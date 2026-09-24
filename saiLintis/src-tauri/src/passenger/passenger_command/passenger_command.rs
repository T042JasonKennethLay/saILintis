use tauri::State;
use crate::database::database::DbState;
use crate::passenger::{
    passenger_model::passenger_model::*,
    passenger_service::passenger_service::PassengerService,
};

#[tauri::command]
pub async fn create_passenger(state: State<'_, DbState>,payload: CreatePassengerRequest,) -> Result<PassengerResponse, String> {
    PassengerService::create_passenger(&state, payload).await
}

#[tauri::command]
pub async fn get_passenger(state: State<'_, DbState>,passenger_id: String,) -> Result<PassengerResponse, String> {
    PassengerService::get_passenger(&state, passenger_id).await
}

#[tauri::command]
pub async fn update_passenger_profile(state: State<'_, DbState>,payload: UpdatePassengerProfileRequest,) -> Result<PassengerResponse, String> {
    PassengerService::update_passenger_profile(&state, payload).await
}

#[tauri::command]
pub async fn update_passenger_preference(state: State<'_, DbState>,payload: UpdatePassengerPreferenceRequest,) -> Result<PassengerResponse, String> {
    PassengerService::update_passenger_preference(&state, payload).await
}

#[tauri::command]
pub async fn add_spending_entry(state: State<'_, DbState>,payload: AddSpendingEntryRequest,) -> Result<SpendingEntryResponse, String> {
    PassengerService::add_spending_entry(&state, payload).await
}

#[tauri::command]
pub async fn list_spending_entries(state: State<'_, DbState>,passenger_id: String,) -> Result<Vec<SpendingEntryResponse>, String> {
    PassengerService::list_spending_entries(&state, passenger_id).await
}

#[tauri::command]
pub async fn list_passengers(state: State<'_, DbState>) -> Result<Vec<PassengerResponse>, String> {
    PassengerService::list_passengers(&state).await
}

#[tauri::command]
pub async fn view_booking_reservation_and_itinerary(state: State<'_, DbState>,passenger_id: String,) -> Result<serde_json::Value, String> {
    PassengerService::view_booking_reservation_and_itinerary(&state, passenger_id).await
}

#[tauri::command]
pub async fn view_daily_onboard_spending_and_budget(state: State<'_, DbState>,passenger_id: String,) -> Result<SpendingSummaryResponse, String> {
    PassengerService::view_daily_onboard_spending_and_budget(&state, passenger_id).await
}

#[tauri::command]
pub async fn reserve_seat_for_entertainment(state: State<'_, DbState>,payload: ReserveSeatRequest,) -> Result<String, String> {
    PassengerService::reserve_seat_for_entertainment(&state, payload).await
}

#[tauri::command]
pub async fn reserved_dining_table_with_dietary_request(state: State<'_, DbState>,payload: ReserveDiningTableRequest,) -> Result<String, String> {
    PassengerService::reserved_dining_table_with_dietary_request(&state, payload).await
}

#[tauri::command]
pub async fn request_medical_support(state: State<'_, DbState>,payload: RequestMedicalSupportRequest,) -> Result<String, String> {
    PassengerService::request_medical_support(&state, payload).await
}

#[tauri::command]
pub async fn view_ship_announcement(state: State<'_, DbState>) -> Result<Vec<AnnouncementResponse>, String> {
    PassengerService::view_ship_announcement(&state).await
}

#[tauri::command]
pub async fn publish_ship_announcement(state: State<'_, DbState>, title: String, content: String, sent_by: String) -> Result<(), String> {
    PassengerService::publish_ship_announcement(&state, title, content, sent_by).await
}

#[tauri::command]
pub async fn order_room_service(state: State<'_, DbState>,payload: OrderRoomServiceRequest,) -> Result<SpendingEntryResponse, String> {
    PassengerService::order_room_service(&state, payload).await
}

#[tauri::command]
pub async fn submit_formal_feedback_or_complaint(state: State<'_, DbState>,payload: SubmitFeedbackRequest,) -> Result<String, String> {
    PassengerService::submit_formal_feedback_or_complaint(&state, payload).await
}

#[tauri::command]
pub async fn access_dedicated_vip_direct_contact_channel(state: State<'_, DbState>,passenger_id: String,) -> Result<String, String> {
    PassengerService::access_dedicated_vip_direct_contact_channel(&state, passenger_id).await
}

#[tauri::command]
pub async fn reserve_entertainment_seat_with_vip_early_access(state: State<'_, DbState>,payload: ReserveSeatRequest,) -> Result<String, String> {
    PassengerService::reserve_entertainment_seat_with_vip_early_access(&state, payload).await
}

#[tauri::command]
pub async fn reserved_dining_table_with_vip_early_access(state: State<'_, DbState>,payload: ReserveDiningTableRequest,) -> Result<String, String> {
    PassengerService::reserved_dining_table_with_vip_early_access(&state, payload).await
}

#[tauri::command]
pub async fn get_seats_for_performance(state: State<'_, DbState>, performance_title: String, passenger_id: Option<String>) -> Result<std::collections::HashMap<String, String>, String> {
    PassengerService::get_seats_for_performance(&state, performance_title, passenger_id).await
}

#[tauri::command]
pub async fn get_dining_tables(state: State<'_, DbState>, restaurant_name: String, passenger_id: Option<String>) -> Result<std::collections::HashMap<String, String>, String> {
    PassengerService::get_dining_tables(&state, restaurant_name, passenger_id).await
}

#[tauri::command]
pub async fn get_all_performances(state: State<'_, DbState>) -> Result<Vec<PerformanceDetail>, String> {
    PassengerService::get_all_performances(&state).await
}

#[tauri::command]
pub async fn create_performance(state: State<'_, DbState>, title: String, date: String, time: String, capacity: i32) -> Result<String, String> {
    PassengerService::create_performance(&state, title, date, time, capacity).await
}

#[tauri::command]
pub async fn create_dining_table(state: State<'_, DbState>, restaurant_name: String, table_number: String, capacity: i32) -> Result<String, String> {
    PassengerService::create_dining_table(&state, restaurant_name, table_number, capacity).await
}

#[tauri::command]
pub async fn get_all_activities(state: State<'_, DbState>) -> Result<Vec<ActivityResponse>, String> {
    PassengerService::get_all_activities(&state).await
}

#[tauri::command]
pub async fn export_spending_csv(state: State<'_, DbState>, passenger_id: String) -> Result<String, String> {
    PassengerService::export_spending_csv(&state, passenger_id).await
}

#[tauri::command]
pub async fn approve_seat_booking(state: State<'_, DbState>, performance_title: String, seat_number: String) -> Result<String, String> {
    PassengerService::approve_seat_booking(&state, performance_title, seat_number).await
}

#[tauri::command]
pub async fn reject_seat_booking(state: State<'_, DbState>, performance_title: String, seat_number: String) -> Result<String, String> {
    PassengerService::reject_seat_booking(&state, performance_title, seat_number).await
}

#[tauri::command]
pub async fn get_all_pending_reservations(state: State<'_, DbState>) -> Result<PendingReservationsResponse, String> {
    PassengerService::get_all_pending_reservations(&state).await
}

#[tauri::command]
pub async fn approve_dining_table(state: State<'_, DbState>, restaurant_name: String, table_number: String) -> Result<String, String> {
    PassengerService::approve_dining_table(&state, restaurant_name, table_number).await
}

#[tauri::command]
pub async fn reject_dining_table(state: State<'_, DbState>, restaurant_name: String, table_number: String) -> Result<String, String> {
    PassengerService::reject_dining_table(&state, restaurant_name, table_number).await
}

#[tauri::command]
pub async fn submit_performance_report(
    state: State<'_, DbState>,
    payload: SubmitPerformanceReportRequest,
) -> Result<String, String> {
    PassengerService::submit_performance_report(&state, payload).await
}

#[tauri::command]
pub async fn get_performance_reports(
    state: State<'_, DbState>,
) -> Result<Vec<PerformanceReportResponse>, String> {
    PassengerService::get_performance_reports(&state).await
}

#[tauri::command]
pub async fn ent_create_staff_schedule(state: State<'_, DbState>, payload: CreateScheduleRequest) -> Result<String, String> {
    PassengerService::ent_create_staff_schedule(&state, payload).await
}

#[tauri::command]
pub async fn ent_get_employees(state: State<'_, DbState>) -> Result<Vec<String>, String> {
    PassengerService::ent_get_employees(&state).await
}

#[tauri::command]
pub async fn ent_get_staff_schedules(state: State<'_, DbState>) -> Result<Vec<StaffScheduleResponse>, String> {
    PassengerService::ent_get_staff_schedules(&state).await
}
