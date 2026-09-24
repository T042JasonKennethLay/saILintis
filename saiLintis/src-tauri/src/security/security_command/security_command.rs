use crate::database::database::DbState;
use crate::security::{
    security_model::security_model::*,
    security_service::security_service::SecurityService,
};
use uuid::Uuid;

#[tauri::command]
pub async fn list_zones(state: tauri::State<'_, DbState>) -> Result<Vec<ZoneResponse>, String> {
    SecurityService::list_zones(&state).await
}

#[tauri::command]
pub async fn get_zone_by_id(state: tauri::State<'_, DbState>, zone_id: String) -> Result<ZoneResponse, String> {
    SecurityService::get_zone_by_id(&state, zone_id).await
}

#[tauri::command]
pub async fn get_zone_crew(state: tauri::State<'_, DbState>, zone_id: String) -> Result<Vec<ZoneCrewResponse>, String> {
    SecurityService::get_zone_crew(&state, zone_id).await
}

#[tauri::command]
pub async fn send_zone_specific_security_alert(
    state: tauri::State<'_, DbState>,
    payload: SendZoneAlertRequest,
) -> Result<Uuid, String> {
    SecurityService::send_zone_specific_security_alert(&state, payload).await
}

#[tauri::command]
pub async fn close_zone_alert(
    state: tauri::State<'_, DbState>,
    alert_id: String,
    closed_by: String,
) -> Result<(), String> {
    SecurityService::close_zone_alert(&state, alert_id, closed_by).await
}

#[tauri::command]
pub async fn list_zone_alerts(state: tauri::State<'_, DbState>) -> Result<Vec<ZoneAlertResponse>, String> {
    SecurityService::list_zone_alerts(&state).await
}
