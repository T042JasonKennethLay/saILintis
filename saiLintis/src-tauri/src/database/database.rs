use sea_orm::ConnectionTrait;
use sea_orm::Database;
use sea_orm::DatabaseConnection;

pub struct DbState {
    pub pool: DatabaseConnection,
    pub redis_client: Option<redis::Client>,
}

impl DbState {
    pub async fn connect() -> Self {
        dotenvy::dotenv().ok();
        let conn_str = std::env::var("DATABASE_URL").expect("DATABASE_URL is not set");
        let pool = Database::connect(&conn_str).await.expect("Failed to connect to database");

        let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let redis_client = match redis::Client::open(redis_url) {
            Ok(client) => {
                match client.get_async_connection().await {
                    Ok(_) => {
                        println!("Redis Connected successfully!");
                        Some(client)
                    }
                    Err(e) => {
                        eprintln!("Connection failed because: {} ", e);
                        None
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed.... falling back to db..... error because : {}", e);
                None
            }
        };

        DbState { pool, redis_client }
    }
}
