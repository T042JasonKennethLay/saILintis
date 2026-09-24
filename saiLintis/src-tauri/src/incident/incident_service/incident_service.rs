use crate::database::database::DbState;
use uuid::Uuid;
use crate::incident::{
    incident_model::incident_model::{IncidentResponse, AcknowledgeIncidentRequest, GeneratePdfRequest},
    incident_repository::incident_repository::IncidentRepository,
};
use printpdf::*;
use std::io::BufWriter;
use std::io::Cursor;
use base64::{engine::general_purpose, Engine as _};
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};

pub struct IncidentService;

impl IncidentService {
    pub async fn get_overnight_incidents(state: &DbState) -> Result<Vec<IncidentResponse>, String> {
        IncidentRepository::get_overnight_incidents(&state.pool).await
    }

    pub async fn acknowledge_incident(state: &DbState, payload: AcknowledgeIncidentRequest) -> Result<(), String> {
        let incident_uuid = Uuid::parse_str(&payload.incident_id).map_err(|_| "Invalid incident ID format".to_string())?;
        let reviewer_uuid = Uuid::parse_str(&payload.reviewed_by).map_err(|_| "Invalid reviewer ID format".to_string())?;

        let status = payload.status.trim().to_string();
        if status != "Reviewed"
            && status != "Closed -> Reviewed"
            && status != "Escalated -> Action Pending"
            && status != "Emergency Broadcasted"
            && status != "Evacuation Authorized"
            && status != "Route Alteration Authorized"
        {
            return Err("Invalid acknowledgment status".to_string());
        }

        IncidentRepository::acknowledge_incident(&state.pool, incident_uuid, &status, reviewer_uuid).await?;
        let action_name = if status == "Emergency Broadcasted" || status == "Evacuation Authorized" || status == "Route Alteration Authorized" {
            "Escalate Incident"
        } else {
            "Acknowledge Incident"
        };

        let desc = format!("Incident {} status updated to '{}' by Captain/Officer {}", payload.incident_id, status, payload.reviewed_by);

        let _ = state.pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO system_logs (account_id, action, description, is_flagged, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![
                Some(reviewer_uuid).into(),
                action_name.into(),
                desc.into(),
                false.into(),
            ],
        )).await;
        if status == "Emergency Broadcasted" || status == "Evacuation Authorized" {
            let alert_msg = if status == "Emergency Broadcasted" {
                format!("EMERGENCY BROADCAST AUTHORIZED: Critical situation reported at incident location. All decks stand by.")
            } else {
                format!("SHIP EVACUATION AUTHORIZED: Muster station evacuation protocol activated for critical incident.")
            };

            let alert_id = Uuid::new_v4();
            let _ = state.pool.execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                INSERT INTO zone_alerts (alert_id, zone_id, message, sent_by, sent_at, status, recipients)
                VALUES ($1, 'ALL', $2, $3, NOW(), 'Active', 'Safety Officer');
                "#,
                vec![
                    alert_id.into(),
                    alert_msg.into(),
                    reviewer_uuid.into(),
                ],
            )).await;
        }

        Ok(())
    }

    pub async fn create_security_incident(state: &DbState, payload: crate::incident::incident_model::incident_model::CreateSecurityIncidentRequest) -> Result<(), String> {
        let submitter_uuid = Uuid::parse_str(&payload.submitted_by).map_err(|_| "Invalid submitter ID format".to_string())?;

        let desc = payload.description.trim();
        let loc = payload.location.trim();
        let sev = payload.severity.trim().to_string();

        if desc.is_empty() || loc.is_empty() {
            return Err("Description and Location are required fields".to_string());
        }

        if sev != "Low" && sev != "Medium" && sev != "Critical" {
            return Err("Severity must be Low, Medium, or Critical".to_string());
        }

        IncidentRepository::create_security_incident(
            &state.pool,
            submitter_uuid,
            desc,
            loc,
            &sev,
            payload.cctv_reviewed,
            payload.warning_count,
            payload.escalated_to_blacklist,
            payload.evidence_log,
        ).await
    }

    pub async fn create_medical_incident(state: &DbState, payload: crate::incident::incident_model::incident_model::CreateMedicalIncidentRequest) -> Result<(), String> {
        let submitter_uuid = Uuid::parse_str(&payload.submitted_by).map_err(|_| "Invalid submitter ID format".to_string())?;

        let desc = payload.description.trim();
        let loc = payload.location.trim();
        let sev = payload.severity.trim().to_string();

        if desc.is_empty() || loc.is_empty() {
            return Err("Description and Location are required fields".to_string());
        }

        if sev != "Low" && sev != "Medium" && sev != "Critical" {
            return Err("Severity must be Low, Medium, or Critical".to_string());
        }

        IncidentRepository::create_medical_incident(
            &state.pool,
            submitter_uuid,
            desc,
            loc,
            &sev,
            payload.known_conditions,
            payload.medications_on_file,
            payload.treatment_given,
            payload.outcome,
            payload.clearance_issued,
        ).await
    }

    pub async fn generate_incident_pdf(state: &DbState, payload: GeneratePdfRequest) -> Result<String, String> {
        let incident_uuid = Uuid::parse_str(&payload.incident_id).map_err(|_| "Invalid incident ID".to_string())?;

        let all = IncidentRepository::get_overnight_incidents(&state.pool).await?;
        let incident = all.into_iter().find(|i| i.incident_id == incident_uuid)
            .ok_or_else(|| "Incident not found".to_string())?;

        let (doc, page1, layer1) = PdfDocument::new(
            format!("Incident Report - {}", &incident.incident_id.to_string()[..8]),
            Mm(210.0_f32),
            Mm(297.0_f32),
            "Layer 1",
        );

        let current_layer = doc.get_page(page1).get_layer(layer1);
        let font = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;
        let font_regular = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;

        let mut y = 270.0_f32;
        let left = 20.0_f32;

        current_layer.use_text("SHIP CAPTAIN INCIDENT REPORT", 18.0, Mm(left), Mm(y), &font);
        y -= 10.0;
        current_layer.use_text(
            format!("Generated: {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S")),
            9.0, Mm(left), Mm(y), &font_regular,
        );
        y -= 12.0;

        current_layer.use_text(format!("Incident ID: {}", incident.incident_id), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
        current_layer.use_text(format!("Type: {}", incident.incident_type), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
        current_layer.use_text(format!("Severity: {}", incident.severity), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
        current_layer.use_text(format!("Status: {}", incident.status), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
        current_layer.use_text(format!("Location: {}", incident.location), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
        current_layer.use_text(
            format!("Reporting Officer: {}", incident.submitting_officer_name.as_deref().unwrap_or("Unknown")),
            10.0, Mm(left), Mm(y), &font_regular,
        ); y -= 7.0;
        current_layer.use_text(
            format!("Date Filed: {}", incident.created_at.format("%Y-%m-%d %H:%M")),
            10.0, Mm(left), Mm(y), &font_regular,
        ); y -= 12.0;

        current_layer.use_text("Description:", 10.0, Mm(left), Mm(y), &font);
        y -= 7.0;

        let words: Vec<&str> = incident.description.split_whitespace().collect();
        let mut line = String::new();
        for word in words {
            let candidate = if line.is_empty() { word.to_string() } else { format!("{} {}", line, word) };
            if candidate.len() > 85 {
                current_layer.use_text(line.clone(), 10.0, Mm(left), Mm(y), &font_regular);
                y -= 6.0;
                line = word.to_string();
            } else {
                line = candidate;
            }
        }
        if !line.is_empty() {
            current_layer.use_text(line, 10.0, Mm(left), Mm(y), &font_regular);
            y -= 12.0;
        }

        if let Some(sec) = &incident.security_details {
            current_layer.use_text("Security Investigation Details:", 10.0, Mm(left), Mm(y), &font); y -= 7.0;
            current_layer.use_text(format!("CCTV Reviewed: {}", if sec.cctv_reviewed { "Yes" } else { "No" }), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            current_layer.use_text(format!("Warnings Issued: {}", sec.warning_count), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            current_layer.use_text(format!("Escalated to Blacklist: {}", if sec.escalated_to_blacklist { "Yes" } else { "No" }), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            if let Some(ev) = &sec.evidence_log {
                current_layer.use_text(format!("Evidence Log: {}", ev), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            }
        }

        if let Some(med) = &incident.medical_details {
            current_layer.use_text("Medical Assessment Details:", 10.0, Mm(left), Mm(y), &font); y -= 7.0;
            if let Some(kc) = &med.known_conditions {
                current_layer.use_text(format!("Known Conditions: {}", kc), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            }
            if let Some(mof) = &med.medications_on_file {
                current_layer.use_text(format!("Medications on File: {}", mof), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            }
            if let Some(tg) = &med.treatment_given {
                current_layer.use_text(format!("Treatment Given: {}", tg), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            }
            if let Some(out) = &med.outcome {
                current_layer.use_text(format!("Outcome: {}", out), 10.0, Mm(left), Mm(y), &font_regular); y -= 7.0;
            }
            current_layer.use_text(format!("Clearance Issued: {}", if med.clearance_issued { "Yes" } else { "No" }), 10.0, Mm(left), Mm(y), &font_regular);
        }

        let mut buf = BufWriter::new(Cursor::new(Vec::<u8>::new()));
        doc.save(&mut buf).map_err(|e| e.to_string())?;
        let bytes = buf.into_inner().map_err(|e| e.to_string())?.into_inner();
        Ok(general_purpose::STANDARD.encode(&bytes))
    }
}
