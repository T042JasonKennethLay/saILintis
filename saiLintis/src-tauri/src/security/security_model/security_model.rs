use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Debug)]
pub struct ZoneResponse {
    pub zone_id: String,
    pub zone_name: String,
    pub passenger_density: String,
    pub activity_score: i32,
}

#[derive(Serialize, Debug)]
pub struct ZoneCrewResponse {
    pub account_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub role_name: String,
    pub department: String,
}

#[derive(Deserialize, Debug)]
pub struct SendZoneAlertRequest {
    pub zone_id: String,
    pub message: String,
    pub sent_by: String,
}

#[derive(Serialize, Debug)]
pub struct ZoneAlertResponse {
    pub alert_id: Uuid,
    pub zone_id: String,
    pub message: String,
    pub sent_by: Uuid,
    pub sent_by_name: String,
    pub sent_at: String,
    pub status: String,
    pub recipients: String,
}
