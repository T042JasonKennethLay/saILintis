#[allow(non_snake_case)]
pub mod IPublishers;
#[allow(non_snake_case)]
pub mod ISubscribers;
pub mod model;
pub mod service;
pub mod demo;

#[cfg(test)]
mod tests {
    use super::demo::run_observer_demo;
    use crate::database::database::DbState;

    #[tokio::test]
    async fn test_observer_pattern() {
        let db = DbState::connect().await;
        run_observer_demo(&db.pool).await;
    }
}
