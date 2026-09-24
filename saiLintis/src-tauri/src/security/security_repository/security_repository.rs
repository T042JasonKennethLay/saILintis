use sea_orm::*;
use uuid::Uuid;

use crate::security::security_model::security_model::*;

pub struct SecurityRepository;

impl SecurityRepository {
    pub async fn list_zones(pool: &DatabaseConnection) -> Result<Vec<ZoneResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"SELECT zone_id, zone_name, passenger_density, activity_score FROM zones ORDER BY zone_id;"#,
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut zones = Vec::new();
        for row in rows {
            let zone_id: String = row.try_get("", "zone_id").map_err(|e| e.to_string())?;
            let zone_name: String = row.try_get("", "zone_name").map_err(|e| e.to_string())?;
            let passenger_density: String = row.try_get("", "passenger_density").map_err(|e| e.to_string())?;
            let activity_score: i32 = row.try_get("", "activity_score").map_err(|e| e.to_string())?;
            zones.push(ZoneResponse { zone_id, zone_name, passenger_density, activity_score });
        }
        Ok(zones)
    }

    pub async fn get_zone_by_id(pool: &DatabaseConnection, zone_id: &str) -> Result<Option<ZoneResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"SELECT zone_id, zone_name, passenger_density, activity_score FROM zones WHERE zone_id = $1;"#,
            vec![zone_id.into()],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        if let Some(row) = rows.into_iter().next() {
            let zone_id: String = row.try_get("", "zone_id").map_err(|e| e.to_string())?;
            let zone_name: String = row.try_get("", "zone_name").map_err(|e| e.to_string())?;
            let passenger_density: String = row.try_get("", "passenger_density").map_err(|e| e.to_string())?;
            let activity_score: i32 = row.try_get("", "activity_score").map_err(|e| e.to_string())?;
            Ok(Some(ZoneResponse { zone_id, zone_name, passenger_density, activity_score }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_zone_crew(pool: &DatabaseConnection, zone_id: &str) -> Result<Vec<ZoneCrewResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT ua.account_id, ua.username, u.display_name, r.role_name, r.department
            FROM zone_crew_assignments zca
            JOIN user_accounts ua ON zca.account_id = ua.account_id
            JOIN users u ON ua.user_id = u.user_id
            JOIN roles r ON ua.role_id = r.role_id
            WHERE zca.zone_id = $1 AND r.department = 'Security';
            "#,
            vec![zone_id.into()],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut crew = Vec::new();
        for row in rows {
            let account_id: Uuid = row.try_get("", "account_id").map_err(|e| e.to_string())?;
            let username: String = row.try_get("", "username").map_err(|e| e.to_string())?;
            let display_name: String = row.try_get("", "display_name").map_err(|e| e.to_string())?;
            let role_name: String = row.try_get("", "role_name").map_err(|e| e.to_string())?;
            let department: String = row.try_get("", "department").map_err(|e| e.to_string())?;
            crew.push(ZoneCrewResponse { account_id, username, display_name, role_name, department });
        }
        Ok(crew)
    }

    pub async fn send_zone_alert(pool: &DatabaseConnection,zone_id: &str,message: &str,sent_by_user_id: Uuid,recipients: &str,) -> Result<Uuid, String> {
        let account_row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"SELECT account_id FROM user_accounts WHERE user_id = $1 LIMIT 1"#,
            vec![sent_by_user_id.into()],
        )).await.map_err(|e| e.to_string())?;

        let account_id: Uuid = match account_row {
            Some(row) => row.try_get("", "account_id").map_err(|e| e.to_string())?,
            None => return Err("Sender account not found".to_string()),
        };

        let alert_id = Uuid::new_v4();
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO zone_alerts (alert_id, zone_id, message, sent_by, sent_at, status, recipients)
            VALUES ($1, $2, $3, $4, NOW(), 'Active', $5);
            "#,
            vec![
                alert_id.into(),
                zone_id.into(),
                message.into(),
                account_id.into(),
                recipients.into(),
            ],
        ))
        .await
        .map_err(|e| e.to_string())?;

        let zone_name = match Self::get_zone_by_id(pool, zone_id).await {
            Ok(Some(z)) => z.zone_name,
            _ => zone_id.to_string(),
        };

        let _ = Self::create_log(
            pool,
            Some(account_id),
            "SEND_ZONE_ALERT",
            &format!("Zone alert dispatched to {} recipients in {}", recipients, zone_name),
            false,
        ).await;

        Ok(alert_id)
    }

    pub async fn close_zone_alert(pool: &DatabaseConnection,alert_id: Uuid,closed_by_user_id: Uuid,) -> Result<(), String> {
        let account_row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"SELECT account_id FROM user_accounts WHERE user_id = $1 LIMIT 1"#,
            vec![closed_by_user_id.into()],
        )).await.map_err(|e| e.to_string())?;

        let account_id: Uuid = match account_row {
            Some(row) => row.try_get("", "account_id").map_err(|e| e.to_string())?,
            None => return Err("Closer account not found".to_string()),
        };

        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"UPDATE zone_alerts SET status = 'Resolved' WHERE alert_id = $1;"#,
            vec![alert_id.into()],
        ))
        .await
        .map_err(|e| e.to_string())?;

        let _ = Self::create_log(
            pool,
            Some(account_id),
            "CLOSE_ZONE_ALERT",
            &format!("Zone alert {} marked as resolved", alert_id),
            false,
        ).await;

        Ok(())
    }

    pub async fn list_zone_alerts(pool: &DatabaseConnection) -> Result<Vec<ZoneAlertResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT za.alert_id, za.zone_id, za.message, za.sent_by,
                   u.display_name AS sent_by_name,
                   za.sent_at::TEXT AS sent_at, za.status, za.recipients
            FROM zone_alerts za
            JOIN user_accounts ua ON za.sent_by = ua.account_id
            JOIN users u ON ua.user_id = u.user_id
            ORDER BY za.sent_at DESC;
            "#,
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for row in rows {
            let alert_id: Uuid = row.try_get("", "alert_id").map_err(|e| e.to_string())?;
            let zone_id: String = row.try_get("", "zone_id").map_err(|e| e.to_string())?;
            let message: String = row.try_get("", "message").map_err(|e| e.to_string())?;
            let sent_by: Uuid = row.try_get("", "sent_by").map_err(|e| e.to_string())?;
            let sent_by_name: String = row.try_get("", "sent_by_name").map_err(|e| e.to_string())?;
            let sent_at: String = row.try_get("", "sent_at").map_err(|e| e.to_string())?;
            let status: String = row.try_get("", "status").map_err(|e| e.to_string())?;
            let recipients: String = row.try_get("", "recipients").map_err(|e| e.to_string())?;
            list.push(ZoneAlertResponse {
                alert_id,
                zone_id,
                message,
                sent_by,
                sent_by_name,
                sent_at,
                status,
                recipients,
            });
        }
        Ok(list)
    }

    async fn create_log(pool: &DatabaseConnection,account_id: Option<Uuid>,action: &str,description: &str,is_flagged: bool,) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO system_logs (account_id, action, description, is_flagged, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![account_id.into(), action.into(), description.into(), is_flagged.into()],
        ))
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
