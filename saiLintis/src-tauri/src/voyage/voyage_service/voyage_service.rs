use sea_orm::DatabaseConnection;
use uuid::Uuid;
use crate::voyage::voyage_model::voyage_model::*;
use crate::voyage::voyage_repository::voyage_repository::VoyageRepository;

pub struct VoyageService;

impl VoyageService {
    fn parse_date(date_str: &str) -> Result<chrono::NaiveDateTime, String> {
        let cleaned = date_str.replace("Z", "");
        if let Ok(d) = chrono::NaiveDateTime::parse_from_str(&cleaned, "%Y-%m-%dT%H:%M:%S") {
            return Ok(d);
        }
        if let Ok(d) = chrono::NaiveDateTime::parse_from_str(&cleaned, "%Y-%m-%dT%H:%M") {
            return Ok(d);
        }
        if let Ok(d) = chrono::NaiveDateTime::parse_from_str(&cleaned, "%Y-%m-%d %H:%M") {
            return Ok(d);
        }
        if let Ok(d) = chrono::NaiveDate::parse_from_str(&cleaned, "%Y-%m-%d") {
            return Ok(d.and_hms_opt(0, 0, 0).unwrap());
        }
        Err(format!("Invalid date format: {}", date_str))
    }

    pub async fn get_ships(pool: &DatabaseConnection) -> Result<Vec<ShipResponse>, String> {
        VoyageRepository::get_ships(pool).await
    }

    pub async fn create_voyage(
        pool: &DatabaseConnection,
        destination: &str,
        departure_date_str: &str,
        turnaround_buffer: i32,
        port_dwell_time: i32,
        contingency_margin: i32,
        ship_id_str: Option<String>,
        user_id_str: &str,
    ) -> Result<Uuid, String> {
        let departure_date = Self::parse_date(departure_date_str)?;
        let user_uuid = Uuid::parse_str(user_id_str).map_err(|e| e.to_string())?;
        let account_id = VoyageRepository::get_account_id_by_user_id(pool, user_uuid)
            .await?
            .ok_or_else(|| "User account not found".to_string())?;

        let ship_id = match ship_id_str {
            Some(s) if !s.is_empty() => Some(Uuid::parse_str(&s).map_err(|e| e.to_string())?),
            _ => None,
        };

        VoyageRepository::create_voyage(
            pool,
            destination,
            departure_date,
            turnaround_buffer,
            port_dwell_time,
            contingency_margin,
            ship_id,
            account_id,
        ).await
    }

    pub async fn get_voyages(pool: &DatabaseConnection) -> Result<Vec<VoyageResponse>, String> {
        VoyageRepository::get_voyages(pool).await
    }

    pub async fn update_voyage(
        pool: &DatabaseConnection,
        voyage_id_str: &str,
        destination: &str,
        departure_date_str: &str,
        turnaround_buffer: i32,
        port_dwell_time: i32,
        contingency_margin: i32,
        status: &str,
    ) -> Result<(), String> {
        let voyage_uuid = Uuid::parse_str(voyage_id_str).map_err(|e| e.to_string())?;
        let departure_date = Self::parse_date(departure_date_str)?;
        VoyageRepository::update_voyage(
            pool,
            voyage_uuid,
            destination,
            departure_date,
            turnaround_buffer,
            port_dwell_time,
            contingency_margin,
            status,
        ).await
    }

    pub async fn delete_voyage(pool: &DatabaseConnection, voyage_id_str: &str) -> Result<(), String> {
        let voyage_uuid = Uuid::parse_str(voyage_id_str).map_err(|e| e.to_string())?;
        VoyageRepository::delete_voyage(pool, voyage_uuid).await
    }

    pub async fn assign_ship(pool: &DatabaseConnection, voyage_id_str: &str, ship_id_str: Option<String>) -> Result<(), String> {
        let voyage_uuid = Uuid::parse_str(voyage_id_str).map_err(|e| e.to_string())?;
        let ship_uuid = match ship_id_str {
            Some(s) if !s.is_empty() => Some(Uuid::parse_str(&s).map_err(|e| e.to_string())?),
            _ => None,
        };
        VoyageRepository::assign_ship(pool, voyage_uuid, ship_uuid).await
    }

    pub async fn book_voyage(pool: &DatabaseConnection, voyage_id_str: &str, passenger_id_str: &str) -> Result<(), String> {
        let voyage_uuid = Uuid::parse_str(voyage_id_str).map_err(|e| e.to_string())?;
        let passenger_uuid = Uuid::parse_str(passenger_id_str).map_err(|e| e.to_string())?;
        VoyageRepository::book_voyage(pool, voyage_uuid, passenger_uuid).await
    }

    pub async fn cancel_booking(pool: &DatabaseConnection, voyage_id_str: &str, passenger_id_str: &str) -> Result<(), String> {
        let voyage_uuid = Uuid::parse_str(voyage_id_str).map_err(|e| e.to_string())?;
        let passenger_uuid = Uuid::parse_str(passenger_id_str).map_err(|e| e.to_string())?;
        VoyageRepository::cancel_booking(pool, voyage_uuid, passenger_uuid).await
    }

    pub async fn get_occupancy_stats(pool: &DatabaseConnection) -> Result<OccupancyStatsResponse, String> {
        VoyageRepository::get_occupancy_stats(pool).await
    }
}
