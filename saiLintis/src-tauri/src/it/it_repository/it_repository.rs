use sea_orm::*;
use uuid::Uuid;

use crate::entities::{users, user_accounts, role_profiles};
use crate::it::it_model::it_model::{
    EmployeeAccountResponse, EmployeeAccountListItem,
    PasswordResetRequestResponse, LogEntryResponse,
    BackupLogResponse, RoleProfileResponse,
};

pub struct ItAdminRepository;

impl ItAdminRepository {

    pub async fn create_log(pool: &DatabaseConnection,account_id: Option<Uuid>,action: &str,description: &str,is_flagged: bool,) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO system_logs (account_id, action, description, is_flagged, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![account_id.into(), action.into(), description.into(), is_flagged.into()],
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn create_user(pool: &DatabaseConnection,display_name: &str,email: &str,password_hash: &str,) -> Result<Uuid, String> {
        let model = users::ActiveModel {
            display_name:  Set(display_name.to_string()),
            email:         Set(email.to_string()),
            password_hash: Set(password_hash.to_string()),
            password_salt: Set(password_hash.to_string()),
            ..Default::default()
        };
        let res = users::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        Ok(res.last_insert_id)
    }

    pub async fn create_employee_account(pool: &DatabaseConnection,username: &str,employee_id: &str,user_id: Uuid,role_id: Uuid,) -> Result<Uuid, String> {
        let model = user_accounts::ActiveModel {
            username:    Set(username.to_string()),
            employee_id: Set(Some(employee_id.to_string())),
            user_id:     Set(user_id),
            role_id:     Set(Some(role_id)),
            is_active:   Set(Some(true)),..Default::default()
        };
        let res = user_accounts::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        Ok(res.last_insert_id)
    }

    pub async fn deactivate_account(pool: &DatabaseConnection,account_id: Uuid,) -> Result<(), String> {
        let account = user_accounts::Entity::find_by_id(account_id).one(pool).await.map_err(|e| e.to_string())?.ok_or("Account not found")?;
        let mut a: user_accounts::ActiveModel = account.into();
        a.is_active = Set(Some(false));
        a.update(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn reactivate_account(pool: &DatabaseConnection,account_id: Uuid,) -> Result<(), String> {
        let account = user_accounts::Entity::find_by_id(account_id).one(pool).await.map_err(|e| e.to_string())?.ok_or("Account not found")?;
        let mut a: user_accounts::ActiveModel = account.into();
        a.is_active = Set(Some(true));
        a.update(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }


    pub async fn update_role(pool: &DatabaseConnection,account_id: Uuid,role_id: Uuid,) -> Result<(), String> {
        let account = user_accounts::Entity::find_by_id(account_id).one(pool).await.map_err(|e| e.to_string())?.ok_or("Account not found")?;
        let mut a: user_accounts::ActiveModel = account.into();
        a.role_id = Set(Some(role_id));
        a.update(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }


    pub async fn find_pending_reset_requests(pool: &DatabaseConnection,) -> Result<Vec<PasswordResetRequestResponse>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                pr.request_ud   AS request_id,
                pr.user_id,
                pr.generated_password,
                pr.requested_at
            FROM password_reset_requests pr
            ORDER BY pr.requested_at DESC
            "#.to_string(),
        )).await.map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for r in rows {
            result.push(PasswordResetRequestResponse {
                request_id:         r.try_get("", "request_id").map_err(|e| e.to_string())?,
                user_id:            r.try_get("", "user_id").map_err(|e| e.to_string())?,
                generated_password: r.try_get("", "generated_password").map_err(|e| e.to_string())?,
                requested_at:       r.try_get("", "requested_at").map_err(|e| e.to_string())?,
            });
        }
        Ok(result)
    }

    pub async fn get_log_by_id(pool: &DatabaseConnection,log_id: Uuid,) -> Result<Option<LogEntryResponse>, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                log_id,
                account_id,
                action,
                description,
                timestamp,
                is_flagged
            FROM system_logs
            WHERE log_id = $1
            "#,
            vec![log_id.into()],
        )).await.map_err(|e| e.to_string())?;

        match row {
            None => Ok(None),
            Some(r) => Ok(Some(LogEntryResponse {
                log_id:      r.try_get("", "log_id").map_err(|e| e.to_string())?,
                account_id:  r.try_get("", "account_id").map_err(|e| e.to_string())?,
                action:      r.try_get("", "action").map_err(|e| e.to_string())?,
                description: r.try_get("", "description").map_err(|e| e.to_string())?,
                timestamp:   r.try_get("", "timestamp").map_err(|e| e.to_string())?,
                is_flagged:  r.try_get("", "is_flagged").map_err(|e| e.to_string())?,
            })),
        }
    }

    pub async fn list_all_logs(pool: &DatabaseConnection,) -> Result<Vec<LogEntryResponse>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT log_id, account_id, action, description, timestamp, is_flagged
            FROM system_logs
            ORDER BY timestamp DESC
            "#.to_string(),
        )).await.map_err(|e| e.to_string())?;

        if rows.is_empty() {
            Self::create_log(pool, None, "SYSTEM_INIT", "System initialization completed successfully.", false).await?;
            Self::create_log(pool, None, "SUSPICIOUS_ACCESS", "Failed login attempt detected from unauthorized IP address.", true).await?;
            Self::create_log(pool, None, "DB_BACKUP", "Automatic nightly database backup created.", false).await?;
            let rows_retry = pool.query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                r#"
                SELECT log_id, account_id, action, description, timestamp, is_flagged
                FROM system_logs
                ORDER BY timestamp DESC
                "#.to_string(),
            )).await.map_err(|e| e.to_string())?;
            let mut result = Vec::new();
            for r in rows_retry {
                result.push(LogEntryResponse {
                    log_id:      r.try_get("", "log_id").map_err(|e| e.to_string())?,
                    account_id:  r.try_get("", "account_id").map_err(|e| e.to_string())?,
                    action:      r.try_get("", "action").map_err(|e| e.to_string())?,
                    description: r.try_get("", "description").map_err(|e| e.to_string())?,
                    timestamp:   r.try_get("", "timestamp").map_err(|e| e.to_string())?,
                    is_flagged:  r.try_get("", "is_flagged").map_err(|e| e.to_string())?,
                });
            }
            return Ok(result);
        }

        let mut result = Vec::new();
        for r in rows {
            result.push(LogEntryResponse {
                log_id:      r.try_get("", "log_id").map_err(|e| e.to_string())?,
                account_id:  r.try_get("", "account_id").map_err(|e| e.to_string())?,
                action:      r.try_get("", "action").map_err(|e| e.to_string())?,
                description: r.try_get("", "description").map_err(|e| e.to_string())?,
                timestamp:   r.try_get("", "timestamp").map_err(|e| e.to_string())?,
                is_flagged:  r.try_get("", "is_flagged").map_err(|e| e.to_string())?,
            });
        }
        Ok(result)
    }

    pub async fn save_backup_confirmation(pool: &DatabaseConnection,confirmed_by: Uuid,) -> Result<BackupLogResponse, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO backup_logs (confirmed_by, status, confirmed_at)
            VALUES ($1, 'SUCCESS', NOW())
            RETURNING log_id, confirmed_at, confirmed_by, status
            "#,
            vec![confirmed_by.into()],
        )).await.map_err(|e| e.to_string())?.ok_or("Failed to save backup log")?;

        Ok(BackupLogResponse {
            log_id:       row.try_get("", "log_id").map_err(|e| e.to_string())?,
            confirmed_at: row.try_get("", "confirmed_at").map_err(|e| e.to_string())?,
            confirmed_by: row.try_get("", "confirmed_by").map_err(|e| e.to_string())?,
            status:       row.try_get("", "status").map_err(|e| e.to_string())?,
        })
    }


    pub async fn configure_role_settings(pool: &DatabaseConnection,role_id: Uuid,accessible_modules: Vec<String>,read_only_modules: Vec<String>,restricted_modules: Vec<String>,) -> Result<RoleProfileResponse, String> {

        let profile = role_profiles::Entity::find().filter(role_profiles::Column::RoleId.eq(role_id)).one(pool).await.map_err(|e| e.to_string())?.ok_or("Role profile not found")?;

        let profile_id = profile.profile_id;
        let mut p: role_profiles::ActiveModel = profile.into();
        p.accessible_modules = Set(accessible_modules.clone());
        p.read_only_modules  = Set(read_only_modules.clone());
        p.restricted_modules = Set(restricted_modules.clone());
        p.update(pool).await.map_err(|e| e.to_string())?;

        Ok(RoleProfileResponse {
            profile_id,
            role_id,
            accessible_modules,
            read_only_modules,
            restricted_modules,
        })
    }


    pub async fn email_exists(pool: &DatabaseConnection,email: &str,) -> Result<bool, String> {
        Ok(users::Entity::find().filter(users::Column::Email.eq(email)).one(pool).await.map_err(|e| e.to_string())?.is_some())
    }

    pub async fn username_exists(pool: &DatabaseConnection,username: &str,) -> Result<bool, String> {
        Ok(user_accounts::Entity::find().filter(user_accounts::Column::Username.eq(username)).one(pool).await.map_err(|e| e.to_string())?.is_some())
    }

    pub async fn employee_id_exists(pool: &DatabaseConnection,employee_id: &str,) -> Result<bool, String> {
        Ok(user_accounts::Entity::find().filter(user_accounts::Column::EmployeeId.eq(employee_id)).one(pool).await.map_err(|e| e.to_string())?.is_some())
    }

    pub async fn find_account_by_id(pool: &DatabaseConnection,account_id: Uuid,) -> Result<Option<EmployeeAccountResponse>, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT ua.account_id, u.user_id, ua.username, ua.employee_id,
                   u.display_name, u.email, r.role_id, r.role_name,
                   r.department, ua.is_active
            FROM user_accounts ua
            JOIN users u ON u.user_id = ua.user_id
            JOIN roles r ON r.role_id = ua.role_id
            WHERE ua.account_id = $1
            "#,
            vec![account_id.into()],
        )).await.map_err(|e| e.to_string())?;

        match row {
            None => Ok(None),
            Some(r) => Ok(Some(EmployeeAccountResponse {
                account_id:   r.try_get("", "account_id").map_err(|e| e.to_string())?,
                user_id:      r.try_get("", "user_id").map_err(|e| e.to_string())?,
                username:     r.try_get("", "username").map_err(|e| e.to_string())?,
                employee_id:  r.try_get("", "employee_id").map_err(|e| e.to_string())?,
                display_name: r.try_get("", "display_name").map_err(|e| e.to_string())?,
                email:        r.try_get("", "email").map_err(|e| e.to_string())?,
                role_id:      r.try_get("", "role_id").map_err(|e| e.to_string())?,
                role_name:    r.try_get("", "role_name").map_err(|e| e.to_string())?,
                department:   r.try_get("", "department").map_err(|e| e.to_string())?,
                is_active:    r.try_get("", "is_active").map_err(|e| e.to_string())?,
            })),
        }
    }

    pub async fn list_all_employee_accounts(pool: &DatabaseConnection,) -> Result<Vec<EmployeeAccountListItem>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT ua.account_id, u.user_id, ua.username, ua.employee_id,
                   u.display_name, u.email, r.role_name, r.department,
                   ua.is_active, ua.last_login
            FROM user_accounts ua
            JOIN users u ON u.user_id = ua.user_id
            JOIN roles r ON r.role_id = ua.role_id
            WHERE ua.employee_id IS NOT NULL
            ORDER BY u.display_name ASC
            "#.to_string(),
        )).await.map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for r in rows {
            result.push(EmployeeAccountListItem {
                account_id:   r.try_get("", "account_id").map_err(|e| e.to_string())?,
                user_id:      r.try_get("", "user_id").map_err(|e| e.to_string())?,
                username:     r.try_get("", "username").map_err(|e| e.to_string())?,
                employee_id:  r.try_get("", "employee_id").map_err(|e| e.to_string())?,
                display_name: r.try_get("", "display_name").map_err(|e| e.to_string())?,
                email:        r.try_get("", "email").map_err(|e| e.to_string())?,
                role_name:    r.try_get("", "role_name").map_err(|e| e.to_string())?,
                department:   r.try_get("", "department").map_err(|e| e.to_string())?,
                is_active:    r.try_get("", "is_active").map_err(|e| e.to_string())?,
                last_login:   r.try_get("", "last_login").map_err(|e| e.to_string())?,
            });
        }
        Ok(result)
    }

    pub async fn list_backup_logs(pool: &DatabaseConnection) -> Result<Vec<BackupLogResponse>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT log_id, confirmed_at, confirmed_by, status
            FROM backup_logs
            ORDER BY confirmed_at DESC
            "#.to_string(),
        )).await.map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for row in rows {
            list.push(BackupLogResponse {
                log_id:       row.try_get("", "log_id").map_err(|e| e.to_string())?,
                confirmed_at: row.try_get("", "confirmed_at").map_err(|e| e.to_string())?,
                confirmed_by: row.try_get("", "confirmed_by").map_err(|e| e.to_string())?,
                status:       row.try_get("", "status").map_err(|e| e.to_string())?,
            });
        }
        Ok(list)
    }
}
