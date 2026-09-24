use crate::database::database::DbState;
use crate::opm::opm_model::{OpmPassengerResponse, OpmTimelineResponse, StaffSchedule, EscalateRequest, CreateScheduleRequest};
use crate::opm::opm_repository::OpmRepository;
use uuid::Uuid;

pub struct OpmService;

impl OpmService {
    pub async fn get_passenger_checkin_status(state: &DbState) -> Result<Vec<OpmPassengerResponse>, String> {
        OpmRepository::get_passenger_checkin_status(&state.pool).await
    }

    pub async fn get_boarding_timeline(state: &DbState) -> Result<Vec<OpmTimelineResponse>, String> {
        OpmRepository::get_boarding_timeline(&state.pool).await
    }

    pub async fn get_staff_schedules(state: &DbState) -> Result<Vec<StaffSchedule>, String> {
        OpmRepository::get_staff_schedules(&state.pool).await
    }

    pub async fn update_staff_schedule_status(state: &DbState, id: i32, status: String) -> Result<String, String> {
        if status != "Approved" && status != "Rejected" {
            return Err("Invalid status".to_string());
        }
        if status == "Approved" {
            let schedule_opt = OpmRepository::get_staff_schedule_by_id(&state.pool, id).await?;
            if let Some(sch) = schedule_opt {
                let has_conflict = OpmRepository::has_approved_shift_conflict(
                    &state.pool,
                    &sch.employee_name,
                    &sch.shift_date,
                    id,
                ).await?;
                if has_conflict {
                    return Err(format!(
                        "Failed to approve: {} is already scheduled on date {}",
                        sch.employee_name, sch.shift_date
                    ));
                }
            }
        }
        OpmRepository::update_staff_schedule_status(&state.pool, id, &status).await?;
        Ok(format!("Staff Schedule is {}", if status == "Approved" { "Approved" } else { "Rejected" }))
    }

    pub async fn make_final_call_announcement(state: &DbState, sender_id_str: String) -> Result<String, String> {
        crate::passenger::passenger_service::passenger_service::PassengerService::publish_ship_announcement(
            state,
            "FINAL BOARDING".to_string(),
            "THE M/V OCEAN MAJESTY IS GOING TO DEPART IN 5 MINUTES".to_string(),
            sender_id_str,
        ).await?;
        Ok("Final call announcement published".to_string())
    }

    pub async fn escalate_operational_issue(state: &DbState, payload: EscalateRequest) -> Result<String, String> {
        let incident_id = Uuid::new_v4();
        let sender_uuid = Uuid::parse_str(&payload.submitted_by).map_err(|_| "Invalid sender ID".to_string())?;

        OpmRepository::create_operational_incident(
            &state.pool,
            incident_id,
            &payload.description,
            &payload.location,
            &payload.severity,
            sender_uuid
        ).await?;

        let alert_msg = format!("OPERATIONAL ESCALATION: {} (Loc: {}, Severity: {})", payload.description, payload.location, payload.severity);

        crate::medical::medical_repository::medical_repository::MedicalRepository::save_notification(
            &state.pool,
            Uuid::new_v4(),
            &alert_msg,
            sender_uuid,
            "Cruise Operations Director"
        ).await?;

        crate::medical::medical_repository::medical_repository::MedicalRepository::save_notification(
            &state.pool,
            Uuid::new_v4(),
            &alert_msg,
            sender_uuid,
            "Ship Captain"
        ).await?;

        Ok("Operational issue successfully escalated to Cruise Operations Director and Ship Captain".to_string())
    }

    pub async fn get_employees_by_role(state: &DbState, role_name: String) -> Result<Vec<String>, String> {
        OpmRepository::get_employees_by_role(&state.pool, &role_name).await
    }

    pub async fn create_staff_schedule(state: &DbState, payload: CreateScheduleRequest) -> Result<String, String> {
        let has_conflict = OpmRepository::has_approved_shift_conflict(
            &state.pool,
            &payload.employee_name,
            &payload.shift_date,
            -1,
        ).await?;
        if has_conflict {
            return Err(format!(
                "Failed: {} is already scheduled on date {}",
                payload.employee_name, payload.shift_date
            ));
        }
        OpmRepository::create_staff_schedule(&state.pool, payload).await?;
        Ok("Staff schedule successfully created".to_string())
    }
}
