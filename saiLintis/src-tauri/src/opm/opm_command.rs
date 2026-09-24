use tauri::State;
use crate::database::database::DbState;
use crate::opm::opm_model::{OpmPassengerResponse, OpmTimelineResponse, StaffSchedule, EscalateRequest, CreateScheduleRequest};
use crate::opm::opm_service::OpmService;

#[tauri::command]
pub async fn opm_get_passenger_checkin_status(state: State<'_, DbState>) -> Result<Vec<OpmPassengerResponse>, String> {
    OpmService::get_passenger_checkin_status(&state).await
}

#[tauri::command]
pub async fn opm_get_boarding_timeline(state: State<'_, DbState>) -> Result<Vec<OpmTimelineResponse>, String> {
    OpmService::get_boarding_timeline(&state).await
}

#[tauri::command]
pub async fn opm_get_staff_schedules(state: State<'_, DbState>) -> Result<Vec<StaffSchedule>, String> {
    OpmService::get_staff_schedules(&state).await
}

#[tauri::command]
pub async fn opm_update_staff_schedule_status(state: State<'_, DbState>, id: i32, status: String) -> Result<String, String> {
    OpmService::update_staff_schedule_status(&state, id, status).await
}

#[tauri::command]
pub async fn opm_make_final_call_announcement(state: State<'_, DbState>, sender_id: String) -> Result<String, String> {
    OpmService::make_final_call_announcement(&state, sender_id).await
}

#[tauri::command]
pub async fn opm_escalate_operational_issue(state: State<'_, DbState>, payload: EscalateRequest) -> Result<String, String> {
    OpmService::escalate_operational_issue(&state, payload).await
}

#[tauri::command]
pub async fn opm_get_employees_by_role(state: State<'_, DbState>, role_name: String) -> Result<Vec<String>, String> {
    OpmService::get_employees_by_role(&state, role_name).await
}

#[tauri::command]
pub async fn opm_create_staff_schedule(state: State<'_, DbState>, payload: CreateScheduleRequest) -> Result<String, String> {
    OpmService::create_staff_schedule(&state, payload).await
}
