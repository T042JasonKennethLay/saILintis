use sea_orm::*;
use sea_orm::prelude::Decimal;
use uuid::Uuid;
use crate::entities::{passengers, passenger_preferences, spending_entries};
use crate::passenger::passenger_model::passenger_model::{
    PassengerResponse, PassengerPreferenceResponse, SpendingEntryResponse, ActivityResponse, CreateScheduleRequest, StaffScheduleResponse
};


pub struct PassengerRepository;

impl PassengerRepository {
    pub async fn create_passenger(
        pool: &DatabaseConnection,display_name: &str,email: &str,username: &str,password_hash: &str,status: &str,vip_contact_channel: Option<String>,) -> Result<Uuid, String> {

        let user_id = crate::auth::auth_repository::auth_repository::AuthRepository::create_user(
            pool,
            display_name,
            email,
            password_hash,
            username,
        ).await?;

        crate::auth::auth_repository::auth_repository::AuthRepository::create_account(pool,username,user_id,).await?;

        let model = passengers::ActiveModel {
            passenger_id: Set(user_id),
            display_name: Set(display_name.to_string()),
            email: Set(email.to_string()),
            status: Set(status.to_string()),
            spending_balance: Set(Decimal::from(0)),
            vip_contact_channel: Set(vip_contact_channel),
        };
        passengers::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;

        if status.to_ascii_lowercase() == "vip" {
            let preference_model = passenger_preferences::ActiveModel {
                preference_id: Set(Uuid::new_v4()),
                passenger_id: Set(user_id),
                cabin_preference: Set(None),
                temperature: Set(None),
                pillow_type: Set(None),
                dietary_notes: Set(None),
                preferred_newspaper: Set(None),
                minibar_preference: Set(Some("Cleared".to_string())),
                special_requests: Set(None),
            };
            passenger_preferences::Entity::insert(preference_model).exec(pool).await.map_err(|e| e.to_string())?;
        }

        Ok(user_id)
    }

    pub async fn get_passenger_by_id(pool: &DatabaseConnection,passenger_id: Uuid,) -> Result<Option<PassengerResponse>, String> {
        let passenger = passengers::Entity::find_by_id(passenger_id).one(pool).await.map_err(|e| e.to_string())?;

        match passenger {
            None => Ok(None),
            Some(p) => {
                let pref = passenger_preferences::Entity::find().filter(passenger_preferences::Column::PassengerId.eq(p.passenger_id)).one(pool).await.map_err(|e| e.to_string())?;

                let preferences = pref.map(|pr| PassengerPreferenceResponse {
                    preference_id: pr.preference_id,
                    passenger_id: pr.passenger_id,
                    cabin_preference: pr.cabin_preference,
                    temperature: pr.temperature,
                    pillow_type: pr.pillow_type,
                    dietary_notes: pr.dietary_notes,
                    preferred_newspaper: pr.preferred_newspaper,
                    minibar_preference: pr.minibar_preference,
                    special_requests: pr.special_requests,
                });

                let user_opt = crate::entities::users::Entity::find_by_id(p.passenger_id).one(pool).await.map_err(|e| e.to_string())?;
                let profile_picture = user_opt.and_then(|u| u.profile_picture);

                Ok(Some(PassengerResponse {
                    passenger_id: p.passenger_id,
                    display_name: p.display_name,
                    email: p.email,
                    status: p.status,
                    spending_balance: p.spending_balance,
                    vip_contact_channel: p.vip_contact_channel,
                    preferences,
                    profile_picture,
                }))
            }
        }
    }

    pub async fn update_passenger_profile(pool: &DatabaseConnection,passenger_id: Uuid,display_name: &str,email: &str,vip_contact_channel: Option<String>,) -> Result<(), String> {
        let passenger = passengers::Entity::find_by_id(passenger_id).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Passenger not found".to_string())?;

        let mut active: passengers::ActiveModel = passenger.into();
        active.display_name = Set(display_name.to_string());
        active.email = Set(email.to_string());
        active.vip_contact_channel = Set(vip_contact_channel);

        active.update(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn update_passenger_preference(pool: &DatabaseConnection,passenger_id: Uuid,cabin_preference: Option<String>,temperature: Option<String>,pillow_type: Option<String>,dietary_notes: Option<String>,preferred_newspaper: Option<String>,minibar_preference: Option<String>,special_requests: Option<String>,) -> Result<(), String> {
        let pref = passenger_preferences::Entity::find().filter(passenger_preferences::Column::PassengerId.eq(passenger_id)).one(pool).await.map_err(|e| e.to_string())?;

        match pref {
            Some(p) => {
                let mut active: passenger_preferences::ActiveModel = p.into();
                active.cabin_preference = Set(cabin_preference);
                active.temperature = Set(temperature);
                active.pillow_type = Set(pillow_type);
                active.dietary_notes = Set(dietary_notes);
                active.preferred_newspaper = Set(preferred_newspaper);
                active.minibar_preference = Set(minibar_preference);
                active.special_requests = Set(special_requests);

                active.update(pool).await.map_err(|e| e.to_string())?;
            }
            None => {
                let preference_model = passenger_preferences::ActiveModel {
                    preference_id: Set(Uuid::new_v4()),
                    passenger_id: Set(passenger_id),
                    cabin_preference: Set(cabin_preference),
                    temperature: Set(temperature),
                    pillow_type: Set(pillow_type),
                    dietary_notes: Set(dietary_notes),
                    preferred_newspaper: Set(preferred_newspaper),
                    minibar_preference: Set(minibar_preference.or(Some("Cleared".to_string()))),
                    special_requests: Set(special_requests),
                };
                passenger_preferences::Entity::insert(preference_model).exec(pool).await.map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub async fn add_spending_entry(pool: &DatabaseConnection,passenger_id: Uuid,description: &str,amount: Decimal,) -> Result<Uuid, String> {
        let passenger = passengers::Entity::find_by_id(passenger_id).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Passenger not found".to_string())?;

        let entry_id = Uuid::new_v4();
        let entry_model = spending_entries::ActiveModel {
            entry_id: Set(entry_id),
            passenger_id: Set(passenger_id),
            description: Set(description.to_string()),
            amount: Set(amount),
            date: Set(chrono::Utc::now().naive_utc()),
        };
        spending_entries::Entity::insert(entry_model).exec(pool).await.map_err(|e| e.to_string())?;

        let mut active_passenger: passengers::ActiveModel = passenger.into();
        let current_balance = active_passenger.spending_balance.unwrap();
        active_passenger.spending_balance = Set(current_balance + amount);
        active_passenger.update(pool).await.map_err(|e| e.to_string())?;

        Ok(entry_id)
    }

    pub async fn list_spending_entries(pool: &DatabaseConnection,passenger_id: Uuid,) -> Result<Vec<SpendingEntryResponse>, String> {
        let entries = spending_entries::Entity::find().filter(spending_entries::Column::PassengerId.eq(passenger_id)).order_by_desc(spending_entries::Column::Date).all(pool).await.map_err(|e| e.to_string())?;

        Ok(entries.into_iter().map(|se| SpendingEntryResponse {
                entry_id: se.entry_id,
                passenger_id: se.passenger_id,
                description: se.description,
                amount: se.amount,
                date: se.date,
            }).collect())
    }

    pub async fn list_passengers(pool: &DatabaseConnection) -> Result<Vec<PassengerResponse>, String> {
        let passenger_models = passengers::Entity::find().order_by_asc(passengers::Column::DisplayName).all(pool).await.map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for p in passenger_models {
            let pref = passenger_preferences::Entity::find().filter(passenger_preferences::Column::PassengerId.eq(p.passenger_id)).one(pool).await.map_err(|e| e.to_string())?;

            let preferences = pref.map(|pr| PassengerPreferenceResponse {
                preference_id: pr.preference_id,
                passenger_id: pr.passenger_id,
                cabin_preference: pr.cabin_preference,
                temperature: pr.temperature,
                pillow_type: pr.pillow_type,
                dietary_notes: pr.dietary_notes,
                preferred_newspaper: pr.preferred_newspaper,
                minibar_preference: pr.minibar_preference,
                special_requests: pr.special_requests,
            });

            let user_opt = crate::entities::users::Entity::find_by_id(p.passenger_id).one(pool).await.map_err(|e| e.to_string())?;
            let profile_picture = user_opt.and_then(|u| u.profile_picture);

            result.push(PassengerResponse {
                passenger_id: p.passenger_id,
                display_name: p.display_name,
                email: p.email,
                status: p.status,
                spending_balance: p.spending_balance,
                vip_contact_channel: p.vip_contact_channel,
                preferences,
                profile_picture,
            });
        }
        Ok(result)
    }

    pub async fn email_exists(pool: &DatabaseConnection, email: &str) -> Result<bool, String> {
        Ok(passengers::Entity::find().filter(passengers::Column::Email.eq(email)).one(pool).await.map_err(|e| e.to_string())?.is_some())
    }

    pub async fn create_log(pool: &DatabaseConnection,action: &str,description: &str,is_flagged: bool,) -> Result<(), String> {
        let model = crate::entities::system_logs::ActiveModel {
            log_id: Set(Uuid::new_v4()),
            account_id: Set(None),
            action: Set(action.to_string()),
            description: Set(description.to_string()),
            timestamp: Set(Some(chrono::Utc::now().naive_utc())),
            is_flagged: Set(Some(is_flagged)),
        };
        crate::entities::system_logs::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_all_activities(pool: &DatabaseConnection) -> Result<Vec<ActivityResponse>, String> {
        let list = crate::entities::activities::Entity::find()
            .all(pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(list
            .into_iter()
            .map(|a| ActivityResponse {
                activity_id: a.activity_id,
                title: a.title,
                category: a.category,
                schedule_time: a.schedule_time,
                location: a.location,
                description: a.description,
                price: a.price,
                icon: a.icon,
            })
            .collect())
    }

    pub async fn has_approved_shift_conflict(pool: &DatabaseConnection, employee_name: &str, shift_date: &str) -> Result<bool, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT COUNT(*) AS cnt FROM staff_schedules WHERE employee_name = $1 AND shift_date = $2 AND status = 'Approved'",
            [employee_name.into(), shift_date.into()]
        )).await.map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let cnt: i64 = r.try_get("", "cnt").unwrap_or(0);
            Ok(cnt > 0)
        } else {
            Ok(false)
        }
    }

    pub async fn create_staff_schedule(pool: &DatabaseConnection, payload: CreateScheduleRequest) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO staff_schedules (employee_name, role_name, shift_date, shift_hours, position, status, requested_by) VALUES ($1, $2, $3, $4, $5, 'Pending', $6)",
            [
                payload.employee_name.into(),
                payload.role_name.into(),
                payload.shift_date.into(),
                payload.shift_hours.into(),
                payload.position.into(),
                payload.requested_by.into(),
            ]
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_employees_by_role(pool: &DatabaseConnection, role_name: &str) -> Result<Vec<String>, String> {
        let rows = pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT u.display_name
            FROM users u
            JOIN user_accounts ua ON ua.user_id = u.user_id
            JOIN roles r          ON r.role_id  = ua.role_id
            WHERE r.role_name = $1 AND ua.is_active = TRUE
            ORDER BY u.display_name ASC
            "#,
            [role_name.into()]
        )).await.map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            let display_name: String = r.try_get("", "display_name").unwrap_or_default();
            res.push(display_name);
        }
        Ok(res)
    }

    pub async fn get_staff_schedules(pool: &DatabaseConnection) -> Result<Vec<StaffScheduleResponse>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT id, employee_name, role_name, shift_date, shift_hours, position, status, requested_by, created_at::text AS created_at_str FROM staff_schedules ORDER BY created_at DESC"
        )).await.map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            let id: i32 = r.try_get("", "id").unwrap_or(0);
            let employee_name: String = r.try_get("", "employee_name").unwrap_or_default();
            let role_name: String = r.try_get("", "role_name").unwrap_or_default();
            let shift_date: String = r.try_get("", "shift_date").unwrap_or_default();
            let shift_hours: String = r.try_get("", "shift_hours").unwrap_or_default();
            let position: String = r.try_get("", "position").unwrap_or_default();
            let status: String = r.try_get("", "status").unwrap_or_default();
            let requested_by: String = r.try_get("", "requested_by").unwrap_or_default();
            let created_at: String = r.try_get("", "created_at_str").unwrap_or_default();

            res.push(StaffScheduleResponse {
                id,
                employee_name,
                role_name,
                shift_date,
                shift_hours,
                position,
                status,
                requested_by,
                created_at,
            });
        }
        Ok(res)
    }
}
