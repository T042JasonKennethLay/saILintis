use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize, Debug)]
pub struct CreateLinenRequest {
    pub item_name: String,
    pub stock_count: i32,
    pub threshold: i32,
    pub user_id: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateLinenRequest {
    pub linen_id: String,
    pub item_name: String,
    pub stock_count: i32,
    pub threshold: i32,
    pub user_id: String,
}

#[derive(Deserialize, Debug)]
pub struct DeleteLinenRequest {
    pub linen_id: String,
    pub user_id: String,
}

#[derive(Deserialize, Debug)]
pub struct SubmitShortageRequest {
    pub linen_id: String,
    pub description: String,
    pub severity: String,
    pub category: String,
    pub photo_data: Option<String>,
    pub user_id: String,
}

#[derive(Serialize, Debug)]
pub struct LinenResponse {
    pub linen_id: Uuid,
    pub item_name: String,
    pub stock_count: i32,
    pub threshold: i32,
    pub status: String,
}

#[derive(Serialize, Debug)]
pub struct ShortageReportResponse {
    pub report_id: Uuid,
    pub linen_id: Uuid,
    pub item_name: String,
    pub description: String,
    pub severity: String,
    pub category: String,
    pub photo_data: Option<String>,
    pub reported_by: Option<Uuid>,
    pub reported_by_name: Option<String>,
    pub reported_at: String,
    pub status: String,
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
