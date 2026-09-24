use sea_orm::DatabaseConnection;
use uuid::Uuid;
use crate::restaurant::restaurant_model::restaurant_model::*;
use crate::restaurant::restaurant_repository::restaurant_repository::RestaurantRepository;

pub struct RestaurantService;

impl RestaurantService {
    pub async fn get_food_inventory(pool: &DatabaseConnection) -> Result<Vec<FoodInventoryResponse>, String> {
        RestaurantRepository::get_food_inventory(pool).await
    }

    pub async fn create_food_item(
        pool: &DatabaseConnection,
        item_name: &str,
        category: &str,
        quantity: f64,
        unit: &str,
        minimum_stock: f64,
    ) -> Result<Uuid, String> {
        RestaurantRepository::create_food_item(pool, item_name, category, quantity, unit, minimum_stock).await
    }

    pub async fn update_food_item(
        pool: &DatabaseConnection,
        item_id: &str,
        item_name: &str,
        category: &str,
        quantity: f64,
        unit: &str,
        minimum_stock: f64,
    ) -> Result<(), String> {
        let uid = Uuid::parse_str(item_id).map_err(|e| e.to_string())?;
        RestaurantRepository::update_food_item(pool, uid, item_name, category, quantity, unit, minimum_stock).await
    }

    pub async fn delete_food_item(pool: &DatabaseConnection, item_id: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(item_id).map_err(|e| e.to_string())?;
        RestaurantRepository::delete_food_item(pool, uid).await
    }

    pub async fn submit_restock_request(
        pool: &DatabaseConnection,
        item_id: &str,
        requested_quantity: f64,
        reason: &str,
        user_id: &str,
    ) -> Result<Uuid, String> {
        let iid = Uuid::parse_str(item_id).map_err(|e| e.to_string())?;
        let uid = Uuid::parse_str(user_id).map_err(|e| e.to_string())?;
        RestaurantRepository::submit_restock_request(pool, iid, requested_quantity, reason, uid).await
    }

    pub async fn get_restock_requests(pool: &DatabaseConnection) -> Result<Vec<RestockRequestResponse>, String> {
        RestaurantRepository::get_restock_requests(pool).await
    }

    pub async fn get_menu_items(pool: &DatabaseConnection, menu_type: &str) -> Result<Vec<MenuItemResponse>, String> {
        RestaurantRepository::get_menu_items(pool, menu_type).await
    }

    pub async fn create_menu_item(
        pool: &DatabaseConnection,
        menu_type: &str,
        item_name: &str,
        description: &str,
        price: f64,
        category: &str,
    ) -> Result<Uuid, String> {
        RestaurantRepository::create_menu_item(pool, menu_type, item_name, description, price, category).await
    }

    pub async fn update_menu_item(
        pool: &DatabaseConnection,
        menu_item_id: &str,
        item_name: &str,
        description: &str,
        price: f64,
        category: &str,
        is_available: bool,
    ) -> Result<(), String> {
        let uid = Uuid::parse_str(menu_item_id).map_err(|e| e.to_string())?;
        RestaurantRepository::update_menu_item(pool, uid, item_name, description, price, category, is_available).await
    }

    pub async fn delete_menu_item(pool: &DatabaseConnection, menu_item_id: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(menu_item_id).map_err(|e| e.to_string())?;
        RestaurantRepository::delete_menu_item(pool, uid).await
    }

    pub async fn get_reservations(pool: &DatabaseConnection) -> Result<Vec<ReservationResponse>, String> {
        RestaurantRepository::get_reservations(pool).await
    }

    pub async fn approve_reservation(pool: &DatabaseConnection, booking_id: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(booking_id).map_err(|e| e.to_string())?;
        RestaurantRepository::approve_reservation(pool, uid).await
    }

    pub async fn reject_reservation(pool: &DatabaseConnection, booking_id: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(booking_id).map_err(|e| e.to_string())?;
        RestaurantRepository::reject_reservation(pool, uid).await
    }

    pub async fn get_overview_stats(pool: &DatabaseConnection) -> Result<RestaurantOverviewResponse, String> {
        RestaurantRepository::get_overview_stats(pool).await
    }

    pub async fn update_restock_request_status(
        pool: &DatabaseConnection,
        request_id: &str,
        status: &str,
    ) -> Result<(), String> {
        let rid = Uuid::parse_str(request_id).map_err(|e| e.to_string())?;
        RestaurantRepository::update_restock_request_status(pool, rid, status).await
    }
}
