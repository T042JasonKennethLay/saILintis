use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Clone, Debug)]
pub struct CabinResponse {
    pub cabin_number: String,
    pub category: String,
    pub status: String,
    pub assigned_passenger_id: Option<String>,
    pub assigned_passenger_name: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct FdoPassengerResponse {
    pub passenger_id: String,
    pub display_name: String,
    pub email: String,
    pub status: String,
    pub checkin_status: String,
    pub cabin_number: Option<String>,
    pub is_vip: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct ComplaintResponse {
    pub incident_id: String,
    pub passenger_name: Option<String>,
    pub subject: String,
    pub description: String,
    pub severity: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ChatMessageResponse {
    pub message_id: String,
    pub passenger_id: String,
    pub sender_role: String,
    pub sender_name: String,
    pub message_body: String,
    pub created_at: String,
    pub is_read: bool,
}

#[derive(Deserialize, Debug)]
pub struct SendChatMessageRequest {
    pub passenger_id: String,
    pub sender_id: String,
    pub sender_role: String,
    pub message_body: String,
}

#[derive(Deserialize, Debug)]
pub struct AssignCabinRequest {
    pub cabin_number: String,
    pub passenger_id: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdatePassengerStatusRequest {
    pub passenger_id: String,
    pub new_status: String,
}

#[derive(Deserialize, Debug)]
pub struct ResolveComplaintRequest {
    pub incident_id: String,
    pub resolved_by: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ChatQueueEntry {
    pub passenger_id: String,
    pub display_name: String,
    pub is_vip: bool,
    pub vip_contact_channel: Option<String>,
    pub unread_count: i64,
    pub last_message: Option<String>,
    pub last_message_at: Option<String>,
}

#[allow(dead_code)]
pub struct PlaceholderForUuid {
    pub _id: Uuid,
}
