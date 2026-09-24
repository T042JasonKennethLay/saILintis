use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveDateTime;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MedicalClearanceResponse {
    pub clearance_id: Uuid,
    pub incident_id: Uuid,
    pub fit_to_continue: bool,
    pub assessment_notes: String,
    pub issued_at: NaiveDateTime,
    pub issued_by: Uuid,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateMedicalClearanceRequest {
    pub incident_id: String,
    pub fit_to_continue: bool,
    pub assessment_notes: String,
    pub issued_by: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MedicalPassengerProfile {
    pub passenger_id: Uuid,
    pub display_name: String,
    pub email: String,
    pub status: String,
    pub cabin_preference: Option<String>,
    pub dietary_notes: Option<String>,
    pub special_requests: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LogActionRequest {
    pub account_id: String,
    pub action: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotificationItem {
    pub alert_id: String,
    pub message: String,
    pub sent_at: String,
    pub recipients: String,
    pub is_read: bool,
}
