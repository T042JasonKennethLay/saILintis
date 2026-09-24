mod database;
mod entities;

use database::database::DbState;
use tauri::Manager;

mod auth;
mod it;
mod passenger;
mod incident;
mod save_file_command;
mod hr;
mod housekeeping;
mod security;
mod medical;
mod patterns;
mod finance;
mod frontdesk;
mod engineering;
mod voyage;
mod restaurant;
mod opm;



#[tauri::command]
async fn ping_db(state: tauri::State<'_, DbState>) -> Result<String, String> {
    use sea_orm::ConnectionTrait;

    state.pool.execute_unprepared("SELECT 1").await.map(|_| "Database Connected!".to_string()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = tauri::async_runtime::block_on(async {
                let state = DbState::connect().await;
                state
            });
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping_db,
            auth::auth_command::auth_command::forgot_password,
            auth::auth_command::auth_command::register,
            auth::auth_command::auth_command::login,
            auth::auth_command::auth_command::get_roles,
            auth::auth_command::auth_command::update_profile,
            auth::auth_command::auth_command::change_password,
            it::it_command::it_command::create_employee_account,
            it::it_command::it_command::update_employee_role,
            it::it_command::it_command::deactivate_employee_account,
            it::it_command::it_command::reactivate_employee_account,
            it::it_command::it_command::list_employee_accounts,
            it::it_command::it_command::list_password_reset_requests,
            it::it_command::it_command::investigate_suspicious_activity,
            it::it_command::it_command::list_system_logs,
            it::it_command::it_command::confirm_daily_backup,
            it::it_command::it_command::list_backup_logs,
            it::it_command::it_command::configure_role_settings,
            passenger::passenger_command::passenger_command::create_passenger,
            passenger::passenger_command::passenger_command::get_passenger,
            passenger::passenger_command::passenger_command::update_passenger_profile,
            passenger::passenger_command::passenger_command::update_passenger_preference,
            passenger::passenger_command::passenger_command::add_spending_entry,
            passenger::passenger_command::passenger_command::get_all_activities,
            passenger::passenger_command::passenger_command::export_spending_csv,
            passenger::passenger_command::passenger_command::approve_seat_booking,
            passenger::passenger_command::passenger_command::reject_seat_booking,
            passenger::passenger_command::passenger_command::list_spending_entries,
            passenger::passenger_command::passenger_command::list_passengers,
            passenger::passenger_command::passenger_command::view_booking_reservation_and_itinerary,
            passenger::passenger_command::passenger_command::view_daily_onboard_spending_and_budget,
            passenger::passenger_command::passenger_command::reserve_seat_for_entertainment,
            passenger::passenger_command::passenger_command::reserved_dining_table_with_dietary_request,
            passenger::passenger_command::passenger_command::request_medical_support,
            passenger::passenger_command::passenger_command::view_ship_announcement,
            passenger::passenger_command::passenger_command::publish_ship_announcement,
            passenger::passenger_command::passenger_command::order_room_service,
            passenger::passenger_command::passenger_command::submit_formal_feedback_or_complaint,
            passenger::passenger_command::passenger_command::access_dedicated_vip_direct_contact_channel,
            passenger::passenger_command::passenger_command::reserve_entertainment_seat_with_vip_early_access,
            passenger::passenger_command::passenger_command::reserved_dining_table_with_vip_early_access,
            passenger::passenger_command::passenger_command::get_seats_for_performance,
            passenger::passenger_command::passenger_command::get_dining_tables,
            passenger::passenger_command::passenger_command::get_all_performances,
            passenger::passenger_command::passenger_command::create_performance,
            passenger::passenger_command::passenger_command::submit_performance_report,
            passenger::passenger_command::passenger_command::get_performance_reports,
            passenger::passenger_command::passenger_command::create_dining_table,
            passenger::passenger_command::passenger_command::get_all_pending_reservations,
            passenger::passenger_command::passenger_command::approve_dining_table,
            passenger::passenger_command::passenger_command::reject_dining_table,
            passenger::passenger_command::passenger_command::ent_create_staff_schedule,
            passenger::passenger_command::passenger_command::ent_get_employees,
            passenger::passenger_command::passenger_command::ent_get_staff_schedules,
            incident::incident_command::incident_command::get_overnight_incidents,
            incident::incident_command::incident_command::acknowledge_incident,
            incident::incident_command::incident_command::create_security_incident,
            incident::incident_command::incident_command::create_medical_incident,
            incident::incident_command::incident_command::generate_incident_pdf,
            medical::medical_command::medical_command::get_passenger_medical_profile,
            medical::medical_command::medical_command::save_medical_clearance,
            medical::medical_command::medical_command::generate_clearance_pdf,
            medical::medical_command::medical_command::update_passenger_status,
            medical::medical_command::medical_command::save_notification,
            medical::medical_command::medical_command::record_action,
            medical::medical_command::medical_command::get_notifications,
            medical::medical_command::medical_command::mark_notification_read,
            medical::medical_command::medical_command::mark_all_notifications_read,
            it::it_command::it_command::export_system_logs_csv,
            it::it_command::it_command::export_backup_logs_csv,
            save_file_command::get_default_download_dir,
            save_file_command::select_directory,
            save_file_command::save_file_to_directory,
            hr::hr_command::hr_command::list_job_vacancies,
            hr::hr_command::hr_command::create_job_vacancy,
            hr::hr_command::hr_command::update_job_vacancy,
            hr::hr_command::hr_command::delete_job_vacancy,
            hr::hr_command::hr_command::list_candidates,
            hr::hr_command::hr_command::screen_candidate,
            hr::hr_command::hr_command::get_available_roles,
            hr::hr_command::hr_command::seed_test_candidates,
            hr::hr_command::hr_command::apply_for_job,
            housekeeping::housekeeping_command::housekeeping_command::list_linens,
            housekeeping::housekeeping_command::housekeeping_command::create_linen,
            housekeeping::housekeeping_command::housekeeping_command::update_linen,
            housekeeping::housekeeping_command::housekeeping_command::delete_linen,
            housekeeping::housekeeping_command::housekeeping_command::submit_shortage_report,
            housekeeping::housekeeping_command::housekeeping_command::list_shortage_reports,
            housekeeping::housekeeping_command::housekeeping_command::hk_create_staff_schedule,
            housekeeping::housekeeping_command::housekeeping_command::hk_get_employees,
            housekeeping::housekeeping_command::housekeeping_command::hk_get_staff_schedules,
            security::security_command::security_command::list_zones,
            security::security_command::security_command::get_zone_by_id,
            security::security_command::security_command::get_zone_crew,
            security::security_command::security_command::send_zone_specific_security_alert,
            security::security_command::security_command::close_zone_alert,
            security::security_command::security_command::list_zone_alerts,
            finance::finance_command::finance_command::get_crew_payroll_data,
            finance::finance_command::finance_command::save_crew_contract,
            finance::finance_command::finance_command::submit_crew_payroll,
            finance::finance_command::finance_command::list_payroll_records,
            finance::finance_command::finance_command::export_payroll_csv,
            finance::finance_command::finance_command::submit_refund_request,
            finance::finance_command::finance_command::list_refund_requests,
            finance::finance_command::finance_command::approve_refund_request,
            finance::finance_command::finance_command::reject_refund_request,
            finance::finance_command::finance_command::get_cancellation_policy,
            frontdesk::frontdesk_command::frontdesk_command::fdo_get_passengers,
            frontdesk::frontdesk_command::frontdesk_command::fdo_check_in_passenger,
            frontdesk::frontdesk_command::frontdesk_command::fdo_check_out_passenger,
            frontdesk::frontdesk_command::frontdesk_command::fdo_update_onboard_status,
            frontdesk::frontdesk_command::frontdesk_command::fdo_get_cabins,
            frontdesk::frontdesk_command::frontdesk_command::fdo_assign_cabin,
            frontdesk::frontdesk_command::frontdesk_command::fdo_get_complaints,
            frontdesk::frontdesk_command::frontdesk_command::fdo_resolve_complaint,
            frontdesk::frontdesk_command::frontdesk_command::fdo_get_chat_queues,
            frontdesk::frontdesk_command::frontdesk_command::get_chat_history,
            frontdesk::frontdesk_command::frontdesk_command::send_chat_message,
            frontdesk::frontdesk_command::frontdesk_command::mark_fdo_messages_read,
            frontdesk::frontdesk_command::frontdesk_command::get_chat_unread_count,
            engineering::engineering_command::engineering_command::eng_create_work_order,
            engineering::engineering_command::engineering_command::eng_get_work_orders,
            engineering::engineering_command::engineering_command::eng_assign_work_order,
            engineering::engineering_command::engineering_command::eng_update_work_order_status,
            engineering::engineering_command::engineering_command::eng_add_maintenance_log,
            engineering::engineering_command::engineering_command::eng_get_maintenance_logs,
            engineering::engineering_command::engineering_command::eng_get_engineering_staff,
            engineering::engineering_command::engineering_command::eng_get_stats,
            voyage::voyage_command::voyage_command::voyage_get_ships,
            voyage::voyage_command::voyage_command::voyage_create_voyage,
            voyage::voyage_command::voyage_command::voyage_get_voyages,
            voyage::voyage_command::voyage_command::voyage_update_voyage,
            voyage::voyage_command::voyage_command::voyage_delete_voyage,
            voyage::voyage_command::voyage_command::voyage_assign_ship,
            voyage::voyage_command::voyage_command::voyage_book_voyage,
            voyage::voyage_command::voyage_command::voyage_cancel_booking,
            voyage::voyage_command::voyage_command::voyage_get_occupancy_stats,
            voyage::voyage_command::voyage_command::is_crew_assigned_to_voyage,
            voyage::voyage_command::voyage_command::voyage_get_crew_assignments,
            voyage::voyage_command::voyage_command::voyage_set_crew_assignments,
            restaurant::restaurant_command::restaurant_command::rm_get_food_inventory,
            restaurant::restaurant_command::restaurant_command::rm_create_food_item,
            restaurant::restaurant_command::restaurant_command::rm_update_food_item,
            restaurant::restaurant_command::restaurant_command::rm_delete_food_item,
            restaurant::restaurant_command::restaurant_command::rm_submit_restock_request,
            restaurant::restaurant_command::restaurant_command::rm_get_restock_requests,
            restaurant::restaurant_command::restaurant_command::rm_update_restock_request_status,
            restaurant::restaurant_command::restaurant_command::rm_get_menu_items,
            restaurant::restaurant_command::restaurant_command::rm_create_menu_item,
            restaurant::restaurant_command::restaurant_command::rm_update_menu_item,
            restaurant::restaurant_command::restaurant_command::rm_delete_menu_item,
            restaurant::restaurant_command::restaurant_command::rm_get_reservations,
            restaurant::restaurant_command::restaurant_command::rm_approve_reservation,
            restaurant::restaurant_command::restaurant_command::rm_reject_reservation,
            restaurant::restaurant_command::restaurant_command::rm_get_overview_stats,
            opm::opm_command::opm_get_passenger_checkin_status,
            opm::opm_command::opm_get_boarding_timeline,
            opm::opm_command::opm_get_staff_schedules,
            opm::opm_command::opm_update_staff_schedule_status,
            opm::opm_command::opm_make_final_call_announcement,
            opm::opm_command::opm_escalate_operational_issue,
            opm::opm_command::opm_get_employees_by_role,
            opm::opm_command::opm_create_staff_schedule,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
