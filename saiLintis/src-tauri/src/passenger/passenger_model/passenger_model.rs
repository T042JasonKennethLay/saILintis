use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::prelude::Decimal;

#[derive(Deserialize)]
pub struct CreatePassengerRequest {
    pub display_name: String,
    pub email: String,
    pub username: String,
    pub password: String,
    pub status: String,
    pub vip_contact_channel: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePassengerProfileRequest {
    pub passenger_id: String,
    pub display_name: String,
    pub email: String,
    pub vip_contact_channel: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePassengerPreferenceRequest {
    pub passenger_id: String,
    pub cabin_preference: Option<String>,
    pub temperature: Option<String>,
    pub pillow_type: Option<String>,
    pub dietary_notes: Option<String>,
    pub preferred_newspaper: Option<String>,
    pub minibar_preference: Option<String>,
    pub special_requests: Option<String>,
}

#[derive(Deserialize)]
pub struct AddSpendingEntryRequest {
    pub passenger_id: String,
    pub description: String,
    pub amount: String
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PassengerPreferenceResponse {
    pub preference_id: Uuid,
    pub passenger_id: Uuid,
    pub cabin_preference: Option<String>,
    pub temperature: Option<String>,
    pub pillow_type: Option<String>,
    pub dietary_notes: Option<String>,
    pub preferred_newspaper: Option<String>,
    pub minibar_preference: Option<String>,
    pub special_requests: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PassengerResponse {
    pub passenger_id: Uuid,
    pub display_name: String,
    pub email: String,
    pub status: String,
    pub spending_balance: Decimal,
    pub vip_contact_channel: Option<String>,
    pub preferences: Option<PassengerPreferenceResponse>,
    pub profile_picture: Option<String>,
}

#[derive(Serialize)]
pub struct SpendingEntryResponse {
    pub entry_id: Uuid,
    pub passenger_id: Uuid,
    pub description: String,
    pub amount: Decimal,
    pub date: chrono::NaiveDateTime,
}

#[derive(Deserialize)]
pub struct ReserveSeatRequest {
    pub passenger_id: String,
    pub entertainment_id: String,
    pub seat_number: String,
}

#[derive(Deserialize)]
pub struct ApproveSeatRequest {
    pub performance_title: String,
    pub seat_number: String,
    pub approved_by: String,
}

#[derive(Deserialize)]
pub struct ReserveDiningTableRequest {
    pub passenger_id: String,
    pub table_id: String,
    pub dietary_request: String,
}

#[derive(Deserialize)]
pub struct RequestMedicalSupportRequest {
    pub passenger_id: String,
    pub cabin_number: String,
    pub request_type: String,
    pub severity: String,
}

#[derive(Deserialize)]
pub struct OrderRoomServiceRequest {
    pub passenger_id: String,
    pub items: Vec<String>,
    pub total_price: String
}

#[derive(Deserialize)]
pub struct SubmitFeedbackRequest {
    pub passenger_id: String,
    pub subject: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct AnnouncementResponse {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub date: String,
}

#[derive(Serialize)]
pub struct SpendingSummaryResponse {
    pub total_spent: Decimal,
    pub budget_limit: Decimal,
    pub remaining_budget: Decimal,
}

#[derive(Serialize)]
pub struct PerformanceDetail {
    pub performance_id: Uuid,
    pub title: String,
    pub schedule_date: String,
    pub schedule_time: String,
    pub status: String,
    pub current_occupancy: i32,
    pub total_capacity: i32,
}

#[derive(Serialize)]
pub struct ActivityResponse {
    pub activity_id: String,
    pub title: String,
    pub category: String,
    pub schedule_time: String,
    pub location: String,
    pub description: String,
    pub price: Decimal,
    pub icon: String,
}
#[derive(Serialize)]
pub struct PendingTableReservation {
    pub passenger_id: String,
    pub passenger_name: String,
    pub table_id: String,
    pub restaurant_name: String,
}

#[derive(Serialize)]
pub struct PendingSeatReservation {
    pub passenger_id: String,
    pub passenger_name: String,
    pub seat_id: String,
    pub entertainment_id: String,
}

#[derive(Serialize)]
pub struct PendingReservationsResponse {
    pub tables: Vec<PendingTableReservation>,
    pub seats: Vec<PendingSeatReservation>,
}

#[derive(Deserialize, Debug)]
pub struct SubmitPerformanceReportRequest {
    pub performance_id: String,
    pub occupancy_count: i32,
    pub technical_issues: String,
    pub audience_rating: i32,
    pub audience_notes: String,
    pub submitted_by: String,
    pub has_unresolved_issues: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct PerformanceReportResponse {
    pub report_id: Uuid,
    pub performance_id: Uuid,
    pub performance_title: String,
    pub occupancy_count: i32,
    pub technical_issues: String,
    pub audience_rating: i32,
    pub audience_notes: String,
    pub submitted_by: Uuid,
    pub submitted_by_name: String,
    pub submitted_at: String,
    pub status: String,
    pub is_late: bool,
    pub priority_review: bool,
}

#[derive(Deserialize, Debug)]
pub struct CreateScheduleRequest {
    pub employee_name: String,
    pub role_name: String,
    pub shift_date: String,
    pub shift_hours: String,
    pub position: String,
    pub requested_by: String,
}

#[derive(Serialize, Debug)]
pub struct StaffScheduleResponse {
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
