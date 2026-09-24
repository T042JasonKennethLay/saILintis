use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FoodInventoryResponse {
    pub item_id: Uuid,
    pub item_name: String,
    pub category: String,
    pub quantity: f64,
    pub unit: String,
    pub minimum_stock: f64,
    pub last_delivery_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RestockRequestResponse {
    pub request_id: Uuid,
    pub item_id: Uuid,
    pub item_name: String,
    pub requested_quantity: f64,
    pub reason: String,
    pub status: String,
    pub requested_by: Uuid,
    pub requested_by_name: String,
    pub requested_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MenuItemResponse {
    pub menu_item_id: Uuid,
    pub restaurant_id: Uuid,
    pub restaurant_name: String,
    pub item_name: String,
    pub description: Option<String>,
    pub price: f64,
    pub category: String,
    pub is_available: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReservationResponse {
    pub booking_id: Uuid,
    pub passenger_id: Option<Uuid>,
    pub passenger_name: String,
    pub restaurant_name: String,
    pub tables: Vec<String>,
    pub reservation_date: String,
    pub reservation_time: String,
    pub location: String,
    pub dietary_request: Option<String>,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RestaurantOverviewResponse {
    pub total_food_items: i64,
    pub low_stock_count: i64,
    pub pending_restock_count: i64,
    pub public_menu_count: i64,
    pub vip_menu_count: i64,
    pub pending_reservations: i64,
    pub approved_reservations: i64,
    pub total_reservations: i64,
}
