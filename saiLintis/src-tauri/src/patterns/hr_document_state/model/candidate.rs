use uuid::Uuid;
use sea_orm::{DatabaseConnection, ConnectionTrait, Statement, DbBackend};
use crate::patterns::hr_document_state::state::i_hr_document_state::CandidateState;
use crate::patterns::hr_document_state::state::pending_state::PendingState;
use crate::patterns::hr_document_state::state::shortlisted_state::ShortlistedState;
use crate::patterns::hr_document_state::state::rejected_state::RejectedState;
use crate::patterns::hr_document_state::state::incomplete_state::IncompleteState;
use crate::patterns::hr_document_state::state::account_created_state::AccountCreatedState;

pub struct Candidate {
    pub candidate_id: Uuid,
    pub full_name: String,
    pub status: String,
    pub state: Option<Box<dyn CandidateState>>,
}

impl Candidate {
    pub async fn load(candidate_id: Uuid, pool: &DatabaseConnection) -> Result<Self, String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            "SELECT full_name, status FROM candidates WHERE candidate_id = $1",
            vec![candidate_id.into()],
        );
        let row = pool.query_one(stmt).await.map_err(|e| e.to_string())?
            .ok_or_else(|| "Candidate not found".to_string())?;

        let full_name: String = row.try_get("", "full_name").map_err(|e| e.to_string())?;
        let status: String = row.try_get("", "status").map_err(|e| e.to_string())?;

        let state: Box<dyn CandidateState> = match status.as_str() {
            "Pending" => Box::new(PendingState),
            "Shortlisted" => Box::new(ShortlistedState),
            "Rejected" => Box::new(RejectedState),
            "Incomplete" => Box::new(IncompleteState),
            "Account Created" => Box::new(AccountCreatedState),
            _ => return Err(format!("Invalid candidate status: {}", status)),
        };

        Ok(Self {
            candidate_id,
            full_name,
            status,
            state: Some(state),
        })
    }

    pub async fn transition_to(
        &mut self,
        target_status: &str,
        assigned_voyage: Option<String>,
        assigned_capacity: Option<String>,
        pool: &DatabaseConnection,
    ) -> Result<(), String> {
        let new_state = match target_status {
            "Pending" => {
                if self.status == "Pending" {
                    return Ok(());
                }
                None
            }
            "Shortlisted" => self.state.as_ref().and_then(|s| s.shortlist(self)),
            "Rejected" => self.state.as_ref().and_then(|s| s.reject(self)),
            "Incomplete" => self.state.as_ref().and_then(|s| s.mark_incomplete(self)),
            "Account Created" => self.state.as_ref().and_then(|s| s.create_account(self)),
            _ => return Err(format!("Unknown status: {}", target_status)),
        };

        if let Some(ns) = new_state {
            let stmt = Statement::from_sql_and_values(
                DbBackend::Postgres,
                "UPDATE candidates SET status = $1, assigned_voyage = $2, assigned_capacity = $3 WHERE candidate_id = $4",
                vec![
                    ns.get_status_name().into(),
                    assigned_voyage.into(),
                    assigned_capacity.into(),
                    self.candidate_id.into(),
                ],
            );
            pool.execute(stmt).await.map_err(|e| e.to_string())?;
            self.status = ns.get_status_name().to_string();
            self.state = Some(ns);
            Ok(())
        } else {
            Err(format!(
                "Candidate {} transition from '{}' to '{}' is invalid.",
                self.full_name, self.status, target_status
            ))
        }
    }
}
