use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkOrderResponse {
    pub work_order_id: Uuid,
    pub title: String,
    pub description: String,
    pub equipment: String,
    pub location: String,
    pub priority: String,
    pub status: String,
    pub assigned_to: Option<Uuid>,
    pub assigned_to_name: Option<String>,
    pub created_by: Uuid,
    pub created_by_name: String,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MaintenanceLogResponse {
    pub log_id: Uuid,
    pub work_order_id: Uuid,
    pub logged_by: Uuid,
    pub logged_by_name: String,
    pub notes: String,
    pub logged_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EngineeringStaffResponse {
    pub account_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub active_tasks: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EngineeringStatsResponse {
    pub open_count: i32,
    pub in_progress_count: i32,
    pub completed_count: i32,
    pub closed_count: i32,
    pub average_resolve_time_hours: f64,
    pub completion_rate: f64,
    pub compliance_rate: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateWorkOrderRequest {
    pub title: String,
    pub description: String,
    pub equipment: String,
    pub location: String,
    pub priority: String,
    pub user_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateWorkOrderStatusRequest {
    pub work_order_id: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AssignWorkOrderRequest {
    pub work_order_id: String,
    pub staff_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AddMaintenanceLogRequest {
    pub work_order_id: String,
    pub notes: String,
    pub user_id: String,
}
