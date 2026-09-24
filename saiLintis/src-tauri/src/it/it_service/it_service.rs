use bcrypt::{hash, DEFAULT_COST};
use sea_orm::DatabaseConnection;
use uuid::Uuid;

use crate::it::{
    it_model::it_model::*,
    it_repository::it_repository::ItAdminRepository,
};

pub struct ItAdminService;

impl ItAdminService {

    pub async fn create_employee_account(pool: &DatabaseConnection, payload: CreateEmployeeAccountRequest) -> Result<EmployeeAccountResponse, String> {
        if payload.email.trim().is_empty()
            || payload.username.trim().is_empty()
            || payload.employee_id.trim().is_empty()
            || payload.password.trim().is_empty()
        {
            return Err("All fields are required".to_string());
        }
        if ItAdminRepository::email_exists(pool, &payload.email).await? {
            return Err("Email is already registered".to_string());
        }
        if ItAdminRepository::username_exists(pool, &payload.username).await? {
            return Err("Username is already in use".to_string());
        }
        if ItAdminRepository::employee_id_exists(pool, &payload.employee_id).await? {
            return Err("Employee ID is already in use".to_string());
        }

        let role_id = Uuid::parse_str(&payload.role_id).map_err(|_| "Invalid role ID".to_string())?;
        let password_hash = hash(&payload.password, DEFAULT_COST).map_err(|e| e.to_string())?;

        let user_id = ItAdminRepository::create_user(pool, &payload.display_name, &payload.email, &password_hash).await?;

        let account_id = ItAdminRepository::create_employee_account(pool, &payload.username, &payload.employee_id, user_id, role_id).await?;

        crate::auth::jwt::mailer::send_welcome_email(&payload.email, &payload.username, &payload.password).await?;

        let res = ItAdminRepository::find_account_by_id(pool, account_id).await?.ok_or("Failed to retrieve new account data".to_string())?;
        let _ = ItAdminRepository::create_log(pool, Some(account_id), "CREATE_ACCOUNT", &format!("Created account for user {}", payload.username), false).await;
        Ok(res)
    }

    pub async fn deactivate_account(pool: &DatabaseConnection, payload: DeactivateAccountRequest) -> Result<String, String> {
        let account_id = Uuid::parse_str(&payload.account_id).map_err(|_| "Invalid account ID".to_string())?;
        ItAdminRepository::deactivate_account(pool, account_id).await?;
        let _ = ItAdminRepository::create_log(pool, Some(account_id), "DEACTIVATE_ACCOUNT", &format!("Deactivated account {}", account_id), false).await;
        Ok("Account successfully deactivated".to_string())
    }

    pub async fn reactivate_account(pool: &DatabaseConnection, account_id: String) -> Result<String, String> {
        let uid = Uuid::parse_str(&account_id).map_err(|_| "Invalid account ID".to_string())?;
        ItAdminRepository::reactivate_account(pool, uid).await?;
        let _ = ItAdminRepository::create_log(pool, Some(uid), "REACTIVATE_ACCOUNT", &format!("Reactivated account {}", uid), false).await;
        Ok("Account successfully reactivated".to_string())
    }

    pub async fn update_employee_role(pool: &DatabaseConnection, payload: UpdateEmployeeRoleRequest) -> Result<EmployeeAccountResponse, String> {
        let account_id = Uuid::parse_str(&payload.account_id).map_err(|_| "Invalid account ID".to_string())?;
        let role_id = Uuid::parse_str(&payload.role_id).map_err(|_| "Invalid role ID".to_string())?;
        ItAdminRepository::update_role(pool, account_id, role_id).await?;
        let res = ItAdminRepository::find_account_by_id(pool, account_id).await?.ok_or("Failed to retrieve account data after update".to_string())?;
        let _ = ItAdminRepository::create_log(pool, Some(account_id), "UPDATE_ROLE", &format!("Updated role for account {} to {}", account_id, role_id), false).await;
        Ok(res)
    }

    pub async fn list_password_reset_requests(pool: &DatabaseConnection) -> Result<Vec<PasswordResetRequestResponse>, String> {
        ItAdminRepository::find_pending_reset_requests(pool).await
    }

    pub async fn investigate_suspicious_activity(pool: &DatabaseConnection, log_id: String) -> Result<LogEntryResponse, String> {
        let uid = Uuid::parse_str(&log_id).map_err(|_| "Invalid log ID".to_string())?;
        ItAdminRepository::get_log_by_id(pool, uid).await?.ok_or("Log not found".to_string())
    }

    pub async fn list_system_logs(pool: &DatabaseConnection) -> Result<Vec<LogEntryResponse>, String> {
        ItAdminRepository::list_all_logs(pool).await
    }

    pub async fn confirm_daily_backup(pool: &DatabaseConnection, confirmed_by: String) -> Result<BackupLogResponse, String> {
        let uid = Uuid::parse_str(&confirmed_by).map_err(|_| "Invalid user ID".to_string())?;
        let res = ItAdminRepository::save_backup_confirmation(pool, uid).await?;
        let _ = ItAdminRepository::create_log(pool, None, "CONFIRM_BACKUP", &format!("Confirmed daily backup by {}", confirmed_by), false).await;
        Ok(res)
    }

    pub async fn configure_role_settings(pool: &DatabaseConnection, payload: ConfigureRoleSettingsRequest) -> Result<RoleProfileResponse, String> {
        let role_id = Uuid::parse_str(&payload.role_id).map_err(|_| "Invalid role ID".to_string())?;
        let res = ItAdminRepository::configure_role_settings(pool, role_id, payload.accessible_modules, payload.read_only_modules, payload.restricted_modules).await?;
        let _ = ItAdminRepository::create_log(pool, None, "CONFIGURE_ROLE", &format!("Configured settings for role {}", role_id), false).await;
        Ok(res)
    }

    pub async fn list_employee_accounts(pool: &DatabaseConnection) -> Result<Vec<EmployeeAccountListItem>, String> {
        ItAdminRepository::list_all_employee_accounts(pool).await
    }

    pub async fn list_backup_logs(pool: &DatabaseConnection) -> Result<Vec<BackupLogResponse>, String> {
        ItAdminRepository::list_backup_logs(pool).await
    }

    pub async fn export_system_logs_csv(pool: &DatabaseConnection) -> Result<String, String> {
        let logs = ItAdminRepository::list_all_logs(pool).await?;
        let mut csv = String::from("log_id,action,description,is_flagged,timestamp\n");
        for log in &logs {
            let desc = log.description.replace('"', "\"\"");
            csv.push_str(&format!(
                "{},{},\"{}\",{},{}\n",
                log.log_id,
                log.action,
                desc,
                log.is_flagged,
                log.timestamp.map(|t| t.to_string()).unwrap_or_default()
            ));
        }
        use base64::{engine::general_purpose, Engine as _};
        Ok(general_purpose::STANDARD.encode(csv.as_bytes()))
    }

    pub async fn export_backup_logs_csv(pool: &DatabaseConnection) -> Result<String, String> {
        let logs = ItAdminRepository::list_backup_logs(pool).await?;
        let mut csv = String::from("log_id,confirmed_at,confirmed_by,status\n");
        for log in &logs {
            csv.push_str(&format!(
                "{},{},{},{}\n",
                log.log_id,
                log.confirmed_at.map(|t| t.to_string()).unwrap_or_default(),
                log.confirmed_by,
                log.status
            ));
        }
        use base64::{engine::general_purpose, Engine as _};
        Ok(general_purpose::STANDARD.encode(csv.as_bytes()))
    }
}
