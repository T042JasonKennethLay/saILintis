use crate::database::database::DbState;
use uuid::Uuid;
use crate::medical::{
    medical_model::medical_model::{MedicalPassengerProfile, CreateMedicalClearanceRequest},
    medical_repository::medical_repository::MedicalRepository,
};
use printpdf::*;
use std::io::BufWriter;
use std::io::Cursor;
use base64::{engine::general_purpose, Engine as _};
use sea_orm::*;
use crate::entities::{medical_clearances, incidents, users};

pub struct MedicalService;

impl MedicalService {
    pub async fn get_passenger_medical_profile(state: &DbState, passenger_id: String) -> Result<Option<MedicalPassengerProfile>, String> {
        let uid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        MedicalRepository::get_passenger_medical_profile(&state.pool, uid).await
    }

    pub async fn save_medical_clearance(state: &DbState, payload: CreateMedicalClearanceRequest) -> Result<String, String> {
        let notes = payload.assessment_notes.trim();
        if notes.is_empty() {
            return Err("Assessment notes are required before decision can be confirmed.".to_string());
        }

        let inc_uuid = Uuid::parse_str(&payload.incident_id).map_err(|_| "Invalid incident ID".to_string())?;
        let officer_uuid = Uuid::parse_str(&payload.issued_by).map_err(|_| "Invalid officer ID".to_string())?;

        let incident = incidents::Entity::find_by_id(inc_uuid)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "No incident record found for this passenger.".to_string())?;

        let clearance_id = Uuid::new_v4();
        MedicalRepository::save_medical_clearance(
            &state.pool,
            clearance_id,
            inc_uuid,
            payload.fit_to_continue,
            notes,
            officer_uuid,
        ).await?;

        let pass_status = if payload.fit_to_continue {
            "Fit to Continue"
        } else {
            "Disembarked"
        };

        if let Some(sub_by) = incident.submitted_by {
            let _ = MedicalRepository::update_passenger_status(&state.pool, sub_by, pass_status).await;
        }

        let _ = MedicalRepository::set_clearance_issued_in_incident(&state.pool, inc_uuid, true).await;

        let alert_msg = format!(
            "MEDICAL CLEARANCE UPDATED: Passenger clearance status is '{}' for incident ID: {}.",
            pass_status, payload.incident_id
        );
        let _ = MedicalRepository::save_notification(
            &state.pool,
            Uuid::new_v4(),
            &alert_msg,
            officer_uuid,
            "Safety Officer",
        ).await;

        let action_desc = format!(
            "Clearance document {} issued for incident {} by Medical Officer {}",
            clearance_id, payload.incident_id, payload.issued_by
        );
        let _ = MedicalRepository::record_action(
            &state.pool,
            Uuid::new_v4(),
            Some(officer_uuid),
            "Issue Medical Clearance",
            &action_desc,
        ).await;

        Ok(clearance_id.to_string())
    }

    pub async fn generate_clearance_pdf(state: &DbState, clearance_id: String) -> Result<String, String> {
        let clearance_uuid = Uuid::parse_str(&clearance_id).map_err(|_| "Invalid clearance ID".to_string())?;
        let clearance = medical_clearances::Entity::find_by_id(clearance_uuid)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Clearance not found".to_string())?;

        let officer = users::Entity::find_by_id(clearance.issued_by)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Officer not found".to_string())?;

        let (doc, page1, layer1) = PdfDocument::new(
            format!("Medical Clearance - {}", &clearance_id[..8]),
            Mm(210.0_f32),
            Mm(297.0_f32),
            "Layer 1",
        );

        let current_layer = doc.get_page(page1).get_layer(layer1);
        let font = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;
        let font_regular = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;

        let mut y = 270.0_f32;
        let left = 20.0_f32;

        current_layer.use_text("MEDICAL CLEARANCE FOR CONTINUED VOYAGE", 16.0, Mm(left), Mm(y), &font);
        y -= 10.0;
        current_layer.use_text(
            format!("Generated: {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S")),
            9.0, Mm(left), Mm(y), &font_regular,
        );
        y -= 15.0;

        current_layer.use_text(format!("Clearance ID: {}", clearance.clearance_id), 10.0, Mm(left), Mm(y), &font_regular); y -= 8.0;
        current_layer.use_text(format!("Incident ID: {}", clearance.incident_id), 10.0, Mm(left), Mm(y), &font_regular); y -= 8.0;
        current_layer.use_text(
            format!("Status: {}", if clearance.fit_to_continue { "Fit to Continue Voyage" } else { "Disembarkation Recommended" }),
            10.0, Mm(left), Mm(y), &font,
        ); y -= 8.0;
        current_layer.use_text(format!("Issued By: {}", officer.display_name), 10.0, Mm(left), Mm(y), &font_regular); y -= 8.0;
        current_layer.use_text(format!("Issued At: {}", clearance.issued_at.format("%Y-%m-%d %H:%M:%S")), 10.0, Mm(left), Mm(y), &font_regular); y -= 15.0;

        current_layer.use_text("Assessment Notes:", 10.0, Mm(left), Mm(y), &font);
        y -= 8.0;

        let words: Vec<&str> = clearance.assessment_notes.split_whitespace().collect();
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
        }

        let mut buf = BufWriter::new(Cursor::new(Vec::<u8>::new()));
        doc.save(&mut buf).map_err(|e| e.to_string())?;
        let bytes = buf.into_inner().map_err(|e| e.to_string())?.into_inner();
        Ok(general_purpose::STANDARD.encode(&bytes))
    }
}
