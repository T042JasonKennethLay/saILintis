use sea_orm::*;
use uuid::Uuid;
use crate::engineering::engineering_model::engineering_model::*;

pub struct EngineeringRepository;

impl EngineeringRepository {
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

    pub async fn create_work_order(
        pool: &DatabaseConnection,
        title: &str,
        description: &str,
        equipment: &str,
        location: &str,
        priority: &str,
        created_by_account_id: Uuid,
    ) -> Result<Uuid, String> {
        let work_order_id = Uuid::new_v4();
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO work_orders (work_order_id, title, description, equipment, location, priority, status, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'Open', $7, NOW(), NOW());
            "#,
            vec![
                work_order_id.into(),
                title.into(),
                description.into(),
                equipment.into(),
                location.into(),
                priority.into(),
                created_by_account_id.into(),
            ],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(work_order_id)
    }

    pub async fn get_work_orders(pool: &DatabaseConnection) -> Result<Vec<WorkOrderResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT wo.work_order_id, wo.title, wo.description, wo.equipment, wo.location, wo.priority, wo.status,
                   wo.assigned_to, wo.created_by, wo.created_at::TEXT as created_at_str, wo.updated_at::TEXT as updated_at_str,
                   wo.closed_at::TEXT as closed_at_str,
                   u_creator.display_name AS creator_name,
                   u_assignee.display_name AS assignee_name
            FROM work_orders wo
            JOIN user_accounts ua_creator ON wo.created_by = ua_creator.account_id
            JOIN users u_creator ON ua_creator.user_id = u_creator.user_id
            LEFT JOIN user_accounts ua_assignee ON wo.assigned_to = ua_assignee.account_id
            LEFT JOIN users u_assignee ON ua_assignee.user_id = u_assignee.user_id
            ORDER BY wo.created_at DESC;
            "#,
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in rows {
            let work_order_id: Uuid = r.try_get("", "work_order_id").map_err(|e| e.to_string())?;
            let title: String = r.try_get("", "title").map_err(|e| e.to_string())?;
            let description: String = r.try_get("", "description").map_err(|e| e.to_string())?;
            let equipment: String = r.try_get("", "equipment").map_err(|e| e.to_string())?;
            let location: String = r.try_get("", "location").map_err(|e| e.to_string())?;
            let priority: String = r.try_get("", "priority").map_err(|e| e.to_string())?;
            let status: String = r.try_get("", "status").map_err(|e| e.to_string())?;
            let assigned_to: Option<Uuid> = r.try_get("", "assigned_to").map_err(|e| e.to_string())?;
            let created_by: Uuid = r.try_get("", "created_by").map_err(|e| e.to_string())?;
            let created_at: String = r.try_get("", "created_at_str").map_err(|e| e.to_string())?;
            let updated_at: String = r.try_get("", "updated_at_str").map_err(|e| e.to_string())?;
            let closed_at: Option<String> = r.try_get("", "closed_at_str").map_err(|e| e.to_string())?;
            let creator_name: String = r.try_get("", "creator_name").map_err(|e| e.to_string())?;
            let assignee_name: Option<String> = r.try_get("", "assignee_name").map_err(|e| e.to_string())?;

            list.push(WorkOrderResponse {
                work_order_id,
                title,
                description,
                equipment,
                location,
                priority,
                status,
                assigned_to,
                assigned_to_name: assignee_name,
                created_by,
                created_by_name: creator_name,
                created_at,
                updated_at,
                closed_at,
            });
        }
        Ok(list)
    }

    pub async fn assign_work_order(pool: &DatabaseConnection, work_order_uuid: Uuid, staff_uuid: Option<Uuid>) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            UPDATE work_orders
            SET assigned_to = $1, updated_at = NOW()
            WHERE work_order_id = $2;
            "#,
            vec![staff_uuid.into(), work_order_uuid.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;

        if let Some(engineer_account_id) = staff_uuid {
            let info_stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT title, created_by FROM work_orders WHERE work_order_id = $1 LIMIT 1;",
                vec![work_order_uuid.into()],
            );
            let info_row = pool.query_one(info_stmt).await.map_err(|e| e.to_string())?;
            if let Some(row) = info_row {
                let title: String = row.try_get("", "title").map_err(|e| e.to_string())?;
                let created_by: Uuid = row.try_get("", "created_by").map_err(|e| e.to_string())?;

                let name_stmt = Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "SELECT u.display_name FROM user_accounts ua JOIN users u ON ua.user_id = u.user_id WHERE ua.account_id = $1 LIMIT 1;",
                    vec![engineer_account_id.into()],
                );
                let name_row = pool.query_one(name_stmt).await.map_err(|e| e.to_string())?;
                let engineer_name = match name_row {
                    Some(r) => r.try_get("", "display_name").unwrap_or_else(|_| "Engineer".to_string()),
                    None => "Engineer".to_string(),
                };

                let alert_id = Uuid::new_v4();
                let msg = format!("Work Order '{}' has been assigned to {}.", title, engineer_name);
                let insert_alert = Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    r#"
                    INSERT INTO zone_alerts (alert_id, zone_id, message, sent_by, sent_at, status, recipients, is_read)
                    VALUES ($1, 'ALL', $2, $3, NOW(), 'Active', 'Engineer', FALSE);
                    "#,
                    vec![alert_id.into(), msg.into(), created_by.into()],
                );
                pool.execute(insert_alert).await.map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub async fn update_work_order_status(pool: &DatabaseConnection, work_order_uuid: Uuid, status: &str) -> Result<(), String> {
        let stmt = if status == "Completed" || status == "Closed" {
            Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                UPDATE work_orders
                SET status = $1, updated_at = NOW(), closed_at = NOW()
                WHERE work_order_id = $2;
                "#,
                vec![status.into(), work_order_uuid.into()],
            )
        } else {
            Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                UPDATE work_orders
                SET status = $1, updated_at = NOW(), closed_at = NULL
                WHERE work_order_id = $2;
                "#,
                vec![status.into(), work_order_uuid.into()],
            )
        };
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn add_maintenance_log(
        pool: &DatabaseConnection,
        work_order_uuid: Uuid,
        logged_by_account_id: Uuid,
        notes: &str,
    ) -> Result<Uuid, String> {
        let log_id = Uuid::new_v4();
        let name_stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT u.display_name FROM user_accounts ua JOIN users u ON ua.user_id = u.user_id WHERE ua.account_id = $1 LIMIT 1;",
            vec![logged_by_account_id.into()],
        );
        let name_row = pool.query_one(name_stmt).await.map_err(|e| e.to_string())?;
        let logged_by_name = match name_row {
            Some(row) => row.try_get("", "display_name").unwrap_or_else(|_| "Unknown Staff".to_string()),
            None => "Unknown Staff".to_string(),
        };

        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO maintenance_logs (log_id, work_order_id, logged_by, logged_by_name, notes, logged_at)
            VALUES ($1, $2, $3, $4, $5, NOW());
            "#,
            vec![
                log_id.into(),
                work_order_uuid.into(),
                logged_by_account_id.into(),
                logged_by_name.into(),
                notes.into(),
            ],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(log_id)
    }

    pub async fn get_maintenance_logs(pool: &DatabaseConnection, work_order_uuid: Uuid) -> Result<Vec<MaintenanceLogResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT log_id, work_order_id, logged_by, logged_by_name, notes, logged_at::TEXT as logged_at_str
            FROM maintenance_logs
            WHERE work_order_id = $1
            ORDER BY logged_at DESC;
            "#,
            vec![work_order_uuid.into()],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in rows {
            let log_id: Uuid = r.try_get("", "log_id").map_err(|e| e.to_string())?;
            let work_order_id: Uuid = r.try_get("", "work_order_id").map_err(|e| e.to_string())?;
            let logged_by: Uuid = r.try_get("", "logged_by").map_err(|e| e.to_string())?;
            let logged_by_name: String = r.try_get("", "logged_by_name").map_err(|e| e.to_string())?;
            let notes: String = r.try_get("", "notes").map_err(|e| e.to_string())?;
            let logged_at: String = r.try_get("", "logged_at_str").map_err(|e| e.to_string())?;

            list.push(MaintenanceLogResponse {
                log_id,
                work_order_id,
                logged_by,
                logged_by_name,
                notes,
                logged_at,
            });
        }
        Ok(list)
    }

    pub async fn get_engineering_staff(pool: &DatabaseConnection) -> Result<Vec<EngineeringStaffResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT ua.account_id, ua.username, u.display_name,
                   COALESCE((SELECT COUNT(*) FROM work_orders WHERE assigned_to = ua.account_id AND status NOT IN ('Completed', 'Closed')), 0)::INT AS active_tasks
            FROM user_accounts ua
            JOIN users u ON ua.user_id = u.user_id
            JOIN roles r ON ua.role_id = r.role_id
            WHERE r.role_name = 'Engineer' AND ua.is_active = true;
            "#,
            vec![],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in rows {
            let account_id: Uuid = r.try_get("", "account_id").map_err(|e| e.to_string())?;
            let username: String = r.try_get("", "username").map_err(|e| e.to_string())?;
            let display_name: String = r.try_get("", "display_name").map_err(|e| e.to_string())?;
            let active_tasks: i32 = r.try_get("", "active_tasks").map_err(|e| e.to_string())?;

            list.push(EngineeringStaffResponse {
                account_id,
                username,
                display_name,
                active_tasks,
            });
        }
        Ok(list)
    }

    pub async fn get_stats(pool: &DatabaseConnection) -> Result<EngineeringStatsResponse, String> {
        let counts_stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0)::INT as open_count,
                COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0)::INT as in_progress_count,
                COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0)::INT as completed_count,
                COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0)::INT as closed_count,
                COUNT(*)::INT as total_count
            FROM work_orders;
            "#,
            vec![],
        );
        let counts_row = pool.query_one(counts_stmt).await.map_err(|e| e.to_string())?;
        let (open_count, in_progress_count, completed_count, closed_count, total_count) = match counts_row {
            Some(r) => (
                r.try_get::<i32>("", "open_count").unwrap_or(0),
                r.try_get::<i32>("", "in_progress_count").unwrap_or(0),
                r.try_get::<i32>("", "completed_count").unwrap_or(0),
                r.try_get::<i32>("", "closed_count").unwrap_or(0),
                r.try_get::<i32>("", "total_count").unwrap_or(0),
            ),
            None => (0, 0, 0, 0, 0),
        };

        let time_stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600.0) as avg_hrs
            FROM work_orders
            WHERE closed_at IS NOT NULL AND created_at IS NOT NULL;
            "#,
            vec![],
        );
        let time_row = pool.query_one(time_stmt).await.map_err(|e| e.to_string())?;
        let average_resolve_time_hours = match time_row {
            Some(r) => r.try_get::<Option<f64>>("", "avg_hrs").unwrap_or(None).unwrap_or(0.0),
            None => 0.0,
        };

        let completion_rate = if total_count > 0 {
            ((completed_count + closed_count) as f64 / total_count as f64) * 100.0
        } else {
            100.0
        };

        let compliance_stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT 
                COUNT(DISTINCT wo.work_order_id)::INT as resolved_with_logs,
                (SELECT COUNT(*) FROM work_orders WHERE status IN ('Completed', 'Closed'))::INT as total_resolved
            FROM work_orders wo
            JOIN maintenance_logs ml ON wo.work_order_id = ml.work_order_id
            WHERE wo.status IN ('Completed', 'Closed');
            "#,
            vec![],
        );
        let compliance_row = pool.query_one(compliance_stmt).await.map_err(|e| e.to_string())?;
        let compliance_rate = match compliance_row {
            Some(r) => {
                let with_logs = r.try_get::<i32>("", "resolved_with_logs").unwrap_or(0);
                let total_resolved = r.try_get::<i32>("", "total_resolved").unwrap_or(0);
                if total_resolved > 0 {
                    (with_logs as f64 / total_resolved as f64) * 100.0
                } else {
                    100.0
                }
            }
            None => 100.0,
        };

        Ok(EngineeringStatsResponse {
            open_count,
            in_progress_count,
            completed_count,
            closed_count,
            average_resolve_time_hours,
            completion_rate,
            compliance_rate,
        })
    }
}
