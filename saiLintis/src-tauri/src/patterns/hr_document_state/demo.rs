use crate::patterns::hr_document_state::model::candidate::Candidate;
use sea_orm::{DatabaseConnection, ConnectionTrait, Statement, DbBackend};
use uuid::Uuid;

#[allow(dead_code)]
pub async fn run_state_demo(pool: &DatabaseConnection) {
    let candidate_id = Uuid::new_v4();
    let vacancy_id = Uuid::new_v4();
    let setup_vac = Statement::from_sql_and_values(
        DbBackend::Postgres,
        "INSERT INTO job_vacancies (vacancy_id, title, description, requirements, status, created_at, deadline) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '1 day')",
        vec![
            vacancy_id.into(),
            "Demo Vacancy".into(),
            "Demo".into(),
            "Demo".into(),
            "Open".into(),
        ]
    );
    let _ = pool.execute(setup_vac).await;

    let setup_cand = Statement::from_sql_and_values(
        DbBackend::Postgres,
        "INSERT INTO candidates (candidate_id, vacancy_id, full_name, email, cv_document, status, applied_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        vec![
            candidate_id.into(),
            vacancy_id.into(),
            "Demo Candidate".into(),
            "demo@candidate.com".into(),
            "demo resume".into(),
            "Pending".into(),
        ]
    );
    let _ = pool.execute(setup_cand).await;

    let mut candidate = Candidate::load(candidate_id, pool).await.unwrap();
    let _ = candidate.transition_to("Shortlisted", Some("Voyage 1".to_string()), Some("Chef".to_string()), pool).await;
    let _ = candidate.transition_to("Account Created", None, None, pool).await;

    let cleanup_cand = Statement::from_sql_and_values(
        DbBackend::Postgres,
        "DELETE FROM candidates WHERE candidate_id = $1",
        vec![candidate_id.into()],
    );
    let _ = pool.execute(cleanup_cand).await;

    let cleanup_vac = Statement::from_sql_and_values(
        DbBackend::Postgres,
        "DELETE FROM job_vacancies WHERE vacancy_id = $1",
        vec![vacancy_id.into()],
    );
    let _ = pool.execute(cleanup_vac).await;
}
