use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveDateTime;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SecurityIncidentDetails {
    pub cctv_reviewed: bool,
    pub warning_count: i32,
    pub escalated_to_blacklist: bool,
    pub evidence_log: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MedicalIncidentDetails {
    pub known_conditions: Option<String>,
    pub medications_on_file: Option<String>,
    pub treatment_given: Option<String>,
    pub outcome: Option<String>,
    pub clearance_issued: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IncidentResponse {
    pub incident_id: Uuid,
    pub incident_type: String,
    pub description: String,
    pub location: String,
    pub severity: String,
    pub status: String,
    pub resolved_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub submitted_by: Option<Uuid>,
    pub submitting_officer_name: Option<String>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<NaiveDateTime>,
    pub security_details: Option<SecurityIncidentDetails>,
    pub medical_details: Option<MedicalIncidentDetails>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AcknowledgeIncidentRequest {
    pub incident_id: String,
    pub status: String,
    pub reviewed_by: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateSecurityIncidentRequest {
    pub submitted_by: String,
    pub description: String,
    pub location: String,
    pub severity: String,
    pub cctv_reviewed: bool,
    pub warning_count: i32,
    pub escalated_to_blacklist: bool,
    pub evidence_log: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateMedicalIncidentRequest {
    pub submitted_by: String,
    pub description: String,
    pub location: String,
    pub severity: String,
    pub known_conditions: Option<String>,
    pub medications_on_file: Option<String>,
    pub treatment_given: Option<String>,
    pub outcome: Option<String>,
    pub clearance_issued: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GeneratePdfRequest {
    pub incident_id: String,
}
