use sea_orm::DatabaseConnection;
use uuid::Uuid;
use crate::engineering::engineering_model::engineering_model::*;
use crate::engineering::engineering_repository::engineering_repository::EngineeringRepository;

pub struct EngineeringService;

impl EngineeringService {
    pub async fn create_work_order(
        pool: &DatabaseConnection,
        title: &str,
        description: &str,
        equipment: &str,
        location: &str,
        priority: &str,
        user_id_str: &str,
    ) -> Result<Uuid, String> {
        let user_uuid = Uuid::parse_str(user_id_str).map_err(|e| e.to_string())?;
        let account_id = EngineeringRepository::get_account_id_by_user_id(pool, user_uuid)
            .await?
            .ok_or_else(|| "User account not found".to_string())?;

        EngineeringRepository::create_work_order(pool, title, description, equipment, location, priority, account_id).await
    }

    pub async fn get_work_orders(pool: &DatabaseConnection) -> Result<Vec<WorkOrderResponse>, String> {
        EngineeringRepository::get_work_orders(pool).await
    }

    pub async fn assign_work_order(pool: &DatabaseConnection, work_order_id_str: &str, staff_id_str: Option<String>) -> Result<(), String> {
        let work_order_uuid = Uuid::parse_str(work_order_id_str).map_err(|e| e.to_string())?;
        let staff_uuid = match staff_id_str {
            Some(s) if !s.is_empty() => Some(Uuid::parse_str(&s).map_err(|e| e.to_string())?),
            _ => None,
        };

        EngineeringRepository::assign_work_order(pool, work_order_uuid, staff_uuid).await
    }

    pub async fn update_work_order_status(pool: &DatabaseConnection, work_order_id_str: &str, status: &str) -> Result<(), String> {
        let work_order_uuid = Uuid::parse_str(work_order_id_str).map_err(|e| e.to_string())?;
        EngineeringRepository::update_work_order_status(pool, work_order_uuid, status).await
    }

    pub async fn add_maintenance_log(
        pool: &DatabaseConnection,
        work_order_id_str: &str,
        user_id_str: &str,
        notes: &str,
    ) -> Result<Uuid, String> {
        let work_order_uuid = Uuid::parse_str(work_order_id_str).map_err(|e| e.to_string())?;
        let user_uuid = Uuid::parse_str(user_id_str).map_err(|e| e.to_string())?;
        let account_id = EngineeringRepository::get_account_id_by_user_id(pool, user_uuid)
            .await?
            .ok_or_else(|| "User account not found".to_string())?;

        EngineeringRepository::add_maintenance_log(pool, work_order_uuid, account_id, notes).await
    }

    pub async fn get_maintenance_logs(pool: &DatabaseConnection, work_order_id_str: &str) -> Result<Vec<MaintenanceLogResponse>, String> {
        let work_order_uuid = Uuid::parse_str(work_order_id_str).map_err(|e| e.to_string())?;
        EngineeringRepository::get_maintenance_logs(pool, work_order_uuid).await
    }

    pub async fn get_engineering_staff(pool: &DatabaseConnection) -> Result<Vec<EngineeringStaffResponse>, String> {
        EngineeringRepository::get_engineering_staff(pool).await
    }

    pub async fn get_stats(pool: &DatabaseConnection) -> Result<EngineeringStatsResponse, String> {
        EngineeringRepository::get_stats(pool).await
    }
}
