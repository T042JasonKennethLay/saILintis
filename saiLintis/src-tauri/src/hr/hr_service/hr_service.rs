use crate::database::database::DbState;
use uuid::Uuid;
use crate::hr::{
    hr_model::hr_model::*,
    hr_repository::hr_repository::HrRepository,
};

pub struct HrService;

impl HrService {
    fn parse_date(date_str: &str) -> Result<chrono::NaiveDateTime, String> {
        let trimmed = date_str.trim();
        if trimmed.is_empty() {
            return Err("Deadline is required".to_string());
        }

        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M") {
            return Ok(dt);
        }
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S") {
            return Ok(dt);
        }
        if let Ok(d) = chrono::NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
            if let Some(dt) = d.and_hms_opt(23, 59, 59) {
                return Ok(dt);
            }
        }
        
        Err("Invalid date format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM".to_string())
    }

    pub async fn list_job_vacancies(state: &DbState) -> Result<Vec<JobVacancyResponse>, String> {
        HrRepository::list_job_vacancies(&state.pool).await
    }

    pub async fn create_job_vacancy(state: &DbState, payload: CreateJobVacancyRequest) -> Result<Uuid, String> {
        let title = payload.title.trim();
        let description = payload.description.trim();
        let requirements = payload.requirements.trim();
        let status = payload.status.trim();

        if title.is_empty() {
            return Err("Title is required".to_string());
        }
        if description.is_empty() {
            return Err("Description is required".to_string());
        }
        if requirements.is_empty() {
            return Err("Requirements are required".to_string());
        }

        let deadline = Self::parse_date(&payload.deadline)?;
        if deadline <= chrono::Local::now().naive_local() {
            return Err("Deadline must be in the future".to_string());
        }

        if status != "Draft" && status != "Open" && status != "Closed" {
            return Err("Status must be Draft, Open, or Closed".to_string());
        }

        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HrRepository::create_job_vacancy(
            &state.pool,
            title,
            description,
            requirements,
            deadline,
            status,
            user_uuid,
        )
        .await
    }

    pub async fn update_job_vacancy(state: &DbState, payload: UpdateJobVacancyRequest) -> Result<(), String> {
        let vacancy_uuid = Uuid::parse_str(&payload.vacancy_id).map_err(|_| "Invalid vacancy ID format".to_string())?;
        let title = payload.title.trim();
        let description = payload.description.trim();
        let requirements = payload.requirements.trim();
        let status = payload.status.trim();

        if title.is_empty() {
            return Err("Title is required".to_string());
        }
        if description.is_empty() {
            return Err("Description is required".to_string());
        }
        if requirements.is_empty() {
            return Err("Requirements are required".to_string());
        }

        let deadline = Self::parse_date(&payload.deadline)?;
        if deadline <= chrono::Local::now().naive_local() {
            return Err("Deadline must be in the future".to_string());
        }

        if status != "Draft" && status != "Open" && status != "Closed" {
            return Err("Status must be Draft, Open, or Closed".to_string());
        }

        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HrRepository::update_job_vacancy(
            &state.pool,
            vacancy_uuid,
            title,
            description,
            requirements,
            deadline,
            status,
            user_uuid,
        )
        .await
    }

    pub async fn delete_job_vacancy(state: &DbState, payload: DeleteJobVacancyRequest) -> Result<(), String> {
        let vacancy_uuid = Uuid::parse_str(&payload.vacancy_id).map_err(|_| "Invalid vacancy ID format".to_string())?;
        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HrRepository::delete_job_vacancy(&state.pool, vacancy_uuid, user_uuid).await
    }

    pub async fn list_candidates(state: &DbState, vacancy_id_opt: Option<String>) -> Result<Vec<CandidateResponse>, String> {
        let vacancy_uuid = match vacancy_id_opt {
            Some(ref v) if !v.trim().is_empty() => {
                let u = Uuid::parse_str(v).map_err(|_| "Invalid vacancy ID format".to_string())?;
                Some(u)
            }
            _ => None,
        };

        HrRepository::list_candidates(&state.pool, vacancy_uuid).await
    }

    pub async fn screen_candidate(state: &DbState, payload: ScreenCandidateRequest) -> Result<(), String> {
        let candidate_uuid = Uuid::parse_str(&payload.candidate_id).map_err(|_| "Invalid candidate ID format".to_string())?;
        let status = payload.status.trim();
        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        if status != "Pending" && status != "Shortlisted" && status != "Rejected" && status != "Incomplete" && status != "Account Created" {
            return Err("Status must be Pending, Shortlisted, Rejected, Incomplete, or Account Created".to_string());
        }

        let assigned_voyage = payload.assigned_voyage.as_ref().map(|v| v.trim().to_string());
        let assigned_capacity = payload.assigned_capacity.as_ref().map(|c| c.trim().to_string());

        if status == "Shortlisted" {
            if assigned_voyage.as_ref().map(|v| v.is_empty()).unwrap_or(true) {
                return Err("Voyage assignment is required for shortlisted candidates".to_string());
            }
            if assigned_capacity.as_ref().map(|c| c.is_empty()).unwrap_or(true) {
                return Err("Capacity (Role) assignment is required for shortlisted candidates".to_string());
            }
        }

        let mut candidate = crate::patterns::hr_document_state::model::candidate::Candidate::load(candidate_uuid, &state.pool).await?;
        let old_status = candidate.status.clone();
        candidate.transition_to(status, assigned_voyage.clone(), assigned_capacity.clone(), &state.pool).await?;

        let desc = format!(
            "Screened candidate {} (ID: {}) status from '{}' to '{}' (Assigned Voyage: {:?}, Capacity: {:?})",
            candidate.full_name,
            candidate_uuid,
            old_status,
            status,
            assigned_voyage,
            assigned_capacity
        );
        let _ = HrRepository::create_log(&state.pool, Some(user_uuid), "SCREEN_CANDIDATE", &desc, false).await;
        Ok(())
    }

    pub async fn get_available_roles(state: &DbState) -> Result<Vec<RoleOptionResponse>, String> {
        HrRepository::get_available_roles(&state.pool).await
    }

    pub async fn seed_test_candidates(state: &DbState, vacancy_id: String) -> Result<(), String> {
        let vacancy_uuid = Uuid::parse_str(&vacancy_id).map_err(|_| "Invalid vacancy ID format".to_string())?;
        HrRepository::seed_test_candidates(&state.pool, vacancy_uuid).await
    }

    pub async fn apply_for_job(state: &DbState, payload: ApplyJobRequest) -> Result<(), String> {
        let vacancy_uuid = Uuid::parse_str(&payload.vacancy_id).map_err(|_| "Invalid vacancy ID format".to_string())?;
        let full_name = payload.full_name.trim();
        let email = payload.email.trim();
        let cv_document = payload.cv_document.trim();

        if full_name.is_empty() {
            return Err("Full name is required".to_string());
        }
        if email.is_empty() {
            return Err("Email address is required".to_string());
        }
        if cv_document.is_empty() {
            return Err("CV document content is required".to_string());
        }

        let is_pdf = cv_document.starts_with("data:application/pdf;base64,");
        if !is_pdf {
            return Err("CV document must be a PDF file".to_string());
        }

        let cv_lower = cv_document.to_lowercase();
        let status = if cv_document.len() < 4000 || cv_lower.contains("incomplete") {
            "Incomplete"
        } else {
            "Pending"
        };

        HrRepository::apply_for_job(&state.pool, vacancy_uuid, full_name, email, cv_document, status).await
    }
}
