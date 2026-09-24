use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "performance_reports")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub report_id: Uuid,
    pub performance_id: Uuid,
    pub occupancy_count: i32,
    pub technical_issues: String,
    pub audience_rating: i32,
    pub audience_notes: String,
    pub submitted_by: Uuid,
    pub submitted_at: DateTime,
    pub status: String,
    pub is_late: bool,
    pub priority_review: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::performances::Entity",
        from = "Column::PerformanceId",
        to = "super::performances::Column::PerformanceId",
        on_update = "NoAction",
        on_delete = "Cascade"
    )]
    Performances,
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::SubmittedBy",
        to = "super::users::Column::UserId",
        on_update = "NoAction",
        on_delete = "Cascade"
    )]
    Users,
}

impl Related<super::performances::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Performances.def()
    }
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
