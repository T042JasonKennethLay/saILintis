use chrono::Utc;
use sea_orm::*;
use uuid::Uuid;
use crate:: auth::auth_model::auth_model::UserData;
use crate::entities::{password_reset_requests, roles, user_accounts, users};

pub struct AuthRepository;
const PASSENGER_ROLE_ID: &str = "00000000-0000-0000-0000-000000000022";


impl AuthRepository{
    pub async fn email_exists(pool : &DatabaseConnection, email : &str)-> Result<bool,String>{
        let result = users::Entity::find().filter(users::Column::Email.eq(email))
.one(pool).await.map_err(|e| e.to_string())?;
        Ok(result.is_some())
    }

    pub async fn username_exists(pool: &DatabaseConnection,username: &str) -> Result<bool, String>{
        let result =user_accounts::Entity::find().filter(user_accounts::Column::Username.eq(username)).filter(user_accounts::Column::Username.eq(username)).one(pool).await.map_err(|e| e.to_string())?;
        Ok(result.is_some())
    }

    pub async fn create_user(pool: &DatabaseConnection,display_name: &str,email: &str,password_hash: &str,username: &str,) -> Result<Uuid, String> {
        let final_display_name = if display_name.trim().is_empty(){
            username
        } else{
            display_name
        };

        let new_user=users::ActiveModel{
            display_name: Set(final_display_name.to_string()),
            email: Set(email.to_string()),
            password_hash: Set(password_hash.to_string()),
            password_salt: Set(password_hash.to_string()),..std::default::Default::default()
        };

        let result = users::Entity::insert(new_user).exec(pool).await.map_err(|e| e.to_string())?;

        Ok(result.last_insert_id)
    }

    pub async fn create_account( pool: &DatabaseConnection,username: &str,user_id: Uuid) -> Result<(), String> {
         let passenger_role_id = Uuid::parse_str(PASSENGER_ROLE_ID).map_err(|e| e.to_string())?;
         let new_account=user_accounts::ActiveModel{
            username: Set(username.to_string()),
            user_id: Set(user_id),
            role_id: Set(Some(passenger_role_id)),..std::default::Default::default()
         };

         user_accounts::Entity::insert(new_account).exec(pool).await.map_err(|e| e.to_string())?;

         Ok(())
    }

    pub async fn find_user_by_email(pool: &DatabaseConnection,email: &str,) -> Result<Option<UserData>, String> {
                 let result = pool.query_one(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"
            SELECT
                u.user_id,
                u.display_name,
                u.email,
                u.password_hash,
                ua.username,
                ua.is_active,
                ua.last_login,
                u.bio,
                u.profile_picture,
                r.role_id,
                r.role_name,
                r.hierarchy_level,
                r.department,
                rp.accessible_modules
            FROM users u
            JOIN user_accounts ua ON ua.user_id = u.user_id
            JOIN roles r          ON r.role_id  = ua.role_id
            JOIN role_profiles rp ON rp.role_id = r.role_id
            WHERE (LOWER(u.email) = LOWER($1) OR LOWER(ua.username) = LOWER($1) OR LOWER(ua.employee_id) = LOWER($1))
              AND ua.is_active = TRUE
            "#,
            vec![email.into()],
        )).await.map_err(|e| e.to_string())?;

        match result {
            Some(row) => Ok(Some(UserData {
                user_id:           row.try_get("", "user_id").map_err(|e| e.to_string())?,
                display_name:      row.try_get("", "display_name").map_err(|e| e.to_string())?,
                email:             row.try_get("", "email").map_err(|e| e.to_string())?,
                password_hash:     row.try_get("", "password_hash").map_err(|e| e.to_string())?,
                username:          row.try_get("", "username").map_err(|e| e.to_string())?,
                role_id:           row.try_get("", "role_id").map_err(|e| e.to_string())?,
                role_name:         row.try_get("", "role_name").map_err(|e| e.to_string())?,
                hierarchy_level:   row.try_get("", "hierarchy_level").map_err(|e| e.to_string())?,
                department:        row.try_get("", "department").map_err(|e| e.to_string())?,
                accessible_modules: row.try_get("", "accessible_modules").map_err(|e| e.to_string())?,
                is_active:          row.try_get("", "is_active").map_err(|e| e.to_string())?,
                last_login:         row.try_get("", "last_login").map_err(|e| e.to_string())?,
                bio:                row.try_get("", "bio").map_err(|e| e.to_string())?,
                profile_picture:    row.try_get("", "profile_picture").map_err(|e| e.to_string())?,
            })),
            None => Ok(None),
        }
    }

    pub async fn find_user_by_id(pool: &DatabaseConnection,user_id: Uuid,) -> Result<Option<UserData>, String> {
        let result = pool.query_one(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"
            SELECT
                u.user_id,
                u.display_name,
                u.email,
                u.password_hash,
                ua.username,
                ua.is_active,
                ua.last_login,
                u.bio,
                u.profile_picture,
                r.role_id,
                r.role_name,
                r.hierarchy_level,
                r.department,
                rp.accessible_modules
            FROM users u
            JOIN user_accounts ua ON ua.user_id = u.user_id
            JOIN roles r          ON r.role_id  = ua.role_id
            JOIN role_profiles rp ON rp.role_id = r.role_id
            WHERE u.user_id = $1
            "#,
            vec![user_id.into()],
        )).await.map_err(|e| e.to_string())?;

        match result {
            Some(row) => Ok(Some(UserData {
                user_id:           row.try_get("", "user_id").map_err(|e| e.to_string())?,
                display_name:      row.try_get("", "display_name").map_err(|e| e.to_string())?,
                email:             row.try_get("", "email").map_err(|e| e.to_string())?,
                password_hash:     row.try_get("", "password_hash").map_err(|e| e.to_string())?,
                username:          row.try_get("", "username").map_err(|e| e.to_string())?,
                role_id:           row.try_get("", "role_id").map_err(|e| e.to_string())?,
                role_name:         row.try_get("", "role_name").map_err(|e| e.to_string())?,
                hierarchy_level:   row.try_get("", "hierarchy_level").map_err(|e| e.to_string())?,
                department:        row.try_get("", "department").map_err(|e| e.to_string())?,
                accessible_modules: row.try_get("", "accessible_modules").map_err(|e| e.to_string())?,
                is_active:          row.try_get("", "is_active").map_err(|e| e.to_string())?,
                last_login:         row.try_get("", "last_login").map_err(|e| e.to_string())?,
                bio:                row.try_get("", "bio").map_err(|e| e.to_string())?,
                profile_picture:    row.try_get("", "profile_picture").map_err(|e| e.to_string())?,
            })),
            None => Ok(None),
        }
    }

    pub async fn update_profile(pool: &DatabaseConnection, user_id: Uuid, display_name: &str, email: &str, bio: Option<String>, profile_picture: Option<String>,) -> Result<(), String> {

        if email.trim().is_empty() {
            return Err("Email cannot be empty".to_string());
        }
        if display_name.trim().is_empty() {
            return Err("Name cannot be empty".to_string());
        }

        let existing = users::Entity::find().filter(users::Column::Email.eq(email)).filter(users::Column::UserId.ne(user_id)).one(pool).await.map_err(|e| e.to_string())?;

        if existing.is_some() {
            return Err("Email is already registered by another user".to_string());
        }

        let user = users::Entity::find_by_id(user_id).one(pool).await.map_err(|e| e.to_string())?.ok_or("User not found".to_string())?;

        let mut user: users::ActiveModel = user.into();
        user.display_name = Set(display_name.to_string());
        user.email = Set(email.to_string());
        user.bio = Set(bio);
        user.profile_picture = Set(profile_picture);
        user.update(pool).await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_user_id_by_email(pool: &DatabaseConnection, email: &str) -> Result<Option<Uuid>, String> {
        let result = pool.query_one(sea_orm::Statement::from_sql_and_values(sea_orm::DatabaseBackend::Postgres,
        r#"
            SELECT u.user_id
            FROM users u
            JOIN user_accounts ua ON ua.user_id = u.user_id
            WHERE (LOWER(u.email) = LOWER($1) OR LOWER(ua.employee_id = LOWER($1)) AND ua.is_active = TRUE
            "#, vec![email.into()])).await.map_err(|e| e.to_string())?;

        match result {
            Some(row) => {
                let id: Uuid = row.try_get("", "user_id").map_err(|e| e.to_string())?;
                Ok(Some(id))
            }
            None => Ok(None),
        }
    }

    pub async fn update_last_login(pool: &DatabaseConnection,user_id: Uuid,) -> Result<(), String> {
        let account = user_accounts::Entity::find().filter(user_accounts::Column::UserId.eq(user_id)).one(pool).await.map_err(|e| e.to_string())?.ok_or("Account not found".to_string())?;

        let mut account: user_accounts::ActiveModel = account.into();
        account.last_login = Set(Some(Utc::now().naive_utc()));
        account.update(pool).await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn update_password(pool: &DatabaseConnection,user_id: Uuid,password_hash: &str) -> Result<(), String> {
        let user = users::Entity::find_by_id(user_id).one(pool).await.map_err(|e| e.to_string())?.ok_or("User not found".to_string())?;

        let mut user: users::ActiveModel = user.into();
        user.password_hash = Set(password_hash.to_string());
        user.password_salt = Set(password_hash.to_string());
        user.update(pool).await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn save_reset_request(pool: &DatabaseConnection,user_id: Uuid,generated_password: &str) -> Result<(), String> {
        let new_request = password_reset_requests::ActiveModel {
            user_id: Set(user_id),
            generated_password: Set(generated_password.to_string()),..std::default::Default::default()
        };

        password_reset_requests::Entity::insert(new_request).exec(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_all_roles(pool: &DatabaseConnection) -> Result<Vec<crate::entities::roles::Model>, String>{
        roles::Entity::find().all(pool).await.map_err(|e| e.to_string())
    }

}
