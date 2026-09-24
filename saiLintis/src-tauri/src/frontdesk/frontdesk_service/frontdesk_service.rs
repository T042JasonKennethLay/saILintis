use crate::database::database::DbState;
use crate::frontdesk::frontdesk_model::frontdesk_model::{
    CabinResponse, FdoPassengerResponse, ComplaintResponse,
    ChatMessageResponse, ChatQueueEntry, SendChatMessageRequest,
    AssignCabinRequest, UpdatePassengerStatusRequest, ResolveComplaintRequest,
};
use crate::frontdesk::frontdesk_repository::frontdesk_repository::FrontdeskRepository;
use crate::entities::users;
use sea_orm::*;
use uuid::Uuid;

pub struct FrontdeskService;

impl FrontdeskService {
    pub async fn get_all_passengers(state: &DbState) -> Result<Vec<FdoPassengerResponse>, String> {
        FrontdeskRepository::get_all_passengers(state).await
    }

    pub async fn checkin_passenger(state: &DbState, passenger_id: String) -> Result<String, String> {
        FrontdeskRepository::checkin_passenger(state, &passenger_id).await?;
        Ok("Passenger checked in successfully.".to_string())
    }

    pub async fn checkout_passenger(state: &DbState, passenger_id: String) -> Result<String, String> {
        FrontdeskRepository::checkout_passenger(state, &passenger_id).await?;
        Ok("Passenger checked out successfully.".to_string())
    }

    pub async fn update_onboard_status(state: &DbState, payload: UpdatePassengerStatusRequest) -> Result<String, String> {
        FrontdeskRepository::update_onboard_status(state, &payload.passenger_id, &payload.new_status).await?;
        Ok(format!("Passenger status updated to {}.", payload.new_status))
    }

    pub async fn get_all_cabins(state: &DbState) -> Result<Vec<CabinResponse>, String> {
        FrontdeskRepository::get_all_cabins(state).await
    }

    pub async fn assign_cabin(state: &DbState, payload: AssignCabinRequest) -> Result<String, String> {
        FrontdeskRepository::assign_cabin(state, &payload.cabin_number, &payload.passenger_id).await?;
        Ok(format!("Cabin {} assigned to passenger.", payload.cabin_number))
    }

    pub async fn get_complaints(state: &DbState) -> Result<Vec<ComplaintResponse>, String> {
        FrontdeskRepository::get_complaints(state).await
    }

    pub async fn resolve_complaint(state: &DbState, payload: ResolveComplaintRequest) -> Result<String, String> {
        FrontdeskRepository::resolve_complaint(state, &payload.incident_id, &payload.resolved_by).await?;
        Ok("Complaint resolved successfully.".to_string())
    }

    pub async fn get_chat_queues(state: &DbState) -> Result<Vec<ChatQueueEntry>, String> {
        FrontdeskRepository::get_chat_queues(state).await
    }

    pub async fn get_chat_history(state: &DbState, passenger_id: String) -> Result<Vec<ChatMessageResponse>, String> {
        FrontdeskRepository::get_chat_history(state, &passenger_id).await
    }

    pub async fn send_chat_message(state: &DbState, payload: SendChatMessageRequest) -> Result<String, String> {
        if payload.message_body.trim().is_empty() {
            return Err("Message cannot be empty.".to_string());
        }

        let sender_name = if let Ok(uid) = Uuid::parse_str(&payload.sender_id) {
            users::Entity::find_by_id(uid)
                .one(&state.pool)
                .await
                .ok()
                .flatten()
                .map(|u| u.display_name)
                .unwrap_or_else(|| payload.sender_role.clone())
        } else {
            payload.sender_role.clone()
        };

        FrontdeskRepository::send_chat_message(
            state,
            &payload.passenger_id,
            &payload.sender_id,
            &payload.sender_role,
            &sender_name,
            payload.message_body.trim(),
        ).await?;

        Ok("Message sent.".to_string())
    }

    pub async fn mark_fdo_messages_read(state: &DbState, passenger_id: String) -> Result<(), String> {
        FrontdeskRepository::mark_fdo_messages_read(state, &passenger_id).await
    }

    pub async fn get_chat_unread_count(state: &DbState, passenger_id: String) -> Result<i64, String> {
        FrontdeskRepository::get_chat_unread_count(state, &passenger_id).await
    }
}
