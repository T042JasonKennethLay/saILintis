use crate::patterns::hr_document_state::model::candidate::Candidate;
use crate::patterns::hr_document_state::state::i_hr_document_state::CandidateState;
use crate::patterns::hr_document_state::state::shortlisted_state::ShortlistedState;
use crate::patterns::hr_document_state::state::rejected_state::RejectedState;

pub struct IncompleteState;

impl CandidateState for IncompleteState {
    fn shortlist(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        Some(Box::new(ShortlistedState))
    }

    fn reject(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        Some(Box::new(RejectedState))
    }

    fn mark_incomplete(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        None
    }

    fn create_account(&self, _candidate: &Candidate) -> Option<Box<dyn CandidateState>> {
        None
    }

    fn get_status_name(&self) -> &'static str {
        "Incomplete"
    }
}
