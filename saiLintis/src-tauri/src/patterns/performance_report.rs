use uuid::Uuid;
use chrono::{NaiveDateTime, NaiveDate, NaiveTime};
use sea_orm::{DatabaseConnection, ActiveModelTrait, Set, EntityTrait};
use crate::entities::performance_reports;
use crate::entities::performances;

pub struct PerformanceReport {
    pub report_id: Uuid,
    pub performance_id: Uuid,
    pub occupancy_count: i32,
    pub technical_issues: String,
    pub audience_rating: i32,
    pub audience_notes: String,
    pub submitted_by: Uuid,
    pub submitted_at: NaiveDateTime,
    pub status: String,
    pub is_late: bool,
    pub priority_review: bool,
}

impl PerformanceReport {
    pub fn new(
        performance_id: Uuid,
        occupancy_count: i32,
        technical_issues: String,
        audience_rating: i32,
        audience_notes: String,
        submitted_by: Uuid,
    ) -> Self {
        Self {
            report_id: Uuid::new_v4(),
            performance_id,
            occupancy_count,
            technical_issues,
            audience_rating,
            audience_notes,
            submitted_by,
            submitted_at: chrono::Utc::now().naive_utc(),
            status: "Pending Review".to_string(),
            is_late: false,
            priority_review: false,
        }
    }

    pub fn validate_occupancy(&self, total_capacity: i32) -> Result<(), String> {
        if self.occupancy_count > total_capacity {
            return Err("Occupancy count entered exceeds venue capacity".to_string());
        }
        Ok(())
    }

    pub fn check_late_submission(&mut self, schedule_date: NaiveDate, schedule_time: NaiveTime) {
        let schedule_datetime = NaiveDateTime::new(schedule_date, schedule_time);
        let duration = self.submitted_at.signed_duration_since(schedule_datetime);
        if duration.num_hours() > 2 {
            self.is_late = true;
            self.status = "Late Submission".to_string();
        }
    }

    pub fn check_priority_review(&mut self, has_unresolved: bool) {
        if has_unresolved {
            self.priority_review = true;
            self.status = "Priority Review".to_string();
        }
    }

    pub async fn save_to_db(&self, db: &DatabaseConnection) -> Result<(), String> {
        let report = performance_reports::ActiveModel {
            report_id: Set(self.report_id),
            performance_id: Set(self.performance_id),
            occupancy_count: Set(self.occupancy_count),
            technical_issues: Set(self.technical_issues.clone()),
            audience_rating: Set(self.audience_rating),
            audience_notes: Set(self.audience_notes.clone()),
            submitted_by: Set(self.submitted_by),
            submitted_at: Set(self.submitted_at),
            status: Set(self.status.clone()),
            is_late: Set(self.is_late),
            priority_review: Set(self.priority_review),
        };
        report.insert(db).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn update_performance_record(&self, db: &DatabaseConnection) -> Result<(), String> {
        let mut perf: performances::ActiveModel = performances::Entity::find_by_id(self.performance_id)
            .one(db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Performance not found".to_string())?
            .into();

        perf.status = Set("COMPLETED".to_string());
        perf.current_occupancy = Set(Some(self.occupancy_count));
        perf.update(db).await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
