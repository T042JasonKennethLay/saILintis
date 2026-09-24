pub mod model;
pub mod state;
pub mod demo;

#[cfg(test)]
mod tests {
    use super::demo::run_state_demo;
    use crate::database::database::DbState;

    #[tokio::test]
    async fn test_state_pattern() {
        let db = DbState::connect().await;
        run_state_demo(&db.pool).await;
    }
}
