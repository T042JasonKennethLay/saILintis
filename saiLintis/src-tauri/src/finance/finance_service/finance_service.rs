use crate::database::database::DbState;
use uuid::Uuid;
use crate::finance::finance_model::finance_model::*;
use crate::finance::finance_repository::finance_repository::FinanceRepository;
use sea_orm::prelude::Decimal;
use base64::{engine::general_purpose, Engine as _};

pub struct FinanceService;

impl FinanceService {
    pub async fn get_crew_payroll_data(state: &DbState) -> Result<Vec<CrewContractInfo>, String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        FinanceRepository::get_crew_payroll_data(&state.pool).await
    }

    pub async fn save_crew_contract(state: &DbState, payload: SaveContractRequest) -> Result<(), String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        let user_uuid = Uuid::parse_str(&payload.user_id).map_err(|_| "Invalid user ID format".to_string())?;
        
        FinanceRepository::save_crew_contract(
            &state.pool,
            user_uuid,
            &payload.contract_type,
            payload.duration_months,
            payload.monthly_base_salary,
        ).await?;

        let desc = format!(
            "Saved contract configuration for crew member (ID: {}). Type: {}, Duration: {} months, Base Rate: ${}",
            payload.user_id, payload.contract_type, payload.duration_months, payload.monthly_base_salary
        );
        let _ = FinanceRepository::create_log(&state.pool, None, "SAVE_CREW_CONTRACT", &desc, false).await;

        Ok(())
    }

    pub async fn submit_crew_payroll(state: &DbState, payload: SubmitPayrollRequest) -> Result<String, String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        let submitted_by_uuid = Uuid::parse_str(&payload.submitted_by).map_err(|_| "Invalid submitter ID format".to_string())?;
        let payroll_uuid = Uuid::new_v4();

        FinanceRepository::submit_crew_payroll(
            &state.pool,
            payroll_uuid,
            payload.total_amount,
            submitted_by_uuid,
            payload.crew_count,
            &payload.details,
        ).await?;

        let parsed_details: serde_json::Value = serde_json::from_str(&payload.details)
            .map_err(|_| "Invalid payroll details format".to_string())?;

        if let Some(list) = parsed_details.as_array() {
            for item in list {
                if let (Some(u_id_str), Some(salary_val)) = (item.get("user_id").and_then(|v| v.as_str()), item.get("calculated_salary").and_then(|v| v.as_f64())) {
                    if let Ok(user_uuid) = Uuid::parse_str(u_id_str) {
                        let _ = FinanceRepository::decrement_crew_contract_duration(&state.pool, user_uuid).await;
                        let payment_uuid = Uuid::new_v4();
                        let amount = Decimal::from_f64_retain(salary_val).unwrap_or(Decimal::from(0));
                        let _ = FinanceRepository::insert_crew_payment(&state.pool, payment_uuid, payroll_uuid, user_uuid, amount).await;
                    }
                }
            }
        }

        let log_desc = format!(
            "Processed crew payroll run cycle (ID: {}). Total Count: {}, Total Paid: ${}",
            payroll_uuid, payload.crew_count, payload.total_amount
        );
        let _ = FinanceRepository::create_log(&state.pool, Some(submitted_by_uuid), "GENERATE_PAYROLL", &log_desc, false).await;

        Ok(payroll_uuid.to_string())
    }

    pub async fn list_payroll_records(state: &DbState) -> Result<Vec<PayrollRecordResponse>, String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        FinanceRepository::list_payroll_records(&state.pool).await
    }

    pub async fn export_payroll_csv(state: &DbState, payroll_id: String) -> Result<String, String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        let records = FinanceRepository::list_payroll_records(&state.pool).await?;
        let payroll_uuid = Uuid::parse_str(&payroll_id).map_err(|_| "Invalid payroll ID format".to_string())?;
        
        let selected = records.into_iter().find(|r| r.payroll_id == payroll_uuid)
            .ok_or_else(|| "Payroll run record not found".to_string())?;

        let details_val: serde_json::Value = serde_json::from_str(&selected.details)
            .map_err(|_| "Failed to parse payroll details".to_string())?;

        let mut csv_content = String::new();
        csv_content.push_str("Employee ID,Username,Display Name,Role (Rank),Department,Contract Type,Remaining Duration (Months),Base Monthly Rate ($),Adjustment Factor,Calculated Monthly Pay ($)\n");

        if let Some(list) = details_val.as_array() {
            for item in list {
                let emp_id = item.get("employee_id").and_then(|v| v.as_str()).unwrap_or("");
                let username = item.get("username").and_then(|v| v.as_str()).unwrap_or("");
                let display_name = item.get("display_name").and_then(|v| v.as_str()).unwrap_or("");
                let role_name = item.get("role_name").and_then(|v| v.as_str()).unwrap_or("");
                let department = item.get("department").and_then(|v| v.as_str()).unwrap_or("");
                let contract_type = item.get("contract_type").and_then(|v| v.as_str()).unwrap_or("");
                let duration = item.get("duration_months").and_then(|v| v.as_i64()).unwrap_or(0);
                let base_salary = item.get("monthly_base_salary").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let factor = item.get("factor").and_then(|v| v.as_f64()).unwrap_or(1.0);
                let calc_salary = item.get("calculated_salary").and_then(|v| v.as_f64()).unwrap_or(0.0);

                csv_content.push_str(&format!(
                    "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",{},{:.2},{:.1},{:.2}\n",
                    emp_id, username, display_name, role_name, department, contract_type, duration, base_salary, factor, calc_salary
                ));
            }
        }

        let base64_content = general_purpose::STANDARD.encode(csv_content.as_bytes());
        Ok(base64_content)
    }

    pub async fn submit_refund_request(state: &DbState, payload: SubmitRefundRequest) -> Result<(), String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        let entry_uuid = Uuid::parse_str(&payload.entry_id).map_err(|_| "Invalid entry ID format".to_string())?;
        let passenger_uuid = Uuid::parse_str(&payload.passenger_id).map_err(|_| "Invalid passenger ID format".to_string())?;
        let refund_uuid = Uuid::new_v4();

        FinanceRepository::submit_refund_request(
            &state.pool,
            refund_uuid,
            entry_uuid,
            passenger_uuid,
            &payload.reason,
        ).await?;

        let desc = format!(
            "Passenger (ID: {}) submitted refund request for charge (ID: {})",
            payload.passenger_id, payload.entry_id
        );
        let _ = FinanceRepository::create_log(&state.pool, Some(passenger_uuid), "SUBMIT_REFUND_REQUEST", &desc, false).await;

        Ok(())
    }

    pub async fn list_refund_requests(state: &DbState) -> Result<Vec<RefundRequestResponse>, String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        FinanceRepository::list_refund_requests(&state.pool).await
    }

    pub async fn approve_refund_request(state: &DbState, payload: ResolveRefundRequest) -> Result<(), String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        let refund_uuid = Uuid::parse_str(&payload.refund_id).map_err(|_| "Invalid refund ID format".to_string())?;
        let resolved_by_uuid = Uuid::parse_str(&payload.resolved_by).map_err(|_| "Invalid resolver ID format".to_string())?;

        let (passenger_uuid, amount, description) = FinanceRepository::approve_refund_request(
            &state.pool,
            refund_uuid,
            &payload.decision_notes,
            resolved_by_uuid,
        ).await?;

        let desc = format!(
            "Approved refund request (ID: {}) for passenger (ID: {}). Refunded: ${} for '{}'. Notes: {}",
            payload.refund_id, passenger_uuid, amount, description, payload.decision_notes
        );
        let _ = FinanceRepository::create_log(&state.pool, Some(resolved_by_uuid), "APPROVE_REFUND", &desc, false).await;

        Ok(())
    }

    pub async fn reject_refund_request(state: &DbState, payload: ResolveRefundRequest) -> Result<(), String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        let refund_uuid = Uuid::parse_str(&payload.refund_id).map_err(|_| "Invalid refund ID format".to_string())?;
        let resolved_by_uuid = Uuid::parse_str(&payload.resolved_by).map_err(|_| "Invalid resolver ID format".to_string())?;

        let passenger_uuid = FinanceRepository::reject_refund_request(
            &state.pool,
            refund_uuid,
            &payload.decision_notes,
            resolved_by_uuid,
        ).await?;

        let desc = format!(
            "Rejected refund request (ID: {}) for passenger (ID: {}). Notes: {}",
            payload.refund_id, passenger_uuid, payload.decision_notes
        );
        let _ = FinanceRepository::create_log(&state.pool, Some(resolved_by_uuid), "REJECT_REFUND", &desc, false).await;

        Ok(())
    }

    pub async fn get_cancellation_policy(state: &DbState) -> Result<CancellationPolicyResponse, String> {
        FinanceRepository::ensure_tables_exist(&state.pool).await?;
        FinanceRepository::get_cancellation_policy(&state.pool).await
    }
}
