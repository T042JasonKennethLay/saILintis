use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpmPassengerResponse {
    pub passenger_id: String,
    pub display_name: String,
    pub email: String,
    pub status: String,
    pub cabin_number: Option<String>,
    pub checkin_status: String,
    pub checkin_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpmTimelineResponse {
    pub id: i32,
    pub passenger_id: String,
    pub display_name: String,
    pub checkin_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffSchedule {
    pub id: i32,
    pub employee_name: String,
    pub role_name: String,
    pub shift_date: String,
    pub shift_hours: String,
    pub position: String,
    pub status: String,
    pub requested_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateScheduleRequest {
    pub employee_name: String,
    pub role_name: String,
    pub shift_date: String,
    pub shift_hours: String,
    pub position: String,
    pub requested_by: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EscalateRequest {
    pub description: String,
    pub location: String,
    pub severity: String,
    pub submitted_by: String,
}
