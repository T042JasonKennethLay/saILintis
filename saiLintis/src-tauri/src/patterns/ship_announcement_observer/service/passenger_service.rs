use crate::patterns::ship_announcement_observer::ISubscribers::Subscriber;
use sea_orm::DatabaseConnection;
use uuid::Uuid;

pub struct PassengerSubscriber {
    passenger_id: Uuid,
    pool: DatabaseConnection,
    sent_by: Uuid,
}

impl PassengerSubscriber {
    pub fn new(passenger_id: Uuid, pool: DatabaseConnection, sent_by: Uuid) -> Self {
        Self {
            passenger_id,
            pool,
            sent_by,
        }
    }
}

impl Subscriber for PassengerSubscriber {
    fn update(&self, announcement: &str) {
        let pool = self.pool.clone();
        let sent_by = self.sent_by;
        let message = announcement.to_string();
        println!("Passenger subscriber {} received update", self.passenger_id);
        tauri::async_runtime::spawn(async move {
            let alert_id = Uuid::new_v4();
            let _ = crate::medical::medical_repository::medical_repository::MedicalRepository::save_notification(
                &pool,
                alert_id,
                &message,
                sent_by,
                "Passenger",
            )
            .await;
        });
    }

    fn get_id(&self) -> String {
        self.passenger_id.to_string()
    }
}
