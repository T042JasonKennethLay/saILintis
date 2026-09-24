use crate::patterns::hr_document_state::model::candidate::Candidate;
use crate::patterns::hr_document_state::state::i_hr_document_state::CandidateState;
use crate::patterns::hr_document_state::state::shortlisted_state::ShortlistedState;
use crate::patterns::hr_document_state::state::rejected_state::RejectedState;
use crate::patterns::hr_document_state::state::incomplete_state::IncompleteState;

pub struct PendingState;

impl CandidateState for PendingState {
    fn shortlist(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        Some(Box::new(ShortlistedState))
    }

    fn reject(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        Some(Box::new(RejectedState))
    }

    fn mark_incomplete(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        Some(Box::new(IncompleteState))
    }

    fn create_account(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        None
    }

    fn get_status_name(&self) -> &'static str {
        "Pending"
    }
}
