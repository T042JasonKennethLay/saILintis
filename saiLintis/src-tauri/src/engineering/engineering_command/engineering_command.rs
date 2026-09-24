use tauri::State;
use crate::database::database::DbState;
use crate::engineering::engineering_model::engineering_model::*;
use crate::engineering::engineering_service::engineering_service::EngineeringService;

#[tauri::command]
pub async fn eng_create_work_order(
    state: State<'_, DbState>,
    title: String,
    description: String,
    equipment: String,
    location: String,
    priority: String,
    userId: String,
) -> Result<String, String> {
    let id = EngineeringService::create_work_order(&state.pool, &title, &description, &equipment, &location, &priority, &userId).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn eng_get_work_orders(state: State<'_, DbState>) -> Result<Vec<WorkOrderResponse>, String> {
    EngineeringService::get_work_orders(&state.pool).await
}

#[tauri::command]
pub async fn eng_assign_work_order(
    state: State<'_, DbState>,
    workOrderId: String,
    staffId: Option<String>,
) -> Result<(), String> {
    EngineeringService::assign_work_order(&state.pool, &workOrderId, staffId).await
}

#[tauri::command]
pub async fn eng_update_work_order_status(
    state: State<'_, DbState>,
    workOrderId: String,
    status: String,
) -> Result<(), String> {
    EngineeringService::update_work_order_status(&state.pool, &workOrderId, &status).await
}

#[tauri::command]
pub async fn eng_add_maintenance_log(
    state: State<'_, DbState>,
    workOrderId: String,
    notes: String,
    userId: String,
) -> Result<String, String> {
    let id = EngineeringService::add_maintenance_log(&state.pool, &workOrderId, &userId, &notes).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn eng_get_maintenance_logs(
    state: State<'_, DbState>,
    workOrderId: String,
) -> Result<Vec<MaintenanceLogResponse>, String> {
    EngineeringService::get_maintenance_logs(&state.pool, &workOrderId).await
}

#[tauri::command]
pub async fn eng_get_engineering_staff(state: State<'_, DbState>) -> Result<Vec<EngineeringStaffResponse>, String> {
    EngineeringService::get_engineering_staff(&state.pool).await
}

#[tauri::command]
pub async fn eng_get_stats(state: State<'_, DbState>) -> Result<EngineeringStatsResponse, String> {
    EngineeringService::get_stats(&state.pool).await
}
