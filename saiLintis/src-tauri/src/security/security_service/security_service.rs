use crate::database::database::DbState;
use crate::security::{
    security_model::security_model::*,
    security_repository::security_repository::SecurityRepository,
};
use uuid::Uuid;

pub struct SecurityService;

impl SecurityService {
    pub async fn list_zones(state: &DbState) -> Result<Vec<ZoneResponse>, String> {
        SecurityRepository::list_zones(&state.pool).await
    }

    pub async fn get_zone_by_id(state: &DbState, zone_id: String) -> Result<ZoneResponse, String> {
        let zone = SecurityRepository::get_zone_by_id(&state.pool, &zone_id).await?;
        match zone {
            Some(z) => Ok(z),
            None => Err("Zone not found".to_string()),
        }
    }

    pub async fn get_zone_crew(state: &DbState, zone_id: String) -> Result<Vec<ZoneCrewResponse>, String> {
        SecurityRepository::get_zone_crew(&state.pool, &zone_id).await
    }

    pub async fn send_zone_specific_security_alert(
        state: &DbState,
        payload: SendZoneAlertRequest,
    ) -> Result<Uuid, String> {
        let msg = payload.message.trim();
        if msg.is_empty() {
            return Err("Alert message is required before sending.".to_string());
        }

        let sent_by_uuid = Uuid::parse_str(&payload.sent_by).map_err(|_| "Invalid sender ID format".to_string())?;

        let crew = SecurityRepository::get_zone_crew(&state.pool, &payload.zone_id).await?;
        if crew.is_empty() {
            return Err("No crew assigned to this zone.".to_string());
        }

        let recipient_names: Vec<String> = crew.iter().map(|c| c.display_name.clone()).collect();
        let recipients_str = recipient_names.join(", ");

        SecurityRepository::send_zone_alert(
            &state.pool,
            &payload.zone_id,
            msg,
            sent_by_uuid,
            &recipients_str,
        )
        .await
    }

    pub async fn close_zone_alert(
        state: &DbState,
        alert_id_str: String,
        closed_by_str: String,
    ) -> Result<(), String> {
        let alert_uuid = Uuid::parse_str(&alert_id_str).map_err(|_| "Invalid alert ID format".to_string())?;
        let closed_by_uuid = Uuid::parse_str(&closed_by_str).map_err(|_| "Invalid user ID format".to_string())?;
        SecurityRepository::close_zone_alert(&state.pool, alert_uuid, closed_by_uuid).await
    }

    pub async fn list_zone_alerts(state: &DbState) -> Result<Vec<ZoneAlertResponse>, String> {
        SecurityRepository::list_zone_alerts(&state.pool).await
    }
}
