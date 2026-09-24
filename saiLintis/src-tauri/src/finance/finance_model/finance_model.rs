use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::prelude::Decimal;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CrewContractInfo {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub role_name: String,
    pub department: String,
    pub employee_id: String,
    pub contract_type: String,
    pub duration_months: i32,
    pub monthly_base_salary: Decimal,
    pub is_complete: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct SaveContractRequest {
    pub user_id: String,
    pub contract_type: String,
    pub duration_months: i32,
    pub monthly_base_salary: Decimal,
}

#[derive(Deserialize, Clone, Debug)]
pub struct SubmitPayrollRequest {
    pub total_amount: Decimal,
    pub submitted_by: String,
    pub crew_count: i32,
    pub details: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct PayrollRecordResponse {
    pub payroll_id: Uuid,
    pub cycle_date: String,
    pub total_amount: Decimal,
    pub submitted_by_name: String,
    pub crew_count: i32,
    pub details: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct SubmitRefundRequest {
    pub entry_id: String,
    pub passenger_id: String,
    pub reason: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct RefundRequestResponse {
    pub refund_id: Uuid,
    pub entry_id: Uuid,
    pub passenger_id: Uuid,
    pub passenger_name: String,
    pub passenger_email: String,
    pub reason: String,
    pub status: String,
    pub decision_notes: Option<String>,
    pub resolved_by: Option<Uuid>,
    pub resolved_by_name: Option<String>,
    pub resolved_at: Option<String>,
    pub created_at: String,
    pub charge_description: String,
    pub charge_amount: Decimal,
    pub charge_date: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ResolveRefundRequest {
    pub refund_id: String,
    pub decision_notes: String,
    pub resolved_by: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CancellationPolicyResponse {
    pub policy_id: String,
    pub policy_name: String,
    pub terms: String,
    pub window_hours: i32,
}
