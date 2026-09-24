use bcrypt::{hash, verify, DEFAULT_COST};
use sea_orm::*;
use tauri::ipc::RuntimeAuthority;
use uuid::Uuid;

use crate::auth::{
    auth_model::auth_model::{
        AuthResponse,
        LoginRequest,
        RegisterRequest,
    },
    auth_repository::auth_repository::AuthRepository,
    jwt::jwt::create_jwt,
};

pub struct AuthService;

impl AuthService {

    pub async fn register(pool: &DatabaseConnection,payload: RegisterRequest,) -> Result<AuthResponse, String> {
        if AuthRepository::email_exists(pool, &payload.email).await? {
            return Err("Email is already registered".to_string());
        }

        if AuthRepository::username_exists(pool, &payload.username).await? {
            return Err("Username is already in use".to_string());
        }

        let password_hash = hash(&payload.password,DEFAULT_COST).map_err(|e| e.to_string())?;
        let user_id = AuthRepository::create_user(pool,&payload.display_name,&payload.email,&password_hash,&payload.username).await?;

        AuthRepository::create_account(pool,&payload.username,user_id).await?;
        let user = AuthRepository::find_user_by_email(pool, &payload.email).await?.ok_or("failed to make account".to_string())?;

        let token = create_jwt(
            user_id.to_string(),
            user.email.clone(),
            user.username.clone(),
            user.role_id.to_string(),
            user.role_name.clone(),
            user.hierarchy_level,
            user.department.clone(),
            user.accessible_modules.clone()
        )?;

        Ok(AuthResponse {
            token,
            user_id: user.user_id,
            display_name: user.display_name,
            email: user.email,
            username: user.username,
            role_name: user.role_name,
            hierarchy_level: user.hierarchy_level,
            department: user.department,
            accessible_modules: user.accessible_modules,
            is_active: user.is_active,
            last_login: user.last_login,
            bio: user.bio,
            profile_picture: user.profile_picture,
        })
    }

    pub async fn login(pool: &DatabaseConnection,payload: LoginRequest, ) -> Result<AuthResponse, String> {
        let user = AuthRepository::find_user_by_email(pool,&payload.email.trim()).await?.ok_or("Incorrect email or password")?;

        if user.role_name == "Passenger" {
            if !payload.email.trim().contains('@') || payload.email.trim().to_lowercase() != user.email.to_lowercase() {
                return Err("Passenger must log in using email".to_string());
            }
        }

        let valid = verify(&payload.password.trim(),&user.password_hash,).map_err(|e| e.to_string())?;

        if !valid {
            return Err("Incorrect email or password".to_string());
        }

        AuthRepository::update_last_login(pool,user.user_id,).await?;
        let token = create_jwt(
            user.user_id.to_string(),
            user.email.clone(),
            user.username.clone(),
            user.role_id.to_string(),
            user.role_name.clone(),
            user.hierarchy_level,
            user.department.clone(),
            user.accessible_modules.clone(),
        )?;

        Ok(AuthResponse {
             token,
            user_id: user.user_id,
            display_name: user.display_name,
            email: user.email,
            username: user.username,
            role_name: user.role_name,
            hierarchy_level: user.hierarchy_level,
            department: user.department,
            accessible_modules: user.accessible_modules,
            is_active: user.is_active,
            last_login: user.last_login,
            bio: user.bio,
            profile_picture: user.profile_picture,
        })
    }

    fn generate_secure_password() -> String {
        let bytes = uuid::Uuid::new_v4().into_bytes();
        let mut password = String::new();

        let uppercase = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let lowercase = b"abcdefghijklmnopqrstuvwxyz";
        let digits = b"0123456789";
        let symbols = b"!@#$%^&*";

        password.push(uppercase[bytes[0] as usize % uppercase.len()] as char);
        password.push(lowercase[bytes[1] as usize % lowercase.len()] as char);
        password.push(digits[bytes[2] as usize % digits.len()] as char);
        password.push(symbols[bytes[3] as usize % symbols.len()] as char);

        let combined = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        for i in 4..12 {
            password.push(combined[bytes[i] as usize % combined.len()] as char);
        }

        password
    }

    pub async fn forgot_password(pool : &DatabaseConnection,email:String)->Result<String, String> {
        let user_id = AuthRepository::get_user_id_by_email(pool, &email).await?;

        if user_id.is_none(){
            return Err("Email is not registered".to_string());
        }

        let new_password = Self::generate_secure_password();

        let user_id = user_id.unwrap();
        let password_hash=bcrypt::hash(&new_password,bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

        AuthRepository::update_password(pool, user_id, &password_hash).await?;
        AuthRepository::save_reset_request(pool, user_id, &new_password).await?;
        crate::auth::jwt::mailer::send_reset_email(&email, &new_password).await?;

        Ok("Password sent".to_string())
    }

    pub async fn get_roles(pool:&DatabaseConnection) -> Result<Vec<serde_json::Value>,String> {
        let roles = AuthRepository::get_all_roles(pool).await?;
        let result = roles.iter().map(|r|{
            serde_json::json!({
                 "role_id": r.role_id,
                "role_name": r.role_name,
                "department": r.department,
            })
        }).collect();
        Ok(result)
    }

    pub async fn update_profile(pool: &DatabaseConnection,user_id: String,display_name: String,email: String,bio: Option<String>,profile_picture: Option<String>,) -> Result<AuthResponse, String> {

        let uid = uuid::Uuid::parse_str(&user_id).map_err(|e| e.to_string())?;
        AuthRepository::update_profile(pool, uid, &display_name, &email, bio, profile_picture).await?;
        let user = AuthRepository::find_user_by_id(pool, uid).await?.ok_or("Failed to retrieve updated profile data".to_string())?;

        let token = create_jwt(
            user.user_id.to_string(),
            user.email.clone(),
            user.username.clone(),
            user.role_id.to_string(),
            user.role_name.clone(),
            user.hierarchy_level,
            user.department.clone(),
            user.accessible_modules.clone(),
        )?;

        Ok(AuthResponse {
            token,
            user_id: user.user_id,
            display_name: user.display_name,
            email: user.email,
            username: user.username,
            role_name: user.role_name,
            hierarchy_level: user.hierarchy_level,
            department: user.department,
            accessible_modules: user.accessible_modules,
            is_active: user.is_active,
            last_login: user.last_login,
            bio: user.bio,
            profile_picture: user.profile_picture,
        })
    }

    pub async fn change_password(
        pool: &DatabaseConnection,
        user_id: String,
        current_password: String,
        new_password: String,
    ) -> Result<String, String> {
        let uid = uuid::Uuid::parse_str(&user_id).map_err(|e| e.to_string())?;

        let user = AuthRepository::find_user_by_id(pool, uid).await?.ok_or("User not found".to_string())?;

        let valid = verify(&current_password, &user.password_hash).map_err(|e| e.to_string())?;
        if !valid {
            return Err("Old password is incorrect".to_string());
        }

        if current_password == new_password {
            return Err("New password cannot be the same as old password".to_string());
        }

        let hash = hash(&new_password, DEFAULT_COST).map_err(|e| e.to_string())?;
        AuthRepository::update_password(pool, uid, &hash).await?;

        Ok("Password changed successfully".to_string())
    }
}
