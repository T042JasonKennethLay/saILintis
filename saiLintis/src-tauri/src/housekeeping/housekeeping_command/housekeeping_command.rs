use crate::database::database::DbState;
use crate::housekeeping::{
    housekeeping_model::housekeeping_model::*,
    housekeeping_service::housekeeping_service::HousekeepingService,
};
use uuid::Uuid;

#[tauri::command]
pub async fn list_linens(state: tauri::State<'_, DbState>) -> Result<Vec<LinenResponse>, String> {
    HousekeepingService::list_linens(&state).await
}

#[tauri::command]
pub async fn create_linen(state: tauri::State<'_, DbState>, payload: CreateLinenRequest) -> Result<Uuid, String> {
    HousekeepingService::create_linen(&state, payload).await
}

#[tauri::command]
pub async fn update_linen(state: tauri::State<'_, DbState>, payload: UpdateLinenRequest) -> Result<(), String> {
    HousekeepingService::update_linen(&state, payload).await
}

#[tauri::command]
pub async fn delete_linen(state: tauri::State<'_, DbState>, payload: DeleteLinenRequest) -> Result<(), String> {
    HousekeepingService::delete_linen(&state, payload).await
}

#[tauri::command]
pub async fn submit_shortage_report(state: tauri::State<'_, DbState>, payload: SubmitShortageRequest) -> Result<Uuid, String> {
    HousekeepingService::submit_shortage_report(&state, payload).await
}

#[tauri::command]
pub async fn list_shortage_reports(state: tauri::State<'_, DbState>) -> Result<Vec<ShortageReportResponse>, String> {
    HousekeepingService::list_shortage_reports(&state).await
}

#[tauri::command]
pub async fn hk_create_staff_schedule(state: tauri::State<'_, DbState>, payload: CreateScheduleRequest) -> Result<String, String> {
    HousekeepingService::hk_create_staff_schedule(&state, payload).await
}

#[tauri::command]
pub async fn hk_get_employees(state: tauri::State<'_, DbState>) -> Result<Vec<String>, String> {
    HousekeepingService::hk_get_employees(&state).await
}

#[tauri::command]
pub async fn hk_get_staff_schedules(state: tauri::State<'_, DbState>) -> Result<Vec<StaffScheduleResponse>, String> {
    HousekeepingService::hk_get_staff_schedules(&state).await
}
