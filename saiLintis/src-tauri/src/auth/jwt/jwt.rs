use jsonwebtoken::{encode, EncodingKey, Header};
use crate::auth::auth_model::auth_model::Claims;

pub fn create_jwt(user_id: String,email : String, username:String,role_id:String,role_name:String, hierarcy_level : i32,department:String,accessible_modules: Vec<String>) -> Result<String,String>{
    dotenvy::dotenv().ok();

    let secret = std::env::var("JWT_SECRET").map_err(|_| "JWT_SECRET ga ada ".to_string())?;
    let exp = chrono::Utc::now().checked_add_signed(chrono::Duration::hours(24)).unwrap().timestamp() as usize;
    let claims= Claims{
        sub: user_id,
        email,
        exp,
        username,
        role_id,
        role_name,
        hierarcy_level,
        department,
        accessible_modules,
    };

    encode(&Header::default(),&claims,&EncodingKey::from_secret(secret.as_bytes())).map_err(|e| e.to_string())
}
