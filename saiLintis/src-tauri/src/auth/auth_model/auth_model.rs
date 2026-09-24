use crate::database::database::DbState;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Deserialize)]
pub struct RegisterRequest{
    pub display_name : String,
    pub email : String,
    pub password: String,
    pub username: String,
}

#[derive(Deserialize)]
pub struct LoginRequest{
    pub email: String,
    pub password : String
}

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
    pub username : String,
    pub role_id : String,
    pub role_name : String,
    pub hierarcy_level : i32,
    pub department : String,
    pub accessible_modules: Vec<String>
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: uuid::Uuid,
    pub display_name: String,
    pub email: String,
    pub username: String,
    pub role_name: String,
    pub hierarchy_level: i32,
    pub department: String,
    pub accessible_modules: Vec<String>,
    pub is_active: Option<bool>,
    pub last_login: Option<chrono::NaiveDateTime>,
    pub bio: Option<String>,
    pub profile_picture: Option<String>,
}

pub struct UserData {
    pub user_id: uuid::Uuid,
    pub display_name: String,
    pub email: String,
    pub password_hash: String,
    pub username: String,
    pub role_id: uuid::Uuid,
    pub role_name: String,
    pub hierarchy_level: i32,
    pub department: String,
    pub accessible_modules: Vec<String>,
    pub is_active: Option<bool>,
    pub last_login: Option<chrono::NaiveDateTime>,
    pub bio: Option<String>,
    pub profile_picture: Option<String>,
}
