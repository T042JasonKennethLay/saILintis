use sea_orm::*;
use uuid::Uuid;
use chrono::Local;
use crate::database::database::DbState;
use crate::frontdesk::frontdesk_model::frontdesk_model::{
    CabinResponse, FdoPassengerResponse, ComplaintResponse,
    ChatMessageResponse, ChatQueueEntry,
};

pub struct FrontdeskRepository;

impl FrontdeskRepository {
    pub async fn get_all_passengers(state: &DbState) -> Result<Vec<FdoPassengerResponse>, String> {
        let rows = state.pool
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                r#"
                SELECT
                    p.passenger_id::text,
                    p.display_name,
                    p.email,
                    p.status,
                    p.vip_contact_channel,
                    COALESCE(c.cabin_number, '') AS cabin_number,
                    COALESCE(ua.checkin_status, 'Not Checked In') AS checkin_status
                FROM passengers p
                LEFT JOIN cabins c ON c.assigned_passenger_id = p.passenger_id::text
                LEFT JOIN (
                    SELECT passenger_id, checkin_status
                    FROM passenger_checkin_log
                    WHERE id IN (
                        SELECT MAX(id) FROM passenger_checkin_log GROUP BY passenger_id
                    )
                ) ua ON ua.passenger_id = p.passenger_id::text
                ORDER BY p.display_name ASC
                "#
            ))
            .await;

        match rows {
            Ok(records) => {
                let mut result = Vec::new();
                for row in records {
                    let passenger_id: String = row.try_get("", "passenger_id").unwrap_or_default();
                    let display_name: String = row.try_get("", "display_name").unwrap_or_default();
                    let email: String = row.try_get("", "email").unwrap_or_default();
                    let status: String = row.try_get("", "status").unwrap_or_default();
                    let vip_contact_channel: Option<String> = row.try_get("", "vip_contact_channel").ok().flatten();
                    let cabin_number: String = row.try_get("", "cabin_number").unwrap_or_default();
                    let checkin_status: String = row.try_get("", "checkin_status").unwrap_or_else(|_| "Not Checked In".to_string());

                    let is_vip = status.to_lowercase() == "vip" || vip_contact_channel.is_some();

                    result.push(FdoPassengerResponse {
                        passenger_id,
                        display_name,
                        email,
                        status,
                        checkin_status,
                        cabin_number: if cabin_number.is_empty() { None } else { Some(cabin_number) },
                        is_vip,
                    });
                }
                Ok(result)
            }
            Err(_) => {
                let rows2 = state.pool
                    .query_all(Statement::from_string(
                        DatabaseBackend::Postgres,
                        r#"SELECT passenger_id::text, display_name, email, status, vip_contact_channel FROM passengers ORDER BY display_name ASC"#
                    ))
                    .await
                    .map_err(|e| e.to_string())?;

                let mut result = Vec::new();
                for row in rows2 {
                    let passenger_id: String = row.try_get("", "passenger_id").unwrap_or_default();
                    let display_name: String = row.try_get("", "display_name").unwrap_or_default();
                    let email: String = row.try_get("", "email").unwrap_or_default();
                    let status: String = row.try_get("", "status").unwrap_or_default();
                    let vip_contact_channel: Option<String> = row.try_get("", "vip_contact_channel").ok().flatten();
                    let is_vip = status.to_lowercase() == "vip" || vip_contact_channel.is_some();

                    result.push(FdoPassengerResponse {
                        passenger_id,
                        display_name,
                        email,
                        status,
                        checkin_status: "Not Checked In".to_string(),
                        cabin_number: None,
                        is_vip,
                    });
                }
                Ok(result)
            }
        }
    }

    pub async fn checkin_passenger(state: &DbState, passenger_id: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"INSERT INTO passenger_checkin_log (passenger_id, checkin_status, created_at) VALUES ($1, 'Checked In', $2)"#,
                [uid.into(), Local::now().naive_local().into()]
            ))
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn checkout_passenger(state: &DbState, passenger_id: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"INSERT INTO passenger_checkin_log (passenger_id, checkin_status, created_at) VALUES ($1, 'Checked Out', $2)"#,
                [uid.into(), Local::now().naive_local().into()]
            ))
            .await
            .map_err(|e| e.to_string())?;

        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE passengers SET status = 'Disembarked' WHERE passenger_id = $1"#,
                [uid.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn update_onboard_status(state: &DbState, passenger_id: &str, new_status: &str) -> Result<(), String> {
        let uid = Uuid::parse_str(passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE passengers SET status = $1 WHERE passenger_id = $2"#,
                [new_status.into(), uid.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_all_cabins(state: &DbState) -> Result<Vec<CabinResponse>, String> {
        let rows = state.pool
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                r#"
                SELECT c.cabin_number, c.category, c.status, c.assigned_passenger_id,
                       p.display_name AS passenger_name
                FROM cabins c
                LEFT JOIN passengers p ON p.passenger_id::text = c.assigned_passenger_id
                ORDER BY c.cabin_number ASC
                "#
            ))
            .await
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            let cabin_number: String = row.try_get("", "cabin_number").unwrap_or_default();
            let category: String = row.try_get("", "category").unwrap_or_default();
            let status: String = row.try_get("", "status").unwrap_or_default();
            let assigned_passenger_id: Option<String> = row.try_get("", "assigned_passenger_id").ok().flatten();
            let assigned_passenger_name: Option<String> = row.try_get("", "passenger_name").ok().flatten();

            result.push(CabinResponse {
                cabin_number,
                category,
                status,
                assigned_passenger_id,
                assigned_passenger_name,
            });
        }
        Ok(result)
    }

    pub async fn assign_cabin(state: &DbState, cabin_number: &str, passenger_id: &str) -> Result<(), String> {
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE cabins SET assigned_passenger_id = $1, status = 'Occupied' WHERE cabin_number = $2"#,
                [passenger_id.into(), cabin_number.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;

        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE cabins SET assigned_passenger_id = NULL, status = 'Available' WHERE cabin_number != $1 AND assigned_passenger_id = $2"#,
                [cabin_number.into(), passenger_id.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_complaints(state: &DbState) -> Result<Vec<ComplaintResponse>, String> {
        let rows = state.pool
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                r#"
                SELECT i.incident_id::text, i.description, i.severity, i.status,
                       i.created_at::text, u.display_name AS passenger_name
                FROM incidents i
                LEFT JOIN users u ON u.user_id = i.submitted_by
                WHERE i.incident_type = 'Complaint'
                ORDER BY i.created_at DESC
                "#
            ))
            .await
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            let incident_id: String = row.try_get("", "incident_id").unwrap_or_default();
            let description: String = row.try_get("", "description").unwrap_or_default();
            let severity: String = row.try_get("", "severity").unwrap_or_default();
            let status: String = row.try_get("", "status").unwrap_or_default();
            let created_at: String = row.try_get("", "created_at").unwrap_or_default();
            let passenger_name: Option<String> = row.try_get("", "passenger_name").ok().flatten();

            let subject = if description.len() > 60 {
                description[..60].to_string() + "..."
            } else {
                description.clone()
            };

            result.push(ComplaintResponse {
                incident_id,
                passenger_name,
                subject,
                description,
                severity,
                status,
                created_at,
            });
        }
        Ok(result)
    }

    pub async fn resolve_complaint(state: &DbState, incident_id: &str, resolved_by: &str) -> Result<(), String> {
        let iid = Uuid::parse_str(incident_id).map_err(|_| "Invalid incident ID".to_string())?;
        let rid = Uuid::parse_str(resolved_by).map_err(|_| "Invalid user ID".to_string())?;
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE incidents SET status = 'Resolved', reviewed_by = $1, reviewed_at = $2, resolved_at = $3 WHERE incident_id = $4"#,
                [rid.into(), Local::now().naive_local().into(), Local::now().naive_local().into(), iid.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_chat_queues(state: &DbState) -> Result<Vec<ChatQueueEntry>, String> {
        let rows = state.pool
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                r#"
                SELECT
                    p.passenger_id::text,
                    p.display_name,
                    p.status,
                    p.vip_contact_channel,
                    COUNT(CASE WHEN cm.is_read = false AND cm.sender_role = 'Passenger' THEN 1 END) AS unread_count,
                    MAX(cm.message_body) AS last_message,
                    MAX(cm.created_at)::text AS last_message_at
                FROM passengers p
                LEFT JOIN chat_messages cm ON cm.passenger_id = p.passenger_id::text
                WHERE EXISTS (SELECT 1 FROM chat_messages WHERE passenger_id = p.passenger_id::text)
                GROUP BY p.passenger_id, p.display_name, p.status, p.vip_contact_channel
                ORDER BY MAX(cm.created_at) DESC NULLS LAST
                "#
            ))
            .await
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            let passenger_id: String = row.try_get("", "passenger_id").unwrap_or_default();
            let display_name: String = row.try_get("", "display_name").unwrap_or_default();
            let status: String = row.try_get("", "status").unwrap_or_default();
            let vip_contact_channel: Option<String> = row.try_get("", "vip_contact_channel").ok().flatten();
            let unread_count: i64 = row.try_get("", "unread_count").unwrap_or(0);
            let last_message: Option<String> = row.try_get("", "last_message").ok().flatten();
            let last_message_at: Option<String> = row.try_get("", "last_message_at").ok().flatten();

            let is_vip = status.to_lowercase() == "vip" || vip_contact_channel.is_some();

            result.push(ChatQueueEntry {
                passenger_id,
                display_name,
                is_vip,
                vip_contact_channel,
                unread_count,
                last_message,
                last_message_at,
            });
        }
        Ok(result)
    }

    pub async fn get_chat_history(state: &DbState, passenger_id: &str) -> Result<Vec<ChatMessageResponse>, String> {
        let rows = state.pool
            .query_all(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                SELECT message_id::text, passenger_id, sender_role, sender_name,
                       message_body, created_at::text, is_read
                FROM chat_messages
                WHERE passenger_id = $1
                ORDER BY created_at ASC
                "#,
                [passenger_id.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            let message_id: String = row.try_get("", "message_id").unwrap_or_default();
            let passenger_id_val: String = row.try_get("", "passenger_id").unwrap_or_default();
            let sender_role: String = row.try_get("", "sender_role").unwrap_or_default();
            let sender_name: String = row.try_get("", "sender_name").unwrap_or_default();
            let message_body: String = row.try_get("", "message_body").unwrap_or_default();
            let created_at: String = row.try_get("", "created_at").unwrap_or_default();
            let is_read: bool = row.try_get("", "is_read").unwrap_or(false);

            result.push(ChatMessageResponse {
                message_id,
                passenger_id: passenger_id_val,
                sender_role,
                sender_name,
                message_body,
                created_at,
                is_read,
            });
        }

        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE chat_messages SET is_read = true WHERE passenger_id = $1 AND sender_role = 'Passenger'"#,
                [passenger_id.into()]
            ))
            .await
            .ok();

        Ok(result)
    }

    pub async fn send_chat_message(
        state: &DbState,
        passenger_id: &str,
        sender_id: &str,
        sender_role: &str,
        sender_name: &str,
        message_body: &str,
    ) -> Result<(), String> {
        let msg_id = Uuid::new_v4();
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"INSERT INTO chat_messages (message_id, passenger_id, sender_id, sender_role, sender_name, message_body, created_at, is_read)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, false)"#,
                [
                    msg_id.into(),
                    passenger_id.into(),
                    sender_id.into(),
                    sender_role.into(),
                    sender_name.into(),
                    message_body.into(),
                    Local::now().naive_local().into(),
                ]
            ))
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub async fn mark_fdo_messages_read(state: &DbState, passenger_id: &str) -> Result<(), String> {
        state.pool
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"UPDATE chat_messages SET is_read = true WHERE passenger_id = $1 AND sender_role != 'Passenger'"#,
                [passenger_id.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_chat_unread_count(state: &DbState, passenger_id: &str) -> Result<i64, String> {
        let row = state.pool
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"SELECT COUNT(*) AS cnt FROM chat_messages WHERE passenger_id = $1 AND sender_role != 'Passenger' AND is_read = false"#,
                [passenger_id.into()]
            ))
            .await
            .map_err(|e| e.to_string())?;
        match row {
            Some(r) => Ok(r.try_get("", "cnt").unwrap_or(0)),
            None => Ok(0),
        }
    }
}
