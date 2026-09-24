use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShipResponse {
    pub ship_id: Uuid,
    pub ship_name: String,
    pub capacity: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VoyageResponse {
    pub voyage_id: Uuid,
    pub destination: String,
    pub departure_date: String,
    pub turnaround_buffer: i32,
    pub port_dwell_time: i32,
    pub contingency_margin: i32,
    pub ship_id: Option<Uuid>,
    pub ship_name: Option<String>,
    pub status: String,
    pub created_by: Uuid,
    pub created_at: String,
    pub occupancy_count: i32,
    pub capacity: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OccupancyStatsResponse {
    pub historical_occupancy: f64,
    pub current_occupancy: f64,
    pub future_occupancy: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CrewAssignmentResponse {
    pub account_id: Uuid,
    pub display_name: String,
    pub username: String,
    pub role_name: String,
    pub is_assigned: bool,
}
