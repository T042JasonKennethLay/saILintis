use tauri::State;
use crate::database::database::DbState;
use crate::voyage::voyage_model::voyage_model::*;
use crate::voyage::voyage_service::voyage_service::VoyageService;

#[tauri::command]
pub async fn voyage_get_ships(state: State<'_, DbState>) -> Result<Vec<ShipResponse>, String> {
    VoyageService::get_ships(&state.pool).await
}

#[tauri::command]
pub async fn voyage_create_voyage(
    state: State<'_, DbState>,
    destination: String,
    departureDate: String,
    turnaroundBuffer: i32,
    portDwellTime: i32,
    contingencyMargin: i32,
    shipId: Option<String>,
    userId: String,
) -> Result<String, String> {
    let id = VoyageService::create_voyage(
        &state.pool,
        &destination,
        &departureDate,
        turnaroundBuffer,
        portDwellTime,
        contingencyMargin,
        shipId,
        &userId,
    ).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn voyage_get_voyages(state: State<'_, DbState>) -> Result<Vec<VoyageResponse>, String> {
    VoyageService::get_voyages(&state.pool).await
}

#[tauri::command]
pub async fn voyage_update_voyage(
    state: State<'_, DbState>,
    voyageId: String,
    destination: String,
    departureDate: String,
    turnaroundBuffer: i32,
    portDwellTime: i32,
    contingencyMargin: i32,
    status: String,
) -> Result<(), String> {
    VoyageService::update_voyage(
        &state.pool,
        &voyageId,
        &destination,
        &departureDate,
        turnaroundBuffer,
        portDwellTime,
        contingencyMargin,
        &status,
    ).await
}

#[tauri::command]
pub async fn voyage_delete_voyage(state: State<'_, DbState>, voyageId: String) -> Result<(), String> {
    VoyageService::delete_voyage(&state.pool, &voyageId).await
}

#[tauri::command]
pub async fn voyage_assign_ship(
    state: State<'_, DbState>,
    voyageId: String,
    shipId: Option<String>,
) -> Result<(), String> {
    VoyageService::assign_ship(&state.pool, &voyageId, shipId).await
}

#[tauri::command]
pub async fn voyage_book_voyage(
    state: State<'_, DbState>,
    voyageId: String,
    passengerId: String,
) -> Result<(), String> {
    VoyageService::book_voyage(&state.pool, &voyageId, &passengerId).await
}

#[tauri::command]
pub async fn voyage_cancel_booking(
    state: State<'_, DbState>,
    voyageId: String,
    passengerId: String,
) -> Result<(), String> {
    VoyageService::cancel_booking(&state.pool, &voyageId, &passengerId).await
}

#[tauri::command]
pub async fn voyage_get_occupancy_stats(state: State<'_, DbState>) -> Result<OccupancyStatsResponse, String> {
    VoyageService::get_occupancy_stats(&state.pool).await
}

#[tauri::command]
pub async fn is_crew_assigned_to_voyage(state: State<'_, DbState>, account_id: String) -> Result<bool, String> {
    use sea_orm::{Statement, DatabaseBackend, ConnectionTrait};
    let user_uuid = uuid::Uuid::parse_str(&account_id).map_err(|_| "Invalid user ID format".to_string())?;

    let row = state.pool.query_one(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        r#"
        SELECT COUNT(*) AS cnt
        FROM voyage_crew_assignments a
        JOIN voyages v ON v.voyage_id = a.voyage_id
        JOIN user_accounts ua ON ua.account_id = a.account_id
        WHERE ua.user_id = $1 AND v.status != 'Completed' AND v.status != 'Closed'
        "#,
        [user_uuid.into()]
    )).await.map_err(|e: sea_orm::DbErr| e.to_string())?;

    if let Some(r) = row {
        let cnt: i64 = r.try_get("", "cnt").unwrap_or(0);
        Ok(cnt > 0)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn voyage_get_crew_assignments(state: State<'_, DbState>, voyage_id: String) -> Result<Vec<CrewAssignmentResponse>, String> {
    use sea_orm::{Statement, DatabaseBackend, ConnectionTrait};
    let voyage_uuid = uuid::Uuid::parse_str(&voyage_id).map_err(|_| "Invalid voyage ID format".to_string())?;

    let rows = state.pool.query_all(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        r#"
        SELECT 
            ua.account_id,
            u.display_name,
            ua.username,
            r.role_name,
            EXISTS(
                SELECT 1 
                FROM voyage_crew_assignments a 
                WHERE a.voyage_id = $1 AND a.account_id = ua.account_id
            ) AS is_assigned
        FROM user_accounts ua
        JOIN users u ON u.user_id = ua.user_id
        JOIN roles r ON r.role_id = ua.role_id
        WHERE r.role_name NOT IN (
            'IT Admin', 
            'Cruise Operations Director', 
            'Cruise Director', 
            'Operations Manager', 
            'Finance Manager', 
            'Restaurant Manager', 
            'Chief Engineer', 
            'Security Officer', 
            'Housekeeping Supervisor', 
            'Entertainment Manager',
            'Passenger',
            'Supplier'
        )
        ORDER BY r.role_name, u.display_name;
        "#,
        [voyage_uuid.into()]
    )).await.map_err(|e: sea_orm::DbErr| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        let account_id: uuid::Uuid = row.try_get("", "account_id").map_err(|e: sea_orm::DbErr| e.to_string())?;
        let display_name: String = row.try_get("", "display_name").map_err(|e: sea_orm::DbErr| e.to_string())?;
        let username: String = row.try_get("", "username").map_err(|e: sea_orm::DbErr| e.to_string())?;
        let role_name: String = row.try_get("", "role_name").map_err(|e: sea_orm::DbErr| e.to_string())?;
        let is_assigned: bool = row.try_get("", "is_assigned").map_err(|e: sea_orm::DbErr| e.to_string())?;

        list.push(CrewAssignmentResponse {
            account_id,
            display_name,
            username,
            role_name,
            is_assigned,
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn voyage_set_crew_assignments(state: State<'_, DbState>, voyage_id: String, account_ids: Vec<String>) -> Result<(), String> {
    use sea_orm::{Statement, DatabaseBackend, ConnectionTrait};
    let voyage_uuid = uuid::Uuid::parse_str(&voyage_id).map_err(|_| "Invalid voyage ID format".to_string())?;

    state.pool.execute(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        "DELETE FROM voyage_crew_assignments WHERE voyage_id = $1",
        [voyage_uuid.into()]
    )).await.map_err(|e: sea_orm::DbErr| e.to_string())?;

    for acc_id_str in account_ids {
        let acc_uuid = uuid::Uuid::parse_str(&acc_id_str).map_err(|_| "Invalid account ID format".to_string())?;
        state.pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO voyage_crew_assignments (voyage_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            vec![voyage_uuid.into(), acc_uuid.into()]
        )).await.map_err(|e: sea_orm::DbErr| e.to_string())?;
    }

    Ok(())
}
