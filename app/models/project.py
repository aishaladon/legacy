from app.extensions import db


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    pipeline_id = db.Column(db.Integer, db.ForeignKey("pipeline.id"), nullable=False)
    institution_id = db.Column(db.Integer, db.ForeignKey("institutions.id"))
    contract_or_grant_number = db.Column(db.String(200))
    project_type = db.Column(db.String(100))  # Government Contract / Grant-Funded / Gig / Subcontract
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    total_value = db.Column(db.Numeric(15, 2))
    payment_schedule = db.Column(db.Text)
    payment_milestones = db.Column(db.Text)
    milestone_status = db.Column(db.String(50))  # On Track / At Risk / Delayed / Complete
    subcontractors = db.Column(db.Text)
    deliverables = db.Column(db.Text)
    deliverable_status = db.Column(db.Text)
    travel_required = db.Column(db.Boolean, default=False)
    travel_dates = db.Column(db.Text)
    accommodation_details = db.Column(db.Text)
    monthly_report_due_dates = db.Column(db.Text)
    notes = db.Column(db.Text)

    institution = db.relationship("Institution", back_populates="projects")
    activity_logs = db.relationship("ActivityLog", primaryjoin="and_(ActivityLog.record_type=='project', foreign(ActivityLog.record_id)==Project.id)", lazy="dynamic")
    documents = db.relationship("Document", primaryjoin="and_(Document.record_type=='project', foreign(Document.record_id)==Project.id)", lazy="dynamic")

    def __repr__(self):
        return f"<Project {self.id}: {self.contract_or_grant_number}>"
