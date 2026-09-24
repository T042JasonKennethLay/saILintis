use crate::database::database::DbState;
use crate::medical::{
    medical_model::medical_model::{MedicalPassengerProfile, CreateMedicalClearanceRequest, NotificationItem},
    medical_service::medical_service::MedicalService,
};

#[tauri::command]
pub async fn get_passenger_medical_profile(state: tauri::State<'_, DbState>, passenger_id: String) -> Result<Option<MedicalPassengerProfile>, String> {
    MedicalService::get_passenger_medical_profile(&state, passenger_id).await
}

#[tauri::command]
pub async fn save_medical_clearance(state: tauri::State<'_, DbState>, payload: CreateMedicalClearanceRequest) -> Result<String, String> {
    MedicalService::save_medical_clearance(&state, payload).await
}

#[tauri::command]
pub async fn generate_clearance_pdf(state: tauri::State<'_, DbState>, clearance_id: String) -> Result<String, String> {
    MedicalService::generate_clearance_pdf(&state, clearance_id).await
}

#[tauri::command]
pub async fn update_passenger_status(state: tauri::State<'_, DbState>, passenger_id: String, status: String) -> Result<(), String> {
    use uuid::Uuid;
    use crate::medical::medical_repository::medical_repository::MedicalRepository;
    use crate::passenger::passenger_service::passenger_service::PassengerService;
    let p_uuid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
    MedicalRepository::update_passenger_status(&state.pool, p_uuid, &status).await?;
    PassengerService::invalidate_cache(&state, p_uuid).await;
    Ok(())
}

#[tauri::command]
pub async fn save_notification(state: tauri::State<'_, DbState>, message: String, sent_by: String, recipient_role: String) -> Result<(), String> {
    use uuid::Uuid;
    use crate::medical::medical_repository::medical_repository::MedicalRepository;
    let officer_uuid = Uuid::parse_str(&sent_by).map_err(|_| "Invalid officer ID".to_string())?;
    MedicalRepository::save_notification(&state.pool, Uuid::new_v4(), &message, officer_uuid, &recipient_role).await
}

#[tauri::command]
pub async fn record_action(state: tauri::State<'_, DbState>, account_id: String, action: String, description: String) -> Result<(), String> {
    use uuid::Uuid;
    use crate::medical::medical_repository::medical_repository::MedicalRepository;
    let acc_uuid = Uuid::parse_str(&account_id).map_err(|_| "Invalid account ID".to_string())?;
    MedicalRepository::record_action(&state.pool, Uuid::new_v4(), Some(acc_uuid), &action, &description).await
}

#[tauri::command]
pub async fn get_notifications(state: tauri::State<'_, DbState>, recipient_role: String) -> Result<Vec<NotificationItem>, String> {
    use crate::medical::medical_repository::medical_repository::MedicalRepository;
    MedicalRepository::get_notifications(&state.pool, &recipient_role).await
}

#[tauri::command]
pub async fn mark_notification_read(state: tauri::State<'_, DbState>, alert_id: String) -> Result<(), String> {
    use uuid::Uuid;
    use crate::medical::medical_repository::medical_repository::MedicalRepository;
    let uuid = Uuid::parse_str(&alert_id).map_err(|_| "Invalid alert ID".to_string())?;
    MedicalRepository::mark_notification_read(&state.pool, uuid).await
}

#[tauri::command]
pub async fn mark_all_notifications_read(state: tauri::State<'_, DbState>, recipient_role: String) -> Result<(), String> {
    use crate::medical::medical_repository::medical_repository::MedicalRepository;
    MedicalRepository::mark_all_notifications_read(&state.pool, &recipient_role).await
}
