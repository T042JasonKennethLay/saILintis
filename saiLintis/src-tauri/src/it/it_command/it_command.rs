use tauri::State;
use crate::database::database::DbState;
use crate::it::{
    it_model::it_model::*,
    it_service::it_service::ItAdminService,
};

#[tauri::command]
pub async fn create_employee_account(state: State<'_, DbState>,payload: CreateEmployeeAccountRequest,) -> Result<EmployeeAccountResponse, String> {
    ItAdminService::create_employee_account(&state.pool, payload).await
}

#[tauri::command]
pub async fn update_employee_role(state: State<'_, DbState>,payload: UpdateEmployeeRoleRequest,) -> Result<EmployeeAccountResponse, String> {
    ItAdminService::update_employee_role(&state.pool, payload).await
}

#[tauri::command]
pub async fn deactivate_employee_account(state: State<'_, DbState>,payload: DeactivateAccountRequest,) -> Result<String, String> {
    ItAdminService::deactivate_account(&state.pool, payload).await
}

#[tauri::command]
pub async fn reactivate_employee_account(state: State<'_, DbState>,account_id: String,) -> Result<String, String> {
    ItAdminService::reactivate_account(&state.pool, account_id).await
}

#[tauri::command]
pub async fn list_employee_accounts(state: State<'_, DbState>,) -> Result<Vec<EmployeeAccountListItem>, String> {
    ItAdminService::list_employee_accounts(&state.pool).await
}

#[tauri::command]
pub async fn list_password_reset_requests(state: State<'_, DbState>,) -> Result<Vec<PasswordResetRequestResponse>, String> {
    ItAdminService::list_password_reset_requests(&state.pool).await
}

#[tauri::command]
pub async fn investigate_suspicious_activity(state: State<'_, DbState>,log_id: String,) -> Result<LogEntryResponse, String> {
    ItAdminService::investigate_suspicious_activity(&state.pool, log_id).await
}

#[tauri::command]
pub async fn list_system_logs(state: State<'_, DbState>,) -> Result<Vec<LogEntryResponse>, String> {
    ItAdminService::list_system_logs(&state.pool).await
}

#[tauri::command]
pub async fn confirm_daily_backup(state: State<'_, DbState>,confirmed_by: String,) -> Result<BackupLogResponse, String>{
    ItAdminService::confirm_daily_backup(&state.pool, confirmed_by).await
}

#[tauri::command]
pub async fn configure_role_settings(state: State<'_, DbState>,payload: ConfigureRoleSettingsRequest,) -> Result<RoleProfileResponse, String> {
    ItAdminService::configure_role_settings(&state.pool, payload).await
}

#[tauri::command]
pub async fn list_backup_logs(state: State<'_, DbState>) -> Result<Vec<BackupLogResponse>, String> {
    ItAdminService::list_backup_logs(&state.pool).await
}

#[tauri::command]
pub async fn export_system_logs_csv(state: State<'_, DbState>) -> Result<String, String> {
    ItAdminService::export_system_logs_csv(&state.pool).await
}

#[tauri::command]
pub async fn export_backup_logs_csv(state: State<'_, DbState>) -> Result<String, String> {
    ItAdminService::export_backup_logs_csv(&state.pool).await
}

