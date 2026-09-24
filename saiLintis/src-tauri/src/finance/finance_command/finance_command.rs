use tauri::State;
use crate::database::database::DbState;
use crate::finance::finance_model::finance_model::*;
use crate::finance::finance_service::finance_service::FinanceService;

#[tauri::command]
pub async fn get_crew_payroll_data(state: State<'_, DbState>) -> Result<Vec<CrewContractInfo>, String> {
    FinanceService::get_crew_payroll_data(&state).await
}

#[tauri::command]
pub async fn save_crew_contract(state: State<'_, DbState>, payload: SaveContractRequest) -> Result<(), String> {
    FinanceService::save_crew_contract(&state, payload).await
}

#[tauri::command]
pub async fn submit_crew_payroll(state: State<'_, DbState>, payload: SubmitPayrollRequest) -> Result<String, String> {
    FinanceService::submit_crew_payroll(&state, payload).await
}

#[tauri::command]
pub async fn list_payroll_records(state: State<'_, DbState>) -> Result<Vec<PayrollRecordResponse>, String> {
    FinanceService::list_payroll_records(&state).await
}

#[tauri::command]
pub async fn export_payroll_csv(state: State<'_, DbState>, payroll_id: String) -> Result<String, String> {
    FinanceService::export_payroll_csv(&state, payroll_id).await
}

#[tauri::command]
pub async fn submit_refund_request(state: State<'_, DbState>, payload: SubmitRefundRequest) -> Result<(), String> {
    FinanceService::submit_refund_request(&state, payload).await
}

#[tauri::command]
pub async fn list_refund_requests(state: State<'_, DbState>) -> Result<Vec<RefundRequestResponse>, String> {
    FinanceService::list_refund_requests(&state).await
}

#[tauri::command]
pub async fn approve_refund_request(state: State<'_, DbState>, payload: ResolveRefundRequest) -> Result<(), String> {
    FinanceService::approve_refund_request(&state, payload).await
}

#[tauri::command]
pub async fn reject_refund_request(state: State<'_, DbState>, payload: ResolveRefundRequest) -> Result<(), String> {
    FinanceService::reject_refund_request(&state, payload).await
}

#[tauri::command]
pub async fn get_cancellation_policy(state: State<'_, DbState>) -> Result<CancellationPolicyResponse, String> {
    FinanceService::get_cancellation_policy(&state).await
}
