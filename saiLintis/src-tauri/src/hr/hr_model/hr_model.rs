use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize, Debug)]
pub struct CreateJobVacancyRequest {
    pub title: String,
    pub description: String,
    pub requirements: String,
    pub deadline: String,
    pub status: String,
    pub user_id: String, 
}

#[derive(Deserialize, Debug)]
pub struct UpdateJobVacancyRequest {
    pub vacancy_id: String,
    pub title: String,
    pub description: String,
    pub requirements: String,
    pub deadline: String,
    pub status: String,
    pub user_id: String,
}

#[derive(Deserialize, Debug)]
pub struct DeleteJobVacancyRequest {
    pub vacancy_id: String,
    pub user_id: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct JobVacancyResponse {
    pub vacancy_id: Uuid,
    pub title: String,
    pub description: String,
    pub requirements: String,
    pub status: String,
    pub created_at: chrono::NaiveDateTime,
    pub deadline: chrono::NaiveDateTime,
    pub candidate_count: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct CandidateResponse {
    pub candidate_id: Uuid,
    pub vacancy_id: Uuid,
    pub full_name: String,
    pub email: String,
    pub cv_document: String,
    pub status: String,
    pub applied_at: chrono::NaiveDateTime,
    pub assigned_voyage: Option<String>,
    pub assigned_capacity: Option<String>,
    pub vacancy_title: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ScreenCandidateRequest {
    pub candidate_id: String,
    pub status: String,
    pub assigned_voyage: Option<String>,
    pub assigned_capacity: Option<String>,
    pub user_id: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct RoleOptionResponse {
    pub role_id: Uuid,
    pub role_name: String,
    pub department: String,
}

#[derive(Deserialize, Debug)]
pub struct ApplyJobRequest {
    pub vacancy_id: String,
    pub full_name: String,
    pub email: String,
    pub cv_document: String,
}
