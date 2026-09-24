use sea_orm::*;
use uuid::Uuid;
use crate::entities::{job_vacancies, candidates, roles};
use crate::hr::hr_model::hr_model::{JobVacancyResponse, CandidateResponse, RoleOptionResponse};

pub struct HrRepository;

impl HrRepository {
    pub async fn create_log(pool: &DatabaseConnection,account_id: Option<Uuid>,action: &str,description: &str,is_flagged: bool,) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO system_logs (account_id, action, description, is_flagged, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![account_id.into(), action.into(), description.into(), is_flagged.into()],
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_job_vacancies(pool: &DatabaseConnection) -> Result<Vec<JobVacancyResponse>, String> {
        let vacancies = job_vacancies::Entity::find().order_by_desc(job_vacancies::Column::CreatedAt).all(pool).await.map_err(|e| e.to_string())?;

        let mut responses = Vec::new();
        for v in vacancies {
            let candidate_count = candidates::Entity::find().filter(candidates::Column::VacancyId.eq(v.vacancy_id)).count(pool).await.map_err(|e| e.to_string())? as i64;

            responses.push(JobVacancyResponse {
                vacancy_id: v.vacancy_id,
                title: v.title,
                description: v.description,
                requirements: v.requirements,
                status: v.status,
                created_at: v.created_at,
                deadline: v.deadline,
                candidate_count,
            });
        }
        Ok(responses)
    }

    pub async fn create_job_vacancy(pool: &DatabaseConnection,title: &str,description: &str,requirements: &str,deadline: chrono::NaiveDateTime,status: &str,user_uuid: Uuid,) -> Result<Uuid, String> {
        let vacancy_id = Uuid::new_v4();
        let model = job_vacancies::ActiveModel {
            vacancy_id: Set(vacancy_id),
            title: Set(title.to_string()),
            description: Set(description.to_string()),
            requirements: Set(requirements.to_string()),
            status: Set(status.to_string()),
            created_at: Set(chrono::Local::now().naive_local()),
            deadline: Set(deadline),
        };

        job_vacancies::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        let _ = Self::create_log(pool,Some(user_uuid),"CREATE_JOB_VACANCY",&format!("Created job vacancy: {} (ID: {})", title, vacancy_id),false,).await;
        Ok(vacancy_id)
    }

    pub async fn update_job_vacancy(pool: &DatabaseConnection,vacancy_uuid: Uuid,title: &str,description: &str,requirements: &str,deadline: chrono::NaiveDateTime,status: &str,user_uuid: Uuid,) -> Result<(), String> {
        let vacancy = job_vacancies::Entity::find_by_id(vacancy_uuid).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Job vacancy not found".to_string())?;
        let mut active: job_vacancies::ActiveModel = vacancy.into();
        active.title = Set(title.to_string());
        active.description = Set(description.to_string());
        active.requirements = Set(requirements.to_string());
        active.deadline = Set(deadline);
        active.status = Set(status.to_string());

        active.update(pool).await.map_err(|e| e.to_string())?;

        let _ = Self::create_log(
            pool,
            Some(user_uuid),
            "UPDATE_JOB_VACANCY",
            &format!("Updated job vacancy: {} (ID: {})", title, vacancy_uuid),
            false,
        )
        .await;

        Ok(())
    }

    pub async fn delete_job_vacancy(pool: &DatabaseConnection,vacancy_uuid: Uuid,user_uuid: Uuid,) -> Result<(), String> {
        let vacancy = job_vacancies::Entity::find_by_id(vacancy_uuid).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Job vacancy not found".to_string())?;

        job_vacancies::Entity::delete_by_id(vacancy_uuid).exec(pool).await.map_err(|e| e.to_string())?;

        let _ = Self::create_log(pool,Some(user_uuid),"DELETE_JOB_VACANCY", &format!("Deleted job vacancy: {} (ID: {})", vacancy.title, vacancy_uuid),false,).await;
        Ok(())
    }

    pub async fn list_candidates(pool: &DatabaseConnection,vacancy_uuid_opt: Option<Uuid>,) -> Result<Vec<CandidateResponse>, String> {
        let mut query = candidates::Entity::find();
        if let Some(v_uuid) = vacancy_uuid_opt {
            query = query.filter(candidates::Column::VacancyId.eq(v_uuid));
        }

        let list = query.order_by_desc(candidates::Column::AppliedAt).all(pool).await.map_err(|e| e.to_string())?;

        let mut responses = Vec::new();
        for c in list {
            let vacancy_title = if let Some(v) = job_vacancies::Entity::find_by_id(c.vacancy_id).one(pool).await.ok().flatten(){
                Some(v.title)
            } else {
                None
            };

            responses.push(CandidateResponse {
                candidate_id: c.candidate_id,
                vacancy_id: c.vacancy_id,
                full_name: c.full_name,
                email: c.email,
                cv_document: c.cv_document,
                status: c.status,
                applied_at: c.applied_at,
                assigned_voyage: c.assigned_voyage,
                assigned_capacity: c.assigned_capacity,
                vacancy_title,
            });
        }
        Ok(responses)
    }

    #[allow(dead_code)]
    pub async fn screen_candidate(pool: &DatabaseConnection,candidate_uuid: Uuid,status: &str,assigned_voyage: Option<String>,assigned_capacity: Option<String>,user_uuid: Uuid,) -> Result<(), String> {
        let candidate = candidates::Entity::find_by_id(candidate_uuid).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Candidate not found".to_string())?;

        let old_status = candidate.status.clone();
        let mut active: candidates::ActiveModel = candidate.clone().into();
        active.status = Set(status.to_string());
        active.assigned_voyage = Set(assigned_voyage.clone());
        active.assigned_capacity = Set(assigned_capacity.clone());

        active.update(pool).await.map_err(|e| e.to_string())?;

        let desc = format!(
            "Screened candidate {} (ID: {}) status from '{}' to '{}' (Assigned Voyage: {:?}, Capacity: {:?})",
            candidate.full_name,
            candidate_uuid,
            old_status,
            status,
            assigned_voyage,
            assigned_capacity
        );

        let _ = Self::create_log(pool, Some(user_uuid), "SCREEN_CANDIDATE", &desc, false).await;

        Ok(())
    }

    pub async fn get_available_roles(pool: &DatabaseConnection) -> Result<Vec<RoleOptionResponse>, String> {
        let list = roles::Entity::find().order_by_asc(roles::Column::RoleName).all(pool).await.map_err(|e| e.to_string())?;

        Ok(list.into_iter().map(|r| RoleOptionResponse {
            role_id: r.role_id,
            role_name: r.role_name,
            department: r.department,
        }).collect())
    }

    pub async fn seed_test_candidates(pool: &DatabaseConnection, vacancy_uuid: Uuid) -> Result<(), String> {
        let test_data = vec![
            ("Alice Margatroid", "alice@wonderland.com", "EXPERIENCE:\n- 5 years as Chef de Partie at Royal Caribbean\n- 2 years as Commis Chef at Marriott Hotel\n\nEDUCATION:\n- Culinary Arts Degree, Le Cordon Bleu\n\nSKILLS:\n- Food safety standards (HACCP)\n- Pastry and fine dining menu creation"),
            ("Bob Miller", "bob@sailor.com", "EXPERIENCE:\n- 3 years as Cabin Steward at Carnival Cruise Line\n- 1 year Guest Services Agent at Hilton\n\nEDUCATION:\n- Diploma in Hospitality Management\n\nSKILLS:\n- Cabin cleaning & housekeeping excellence\n- Fluent in English & Spanish"),
            ("Charlie Davidson", "charlie@incomplete.com", "INCOMPLETE CV PROFILE:\n- Missing contact number.\n- Missing detailed work history timeline.\n- Contact email: charlie@incomplete.com")
        ];

        for (name, email, cv) in test_data {
            let model = candidates::ActiveModel {
                candidate_id: Set(Uuid::new_v4()),
                vacancy_id: Set(vacancy_uuid),
                full_name: Set(name.to_string()),
                email: Set(email.to_string()),
                cv_document: Set(cv.to_string()),
                status: Set("Pending".to_string()),
                applied_at: Set(chrono::Local::now().naive_local()),
                assigned_voyage: Set(None),
                assigned_capacity: Set(None),
            };
            candidates::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn apply_for_job(pool: &DatabaseConnection,vacancy_uuid: Uuid,full_name: &str,email: &str,cv_document: &str,status: &str,) -> Result<(), String> {
        let candidate_id = Uuid::new_v4();
        let model = candidates::ActiveModel {
            candidate_id: Set(candidate_id),
            vacancy_id: Set(vacancy_uuid),
            full_name: Set(full_name.to_string()),
            email: Set(email.to_string()),
            cv_document: Set(cv_document.to_string()),
            status: Set(status.to_string()),
            applied_at: Set(chrono::Local::now().naive_local()),
            assigned_voyage: Set(None),
            assigned_capacity: Set(None),
        };

        candidates::Entity::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
