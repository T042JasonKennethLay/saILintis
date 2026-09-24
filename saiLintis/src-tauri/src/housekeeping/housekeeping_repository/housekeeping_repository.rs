use sea_orm::*;
use uuid::Uuid;
use crate::entities::{prelude::*, *};
use crate::housekeeping::housekeeping_model::housekeeping_model::*;

pub struct HousekeepingRepository;

impl HousekeepingRepository {
    pub async fn create_log(pool: &DatabaseConnection,account_id: Option<Uuid>,action: &str,description: &str,is_flagged: bool,) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO system_logs (account_id, action, description, is_flagged, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![account_id.into(), action.into(), description.into(), is_flagged.into()],
        )).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_linens(pool: &DatabaseConnection) -> Result<Vec<LinenResponse>, String> {
        let items = LinenInventory::find().order_by_asc(linen_inventory::Column::ItemName).all(pool).await.map_err(|e| e.to_string())?;
        Ok(items.into_iter().map(|i| LinenResponse {
                linen_id: i.linen_id,
                item_name: i.item_name,
                stock_count: i.stock_count,
                threshold: i.threshold,
                status: i.status,
            }).collect())
    }

    pub async fn create_linen(pool: &DatabaseConnection,item_name: &str,stock_count: i32,threshold: i32,user_uuid: Uuid,) -> Result<Uuid, String> {
        let account = UserAccounts::find()
            .filter(user_accounts::Column::UserId.eq(user_uuid))
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "User account not found".to_string())?;
        let account_id = account.account_id;

        let linen_id = Uuid::new_v4();
        let status = if stock_count < threshold {
            "Shortage".to_string()
        } else {
            "Normal".to_string()
        };

        let model = linen_inventory::ActiveModel {
            linen_id: Set(linen_id),
            item_name: Set(item_name.to_string()),
            stock_count: Set(stock_count),
            threshold: Set(threshold),
            status: Set(status.clone()),
        };

        LinenInventory::insert(model).exec(pool).await.map_err(|e| e.to_string())?;
        let _ = Self::create_log(pool,Some(account_id),"CREATE_LINEN_INVENTORY",&format!("Created linen item: {} (Stock: {}, Threshold: {})", item_name, stock_count, threshold),false,).await;

        Ok(linen_id)
    }

    pub async fn update_linen(pool: &DatabaseConnection,linen_uuid: Uuid,item_name: &str,stock_count: i32,threshold: i32,user_uuid: Uuid,) -> Result<(), String> {
        let account = UserAccounts::find()
            .filter(user_accounts::Column::UserId.eq(user_uuid))
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "User account not found".to_string())?;
        let account_id = account.account_id;

        let item = LinenInventory::find_by_id(linen_uuid).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Linen item not found".to_string())?;
        let status = if stock_count < threshold {
            "Shortage".to_string()
        } else {
            "Normal".to_string()
        };

        let mut active: linen_inventory::ActiveModel = item.into();
        active.item_name = Set(item_name.to_string());
        active.stock_count = Set(stock_count);
        active.threshold = Set(threshold);
        active.status = Set(status);

        active.update(pool).await.map_err(|e| e.to_string())?;

        let _ = Self::create_log(
            pool,
            Some(account_id),
            "UPDATE_LINEN_INVENTORY",
            &format!("Updated linen item: {} (Stock: {}, Threshold: {})", item_name, stock_count, threshold),
            false,
        ).await;

        Ok(())
    }

    pub async fn delete_linen(pool: &DatabaseConnection,linen_uuid: Uuid,user_uuid: Uuid,) -> Result<(), String> {
        let account = UserAccounts::find()
            .filter(user_accounts::Column::UserId.eq(user_uuid))
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "User account not found".to_string())?;
        let account_id = account.account_id;

        let item = LinenInventory::find_by_id(linen_uuid).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Linen item not found".to_string())?;
        LinenInventory::delete_by_id(linen_uuid).exec(pool).await.map_err(|e| e.to_string())?;

        let _ = Self::create_log(pool,Some(account_id),"DELETE_LINEN_INVENTORY",&format!("Deleted linen item: {}", item.item_name),false,).await;

        Ok(())
    }

    pub async fn submit_shortage_report(pool: &DatabaseConnection,linen_uuid: Uuid,description: &str,severity: &str,category: &str,photo_data: Option<String>,user_uuid: Uuid,) -> Result<Uuid, String> {
        let account = UserAccounts::find()
            .filter(user_accounts::Column::UserId.eq(user_uuid))
            .one(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "User account not found".to_string())?;
        let account_id = account.account_id;

        let report_id = Uuid::new_v4();
        let item = LinenInventory::find_by_id(linen_uuid).one(pool).await.map_err(|e| e.to_string())?.ok_or_else(|| "Linen item not found".to_string())?;

        let report = linen_shortage_reports::ActiveModel {
            report_id: Set(report_id),
            linen_id: Set(linen_uuid),
            description: Set(description.to_string()),
            severity: Set(severity.to_string()),
            category: Set(category.to_string()),
            photo_data: Set(photo_data),
            reported_by: Set(Some(account_id)),
            reported_at: Set(chrono::Local::now().naive_local()),
            status: Set("Pending".to_string()),
        };

        LinenShortageReports::insert(report).exec(pool).await.map_err(|e| e.to_string())?;

        let mut active_item: linen_inventory::ActiveModel = item.clone().into();
        active_item.status = Set("Shortage".to_string());
        active_item.update(pool).await.map_err(|e| e.to_string())?;

        let _ = Self::create_log(
            pool,
            Some(account_id),
            "REPORT_LINEN_SHORTAGE",
            &format!("Reported stock shortage for {}: Severity: {}, Department: {}", item.item_name, severity, category),
            true,
        ).await;

        Ok(report_id)
    }

    pub async fn list_shortage_reports(pool: &DatabaseConnection,) -> Result<Vec<ShortageReportResponse>, String> {
        let reports = LinenShortageReports::find().order_by_desc(linen_shortage_reports::Column::ReportedAt).all(pool).await.map_err(|e| e.to_string())?;

        let mut responses = Vec::new();
        for r in reports {
            let item_name = if let Some(item) = LinenInventory::find_by_id(r.linen_id).one(pool).await.map_err(|e| e.to_string())? {
                item.item_name
            } else {
                "Unknown Item".to_string()
            };

            let reported_by_name = if let Some(reporter_uuid) = r.reported_by {
                if let Some(user_acc) = UserAccounts::find_by_id(reporter_uuid).one(pool).await.map_err(|e| e.to_string())? {
                    if let Some(user_info) = Users::find_by_id(user_acc.user_id).one(pool).await.map_err(|e| e.to_string())? {
                        Some(user_info.display_name)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            responses.push(ShortageReportResponse {
                report_id: r.report_id,
                linen_id: r.linen_id,
                item_name,
                description: r.description,
                severity: r.severity,
                category: r.category,
                photo_data: r.photo_data,
                reported_by: r.reported_by,
                reported_by_name,
                reported_at: r.reported_at.to_string(),
                status: r.status,
            });
        }

        Ok(responses)
    }

    pub async fn has_approved_shift_conflict(pool: &DatabaseConnection, employee_name: &str, shift_date: &str) -> Result<bool, String> {
        let row = pool.query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT COUNT(*) AS cnt FROM staff_schedules WHERE employee_name = $1 AND shift_date = $2 AND status = 'Approved'",
            [employee_name.into(), shift_date.into()]
        )).await.map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let cnt: i64 = r.try_get("", "cnt").unwrap_or(0);
            Ok(cnt > 0)
        } else {
            Ok(false)
        }
    }

    pub async fn create_staff_schedule(pool: &DatabaseConnection, payload: CreateScheduleRequest) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO staff_schedules (employee_name, role_name, shift_date, shift_hours, position, status, requested_by) VALUES ($1, $2, $3, $4, $5, 'Pending', $6)",
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

    pub async fn get_staff_schedules(pool: &DatabaseConnection) -> Result<Vec<StaffScheduleResponse>, String> {
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

            res.push(StaffScheduleResponse {
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
}
