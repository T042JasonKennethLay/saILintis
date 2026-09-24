use crate::database::database::DbState;
use crate::incident::{
    incident_model::incident_model::{IncidentResponse, AcknowledgeIncidentRequest, CreateSecurityIncidentRequest, CreateMedicalIncidentRequest, GeneratePdfRequest},
    incident_service::incident_service::IncidentService,
};

#[tauri::command]
pub async fn get_overnight_incidents(state: tauri::State<'_, DbState>) -> Result<Vec<IncidentResponse>, String> {
    IncidentService::get_overnight_incidents(&state).await
}

#[tauri::command]
pub async fn acknowledge_incident(state: tauri::State<'_, DbState>, payload: AcknowledgeIncidentRequest) -> Result<(), String> {
    IncidentService::acknowledge_incident(&state, payload).await
}

#[tauri::command]
pub async fn create_security_incident(state: tauri::State<'_, DbState>, payload: CreateSecurityIncidentRequest) -> Result<(), String> {
    IncidentService::create_security_incident(&state, payload).await
}

#[tauri::command]
pub async fn create_medical_incident(state: tauri::State<'_, DbState>, payload: CreateMedicalIncidentRequest) -> Result<(), String> {
    IncidentService::create_medical_incident(&state, payload).await
}

#[tauri::command]
pub async fn generate_incident_pdf(state: tauri::State<'_, DbState>, payload: GeneratePdfRequest) -> Result<String, String> {
    IncidentService::generate_incident_pdf(&state, payload).await
}
