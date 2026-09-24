use sea_orm::{DatabaseConnection, Statement, DbBackend, ConnectionTrait};
use uuid::Uuid;
use crate::finance::finance_model::finance_model::{CrewContractInfo, PayrollRecordResponse, RefundRequestResponse, CancellationPolicyResponse};
use sea_orm::prelude::Decimal;

pub struct FinanceRepository;

impl FinanceRepository {
    pub async fn ensure_tables_exist(pool: &DatabaseConnection) -> Result<(), String> {
        pool.execute(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            CREATE TABLE IF NOT EXISTS crew_contracts (
                user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                contract_type VARCHAR(50) NOT NULL,
                duration_months INT NOT NULL,
                monthly_base_salary NUMERIC(15, 2) NOT NULL
            );
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        pool.execute(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            CREATE TABLE IF NOT EXISTS payroll_records (
                payroll_id UUID PRIMARY KEY,
                cycle_date TIMESTAMP NOT NULL DEFAULT NOW(),
                total_amount NUMERIC(15, 2) NOT NULL,
                submitted_by UUID NOT NULL REFERENCES users(user_id),
                crew_count INT NOT NULL,
                details TEXT NOT NULL
            );
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        pool.execute(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            CREATE TABLE IF NOT EXISTS crew_payments (
                payment_id UUID PRIMARY KEY,
                payroll_id UUID NOT NULL REFERENCES payroll_records(payroll_id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                amount NUMERIC(15, 2) NOT NULL,
                payment_date TIMESTAMP NOT NULL DEFAULT NOW()
            );
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        pool.execute(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            CREATE TABLE IF NOT EXISTS cancellation_policies (
                policy_id VARCHAR(50) PRIMARY KEY,
                policy_name VARCHAR(100) NOT NULL,
                terms TEXT NOT NULL,
                window_hours INT NOT NULL
            );
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        pool.execute(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO cancellation_policies (policy_id, policy_name, terms, window_hours) 
            VALUES ('STANDARD', 'Standard Onboard Cancellation Policy', 'Onboard purchases, excursion bookings, and spa reservations are eligible for a full refund if the refund request is submitted within 24 hours of the original charge.', 24)
            ON CONFLICT (policy_id) DO NOTHING;
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        pool.execute(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            CREATE TABLE IF NOT EXISTS refund_requests (
                refund_id UUID PRIMARY KEY,
                entry_id UUID NOT NULL REFERENCES spending_entries(entry_id) ON DELETE CASCADE,
                passenger_id UUID NOT NULL REFERENCES passengers(passenger_id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Pending',
                decision_notes TEXT,
                resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            "#,
            vec![],
        )).await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_crew_payroll_data(pool: &DatabaseConnection) -> Result<Vec<CrewContractInfo>, String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            SELECT 
                ua.user_id, 
                ua.username, 
                u.display_name, 
                r.role_name, 
                r.department, 
                ua.employee_id
            FROM user_accounts ua
            JOIN users u ON ua.user_id = u.user_id
            JOIN roles r ON ua.role_id = r.role_id
            WHERE r.role_name != 'Passenger' AND ua.is_active = true
            ORDER BY u.display_name ASC
            "#,
            vec![],
        );

        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut results = Vec::new();

        for row in rows {
            let user_id: Uuid = row.try_get("", "user_id").map_err(|e| e.to_string())?;
            let username: String = row.try_get("", "username").map_err(|e| e.to_string())?;
            let display_name: String = row.try_get("", "display_name").map_err(|e| e.to_string())?;
            let role_name: String = row.try_get("", "role_name").map_err(|e| e.to_string())?;
            let department: String = row.try_get("", "department").map_err(|e| e.to_string())?;
            let employee_id: Option<String> = row.try_get("", "employee_id").map_err(|e| e.to_string())?;
            let employee_id = employee_id.unwrap_or_default();

            let contract_stmt = Statement::from_sql_and_values(
                DbBackend::Postgres,
                "SELECT contract_type, duration_months, monthly_base_salary FROM crew_contracts WHERE user_id = $1",
                vec![user_id.into()],
            );

            let contract_row_opt = pool.query_one(contract_stmt).await.map_err(|e| e.to_string())?;

            let (contract_type, duration_months, monthly_base_salary, is_complete) = match contract_row_opt {
                Some(cr) => {
                    let c_type: String = cr.try_get("", "contract_type").map_err(|e| e.to_string())?;
                    let duration: i32 = cr.try_get("", "duration_months").map_err(|e| e.to_string())?;
                    let salary: Decimal = cr.try_get("", "monthly_base_salary").map_err(|e| e.to_string())?;
                    (c_type, duration, salary, true)
                }
                None => {
                    let default_salary = match role_name.as_str() {
                        "Cruise Line Executive Director" => Decimal::from(15000),
                        "Cruise Operations Director" => Decimal::from(12000),
                        "Ship Captain" => Decimal::from(10000),
                        "Chief Engineer" => Decimal::from(8500),
                        "HR Manager" => Decimal::from(8000),
                        "Finance Manager" => Decimal::from(8000),
                        "Restaurant Manager" => Decimal::from(6000),
                        "Entertainment Manager" => Decimal::from(6000),
                        "Operations Manager" => Decimal::from(6000),
                        "Safety Officer" => Decimal::from(6000),
                        "Medical Officer" => Decimal::from(6000),
                        "Housekeeping Supervisor" => Decimal::from(4500),
                        "Engineer" => Decimal::from(3500),
                        "Security Officer" => Decimal::from(3500),
                        "Entertainment Staff" => Decimal::from(3000),
                        "Housekeeping Staff" => Decimal::from(3000),
                        "Front Desk Officer" => Decimal::from(3000),
                        _ => Decimal::from(2500),
                    };
                    ("Full-Time".to_string(), 0, default_salary, false)
                }
            };

            results.push(CrewContractInfo {
                user_id,
                username,
                display_name,
                role_name,
                department,
                employee_id,
                contract_type,
                duration_months,
                monthly_base_salary,
                is_complete,
            });
        }

        Ok(results)
    }

    pub async fn save_crew_contract(
        pool: &DatabaseConnection,
        user_uuid: Uuid,
        contract_type: &str,
        duration_months: i32,
        monthly_base_salary: Decimal,
    ) -> Result<(), String> {
        let upsert_stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO crew_contracts (user_id, contract_type, duration_months, monthly_base_salary)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE 
            SET contract_type = EXCLUDED.contract_type,
                duration_months = EXCLUDED.duration_months,
                monthly_base_salary = EXCLUDED.monthly_base_salary
            "#,
            vec![
                user_uuid.into(),
                contract_type.into(),
                duration_months.into(),
                monthly_base_salary.into(),
            ],
        );

        pool.execute(upsert_stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn submit_crew_payroll(
        pool: &DatabaseConnection,
        payroll_uuid: Uuid,
        total_amount: Decimal,
        submitted_by_uuid: Uuid,
        crew_count: i32,
        details: &str,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO payroll_records (payroll_id, cycle_date, total_amount, submitted_by, crew_count, details)
            VALUES ($1, NOW(), $2, $3, $4, $5)
            "#,
            vec![
                payroll_uuid.into(),
                total_amount.into(),
                submitted_by_uuid.into(),
                crew_count.into(),
                details.into(),
            ],
        );

        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn insert_crew_payment(
        pool: &DatabaseConnection,
        payment_uuid: Uuid,
        payroll_uuid: Uuid,
        user_uuid: Uuid,
        amount: Decimal,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO crew_payments (payment_id, payroll_id, user_id, amount, payment_date)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![
                payment_uuid.into(),
                payroll_uuid.into(),
                user_uuid.into(),
                amount.into(),
            ],
        );

        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn decrement_crew_contract_duration(pool: &DatabaseConnection, user_uuid: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE crew_contracts 
            SET duration_months = duration_months - 1 
            WHERE user_id = $1 AND duration_months > 0
            "#,
            vec![user_uuid.into()],
        );

        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_payroll_records(pool: &DatabaseConnection) -> Result<Vec<PayrollRecordResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            SELECT 
                pr.payroll_id, 
                pr.cycle_date, 
                pr.total_amount, 
                u.display_name AS submitted_by_name, 
                pr.crew_count, 
                pr.details
            FROM payroll_records pr
            JOIN users u ON pr.submitted_by = u.user_id
            ORDER BY pr.cycle_date DESC
            "#,
            vec![],
        );

        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut results = Vec::new();

        for row in rows {
            let payroll_id: Uuid = row.try_get("", "payroll_id").map_err(|e| e.to_string())?;
            let cycle_date: chrono::NaiveDateTime = row.try_get("", "cycle_date").map_err(|e| e.to_string())?;
            let total_amount: Decimal = row.try_get("", "total_amount").map_err(|e| e.to_string())?;
            let submitted_by_name: String = row.try_get("", "submitted_by_name").map_err(|e| e.to_string())?;
            let crew_count: i32 = row.try_get("", "crew_count").map_err(|e| e.to_string())?;
            let details: String = row.try_get("", "details").map_err(|e| e.to_string())?;

            results.push(PayrollRecordResponse {
                payroll_id,
                cycle_date: cycle_date.to_string(),
                total_amount,
                submitted_by_name,
                crew_count,
                details,
            });
        }

        Ok(results)
    }

    pub async fn create_log(
        pool: &DatabaseConnection,
        account_id: Option<Uuid>,
        action: &str,
        description: &str,
        is_flagged: bool,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO system_logs (account_id, action, description, is_flagged, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![
                account_id.into(),
                action.into(),
                description.into(),
                is_flagged.into(),
            ],
        );

        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn submit_refund_request(
        pool: &DatabaseConnection,
        refund_uuid: Uuid,
        entry_uuid: Uuid,
        passenger_uuid: Uuid,
        reason: &str,
    ) -> Result<(), String> {
        let check_stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            "SELECT 1 FROM refund_requests WHERE entry_id = $1",
            vec![entry_uuid.into()],
        );
        let exists = pool.query_one(check_stmt).await.map_err(|e| e.to_string())?.is_some();
        if exists {
            return Err("A refund request already exists for this charge.".to_string());
        }

        let insert_stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO refund_requests (refund_id, entry_id, passenger_id, reason, status, created_at)
            VALUES ($1, $2, $3, $4, 'Pending', NOW())
            "#,
            vec![
                refund_uuid.into(),
                entry_uuid.into(),
                passenger_uuid.into(),
                reason.into(),
            ],
        );
        pool.execute(insert_stmt).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_refund_requests(pool: &DatabaseConnection) -> Result<Vec<RefundRequestResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            SELECT 
                rr.refund_id,
                rr.entry_id,
                rr.passenger_id,
                p.display_name AS passenger_name,
                p.email AS passenger_email,
                rr.reason,
                rr.status,
                rr.decision_notes,
                rr.resolved_by,
                u.display_name AS resolved_by_name,
                rr.resolved_at,
                rr.created_at,
                se.description AS charge_description,
                se.amount AS charge_amount,
                se.date AS charge_date
            FROM refund_requests rr
            JOIN passengers p ON rr.passenger_id = p.passenger_id
            JOIN spending_entries se ON rr.entry_id = se.entry_id
            LEFT JOIN users u ON rr.resolved_by = u.user_id
            ORDER BY rr.created_at DESC
            "#,
            vec![],
        );

        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut results = Vec::new();

        for row in rows {
            let refund_id: Uuid = row.try_get("", "refund_id").map_err(|e| e.to_string())?;
            let entry_id: Uuid = row.try_get("", "entry_id").map_err(|e| e.to_string())?;
            let passenger_id: Uuid = row.try_get("", "passenger_id").map_err(|e| e.to_string())?;
            let passenger_name: String = row.try_get("", "passenger_name").map_err(|e| e.to_string())?;
            let passenger_email: String = row.try_get("", "passenger_email").map_err(|e| e.to_string())?;
            let reason: String = row.try_get("", "reason").map_err(|e| e.to_string())?;
            let status: String = row.try_get("", "status").map_err(|e| e.to_string())?;
            let decision_notes: Option<String> = row.try_get("", "decision_notes").map_err(|e| e.to_string())?;
            let resolved_by: Option<Uuid> = row.try_get("", "resolved_by").map_err(|e| e.to_string())?;
            let resolved_by_name: Option<String> = row.try_get("", "resolved_by_name").map_err(|e| e.to_string())?;
            let resolved_at: Option<chrono::NaiveDateTime> = row.try_get("", "resolved_at").map_err(|e| e.to_string())?;
            let created_at: chrono::NaiveDateTime = row.try_get("", "created_at").map_err(|e| e.to_string())?;
            
            let charge_description: String = row.try_get("", "charge_description").map_err(|e| e.to_string())?;
            let charge_amount: Decimal = row.try_get("", "charge_amount").map_err(|e| e.to_string())?;
            let charge_date: chrono::NaiveDateTime = row.try_get("", "charge_date").map_err(|e| e.to_string())?;

            results.push(RefundRequestResponse {
                refund_id,
                entry_id,
                passenger_id,
                passenger_name,
                passenger_email,
                reason,
                status,
                decision_notes,
                resolved_by,
                resolved_by_name,
                resolved_at: resolved_at.map(|t| t.to_string()),
                created_at: created_at.to_string(),
                charge_description,
                charge_amount,
                charge_date: charge_date.to_string(),
            });
        }

        Ok(results)
    }

    pub async fn approve_refund_request(
        pool: &DatabaseConnection,
        refund_uuid: Uuid,
        decision_notes: &str,
        resolved_by_uuid: Uuid,
    ) -> Result<(Uuid, Decimal, String), String> {
        let req_stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            "SELECT entry_id, passenger_id, status FROM refund_requests WHERE refund_id = $1",
            vec![refund_uuid.into()],
        );
        let req_row = pool.query_one(req_stmt).await.map_err(|e| e.to_string())?
            .ok_or_else(|| "Refund request not found".to_string())?;

        let status: String = req_row.try_get("", "status").map_err(|e| e.to_string())?;
        if status != "Pending" {
            return Err("Refund request has already been resolved".to_string());
        }

        let entry_uuid: Uuid = req_row.try_get("", "entry_id").map_err(|e| e.to_string())?;
        let passenger_uuid: Uuid = req_row.try_get("", "passenger_id").map_err(|e| e.to_string())?;

        let charge_stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            "SELECT description, amount FROM spending_entries WHERE entry_id = $1",
            vec![entry_uuid.into()],
        );
        let charge_row_opt = pool.query_one(charge_stmt).await.map_err(|e| e.to_string())?;
        if charge_row_opt.is_none() {
            return Err("Charge record not found - cannot proceed".to_string());
        }
        let charge_row = charge_row_opt.unwrap();
        let description: String = charge_row.try_get("", "description").map_err(|e| e.to_string())?;
        let amount: Decimal = charge_row.try_get("", "amount").map_err(|e| e.to_string())?;

        let update_req = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE refund_requests 
            SET status = 'Approved', decision_notes = $2, resolved_by = $3, resolved_at = NOW() 
            WHERE refund_id = $1
            "#,
            vec![
                refund_uuid.into(),
                decision_notes.into(),
                resolved_by_uuid.into(),
            ],
        );
        pool.execute(update_req).await.map_err(|e| e.to_string())?;

        let update_bal = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE passengers 
            SET spending_balance = spending_balance - $2 
            WHERE passenger_id = $1
            "#,
            vec![
                passenger_uuid.into(),
                amount.into(),
            ],
        );
        pool.execute(update_bal).await.map_err(|e| e.to_string())?;

        let refund_entry_id = Uuid::new_v4();
        let refund_desc = format!("Refund: {}", description);
        let insert_entry = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO spending_entries (entry_id, passenger_id, description, amount, date) 
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            vec![
                refund_entry_id.into(),
                passenger_uuid.into(),
                refund_desc.into(),
                (-amount).into(),
            ],
        );
        pool.execute(insert_entry).await.map_err(|e| e.to_string())?;

        Ok((passenger_uuid, amount, description))
    }

    pub async fn reject_refund_request(
        pool: &DatabaseConnection,
        refund_uuid: Uuid,
        decision_notes: &str,
        resolved_by_uuid: Uuid,
    ) -> Result<Uuid, String> {
        let req_stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            "SELECT passenger_id, status FROM refund_requests WHERE refund_id = $1",
            vec![refund_uuid.into()],
        );
        let req_row = pool.query_one(req_stmt).await.map_err(|e| e.to_string())?
            .ok_or_else(|| "Refund request not found".to_string())?;

        let status: String = req_row.try_get("", "status").map_err(|e| e.to_string())?;
        if status != "Pending" {
            return Err("Refund request has already been resolved".to_string());
        }

        let passenger_uuid: Uuid = req_row.try_get("", "passenger_id").map_err(|e| e.to_string())?;

        let update_req = Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE refund_requests 
            SET status = 'Rejected', decision_notes = $2, resolved_by = $3, resolved_at = NOW() 
            WHERE refund_id = $1
            "#,
            vec![
                refund_uuid.into(),
                decision_notes.into(),
                resolved_by_uuid.into(),
            ],
        );
        pool.execute(update_req).await.map_err(|e| e.to_string())?;

        Ok(passenger_uuid)
    }

    pub async fn get_cancellation_policy(pool: &DatabaseConnection) -> Result<CancellationPolicyResponse, String> {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Postgres,
            "SELECT policy_id, policy_name, terms, window_hours FROM cancellation_policies LIMIT 1",
            vec![],
        );

        let row_opt = pool.query_one(stmt).await.map_err(|e| e.to_string())?;
        let row = row_opt.ok_or_else(|| "Policy terms unavailable - cannot evaluate request".to_string())?;

        let policy_id: String = row.try_get("", "policy_id").map_err(|e| e.to_string())?;
        let policy_name: String = row.try_get("", "policy_name").map_err(|e| e.to_string())?;
        let terms: String = row.try_get("", "terms").map_err(|e| e.to_string())?;
        let window_hours: i32 = row.try_get("", "window_hours").map_err(|e| e.to_string())?;

        Ok(CancellationPolicyResponse {
            policy_id,
            policy_name,
            terms,
            window_hours,
        })
    }
}
