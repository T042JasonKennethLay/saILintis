use tauri::State;
use crate::database::database::DbState;
use crate::frontdesk::frontdesk_model::frontdesk_model::{
    CabinResponse, FdoPassengerResponse, ComplaintResponse,
    ChatMessageResponse, ChatQueueEntry, SendChatMessageRequest,
    AssignCabinRequest, UpdatePassengerStatusRequest, ResolveComplaintRequest,
};
use crate::frontdesk::frontdesk_service::frontdesk_service::FrontdeskService;

#[tauri::command]
pub async fn fdo_get_passengers(state: State<'_, DbState>) -> Result<Vec<FdoPassengerResponse>, String> {
    FrontdeskService::get_all_passengers(&state).await
}

#[tauri::command]
pub async fn fdo_check_in_passenger(state: State<'_, DbState>, passenger_id: String) -> Result<String, String> {
    FrontdeskService::checkin_passenger(&state, passenger_id).await
}

#[tauri::command]
pub async fn fdo_check_out_passenger(state: State<'_, DbState>, passenger_id: String) -> Result<String, String> {
    FrontdeskService::checkout_passenger(&state, passenger_id).await
}

#[tauri::command]
pub async fn fdo_update_onboard_status(state: State<'_, DbState>, payload: UpdatePassengerStatusRequest) -> Result<String, String> {
    FrontdeskService::update_onboard_status(&state, payload).await
}

#[tauri::command]
pub async fn fdo_get_cabins(state: State<'_, DbState>) -> Result<Vec<CabinResponse>, String> {
    FrontdeskService::get_all_cabins(&state).await
}

#[tauri::command]
pub async fn fdo_assign_cabin(state: State<'_, DbState>, payload: AssignCabinRequest) -> Result<String, String> {
    FrontdeskService::assign_cabin(&state, payload).await
}

#[tauri::command]
pub async fn fdo_get_complaints(state: State<'_, DbState>) -> Result<Vec<ComplaintResponse>, String> {
    FrontdeskService::get_complaints(&state).await
}

#[tauri::command]
pub async fn fdo_resolve_complaint(state: State<'_, DbState>, payload: ResolveComplaintRequest) -> Result<String, String> {
    FrontdeskService::resolve_complaint(&state, payload).await
}

#[tauri::command]
pub async fn fdo_get_chat_queues(state: State<'_, DbState>) -> Result<Vec<ChatQueueEntry>, String> {
    FrontdeskService::get_chat_queues(&state).await
}

#[tauri::command]
pub async fn get_chat_history(state: State<'_, DbState>, passenger_id: String) -> Result<Vec<ChatMessageResponse>, String> {
    FrontdeskService::get_chat_history(&state, passenger_id).await
}

#[tauri::command]
pub async fn send_chat_message(state: State<'_, DbState>, payload: SendChatMessageRequest) -> Result<String, String> {
    FrontdeskService::send_chat_message(&state, payload).await
}

#[tauri::command]
pub async fn mark_fdo_messages_read(state: State<'_, DbState>, passenger_id: String) -> Result<(), String> {
    FrontdeskService::mark_fdo_messages_read(&state, passenger_id).await
}

#[tauri::command]
pub async fn get_chat_unread_count(state: State<'_, DbState>, passenger_id: String) -> Result<i64, String> {
    FrontdeskService::get_chat_unread_count(&state, passenger_id).await
}
