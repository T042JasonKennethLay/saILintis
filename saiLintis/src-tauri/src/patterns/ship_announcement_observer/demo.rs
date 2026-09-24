use crate::patterns::ship_announcement_observer::IPublishers::Publisher;
use crate::patterns::ship_announcement_observer::model::announcement_publisher::AnnouncementPublisher;
use crate::patterns::ship_announcement_observer::service::passenger_service::PassengerSubscriber;
use crate::patterns::ship_announcement_observer::service::crew_service::CrewSubscriber;
use sea_orm::{DatabaseConnection, ConnectionTrait, Statement, DbBackend};
use uuid::Uuid;

#[allow(dead_code)]
pub async fn run_observer_demo(pool: &DatabaseConnection) {
    let row = pool.query_one(Statement::from_string(
        DbBackend::Postgres,
        "SELECT account_id FROM user_accounts LIMIT 1".to_string(),
    ))
    .await
    .ok()
    .flatten();

    let sent_by = match row {
        Some(r) => r.try_get::<Uuid>("", "account_id").unwrap_or_else(|_| Uuid::new_v4()),
        None => return,
    };

    let p_row = pool.query_one(Statement::from_string(
        DbBackend::Postgres,
        "SELECT passenger_id FROM passengers LIMIT 1".to_string(),
    ))
    .await
    .ok()
    .flatten();

    let passenger_id = match p_row {
        Some(r) => r.try_get::<Uuid>("", "passenger_id").unwrap_or_else(|_| Uuid::new_v4()),
        None => return,
    };

    let mut publisher = AnnouncementPublisher::new();
    let passenger_sub = PassengerSubscriber::new(passenger_id, pool.clone(), sent_by);
    let crew_sub = CrewSubscriber::new("Captain John");

    publisher.subscribe(Box::new(passenger_sub));
    publisher.subscribe(Box::new(crew_sub));

    let payload = serde_json::json!({
        "title": "Storm Warning",
        "content": "Please return to your cabins.",
    });
    let announcement_json = serde_json::to_string(&payload).unwrap();

    publisher.publish(&announcement_json);
}
