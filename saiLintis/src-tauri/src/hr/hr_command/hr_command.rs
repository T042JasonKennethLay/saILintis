use crate::database::database::DbState;
use crate::hr::{
    hr_model::hr_model::*,
    hr_service::hr_service::HrService,
};
use uuid::Uuid;

#[tauri::command]
pub async fn list_job_vacancies(state: tauri::State<'_, DbState>) -> Result<Vec<JobVacancyResponse>, String> {
    HrService::list_job_vacancies(&state).await
}

#[tauri::command]
pub async fn create_job_vacancy(state: tauri::State<'_, DbState>, payload: CreateJobVacancyRequest) -> Result<Uuid, String> {
    HrService::create_job_vacancy(&state, payload).await
}

#[tauri::command]
pub async fn update_job_vacancy(state: tauri::State<'_, DbState>, payload: UpdateJobVacancyRequest) -> Result<(), String> {
    HrService::update_job_vacancy(&state, payload).await
}

#[tauri::command]
pub async fn delete_job_vacancy(state: tauri::State<'_, DbState>, payload: DeleteJobVacancyRequest) -> Result<(), String> {
    HrService::delete_job_vacancy(&state, payload).await
}

#[tauri::command]
pub async fn list_candidates(state: tauri::State<'_, DbState>, vacancy_id: Option<String>) -> Result<Vec<CandidateResponse>, String> {
    HrService::list_candidates(&state, vacancy_id).await
}

#[tauri::command]
pub async fn screen_candidate(state: tauri::State<'_, DbState>, payload: ScreenCandidateRequest) -> Result<(), String> {
    HrService::screen_candidate(&state, payload).await
}

#[tauri::command]
pub async fn get_available_roles(state: tauri::State<'_, DbState>) -> Result<Vec<RoleOptionResponse>, String> {
    HrService::get_available_roles(&state).await
}

#[tauri::command]
pub async fn seed_test_candidates(state: tauri::State<'_, DbState>, vacancy_id: String) -> Result<(), String> {
    HrService::seed_test_candidates(&state, vacancy_id).await
}

#[tauri::command]
pub async fn apply_for_job(state: tauri::State<'_, DbState>, payload: ApplyJobRequest) -> Result<(), String> {
    HrService::apply_for_job(&state, payload).await
}
