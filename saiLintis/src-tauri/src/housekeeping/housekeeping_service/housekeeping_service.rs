use crate::database::database::DbState;
use uuid::Uuid;
use crate::housekeeping::{
    housekeeping_model::housekeeping_model::*,
    housekeeping_repository::housekeeping_repository::HousekeepingRepository,
};

pub struct HousekeepingService;

impl HousekeepingService {
    pub async fn list_linens(state: &DbState) -> Result<Vec<LinenResponse>, String> {
        HousekeepingRepository::list_linens(&state.pool).await
    }

    pub async fn create_linen(state: &DbState, payload: CreateLinenRequest) -> Result<Uuid, String> {
        let item_name = payload.item_name.trim();
        if item_name.is_empty() {
            return Err("Item name is required".to_string());
        }
        if payload.stock_count < 0 || payload.threshold < 0 {
            return Err("Stock and threshold counts must be non-negative".to_string());
        }

        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HousekeepingRepository::create_linen(
            &state.pool,
            item_name,
            payload.stock_count,
            payload.threshold,
            user_uuid,
        )
        .await
    }

    pub async fn update_linen(state: &DbState, payload: UpdateLinenRequest) -> Result<(), String> {
        let linen_uuid = Uuid::parse_str(&payload.linen_id).map_err(|_| "Invalid linen ID format".to_string())?;
        let item_name = payload.item_name.trim();
        if item_name.is_empty() {
            return Err("Item name is required".to_string());
        }
        if payload.stock_count < 0 || payload.threshold < 0 {
            return Err("Stock and threshold counts must be non-negative".to_string());
        }

        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HousekeepingRepository::update_linen(
            &state.pool,
            linen_uuid,
            item_name,
            payload.stock_count,
            payload.threshold,
            user_uuid,
        )
        .await
    }

    pub async fn delete_linen(state: &DbState, payload: DeleteLinenRequest) -> Result<(), String> {
        let linen_uuid = Uuid::parse_str(&payload.linen_id).map_err(|_| "Invalid linen ID format".to_string())?;
        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HousekeepingRepository::delete_linen(&state.pool, linen_uuid, user_uuid).await
    }

    pub async fn submit_shortage_report(state: &DbState, payload: SubmitShortageRequest) -> Result<Uuid, String> {
        let linen_uuid = Uuid::parse_str(&payload.linen_id).map_err(|_| "Invalid linen ID format".to_string())?;
        let description = payload.description.trim();
        let severity = payload.severity.trim();
        let category = payload.category.trim();

        if description.is_empty() {
            return Err("All required fields must be completed before submitting.".to_string());
        }

        if severity != "Low" && severity != "Medium" && severity != "High" {
            return Err("Severity must be Low, Medium, or High".to_string());
        }

        if category != "Provisions" && category != "Maintenance" {
            return Err("Category must be Provisions or Maintenance".to_string());
        }

        if payload.photo_data.is_none() || payload.photo_data.as_ref().unwrap().trim().is_empty() {
            return Err("Photo upload failed - please retry".to_string());
        }

        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user account ID format".to_string())?;

        HousekeepingRepository::submit_shortage_report(
            &state.pool,
            linen_uuid,
            description,
            severity,
            category,
            payload.photo_data,
            user_uuid,
        )
        .await
    }

    pub async fn list_shortage_reports(state: &DbState) -> Result<Vec<ShortageReportResponse>, String> {
        HousekeepingRepository::list_shortage_reports(&state.pool).await
    }

    pub async fn hk_create_staff_schedule(state: &DbState, payload: CreateScheduleRequest) -> Result<String, String> {
        let has_conflict = HousekeepingRepository::has_approved_shift_conflict(
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
        HousekeepingRepository::create_staff_schedule(&state.pool, payload).await?;
        Ok("Schedule request successfully submitted".to_string())
    }

    pub async fn hk_get_employees(state: &DbState) -> Result<Vec<String>, String> {
        HousekeepingRepository::get_employees_by_role(&state.pool, "Housekeeping Staff").await
    }

    pub async fn hk_get_staff_schedules(state: &DbState) -> Result<Vec<StaffScheduleResponse>, String> {
        HousekeepingRepository::get_staff_schedules(&state.pool).await
    }
}
