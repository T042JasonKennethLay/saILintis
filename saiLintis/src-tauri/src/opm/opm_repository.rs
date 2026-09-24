use sea_orm::{DatabaseConnection, Statement, DatabaseBackend, ConnectionTrait};
use uuid::Uuid;
use crate::opm::opm_model::{OpmPassengerResponse, OpmTimelineResponse, StaffSchedule, CreateScheduleRequest};

pub struct OpmRepository;

impl OpmRepository {
    pub async fn get_passenger_checkin_status(pool: &DatabaseConnection) -> Result<Vec<OpmPassengerResponse>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                p.passenger_id::text AS passenger_id,
                p.display_name,
                p.email,
                p.status,
                COALESCE(c.cabin_number, '') AS cabin_number,
                COALESCE(l.checkin_status, 'Not Checked In') AS checkin_status,
                l.created_at::text AS checkin_time
            FROM passengers p
            LEFT JOIN cabins c ON c.assigned_passenger_id = p.passenger_id::text
            LEFT JOIN (
                SELECT passenger_id, checkin_status, created_at
                FROM passenger_checkin_log
                WHERE id IN (
                    SELECT MAX(id) FROM passenger_checkin_log GROUP BY passenger_id
                )
            ) l ON l.passenger_id = p.passenger_id::text
            ORDER BY p.display_name ASC
            "#
        )).await.map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            let passenger_id: String = r.try_get("", "passenger_id").unwrap_or_default();
            let display_name: String = r.try_get("", "display_name").unwrap_or_default();
            let email: String = r.try_get("", "email").unwrap_or_default();
            let status: String = r.try_get("", "status").unwrap_or_default();
            let cabin_number: String = r.try_get("", "cabin_number").unwrap_or_default();
            let checkin_status: String = r.try_get("", "checkin_status").unwrap_or_default();
            let checkin_time: Option<String> = r.try_get("", "checkin_time").ok();

            res.push(OpmPassengerResponse {
                passenger_id,
                display_name,
                email,
                status,
                cabin_number: if cabin_number.is_empty() { None } else { Some(cabin_number) },
                checkin_status,
                checkin_time,
            });
        }
        Ok(res)
    }

    pub async fn get_boarding_timeline(pool: &DatabaseConnection) -> Result<Vec<OpmTimelineResponse>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                l.id,
                l.passenger_id::text AS passenger_id,
                p.display_name,
                l.checkin_status,
                l.created_at::text AS created_at_str
            FROM passenger_checkin_log l
            JOIN passengers p ON l.passenger_id = p.passenger_id::text
            ORDER BY l.created_at DESC
            "#
        )).await.map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            let id: i32 = r.try_get("", "id").unwrap_or(0);
            let passenger_id: String = r.try_get("", "passenger_id").unwrap_or_default();
            let display_name: String = r.try_get("", "display_name").unwrap_or_default();
            let checkin_status: String = r.try_get("", "checkin_status").unwrap_or_default();
            let created_at: String = r.try_get("", "created_at_str").unwrap_or_default();

            res.push(OpmTimelineResponse {
                id,
                passenger_id,
                display_name,
                checkin_status,
                created_at,
            });
        }
        Ok(res)
    }

    pub async fn get_staff_schedules(pool: &DatabaseConnection) -> Result<Vec<StaffSchedule>, String> {
        let rows = pool.query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT id, employee_name, role_name, shift_date, shift_hours, position, status, requested_by, created_at::text AS created_at_str FROM staff_schedules ORDER BY created_at DESC"
        )).await.map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            let id: i32 = r.try_get("", "id").unwrap_or(0);
            let employee_name: String = r.try_get("", "employee_name").unwrap_or_default();
            let role_name: String = r.try_get("", "role_name").unwrap_or_default();
            let shift_date: String = r.try_get("", "shift_date").unwrap_or_default();
            let shift_hours: String = r.try_get("", "shift_hours").unwrap_or_default();
            let position: String = r.try_get("", "position").unwrap_or_default();
            let status: String = r.try_get("", "status").unwrap_or_default();
            let requested_by: String = r.try_get("", "requested_by").unwrap_or_default();
            let created_at: String = r.try_get("", "created_at_str").unwrap_or_default();

            res.push(StaffSchedule {
                id,
                employee_name,
                role_name,
                shift_date,
                shift_hours,
                position,
                status,
                requested_by,
                created_at,
            });
        }
        Ok(res)
    }

    pub async fn get_staff_schedule_by_id(pool: &DatabaseConnection, id: i32) -> Result<Option<StaffSchedule>, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id, employee_name, role_name, shift_date, shift_hours, position, status, requested_by, created_at::text AS created_at_str FROM staff_schedules WHERE id = $1",
            [id.into()]
        )).await.map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let id: i32 = r.try_get("", "id").unwrap_or(0);
            let employee_name: String = r.try_get("", "employee_name").unwrap_or_default();
            let role_name: String = r.try_get("", "role_name").unwrap_or_default();
            let shift_date: String = r.try_get("", "shift_date").unwrap_or_default();
            let shift_hours: String = r.try_get("", "shift_hours").unwrap_or_default();
            let position: String = r.try_get("", "position").unwrap_or_default();
            let status: String = r.try_get("", "status").unwrap_or_default();
            let requested_by: String = r.try_get("", "requested_by").unwrap_or_default();
            let created_at: String = r.try_get("", "created_at_str").unwrap_or_default();

            Ok(Some(StaffSchedule {
                id,
                employee_name,
                role_name,
                shift_date,
                shift_hours,
                position,
                status,
                requested_by,
                created_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn has_approved_shift_conflict(pool: &DatabaseConnection, employee_name: &str, shift_date: &str, exclude_id: i32) -> Result<bool, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT COUNT(*) AS cnt FROM staff_schedules WHERE employee_name = $1 AND shift_date = $2 AND status = 'Approved' AND id != $3",
            [employee_name.into(), shift_date.into(), exclude_id.into()]
        )).await.map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let cnt: i64 = r.try_get("", "cnt").unwrap_or(0);
            Ok(cnt > 0)
        } else {
            Ok(false)
        }
    }

    pub async fn update_staff_schedule_status(pool: &DatabaseConnection, id: i32, status: &str) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE staff_schedules SET status = $1 WHERE id = $2",
            [status.into(), id.into()]
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn create_operational_incident(pool: &DatabaseConnection, incident_id: Uuid, description: &str, location: &str, severity: &str, submitted_by: Uuid) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"INSERT INTO incidents (incident_id, incident_type, description, location, severity, status, created_at, submitted_by)
               VALUES ($1, 'Operational Escalation', $2, $3, $4, 'Escalated', $5, $6)"#,
            [incident_id.into(), description.into(), location.into(), severity.into(), chrono::Local::now().naive_local().into(), submitted_by.into()]
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_employees_by_role(pool: &DatabaseConnection, role_name: &str) -> Result<Vec<String>, String> {
        let rows = pool.query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT u.display_name
            FROM users u
            JOIN user_accounts ua ON ua.user_id = u.user_id
            JOIN roles r          ON r.role_id  = ua.role_id
            WHERE r.role_name = $1 AND ua.is_active = TRUE
            ORDER BY u.display_name ASC
            "#,
            [role_name.into()]
        )).await.map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            let display_name: String = r.try_get("", "display_name").unwrap_or_default();
            res.push(display_name);
        }
        Ok(res)
    }

    pub async fn create_staff_schedule(pool: &DatabaseConnection, payload: CreateScheduleRequest) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO staff_schedules (employee_name, role_name, shift_date, shift_hours, position, status, requested_by) VALUES ($1, $2, $3, $4, $5, 'Approved', $6)",
            [
                payload.employee_name.into(),
                payload.role_name.into(),
                payload.shift_date.into(),
                payload.shift_hours.into(),
                payload.position.into(),
                payload.requested_by.into(),
            ]
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
