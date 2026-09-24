use crate::patterns::hr_document_state::model::candidate::Candidate;
use crate::patterns::hr_document_state::state::i_hr_document_state::CandidateState;
use crate::patterns::hr_document_state::state::account_created_state::AccountCreatedState;

pub struct ShortlistedState;

impl CandidateState for ShortlistedState {
    fn shortlist(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        None
    }

    fn reject(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        None
    }

    fn mark_incomplete(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        None
    }

    fn create_account(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        Some(Box::new(AccountCreatedState))
    }

    fn get_status_name(&self) -> &'static str {
        "Shortlisted"
    }
}
