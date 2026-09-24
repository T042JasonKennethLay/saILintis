use tauri::State;
use crate::database::database::DbState;
use crate::restaurant::restaurant_model::restaurant_model::*;
use crate::restaurant::restaurant_service::restaurant_service::RestaurantService;

#[tauri::command]
pub async fn rm_get_food_inventory(state: State<'_, DbState>) -> Result<Vec<FoodInventoryResponse>, String> {
    RestaurantService::get_food_inventory(&state.pool).await
}

#[tauri::command]
pub async fn rm_create_food_item(
    state: State<'_, DbState>,
    itemName: String,
    category: String,
    quantity: f64,
    unit: String,
    minimumStock: f64,
) -> Result<String, String> {
    let id = RestaurantService::create_food_item(&state.pool, &itemName, &category, quantity, &unit, minimumStock).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn rm_update_food_item(
    state: State<'_, DbState>,
    itemId: String,
    itemName: String,
    category: String,
    quantity: f64,
    unit: String,
    minimumStock: f64,
) -> Result<(), String> {
    RestaurantService::update_food_item(&state.pool, &itemId, &itemName, &category, quantity, &unit, minimumStock).await
}

#[tauri::command]
pub async fn rm_delete_food_item(state: State<'_, DbState>, itemId: String) -> Result<(), String> {
    RestaurantService::delete_food_item(&state.pool, &itemId).await
}

#[tauri::command]
pub async fn rm_submit_restock_request(
    state: State<'_, DbState>,
    itemId: String,
    requestedQuantity: f64,
    reason: String,
    userId: String,
) -> Result<String, String> {
    let id = RestaurantService::submit_restock_request(&state.pool, &itemId, requestedQuantity, &reason, &userId).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn rm_get_restock_requests(state: State<'_, DbState>) -> Result<Vec<RestockRequestResponse>, String> {
    RestaurantService::get_restock_requests(&state.pool).await
}

#[tauri::command]
pub async fn rm_get_menu_items(state: State<'_, DbState>, menuType: String) -> Result<Vec<MenuItemResponse>, String> {
    RestaurantService::get_menu_items(&state.pool, &menuType).await
}

#[tauri::command]
pub async fn rm_create_menu_item(
    state: State<'_, DbState>,
    menuType: String,
    itemName: String,
    description: String,
    price: f64,
    category: String,
) -> Result<String, String> {
    let id = RestaurantService::create_menu_item(&state.pool, &menuType, &itemName, &description, price, &category).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn rm_update_menu_item(
    state: State<'_, DbState>,
    menuItemId: String,
    itemName: String,
    description: String,
    price: f64,
    category: String,
    isAvailable: bool,
) -> Result<(), String> {
    RestaurantService::update_menu_item(&state.pool, &menuItemId, &itemName, &description, price, &category, isAvailable).await
}

#[tauri::command]
pub async fn rm_delete_menu_item(state: State<'_, DbState>, menuItemId: String) -> Result<(), String> {
    RestaurantService::delete_menu_item(&state.pool, &menuItemId).await
}

#[tauri::command]
pub async fn rm_get_reservations(state: State<'_, DbState>) -> Result<Vec<ReservationResponse>, String> {
    RestaurantService::get_reservations(&state.pool).await
}

#[tauri::command]
pub async fn rm_approve_reservation(state: State<'_, DbState>, bookingId: String) -> Result<(), String> {
    RestaurantService::approve_reservation(&state.pool, &bookingId).await
}

#[tauri::command]
pub async fn rm_reject_reservation(state: State<'_, DbState>, bookingId: String) -> Result<(), String> {
    RestaurantService::reject_reservation(&state.pool, &bookingId).await
}

#[tauri::command]
pub async fn rm_get_overview_stats(state: State<'_, DbState>) -> Result<RestaurantOverviewResponse, String> {
    RestaurantService::get_overview_stats(&state.pool).await
}

#[tauri::command]
pub async fn rm_update_restock_request_status(
    state: State<'_, DbState>,
    requestId: String,
    status: String,
) -> Result<(), String> {
    RestaurantService::update_restock_request_status(&state.pool, &requestId, &status).await
}
