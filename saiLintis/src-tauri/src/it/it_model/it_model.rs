use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateEmployeeAccountRequest {
    pub display_name: String,
    pub email:        String,
    pub password:     String,
    pub username:     String,
    pub employee_id:  String,
    pub role_id:      String,
}

#[derive(Deserialize)]
pub struct UpdateEmployeeRoleRequest {
    pub account_id: String,
    pub role_id:    String,
}

#[derive(Deserialize)]
pub struct DeactivateAccountRequest {
    pub account_id: String,
}

#[derive(Deserialize)]
pub struct ConfigureRoleSettingsRequest {
    pub role_id:             String,
    pub accessible_modules:  Vec<String>,
    pub read_only_modules:   Vec<String>,
    pub restricted_modules:  Vec<String>,
}

#[derive(Serialize)]
pub struct EmployeeAccountResponse {
    pub account_id:   Uuid,
    pub user_id:      Uuid,
    pub username:     String,
    pub employee_id:  Option<String>,
    pub display_name: String,
    pub email:        String,
    pub role_id:      Uuid,
    pub role_name:    String,
    pub department:   String,
    pub is_active:    Option<bool>,
}

#[derive(Serialize)]
pub struct EmployeeAccountListItem {
    pub account_id:   Uuid,
    pub user_id:      Uuid,
    pub username:     String,
    pub employee_id:  Option<String>,
    pub display_name: String,
    pub email:        String,
    pub role_name:    String,
    pub department:   String,
    pub is_active:    Option<bool>,
    pub last_login:   Option<chrono::NaiveDateTime>,
}

#[derive(Serialize)]
pub struct PasswordResetRequestResponse {
    pub request_id:         Uuid,
    pub user_id:            Uuid,
    pub generated_password: String,
    pub requested_at:       Option<chrono::NaiveDateTime>,
}

#[derive(Serialize)]
pub struct LogEntryResponse {
    pub log_id:      Uuid,
    pub account_id:  Option<Uuid>,
    pub action:      String,
    pub description: String,
    pub timestamp:   Option<chrono::NaiveDateTime>,
    pub is_flagged:  bool,
}

#[derive(Serialize)]
pub struct BackupLogResponse {
    pub log_id:       Uuid,
    pub confirmed_at: Option<chrono::NaiveDateTime>,
    pub confirmed_by: Uuid,
    pub status:       String,
}

#[derive(Serialize)]
pub struct RoleProfileResponse {
    pub profile_id:          Uuid,
    pub role_id:             Uuid,
    pub accessible_modules:  Vec<String>,
    pub read_only_modules:   Vec<String>,
    pub restricted_modules:  Vec<String>,
}
