use tauri::State;
use crate::{
    database::database::DbState,
};

use crate::auth::{
    auth_model::auth_model::{
        AuthResponse,
        LoginRequest,
        RegisterRequest,
    },
    auth_service::auth_service::AuthService,
};

#[tauri::command]
pub async fn register(state: State<'_, DbState>,payload: RegisterRequest) -> Result<AuthResponse, String> {
    AuthService::register(&state.pool,payload).await
}

#[tauri::command]
pub async fn login(state: State<'_, DbState>,payload: LoginRequest) -> Result<AuthResponse, String> {
    AuthService::login(&state.pool,payload,).await
}

#[tauri::command]
pub async fn forgot_password(state: State<'_,DbState>,email : String) -> Result<String,String> {
    AuthService::forgot_password(&state.pool, email).await
}

#[tauri::command]
pub async fn get_roles(state: State<'_,DbState>) -> Result<Vec<serde_json::Value>,String> {
    AuthService::get_roles(&state.pool).await
}

#[tauri::command]
pub async fn update_profile(state: State<'_, DbState>,user_id: String,display_name: String,email: String,bio: Option<String>,profile_picture: Option<String>) -> Result<AuthResponse, String> {
    AuthService::update_profile(&state.pool, user_id, display_name, email, bio, profile_picture).await
}

#[tauri::command]
pub async fn change_password(state: State<'_, DbState>,user_id: String,current_password: String,new_password: String) -> Result<String, String> {
    AuthService::change_password(&state.pool, user_id, current_password, new_password).await
}
