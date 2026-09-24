use sea_orm::*;
use uuid::Uuid;
use crate::entities::{incidents, security_incidents, medical_incidents, users};
use crate::incident::incident_model::incident_model::{IncidentResponse, SecurityIncidentDetails, MedicalIncidentDetails};

pub struct IncidentRepository;

impl IncidentRepository {
    pub async fn get_overnight_incidents(pool: &DatabaseConnection) -> Result<Vec<IncidentResponse>, String> {
        let list = incidents::Entity::find()
            .order_by_asc(incidents::Column::CreatedAt)
            .all(pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut responses = Vec::new();
        for item in list {
            let submitting_officer_name = if let Some(sub_id) = item.submitted_by {
                users::Entity::find_by_id(sub_id)
                    .one(pool)
                    .await
                    .ok()
                    .flatten()
                    .map(|u| u.display_name)
            } else {
                None
            };

            let security_details = if item.incident_type == "SECURITY" {
                security_incidents::Entity::find_by_id(item.incident_id)
                    .one(pool)
                    .await
                    .map_err(|e| e.to_string())?
                    .map(|si| SecurityIncidentDetails {
                        cctv_reviewed: si.cctv_reviewed,
                        warning_count: si.warning_count,
                        escalated_to_blacklist: si.escalated_to_blacklist,
                        evidence_log: si.evidence_log,
                    })
            } else {
                None
            };

            let medical_details = if item.incident_type == "MEDICAL" {
                medical_incidents::Entity::find_by_id(item.incident_id)
                    .one(pool)
                    .await
                    .map_err(|e| e.to_string())?
                    .map(|mi| MedicalIncidentDetails {
                        known_conditions: mi.known_conditions,
                        medications_on_file: mi.medications_on_file,
                        treatment_given: mi.treatment_given,
                        outcome: mi.outcome,
                        clearance_issued: mi.clearance_issued,
                    })
            } else {
                None
            };

            responses.push(IncidentResponse {
                incident_id: item.incident_id,
                incident_type: item.incident_type,
                description: item.description,
                location: item.location,
                severity: item.severity,
                status: item.status,
                resolved_at: item.resolved_at,
                created_at: item.created_at,
                submitted_by: item.submitted_by,
                submitting_officer_name,
                reviewed_by: item.reviewed_by,
                reviewed_at: item.reviewed_at,
                security_details,
                medical_details,
            });
        }

        Ok(responses)
    }

    pub async fn acknowledge_incident(pool: &DatabaseConnection,incident_id: Uuid,status: &str,reviewed_by: Uuid,) -> Result<(), String> {
        let incident = incidents::Entity::find_by_id(incident_id)
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Incident not found".to_string())?;

        if incident.submitted_by.is_none() {
            return Err("Incomplete record - officer information missing".to_string());
        }

        let mut active: incidents::ActiveModel = incident.into();
        active.status = Set(status.to_string());
        active.reviewed_by = Set(Some(reviewed_by));
        active.reviewed_at = Set(Some(chrono::Local::now().naive_local()));
        active.update(pool).await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn create_security_incident(pool: &DatabaseConnection,submitted_by: Uuid,description: &str,location: &str,severity: &str,cctv_reviewed: bool,warning_count: i32,escalated_to_blacklist: bool,evidence_log: Option<String>,) -> Result<(), String> {
        let incident_id = Uuid::new_v4();
        let incident_model = incidents::ActiveModel {
            incident_id: Set(incident_id),
            incident_type: Set("SECURITY".to_string()),
            description: Set(description.to_string()),
            location: Set(location.to_string()),
            severity: Set(severity.to_string()),
            status: Set("OPEN".to_string()),
            resolved_at: Set(None),
            created_at: Set(chrono::Local::now().naive_local()),
            submitted_by: Set(Some(submitted_by)),
            reviewed_by: Set(None),
            reviewed_at: Set(None),
        };
        incidents::Entity::insert(incident_model).exec(pool).await.map_err(|e| e.to_string())?;

        let security_model = security_incidents::ActiveModel {
            incident_id: Set(incident_id),
            cctv_reviewed: Set(cctv_reviewed),
            warning_count: Set(warning_count),
            escalated_to_blacklist: Set(escalated_to_blacklist),
            evidence_log: Set(evidence_log),
        };
        security_incidents::Entity::insert(security_model).exec(pool).await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn create_medical_incident(pool: &DatabaseConnection,submitted_by: Uuid,description: &str,location: &str,severity: &str,known_conditions: Option<String>,medications_on_file: Option<String>,treatment_given: Option<String>,outcome: Option<String>,clearance_issued: bool,) -> Result<(), String> {
        let incident_id = Uuid::new_v4();
        let incident_model = incidents::ActiveModel {
            incident_id: Set(incident_id),
            incident_type: Set("MEDICAL".to_string()),
            description: Set(description.to_string()),
            location: Set(location.to_string()),
            severity: Set(severity.to_string()),
            status: Set("OPEN".to_string()),
            resolved_at: Set(None),
            created_at: Set(chrono::Local::now().naive_local()),
            submitted_by: Set(Some(submitted_by)),
            reviewed_by: Set(None),
            reviewed_at: Set(None),
        };
        incidents::Entity::insert(incident_model).exec(pool).await.map_err(|e| e.to_string())?;

        let medical_model = medical_incidents::ActiveModel {
            incident_id: Set(incident_id),
            known_conditions: Set(known_conditions),
            medications_on_file: Set(medications_on_file),
            treatment_given: Set(treatment_given),
            outcome: Set(outcome),
            clearance_issued: Set(clearance_issued),
        };
        medical_incidents::Entity::insert(medical_model).exec(pool).await.map_err(|e| e.to_string())?;

        Ok(())
    }
}
