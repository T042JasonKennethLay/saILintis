use crate::patterns::hr_document_state::model::candidate::Candidate;

pub trait CandidateState: Send + Sync {
    fn shortlist(&self, candidate: &Candidate) -> Option<Box<dyn CandidateState>>;
    fn reject(&self, candidate: &Candidate) -> Option<Box<dyn CandidateState>>;
    fn mark_incomplete(&self, candidate: &Candidate) -> Option<Box<dyn CandidateState>>;
    fn create_account(&self, candidate: &Candidate) -> Option<Box<dyn CandidateState>>;
    fn get_status_name(&self) -> &'static str;
}
