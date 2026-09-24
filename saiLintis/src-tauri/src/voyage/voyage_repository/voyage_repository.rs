use sea_orm::*;
use uuid::Uuid;
use crate::voyage::voyage_model::voyage_model::*;

pub struct VoyageRepository;

impl VoyageRepository {
    pub async fn get_account_id_by_user_id(pool: &DatabaseConnection, user_id: Uuid) -> Result<Option<Uuid>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT account_id FROM user_accounts WHERE user_id = $1 LIMIT 1;",
            vec![user_id.into()],
        );
        let row = pool.query_one(stmt).await.map_err(|e| e.to_string())?;
        if let Some(r) = row {
            let account_id: Uuid = r.try_get("", "account_id").map_err(|e| e.to_string())?;
            Ok(Some(account_id))
        } else {
            Ok(None)
        }
    }

    pub async fn get_ships(pool: &DatabaseConnection) -> Result<Vec<ShipResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT ship_id, ship_name, capacity FROM ships ORDER BY ship_name;",
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in rows {
            let ship_id: Uuid = r.try_get("", "ship_id").map_err(|e| e.to_string())?;
            let ship_name: String = r.try_get("", "ship_name").map_err(|e| e.to_string())?;
            let capacity: i32 = r.try_get("", "capacity").map_err(|e| e.to_string())?;
            list.push(ShipResponse { ship_id, ship_name, capacity });
        }
        Ok(list)
    }

    pub async fn create_voyage(
        pool: &DatabaseConnection,
        destination: &str,
        departure_date: chrono::NaiveDateTime,
        turnaround_buffer: i32,
        port_dwell_time: i32,
        contingency_margin: i32,
        ship_id: Option<Uuid>,
        created_by_account_id: Uuid,
    ) -> Result<Uuid, String> {
        let voyage_id = Uuid::new_v4();
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO voyages (voyage_id, destination, departure_date, turnaround_buffer, port_dwell_time, contingency_margin, ship_id, status, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Upcoming', $8, NOW());
            "#,
            vec![
                voyage_id.into(),
                destination.into(),
                departure_date.into(),
                turnaround_buffer.into(),
                port_dwell_time.into(),
                contingency_margin.into(),
                ship_id.into(),
                created_by_account_id.into(),
            ],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(voyage_id)
    }

    pub async fn get_voyages(pool: &DatabaseConnection) -> Result<Vec<VoyageResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT v.voyage_id, v.destination, v.departure_date::TEXT as departure_date_str, v.turnaround_buffer, v.port_dwell_time, v.contingency_margin,
                   v.ship_id, s.ship_name, v.status, v.created_by, v.created_at::TEXT as created_at_str,
                   COALESCE(s.capacity, 100) AS capacity,
                   (SELECT COUNT(*)::INT FROM voyage_bookings WHERE voyage_id = v.voyage_id) AS occupancy_count
            FROM voyages v
            LEFT JOIN ships s ON v.ship_id = s.ship_id
            ORDER BY v.departure_date DESC;
            "#,
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in rows {
            let voyage_id: Uuid = r.try_get("", "voyage_id").map_err(|e| e.to_string())?;
            let destination: String = r.try_get("", "destination").map_err(|e| e.to_string())?;
            let departure_date: String = r.try_get("", "departure_date_str").map_err(|e| e.to_string())?;
            let turnaround_buffer: i32 = r.try_get("", "turnaround_buffer").map_err(|e| e.to_string())?;
            let port_dwell_time: i32 = r.try_get("", "port_dwell_time").map_err(|e| e.to_string())?;
            let contingency_margin: i32 = r.try_get("", "contingency_margin").map_err(|e| e.to_string())?;
            let ship_id: Option<Uuid> = r.try_get("", "ship_id").map_err(|e| e.to_string())?;
            let ship_name: Option<String> = r.try_get("", "ship_name").map_err(|e| e.to_string())?;
            let status: String = r.try_get("", "status").map_err(|e| e.to_string())?;
            let created_by: Uuid = r.try_get("", "created_by").map_err(|e| e.to_string())?;
            let created_at: String = r.try_get("", "created_at_str").map_err(|e| e.to_string())?;
            let capacity: i32 = r.try_get("", "capacity").map_err(|e| e.to_string())?;
            let occupancy_count: i32 = r.try_get("", "occupancy_count").map_err(|e| e.to_string())?;

            list.push(VoyageResponse {
                voyage_id,
                destination,
                departure_date,
                turnaround_buffer,
                port_dwell_time,
                contingency_margin,
                ship_id,
                ship_name,
                status,
                created_by,
                created_at,
                occupancy_count,
                capacity,
            });
        }
        Ok(list)
    }

    pub async fn update_voyage(
        pool: &DatabaseConnection,
        voyage_uuid: Uuid,
        destination: &str,
        departure_date: chrono::NaiveDateTime,
        turnaround_buffer: i32,
        port_dwell_time: i32,
        contingency_margin: i32,
        status: &str,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            UPDATE voyages
            SET destination = $1, departure_date = $2, turnaround_buffer = $3, port_dwell_time = $4, contingency_margin = $5, status = $6
            WHERE voyage_id = $7;
            "#,
            vec![
                destination.into(),
                departure_date.into(),
                turnaround_buffer.into(),
                port_dwell_time.into(),
                contingency_margin.into(),
                status.into(),
                voyage_uuid.into(),
            ],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_voyage(pool: &DatabaseConnection, voyage_uuid: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "DELETE FROM voyages WHERE voyage_id = $1;",
            vec![voyage_uuid.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn assign_ship(pool: &DatabaseConnection, voyage_uuid: Uuid, ship_uuid: Option<Uuid>) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE voyages SET ship_id = $1 WHERE voyage_id = $2;",
            vec![ship_uuid.into(), voyage_uuid.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn book_voyage(pool: &DatabaseConnection, voyage_uuid: Uuid, passenger_uuid: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO voyage_bookings (voyage_id, passenger_id) VALUES ($1, $2) ON CONFLICT (voyage_id, passenger_id) DO NOTHING;",
            vec![voyage_uuid.into(), passenger_uuid.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn cancel_booking(pool: &DatabaseConnection, voyage_uuid: Uuid, passenger_uuid: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "DELETE FROM voyage_bookings WHERE voyage_id = $1 AND passenger_id = $2;",
            vec![voyage_uuid.into(), passenger_uuid.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_occupancy_stats(pool: &DatabaseConnection) -> Result<OccupancyStatsResponse, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT 
                status,
                COALESCE(SUM((SELECT COUNT(*)::FLOAT FROM voyage_bookings WHERE voyage_id = v.voyage_id)), 0) AS booked_count,
                COALESCE(SUM((SELECT capacity::FLOAT FROM ships WHERE ship_id = v.ship_id)), 0) AS total_capacity,
                COUNT(*)::FLOAT AS voyage_count
            FROM voyages v
            GROUP BY status;
            "#,
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut hist_rate = 0.0;
        let mut curr_rate = 0.0;
        let mut fut_rate = 0.0;

        for r in rows {
            let status: String = r.try_get("", "status").map_err(|e| e.to_string())?;
            let booked: f64 = r.try_get("", "booked_count").map_err(|e| e.to_string())?;
            let capacity: f64 = r.try_get("", "total_capacity").map_err(|e| e.to_string())?;

            let rate = if capacity > 0.0 {
                (booked / capacity) * 100.0
            } else {
                0.0
            };

            if status == "Completed" || status == "Closed" {
                hist_rate = rate;
            } else if status == "Active" || status == "In Progress" {
                curr_rate = rate;
            } else if status == "Upcoming" {
                fut_rate = rate;
            }
        }

        Ok(OccupancyStatsResponse {
            historical_occupancy: hist_rate,
            current_occupancy: curr_rate,
            future_occupancy: fut_rate,
        })
    }
}
