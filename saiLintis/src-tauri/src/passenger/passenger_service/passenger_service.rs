use crate::database::database::DbState;
use uuid::Uuid;
use sea_orm::prelude::Decimal;
use std::str::FromStr;
use redis::AsyncCommands;
use sea_orm::{EntityTrait, ColumnTrait, QueryFilter, Set, ActiveModelTrait, ConnectionTrait, Statement, DatabaseBackend};
use crate::entities::{prelude::*, *};
use chrono::{Local, NaiveDate, NaiveTime};

use crate::passenger::{
    passenger_model::passenger_model::*,
    passenger_repository::passenger_repository::PassengerRepository,
};

pub struct PassengerService;

impl PassengerService {
    pub async fn invalidate_cache(state: &DbState, passenger_id: Uuid) {
        if let Some(ref client) = state.redis_client {
            if let Ok(mut conn) = client.get_async_connection().await {
                let cache_key = format!("passenger:profile:{}", passenger_id);
                let _: Result<(), _> = conn.del(&cache_key).await;
            }
        }
    }

    pub async fn create_passenger(state: &DbState,payload: CreatePassengerRequest) -> Result<PassengerResponse, String> {
        if payload.display_name.trim().is_empty()
            || payload.email.trim().is_empty()
            || payload.username.trim().is_empty()
            || payload.password.trim().is_empty()
        {
            return Err("All fields (name, email, username, password) are required".to_string());
        }

        let status = payload.status.trim().to_string();
        if status.to_ascii_lowercase() != "normal" && status.to_ascii_lowercase() != "vip" {
            return Err("Status must be 'Normal' or 'Vip'".to_string());
        }

        if PassengerRepository::email_exists(&state.pool, &payload.email).await? {
            return Err("Email is already registered".to_string());
        }

        if crate::auth::auth_repository::auth_repository::AuthRepository::username_exists(&state.pool, &payload.username).await? {
            return Err("Username is already in use".to_string());
        }

        let password_hash = bcrypt::hash(&payload.password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

        let passenger_id = PassengerRepository::create_passenger(
            &state.pool,
            &payload.display_name,
            &payload.email,
            &payload.username,
            &password_hash,
            &status,
            payload.vip_contact_channel,
        )
        .await?;

        let res = PassengerRepository::get_passenger_by_id(&state.pool, passenger_id).await?.ok_or_else(|| "Failed to retrieve new passenger data".to_string())?;

        Ok(res)
    }

    pub async fn get_passenger(state: &DbState,passenger_id: String,) -> Result<PassengerResponse, String> {
        let uid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;

        let cache_key = format!("passenger:profile:{}", uid);
        if let Some(ref client) = state.redis_client {
            if let Ok(mut conn) = client.get_async_connection().await {
                let cached_json: Option<String> = conn.get(&cache_key).await.ok();
                if let Some(json_str) = cached_json {
                    if let Ok(passenger_resp) = serde_json::from_str::<PassengerResponse>(&json_str) {
                        return Ok(passenger_resp);
                    }
                }
            }
        }

        let res = match PassengerRepository::get_passenger_by_id(&state.pool, uid).await? {
            Some(r) => r,
            None => {
                let user_opt = crate::entities::users::Entity::find_by_id(uid)
                    .one(&state.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                if let Some(user_record) = user_opt {
                    let passenger_model = crate::entities::passengers::ActiveModel {
                        passenger_id: sea_orm::ActiveValue::Set(uid),
                        display_name: sea_orm::ActiveValue::Set(user_record.display_name),
                        email: sea_orm::ActiveValue::Set(user_record.email),
                        status: sea_orm::ActiveValue::Set("Normal".to_string()),
                        spending_balance: sea_orm::ActiveValue::Set(Decimal::from(0)),
                        vip_contact_channel: sea_orm::ActiveValue::Set(None),
                    };
                    crate::entities::passengers::Entity::insert(passenger_model)
                        .exec(&state.pool)
                        .await
                        .map_err(|e| e.to_string())?;

                    PassengerRepository::get_passenger_by_id(&state.pool, uid)
                        .await?
                        .ok_or_else(|| "Failed to process profile data".to_string())?
                } else {
                    return Err("Passenger not found".to_string());
                }
            }
        };
        if let Some(ref client) = state.redis_client {
            if let Ok(mut conn) = client.get_async_connection().await {
                if let Ok(json_str) = serde_json::to_string(&res) {
                    let _: Result<(), _> = conn.set_ex(&cache_key, &json_str, 300).await;
                }
            }
        }

        Ok(res)
    }

    pub async fn update_passenger_profile(state: &DbState,payload: UpdatePassengerProfileRequest,) -> Result<PassengerResponse, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;

        if payload.display_name.trim().is_empty() || payload.email.trim().is_empty() {
            return Err("Name and email are required".to_string());
        }

        if let Some(existing) = PassengerRepository::get_passenger_by_id(&state.pool, uid).await? {
            if existing.email != payload.email && PassengerRepository::email_exists(&state.pool, &payload.email).await? {
                return Err("Email is already registered on another account".to_string());
            }
        } else {
            return Err("Passenger not found".to_string());
        }

        PassengerRepository::update_passenger_profile(
            &state.pool,
            uid,
            &payload.display_name,
            &payload.email,
            payload.vip_contact_channel,
        ).await?;

        Self::invalidate_cache(state, uid).await;

        let res = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Failed to retrieve data".to_string())?;

        Ok(res)
    }

    pub async fn update_passenger_preference(state: &DbState,payload: UpdatePassengerPreferenceRequest,) -> Result<PassengerResponse, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;

        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        if passenger.status.to_ascii_lowercase() != "vip" {
            return Err("Only VIP Passengers can have special preferences".to_string());
        }

        PassengerRepository::update_passenger_preference(
            &state.pool,
            uid,
            payload.cabin_preference,
            payload.temperature,
            payload.pillow_type,
            payload.dietary_notes,
            payload.preferred_newspaper,
            payload.minibar_preference,
            payload.special_requests,
        ).await?;

        Self::invalidate_cache(state, uid).await;

        let res = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Failed to retrieve updated preference data".to_string())?;

        Ok(res)
    }

    pub async fn add_spending_entry(state: &DbState,payload: AddSpendingEntryRequest,) -> Result<SpendingEntryResponse, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let amount_decimal = Decimal::from_str(&payload.amount).map_err(|_| "Invalid amount format".to_string())?;

        if amount_decimal <= Decimal::from(0) {
            return Err("Spending amount must be greater than 0".to_string());
        }

        let entry_id = PassengerRepository::add_spending_entry(
            &state.pool,
            uid,
            &payload.description,
            amount_decimal,
        ).await?;

        Self::invalidate_cache(state, uid).await;

        let entries = PassengerRepository::list_spending_entries(&state.pool, uid).await?;
        let entry = entries.into_iter().find(|e| e.entry_id == entry_id).ok_or_else(|| "Failed to verify new spending entry".to_string())?;

        Ok(entry)
    }

    pub async fn list_spending_entries(state: &DbState,passenger_id: String,) -> Result<Vec<SpendingEntryResponse>, String> {
        let uid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        PassengerRepository::list_spending_entries(&state.pool, uid).await
    }

    pub async fn list_passengers(state: &DbState) -> Result<Vec<PassengerResponse>, String> {
        PassengerRepository::list_passengers(&state.pool).await
    }

    pub async fn view_booking_reservation_and_itinerary(state: &DbState, passenger_id: String) -> Result<serde_json::Value, String> {
        let uid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;

        use sea_orm::{Statement, DatabaseBackend};

        let cabin_row = state.pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT cabin_number FROM cabins WHERE assigned_passenger_id = $1 LIMIT 1;",
            vec![passenger_id.clone().into()],
        )).await.map_err(|e| e.to_string())?;

        let cabin_number = match cabin_row {
            Some(r) => r.try_get("", "cabin_number").unwrap_or_else(|_| "Not Assigned".to_string()),
            None => "Not Assigned".to_string(),
        };

        let rows = state.pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                vb.booking_id::TEXT AS booking_id,
                vb.voyage_id::TEXT AS voyage_id,
                v.destination,
                v.departure_date::TEXT AS departure_date_str,
                v.status,
                s.ship_name
            FROM voyage_bookings vb
            JOIN voyages v ON vb.voyage_id = v.voyage_id
            LEFT JOIN ships s ON v.ship_id = s.ship_id
            WHERE vb.passenger_id = $1
            ORDER BY v.departure_date DESC;
            "#,
            vec![uid.into()],
        )).await.map_err(|e| e.to_string())?;

        let mut bookings_json = Vec::new();
        for r in rows {
            let booking_id: String = r.try_get("", "booking_id").map_err(|e| e.to_string())?;
            let voyage_id: String = r.try_get("", "voyage_id").map_err(|e| e.to_string())?;
            let destination: String = r.try_get("", "destination").map_err(|e| e.to_string())?;
            let departure_date: String = r.try_get("", "departure_date_str").map_err(|e| e.to_string())?;
            let status: String = r.try_get("", "status").map_err(|e| e.to_string())?;
            let ship_name: Option<String> = r.try_get("", "ship_name").map_err(|e| e.to_string())?;

            let ship_display = ship_name.unwrap_or_else(|| "No Ship Assigned".to_string());

            bookings_json.push(serde_json::json!({
                "booking_id": booking_id,
                "voyage_id": voyage_id,
                "cabin_number": cabin_number,
                "status": status,
                "departure_date": departure_date,
                "ship_name": ship_display,
                "itinerary": [
                    { "day": 1, "port": "Port of Departure", "activity": format!("Boarding on {}", ship_display) },
                    { "day": 2, "port": "Cruising", "activity": "Sailing Towards Destination" },
                    { "day": 3, "port": destination, "activity": "Arrival and Exploration" }
                ]
            }));
        }

        Ok(serde_json::json!({
            "passenger_id": passenger_id,
            "bookings": bookings_json
        }))
    }

    pub async fn view_daily_onboard_spending_and_budget(state: &DbState,passenger_id: String,) -> Result<SpendingSummaryResponse, String> {
        let uid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        let total_spent = passenger.spending_balance;
        let budget_limit = Decimal::from(1000);
        let remaining_budget = budget_limit - total_spent;

        Ok(SpendingSummaryResponse {
            total_spent,
            budget_limit,
            remaining_budget,
        })
    }

    pub async fn reserve_seat_for_entertainment(state: &DbState, payload: ReserveSeatRequest) -> Result<String, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        let performance = Performances::find()
            .filter(performances::Column::Title.eq(&payload.entertainment_id))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?;

        let seat = Seats::find()
            .filter(seats::Column::PerformanceId.eq(performance.performance_id))
            .filter(seats::Column::SeatNumber.eq(&payload.seat_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Seat not found".to_string())?;

        if seat.status.to_ascii_lowercase() == "booked" || seat.status.to_ascii_lowercase() == "pending" {
            return Err("Seat is already booked or pending".to_string());
        }

        let mut seat_active: seats::ActiveModel = seat.into();
        seat_active.status = Set("Pending".to_string());
        seat_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        let booking = bookings::ActiveModel {
            booking_id: Set(Uuid::new_v4()),
            passenger_id: Set(Some(uid)),
            booking_date: Set(Local::now().naive_local()),
            total_amount: Set(Decimal::from(0)),
            status: Set("Pending".to_string()),
        };
        let booking = booking.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let perf_booking = performance_bookings::ActiveModel {
            booking_id: Set(booking.booking_id),
            performance_id: Set(Some(performance.performance_id)),
            seats: Set(Some(vec![payload.seat_number.clone()])),
            is_vip_allocation: Set(Some(false)),
        };
        perf_booking.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let mut perf_active: performances::ActiveModel = performance.into();
        let current_occ = perf_active.current_occupancy.unwrap().unwrap_or(0);
        perf_active.current_occupancy = Set(Some(current_occ + 1));
        perf_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        let description = format!(
            "Passenger {} (ID: {}) reserved seat {} for entertainment event {}",
            passenger.display_name, passenger.passenger_id, payload.seat_number, payload.entertainment_id
        );
        PassengerRepository::create_log(&state.pool, "RESERVE_SEAT", &description, false).await?;

        Ok(format!("Seat {} successfully reserved", payload.seat_number))
    }

    pub async fn reserved_dining_table_with_dietary_request(state: &DbState, payload: ReserveDiningTableRequest) -> Result<String, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        let dining_table = DiningTables::find()
            .filter(dining_tables::Column::TableNumber.eq(&payload.table_id))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Table not found".to_string())?;

        if dining_table.status.to_ascii_lowercase() == "booked" || dining_table.status.to_ascii_lowercase() == "pending" {
            return Err("Table is already booked or pending".to_string());
        }

        let mut table_active: dining_tables::ActiveModel = dining_table.clone().into();
        table_active.status = Set("PENDING".to_string());
        table_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        let restaurant = Restaurants::find_by_id(dining_table.restaurant_id.ok_or_else(|| "Table is not associated with a restaurant".to_string())?)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Restaurant not found".to_string())?;

        let booking = bookings::ActiveModel {
            booking_id: Set(Uuid::new_v4()),
            passenger_id: Set(Some(uid)),
            booking_date: Set(Local::now().naive_local()),
            total_amount: Set(Decimal::from(0)),
            status: Set("Pending".to_string()),
        };
        let booking = booking.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let reservation = restaurant_reservations::ActiveModel {
            booking_id: Set(booking.booking_id),
            restaurant_id: Set(Some(restaurant.restaurant_id)),
            tables: Set(Some(vec![dining_table.table_number.clone()])),
            reservation_date: Set(Local::now().date_naive()),
            reservation_time: Set(Local::now().time()),
            location: Set(format!("Deck {}", restaurant.deck)),
            dietary_request: Set(Some(payload.dietary_request.clone())),
        };
        reservation.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let description = format!(
            "Passenger {} (ID: {}) reserved dining table {} with dietary request: {}",
            passenger.display_name, passenger.passenger_id, payload.table_id, payload.dietary_request
        );
        PassengerRepository::create_log(&state.pool, "RESERVE_DINING", &description, false).await?;

        Ok(format!("Dining table {} successfully reserved", payload.table_id))
    }

    pub async fn request_medical_support(state: &DbState, payload: RequestMedicalSupportRequest) -> Result<String, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        let description = format!(
            "MEDICAL EMERGENCY! Passenger {} (Cabin: {}) requested medical support. Type: {}, Severity: {}",
            passenger.display_name, payload.cabin_number, payload.request_type, payload.severity
        );

        PassengerRepository::create_log(&state.pool, "MEDICAL_REQUEST", &description, true).await?;
        crate::medical::medical_repository::medical_repository::MedicalRepository::update_passenger_status(&state.pool, uid, "Emergency").await?;
        Self::invalidate_cache(state, uid).await;

        Ok("Emergency medical support request has been forwarded to the ship's medical team".to_string())
    }

    pub async fn view_ship_announcement(state: &DbState) -> Result<Vec<AnnouncementResponse>, String> {
        use sea_orm::QueryOrder;
        let alerts = zone_alerts::Entity::find()
            .filter(zone_alerts::Column::Recipients.contains("Passenger"))
            .order_by_desc(zone_alerts::Column::SentAt)
            .all(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut announcements = Vec::new();
        for a in alerts {
            let (title, content) = if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&a.message) {
                let t = payload.get("title").and_then(|v| v.as_str()).unwrap_or("Announcement").to_string();
                let c = payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
                (t, c)
            } else {
                ("Ship Notice".to_string(), a.message.clone())
            };

            announcements.push(AnnouncementResponse {
                id: a.alert_id,
                title,
                content,
                date: a.sent_at.to_string(),
            });
        }

        if announcements.is_empty() {
            announcements.push(AnnouncementResponse {
                id: Uuid::new_v4(),
                title: "Recruitment Notice".to_string(),
                content: "There are no active job vacancy postings at this moment.".to_string(),
                date: "2026-06-07T00:00:00Z".to_string(),
            });
        }

        Ok(announcements)
    }

    pub async fn publish_ship_announcement(state: &DbState, title: String, content: String, sent_by: String) -> Result<(), String> {
        use crate::patterns::ship_announcement_observer::IPublishers::Publisher;
        let sent_by_uuid = Uuid::parse_str(&sent_by).map_err(|_| "Invalid sender ID format".to_string())?;
        let list = passengers::Entity::find().all(&state.pool).await.map_err(|e| e.to_string())?;

        let mut publisher = crate::patterns::ship_announcement_observer::model::announcement_publisher::AnnouncementPublisher::new();
        for p in list {
            let sub = crate::patterns::ship_announcement_observer::service::passenger_service::PassengerSubscriber::new(
                p.passenger_id,
                state.pool.clone(),
                sent_by_uuid,
            );
            publisher.subscribe(Box::new(sub));
        }

        let payload = serde_json::json!({
            "title": title,
            "content": content,
        });
        let announcement_json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

        publisher.publish(&announcement_json);
        Ok(())
    }

    pub async fn order_room_service(state: &DbState, payload: OrderRoomServiceRequest) -> Result<SpendingEntryResponse, String> {
        let _uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;

        let desc = format!("Room Service: {}", payload.items.join(", "));

        let add_spending = AddSpendingEntryRequest {
            passenger_id: payload.passenger_id,
            description: desc,
            amount: payload.total_price,
        };

        Self::add_spending_entry(state, add_spending).await
    }

    pub async fn submit_formal_feedback_or_complaint(state: &DbState, payload: SubmitFeedbackRequest) -> Result<String, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        let description = format!("Subject: {}. Content: {}. Submitted by: {} (ID: {})", payload.subject, payload.content, passenger.display_name, passenger.passenger_id);

        let incident_id = Uuid::new_v4();
        state.pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"INSERT INTO incidents (incident_id, incident_type, description, location, severity, status, created_at, submitted_by)
               VALUES ($1, 'Complaint', $2, 'Cabin Services', 'Medium', 'Pending', $3, $4)"#,
            [incident_id.into(), description.clone().into(), Local::now().naive_local().into(), uid.into()]
        )).await.map_err(|e| e.to_string())?;

        PassengerRepository::create_log(&state.pool, "SUBMIT_FEEDBACK", &description, false).await?;

        Ok("Your formal feedback has been received and will be reviewed shortly".to_string())
    }

    pub async fn access_dedicated_vip_direct_contact_channel(state: &DbState, passenger_id: String) -> Result<String, String> {
        let uid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        if passenger.status.to_ascii_lowercase() != "vip" {
            return Err("Only VIP Passengers have access to the VIP Contact Channel".to_string());
        }

        Ok(passenger.vip_contact_channel.unwrap_or_else(|| "No dedicated VIP contact channel set".to_string()))
    }

    pub async fn reserve_entertainment_seat_with_vip_early_access(state: &DbState, payload: ReserveSeatRequest) -> Result<String, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        if passenger.status.to_ascii_lowercase() != "vip" {
            return Err("Only VIP Passengers can reserve using VIP Early Access".to_string());
        }

        let performance = Performances::find()
            .filter(performances::Column::Title.eq(&payload.entertainment_id))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?;

        let seat = Seats::find()
            .filter(seats::Column::PerformanceId.eq(performance.performance_id))
            .filter(seats::Column::SeatNumber.eq(&payload.seat_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Seat not found".to_string())?;

        if seat.status.to_ascii_lowercase() == "booked" || seat.status.to_ascii_lowercase() == "pending" {
            return Err("Seat is already booked or pending".to_string());
        }

        let mut seat_active: seats::ActiveModel = seat.into();
        seat_active.status = Set("Pending".to_string());
        seat_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        let booking = bookings::ActiveModel {
            booking_id: Set(Uuid::new_v4()),
            passenger_id: Set(Some(uid)),
            booking_date: Set(Local::now().naive_local()),
            total_amount: Set(Decimal::from(0)),
            status: Set("Pending".to_string()),
        };
        let booking = booking.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let perf_booking = performance_bookings::ActiveModel {
            booking_id: Set(booking.booking_id),
            performance_id: Set(Some(performance.performance_id)),
            seats: Set(Some(vec![payload.seat_number.clone()])),
            is_vip_allocation: Set(Some(true)),
        };
        perf_booking.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let mut perf_active: performances::ActiveModel = performance.into();
        let current_occ = perf_active.current_occupancy.unwrap().unwrap_or(0);
        perf_active.current_occupancy = Set(Some(current_occ + 1));
        perf_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        let description = format!(
            "VIP EARLY ACCESS: Passenger {} (ID: {}) reserved seat {} for entertainment event {}",
            passenger.display_name, passenger.passenger_id, payload.seat_number, payload.entertainment_id
        );
        PassengerRepository::create_log(&state.pool, "VIP_RESERVE_SEAT", &description, false).await?;

        Ok(format!("Early Access: Seat {} successfully reserved", payload.seat_number))
    }

    pub async fn reserved_dining_table_with_vip_early_access(state: &DbState, payload: ReserveDiningTableRequest) -> Result<String, String> {
        let uid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let passenger = PassengerRepository::get_passenger_by_id(&state.pool, uid).await?.ok_or_else(|| "Passenger not found".to_string())?;

        if passenger.status.to_ascii_lowercase() != "vip" {
            return Err("Only VIP Passengers can reserve using VIP Early Access".to_string());
        }

        let dining_table = DiningTables::find()
            .filter(dining_tables::Column::TableNumber.eq(&payload.table_id))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Table not found".to_string())?;

        if dining_table.status.to_ascii_lowercase() == "booked" || dining_table.status.to_ascii_lowercase() == "pending" {
            return Err("Table is already booked or pending".to_string());
        }

        let mut table_active: dining_tables::ActiveModel = dining_table.clone().into();
        table_active.status = Set("PENDING".to_string());
        table_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        let restaurant = Restaurants::find_by_id(dining_table.restaurant_id.ok_or_else(|| "Table is not associated with a restaurant".to_string())?)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Restaurant not found".to_string())?;

        let booking = bookings::ActiveModel {
            booking_id: Set(Uuid::new_v4()),
            passenger_id: Set(Some(uid)),
            booking_date: Set(Local::now().naive_local()),
            total_amount: Set(Decimal::from(0)),
            status: Set("Pending".to_string()),
        };
        let booking = booking.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let reservation = restaurant_reservations::ActiveModel {
            booking_id: Set(booking.booking_id),
            restaurant_id: Set(Some(restaurant.restaurant_id)),
            tables: Set(Some(vec![dining_table.table_number.clone()])),
            reservation_date: Set(Local::now().date_naive()),
            reservation_time: Set(Local::now().time()),
            location: Set(format!("Deck {}", restaurant.deck)),
            dietary_request: Set(Some(payload.dietary_request.clone())),
        };
        reservation.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let description = format!(
            "VIP EARLY ACCESS: Passenger {} (ID: {}) reserved dining table {} with dietary request: {}",
            passenger.display_name, passenger.passenger_id, payload.table_id, payload.dietary_request
        );
        PassengerRepository::create_log(&state.pool, "VIP_RESERVE_DINING", &description, false).await?;

        Ok(format!("Early Access: Dining table {} successfully reserved", payload.table_id))
    }

    pub async fn get_seats_for_performance(state: &DbState, performance_title: String, passenger_id: Option<String>) -> Result<std::collections::HashMap<String, String>, String> {
        let performance = Performances::find()
            .filter(performances::Column::Title.eq(&performance_title))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?;

        use sea_orm::{Statement, DatabaseBackend};
        let rows = state.pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                s.seat_number,
                s.status,
                b.passenger_id::TEXT AS booked_by
            FROM seats s
            LEFT JOIN performance_bookings pb ON pb.performance_id = s.performance_id AND s.seat_number = ANY(pb.seats)
            LEFT JOIN bookings b ON b.booking_id = pb.booking_id AND b.status != 'Cancelled'
            WHERE s.performance_id = $1;
            "#,
            vec![performance.performance_id.into()],
        )).await.map_err(|e| e.to_string())?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            let seat_number: String = row.try_get("", "seat_number").map_err(|e| e.to_string())?;
            let status: String = row.try_get("", "status").map_err(|e| e.to_string())?;
            let booked_by: Option<String> = row.try_get("", "booked_by").map_err(|e| e.to_string())?;

            let mut final_status = status.clone();
            if status.to_ascii_lowercase() == "booked" {
                if let Some(ref p_id) = passenger_id {
                    if let Some(ref b_by) = booked_by {
                        if b_by == p_id {
                            final_status = "Approved".to_string();
                        }
                    }
                }
            }
            map.insert(seat_number, final_status);
        }
        Ok(map)
    }

    pub async fn get_dining_tables(state: &DbState, restaurant_name: String, passenger_id: Option<String>) -> Result<std::collections::HashMap<String, String>, String> {
        let restaurant = Restaurants::find()
            .filter(restaurants::Column::RestaurantName.eq(&restaurant_name))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Restaurant not found".to_string())?;

        use sea_orm::{Statement, DatabaseBackend};
        let rows = state.pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                dt.table_number,
                dt.status,
                b.passenger_id::TEXT AS booked_by
            FROM dining_tables dt
            LEFT JOIN restaurant_reservations rr ON rr.restaurant_id = dt.restaurant_id AND dt.table_number = ANY(rr.tables)
            LEFT JOIN bookings b ON b.booking_id = rr.booking_id AND b.status != 'Cancelled'
            WHERE dt.restaurant_id = $1;
            "#,
            vec![restaurant.restaurant_id.into()],
        )).await.map_err(|e| e.to_string())?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            let table_number: String = row.try_get("", "table_number").map_err(|e| e.to_string())?;
            let status: String = row.try_get("", "status").map_err(|e| e.to_string())?;
            let booked_by: Option<String> = row.try_get("", "booked_by").map_err(|e| e.to_string())?;

            let mut final_status = status.clone();
            if status.to_ascii_lowercase() == "booked" {
                if let Some(ref p_id) = passenger_id {
                    if let Some(ref b_by) = booked_by {
                        if b_by == p_id {
                            final_status = "Approved".to_string();
                        }
                    }
                }
            }
            map.insert(table_number, final_status);
        }
        Ok(map)
    }

    pub async fn get_all_performances(state: &DbState) -> Result<Vec<PerformanceDetail>, String> {
        let perfs = Performances::find().all(&state.pool).await.map_err(|e| e.to_string())?;
        Ok(perfs.into_iter().map(|p| PerformanceDetail {
            performance_id: p.performance_id,
            title: p.title,
            schedule_date: p.schedule_date.to_string(),
            schedule_time: p.schedule_time.to_string(),
            status: p.status,
            current_occupancy: p.current_occupancy.unwrap_or(0),
            total_capacity: p.total_capacity,
        }).collect())
    }

    pub async fn create_performance(state: &DbState, title: String, date_str: String, time_str: String, capacity: i32) -> Result<String, String> {
        let p_id = Uuid::new_v4();
        let sched_date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").map_err(|_| "Invalid date format".to_string())?;
        let sched_time = NaiveTime::parse_from_str(&time_str, "%H:%M:%S").or_else(|_| NaiveTime::parse_from_str(&time_str, "%H:%M")).map_err(|_| "Invalid time format".to_string())?;
        let venue_id = Uuid::new_v4();

        let perf = performances::ActiveModel {
            performance_id: Set(p_id),
            title: Set(title.clone()),
            venue_id: Set(venue_id),
            schedule_date: Set(sched_date),
            schedule_time: Set(sched_time),
            actual_start_time: Set(None),
            actual_end_time: Set(None),
            status: Set("UPCOMING".to_string()),
            current_occupancy: Set(Some(0)),
            total_capacity: Set(capacity),
            is_vip_window_open: Set(Some(false)),
            is_general_window_open: Set(Some(true)),
        };
        perf.insert(&state.pool).await.map_err(|e| e.to_string())?;

        let left_balcony = vec!["G", "F", "E"];
        let right_balcony = vec!["H", "I", "J"];
        let main_floor = vec!["A", "B", "C", "D"];

        for row in 1..=4 {
            for col in left_balcony.iter().chain(right_balcony.iter()) {
                let seat_num = format!("{}{}", col, row);
                let section = if *col == "G" || *col == "H" { "VIP" } else { "Premium" };
                let seat = seats::ActiveModel {
                    seat_id: Set(Uuid::new_v4()),
                    performance_id: Set(Some(p_id)),
                    seat_number: Set(seat_num),
                    section: Set(section.to_string()),
                    status: Set("Available".to_string()),
                };
                seat.insert(&state.pool).await.map_err(|e| e.to_string())?;
            }
        }

        for row in main_floor.iter() {
            for col in 1..=6 {
                let seat_num = format!("{}{}", row, col);
                let seat = seats::ActiveModel {
                    seat_id: Set(Uuid::new_v4()),
                    performance_id: Set(Some(p_id)),
                    seat_number: Set(seat_num),
                    section: Set("Standard".to_string()),
                    status: Set("Available".to_string()),
                };
                seat.insert(&state.pool).await.map_err(|e| e.to_string())?;
            }
        }

        Ok(format!("Performance {} successfully created", title))
    }

    pub async fn create_dining_table(state: &DbState, restaurant_name: String, table_number: String, capacity: i32) -> Result<String, String> {
        let restaurant = Restaurants::find()
            .filter(restaurants::Column::RestaurantName.eq(&restaurant_name))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Restaurant not found".to_string())?;

        let exists = DiningTables::find()
            .filter(dining_tables::Column::RestaurantId.eq(restaurant.restaurant_id))
            .filter(dining_tables::Column::TableNumber.eq(&table_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
        if exists.is_some() {
            return Err("Table number is already in use".to_string());
        }

        let new_table = dining_tables::ActiveModel {
            table_id: Set(Uuid::new_v4()),
            restaurant_id: Set(Some(restaurant.restaurant_id)),
            table_number: Set(table_number),
            capacity: Set(capacity),
            status: Set("AVAILABLE".to_string()),
        };
        new_table.insert(&state.pool).await.map_err(|e| e.to_string())?;

        Ok("Table successfully added".to_string())
    }

    pub async fn get_all_activities(state: &DbState) -> Result<Vec<ActivityResponse>, String> {
        PassengerRepository::get_all_activities(&state.pool).await
    }

    pub async fn export_spending_csv(state: &DbState, passenger_id: String) -> Result<String, String> {
        let pid = Uuid::parse_str(&passenger_id).map_err(|_| "Invalid passenger ID".to_string())?;
        let entries = PassengerRepository::list_spending_entries(&state.pool, pid).await.map_err(|e| e.to_string())?;
        let mut csv = String::from("entry_id,description,amount,date\n");
        for entry in &entries {
            let desc = entry.description.replace('"', "\"\"");
            csv.push_str(&format!(
                "{},\"{}\",{},{}\n",
                entry.entry_id,
                desc,
                entry.amount,
                entry.date
            ));
        }
        use base64::{engine::general_purpose, Engine as _};
        Ok(general_purpose::STANDARD.encode(csv.as_bytes()))
    }

    pub async fn approve_seat_booking(state: &DbState, performance_title: String, seat_number: String) -> Result<String, String> {
        let performance = Performances::find()
            .filter(performances::Column::Title.eq(&performance_title))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?;

        let seat = Seats::find()
            .filter(seats::Column::PerformanceId.eq(performance.performance_id))
            .filter(seats::Column::SeatNumber.eq(&seat_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Seat not found".to_string())?;

        if seat.status.to_ascii_lowercase() != "pending" {
            return Err("Seat is not in pending status".to_string());
        }

        let mut seat_active: seats::ActiveModel = seat.into();
        seat_active.status = Set("Booked".to_string());
        seat_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        use sea_orm::Statement;
        let _ = state.pool.execute(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"UPDATE bookings SET status = 'Confirmed'
               WHERE booking_id = (
                 SELECT pb.booking_id FROM performance_bookings pb
                 JOIN bookings b ON b.booking_id = pb.booking_id
                 WHERE pb.performance_id = $1 AND b.status = 'Pending'
                 AND $2 = ANY(pb.seats)
                 ORDER BY b.booking_date DESC LIMIT 1
               )"#,
            vec![performance.performance_id.into(), seat_number.clone().into()],
        )).await;

        PassengerRepository::create_log(&state.pool, "APPROVE_SEAT", &format!("Seat {} for {} approved", seat_number, performance_title), false).await?;
        Ok(format!("Seat {} approved successfully", seat_number))
    }

    pub async fn reject_seat_booking(state: &DbState, performance_title: String, seat_number: String) -> Result<String, String> {
        let performance = Performances::find()
            .filter(performances::Column::Title.eq(&performance_title))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?;

        let seat = Seats::find()
            .filter(seats::Column::PerformanceId.eq(performance.performance_id))
            .filter(seats::Column::SeatNumber.eq(&seat_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Seat not found".to_string())?;

        if seat.status.to_ascii_lowercase() != "pending" {
            return Err("Seat is not in pending status".to_string());
        }

        let mut seat_active: seats::ActiveModel = seat.into();
        seat_active.status = Set("Available".to_string());
        seat_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        use sea_orm::Statement;
        let _ = state.pool.execute(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"UPDATE bookings SET status = 'Cancelled'
               WHERE booking_id = (
                 SELECT pb.booking_id FROM performance_bookings pb
                 JOIN bookings b ON b.booking_id = pb.booking_id
                 WHERE pb.performance_id = $1 AND b.status = 'Pending'
                 AND $2 = ANY(pb.seats)
                 ORDER BY b.booking_date DESC LIMIT 1
               )"#,
            vec![performance.performance_id.into(), seat_number.clone().into()],
        )).await;

        PassengerRepository::create_log(&state.pool, "REJECT_SEAT", &format!("Seat {} for {} rejected", seat_number, performance_title), false).await?;
        Ok(format!("Seat {} booking rejected", seat_number))
    }

    pub async fn get_all_pending_reservations(state: &DbState) -> Result<PendingReservationsResponse, String> {
        use sea_orm::{Statement, DatabaseBackend};

        let pending_seats_rows = state.pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                b.passenger_id::TEXT AS passenger_id,
                u.display_name AS passenger_name,
                s.seat_number,
                p.title AS performance_title
            FROM seats s
            JOIN performances p ON s.performance_id = p.performance_id
            JOIN performance_bookings pb ON pb.performance_id = p.performance_id AND s.seat_number = ANY(pb.seats)
            JOIN bookings b ON b.booking_id = pb.booking_id
            JOIN users u ON u.user_id = b.passenger_id
            WHERE s.status = 'Pending' AND b.status = 'Pending';
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        let mut seats = Vec::new();
        for row in pending_seats_rows {
            let passenger_id: String = row.try_get("", "passenger_id").map_err(|e| e.to_string())?;
            let passenger_name: String = row.try_get("", "passenger_name").map_err(|e| e.to_string())?;
            let seat_id: String = row.try_get("", "seat_number").map_err(|e| e.to_string())?;
            let entertainment_id: String = row.try_get("", "performance_title").map_err(|e| e.to_string())?;
            seats.push(PendingSeatReservation {
                passenger_id,
                passenger_name,
                seat_id,
                entertainment_id,
            });
        }

        let pending_tables_rows = state.pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                b.passenger_id::TEXT AS passenger_id,
                u.display_name AS passenger_name,
                dt.table_number,
                r.restaurant_name
            FROM dining_tables dt
            JOIN restaurants r ON dt.restaurant_id = r.restaurant_id
            JOIN restaurant_reservations rr ON rr.restaurant_id = r.restaurant_id AND dt.table_number = ANY(rr.tables)
            JOIN bookings b ON b.booking_id = rr.booking_id
            JOIN users u ON u.user_id = b.passenger_id
            WHERE dt.status = 'PENDING' AND b.status = 'Pending';
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        let mut tables = Vec::new();
        for row in pending_tables_rows {
            let passenger_id: String = row.try_get("", "passenger_id").map_err(|e| e.to_string())?;
            let passenger_name: String = row.try_get("", "passenger_name").map_err(|e| e.to_string())?;
            let table_id: String = row.try_get("", "table_number").map_err(|e| e.to_string())?;
            let restaurant_name: String = row.try_get("", "restaurant_name").map_err(|e| e.to_string())?;
            tables.push(PendingTableReservation {
                passenger_id,
                passenger_name,
                table_id,
                restaurant_name,
            });
        }

        Ok(PendingReservationsResponse { tables, seats })
    }

    pub async fn approve_dining_table(state: &DbState, restaurant_name: String, table_number: String) -> Result<String, String> {
        let restaurant = Restaurants::find()
            .filter(restaurants::Column::RestaurantName.eq(&restaurant_name))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Restaurant not found".to_string())?;

        let dining_table = DiningTables::find()
            .filter(dining_tables::Column::RestaurantId.eq(restaurant.restaurant_id))
            .filter(dining_tables::Column::TableNumber.eq(&table_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Table not found".to_string())?;

        if dining_table.status.to_ascii_lowercase() != "pending" {
            return Err("Table is not in pending status".to_string());
        }

        let mut table_active: dining_tables::ActiveModel = dining_table.into();
        table_active.status = Set("Booked".to_string());
        table_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        use sea_orm::Statement;
        let _ = state.pool.execute(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"UPDATE bookings SET status = 'Confirmed'
               WHERE booking_id = (
                 SELECT rr.booking_id FROM restaurant_reservations rr
                 JOIN bookings b ON b.booking_id = rr.booking_id
                 WHERE rr.restaurant_id = $1 AND b.status = 'Pending'
                 AND $2 = ANY(rr.tables)
                 ORDER BY b.booking_date DESC LIMIT 1
               )"#,
            vec![restaurant.restaurant_id.into(), table_number.clone().into()],
        )).await;

        PassengerRepository::create_log(&state.pool, "APPROVE_TABLE", &format!("Table T-{} for {} approved", table_number, restaurant_name), false).await?;
        Ok(format!("Table T-{} approved successfully", table_number))
    }

    pub async fn reject_dining_table(state: &DbState, restaurant_name: String, table_number: String) -> Result<String, String> {
        let restaurant = Restaurants::find()
            .filter(restaurants::Column::RestaurantName.eq(&restaurant_name))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Restaurant not found".to_string())?;

        let dining_table = DiningTables::find()
            .filter(dining_tables::Column::RestaurantId.eq(restaurant.restaurant_id))
            .filter(dining_tables::Column::TableNumber.eq(&table_number))
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Table not found".to_string())?;

        if dining_table.status.to_ascii_lowercase() != "pending" {
            return Err("Table is not in pending status".to_string());
        }

        let mut table_active: dining_tables::ActiveModel = dining_table.into();
        table_active.status = Set("Available".to_string());
        table_active.update(&state.pool).await.map_err(|e| e.to_string())?;

        use sea_orm::Statement;
        let _ = state.pool.execute(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"UPDATE bookings SET status = 'Cancelled'
               WHERE booking_id = (
                 SELECT rr.booking_id FROM restaurant_reservations rr
                 JOIN bookings b ON b.booking_id = rr.booking_id
                 WHERE rr.restaurant_id = $1 AND b.status = 'Pending'
                 AND $2 = ANY(rr.tables)
                 ORDER BY b.booking_date DESC LIMIT 1
               )"#,
            vec![restaurant.restaurant_id.into(), table_number.clone().into()],
        )).await;

        PassengerRepository::create_log(&state.pool, "REJECT_TABLE", &format!("Table T-{} for {} rejected", table_number, restaurant_name), false).await?;
        Ok(format!("Table T-{} booking rejected", table_number))
    }

    pub async fn submit_performance_report(
        state: &DbState,
        payload: SubmitPerformanceReportRequest,
    ) -> Result<String, String> {
        let p_id = Uuid::parse_str(&payload.performance_id)
            .map_err(|_| "Invalid performance ID".to_string())?;
        let sub_by = Uuid::parse_str(&payload.submitted_by)
            .map_err(|_| "Invalid submitter ID".to_string())?;

        let perf = performances::Entity::find_by_id(p_id)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?;

        let mut report = crate::patterns::performance_report::PerformanceReport::new(
            p_id,
            payload.occupancy_count,
            payload.technical_issues,
            payload.audience_rating,
            payload.audience_notes,
            sub_by,
        );

        report.validate_occupancy(perf.total_capacity)?;
        report.check_late_submission(perf.schedule_date, perf.schedule_time);
        report.check_priority_review(payload.has_unresolved_issues);

        report.save_to_db(&state.pool).await?;
        report.update_performance_record(&state.pool).await?;

        let user_opt = Users::find_by_id(sub_by)
            .one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
        let staff_name = user_opt.map(|u| u.display_name).unwrap_or_else(|| "Staff".to_string());

        PassengerRepository::create_log(
            &state.pool,
            "SUBMIT_PERFORMANCE_REPORT",
            &format!("Performance report for {} submitted by {}", perf.title, staff_name),
            false,
        ).await?;

        Ok("Performance report submitted successfully".to_string())
    }

    pub async fn get_performance_reports(
        state: &DbState,
    ) -> Result<Vec<PerformanceReportResponse>, String> {
        use sea_orm::QueryOrder;

        let reports = PerformanceReports::find()
            .order_by_desc(performance_reports::Column::SubmittedAt)
            .all(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut response = Vec::new();
        for r in reports {
            let perf_opt = performances::Entity::find_by_id(r.performance_id)
                .one(&state.pool)
                .await
                .map_err(|e| e.to_string())?;
            let perf_title = perf_opt.map(|p| p.title).unwrap_or_else(|| "Unknown".to_string());

            let user_opt = Users::find_by_id(r.submitted_by)
                .one(&state.pool)
                .await
                .map_err(|e| e.to_string())?;
            let submitter_name = user_opt.map(|u| u.display_name).unwrap_or_else(|| "Unknown".to_string());

            response.push(PerformanceReportResponse {
                report_id: r.report_id,
                performance_id: r.performance_id,
                performance_title: perf_title,
                occupancy_count: r.occupancy_count,
                technical_issues: r.technical_issues,
                audience_rating: r.audience_rating,
                audience_notes: r.audience_notes,
                submitted_by: r.submitted_by,
                submitted_by_name: submitter_name,
                submitted_at: r.submitted_at.to_string(),
                status: r.status,
                is_late: r.is_late,
                priority_review: r.priority_review,
            });
        }
        Ok(response)
    }

    pub async fn ent_create_staff_schedule(state: &DbState, payload: CreateScheduleRequest) -> Result<String, String> {
        let has_conflict = PassengerRepository::has_approved_shift_conflict(
            &state.pool,
            &payload.employee_name,
            &payload.shift_date,
        ).await?;
        if has_conflict {
            return Err(format!(
                "Failed to submit: {} already has an Approved shift on {}",
                payload.employee_name, payload.shift_date
            ));
        }
        PassengerRepository::create_staff_schedule(&state.pool, payload).await?;
        Ok("Schedule request successfully submitted".to_string())
    }

    pub async fn ent_get_employees(state: &DbState) -> Result<Vec<String>, String> {
        PassengerRepository::get_employees_by_role(&state.pool, "Entertainment Staff").await
    }

    pub async fn ent_get_staff_schedules(state: &DbState) -> Result<Vec<StaffScheduleResponse>, String> {
        PassengerRepository::get_staff_schedules(&state.pool).await
    }
}
