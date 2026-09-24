use sea_orm::*;
use uuid::Uuid;
use crate::entities::{passengers, passenger_preferences, medical_clearances, medical_incidents, system_logs, zone_alerts};
use crate::medical::medical_model::medical_model::{MedicalPassengerProfile, NotificationItem};

pub struct MedicalRepository;

impl MedicalRepository {
    pub async fn get_passenger_medical_profile(pool: &DatabaseConnection, passenger_id: Uuid) -> Result<Option<MedicalPassengerProfile>, String> {
        let passenger = passengers::Entity::find_by_id(passenger_id)
            .one(pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(p) = passenger {
            let pref = passenger_preferences::Entity::find()
                .filter(passenger_preferences::Column::PassengerId.eq(passenger_id))
                .one(pool)
                .await
                .map_err(|e| e.to_string())?;

            let (cabin, dietary, special) = match pref {
                Some(pr) => (pr.cabin_preference, pr.dietary_notes, pr.special_requests),
                None => (None, None, None),
            };

            Ok(Some(MedicalPassengerProfile {
                passenger_id: p.passenger_id,
                display_name: p.display_name,
                email: p.email,
                status: p.status,
                cabin_preference: cabin,
                dietary_notes: dietary,
                special_requests: special,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn save_medical_clearance(
        pool: &DatabaseConnection,
        clearance_id: Uuid,
        incident_id: Uuid,
        fit_to_continue: bool,
        assessment_notes: &str,
        issued_by: Uuid,
    ) -> Result<(), String> {
        let active = medical_clearances::ActiveModel {
            clearance_id: Set(clearance_id),
            incident_id: Set(incident_id),
            fit_to_continue: Set(fit_to_continue),
            assessment_notes: Set(assessment_notes.to_string()),
            issued_at: Set(chrono::Local::now().naive_local()),
            issued_by: Set(issued_by),
        };
        medical_clearances::Entity::insert(active)
            .exec(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn update_passenger_status(
        pool: &DatabaseConnection,
        passenger_id: Uuid,
        status: &str,
    ) -> Result<(), String> {
        let passenger = passengers::Entity::find_by_id(passenger_id)
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Passenger not found".to_string())?;

        let mut active: passengers::ActiveModel = passenger.into();
        active.status = Set(status.to_string());
        active.update(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn set_clearance_issued_in_incident(
        pool: &DatabaseConnection,
        incident_id: Uuid,
        issued: bool,
    ) -> Result<(), String> {
        let med_inc = medical_incidents::Entity::find_by_id(incident_id)
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Medical incident not found".to_string())?;

        let mut active: medical_incidents::ActiveModel = med_inc.into();
        active.clearance_issued = Set(issued);
        active.update(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn save_notification(
        pool: &DatabaseConnection,
        alert_id: Uuid,
        message: &str,
        input_sent_by: Uuid,
        recipient_role: &str,
    ) -> Result<(), String> {
        let mut resolved_sent_by = input_sent_by;
        let lookup_row = pool.query_one(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            "SELECT account_id FROM user_accounts WHERE user_id = $1 LIMIT 1",
            vec![input_sent_by.into()],
        )).await.map_err(|e| e.to_string())?;

        if let Some(r) = lookup_row {
            resolved_sent_by = r.try_get("", "account_id").map_err(|e| e.to_string())?;
        }

        let active = zone_alerts::ActiveModel {
            alert_id: Set(alert_id),
            zone_id: Set("ALL".to_string()),
            message: Set(message.to_string()),
            sent_by: Set(resolved_sent_by),
            sent_at: Set(chrono::Local::now().naive_local()),
            status: Set("Active".to_string()),
            recipients: Set(recipient_role.to_string()),
        };
        zone_alerts::Entity::insert(active)
            .exec(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn record_action(
        pool: &DatabaseConnection,
        log_id: Uuid,
        input_id: Option<Uuid>,
        action: &str,
        description: &str,
    ) -> Result<(), String> {
        let mut resolved_account_id = None;
        if let Some(uid) = input_id {
            let check_row = pool.query_one(sea_orm::Statement::from_sql_and_values(
                sea_orm::DatabaseBackend::Postgres,
                "SELECT account_id FROM user_accounts WHERE account_id = $1 LIMIT 1",
                vec![uid.into()],
            )).await.map_err(|e| e.to_string())?;

            if check_row.is_some() {
                resolved_account_id = Some(uid);
            } else {
                let lookup_row = pool.query_one(sea_orm::Statement::from_sql_and_values(
                    sea_orm::DatabaseBackend::Postgres,
                    "SELECT account_id FROM user_accounts WHERE user_id = $1 LIMIT 1",
                    vec![uid.into()],
                )).await.map_err(|e| e.to_string())?;

                if let Some(r) = lookup_row {
                    let acc_id: Uuid = r.try_get("", "account_id").map_err(|e| e.to_string())?;
                    resolved_account_id = Some(acc_id);
                }
            }
        }

        let active = system_logs::ActiveModel {
            log_id: Set(log_id),
            account_id: Set(resolved_account_id),
            action: Set(action.to_string()),
            description: Set(description.to_string()),
            timestamp: Set(Some(chrono::Local::now().naive_local())),
            is_flagged: Set(Some(false)),
        };
        system_logs::Entity::insert(active)
            .exec(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn ensure_is_read_column(pool: &DatabaseConnection) {
        let _ = pool.execute(sea_orm::Statement::from_string(
            sea_orm::DatabaseBackend::Postgres,
            "ALTER TABLE zone_alerts ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE".to_string(),
        )).await;
    }

    pub async fn get_notifications(pool: &DatabaseConnection, recipient_role: &str) -> Result<Vec<NotificationItem>, String> {
        let rows = pool.query_all(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            "SELECT alert_id, message, sent_at, recipients, COALESCE(is_read, FALSE) AS is_read FROM zone_alerts WHERE recipients = $1 OR recipients = 'All' ORDER BY sent_at DESC LIMIT 50",
            vec![recipient_role.into()],
        )).await.map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        for row in rows {
            let alert_id: Uuid = row.try_get("", "alert_id").map_err(|e| e.to_string())?;
            let message: String = row.try_get("", "message").map_err(|e| e.to_string())?;
            let sent_at: chrono::NaiveDateTime = row.try_get("", "sent_at").map_err(|e| e.to_string())?;
            let recipients: String = row.try_get("", "recipients").map_err(|e| e.to_string())?;
            let is_read: bool = row.try_get("", "is_read").unwrap_or(false);
            items.push(NotificationItem {
                alert_id: alert_id.to_string(),
                message,
                sent_at: sent_at.format("%Y-%m-%d %H:%M").to_string(),
                recipients,
                is_read,
            });
        }
        Ok(items)
    }

    pub async fn mark_notification_read(pool: &DatabaseConnection, alert_id: Uuid) -> Result<(), String> {
        pool.execute(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            "UPDATE zone_alerts SET is_read = TRUE WHERE alert_id = $1",
            vec![alert_id.into()],
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn mark_all_notifications_read(pool: &DatabaseConnection, recipient_role: &str) -> Result<(), String> {
        pool.execute(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            "UPDATE zone_alerts SET is_read = TRUE WHERE recipients = $1 OR recipients = 'All'",
            vec![recipient_role.into()],
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
