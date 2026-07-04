from datetime import datetime, timezone
from app.extensions import db


class Pipeline(db.Model):
    __tablename__ = "pipeline"

    id = db.Column(db.Integer, primary_key=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey("opportunities.id"), nullable=False)
    stage = db.Column(db.String(100), default="Identified")  # Identified / Reviewing / Go Decision / Preparing Bid / Submitted / Under Evaluation / Won / Lost / Withdrawn
    go_no_go = db.Column(db.String(20))  # Go / No-Go / Pending
    decision_date = db.Column(db.Date)
    submission_date = db.Column(db.Date)
    submitted_amount = db.Column(db.Numeric(15, 2))
    outcome = db.Column(db.String(50))  # Won / Lost / No Award / Cancelled
    outcome_date = db.Column(db.Date)
    lessons_learned = db.Column(db.Text)
    followup_date = db.Column(db.Date)
    bid_writing_guide_id = db.Column(db.Integer, db.ForeignKey("bid_writing_guides.id"))
    capability_statement_id = db.Column(db.Integer, db.ForeignKey("capability_statements.id"))
    notes = db.Column(db.Text)
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    bid_writing_guide = db.relationship("BidWritingGuide", foreign_keys=[bid_writing_guide_id])
    capability_statement = db.relationship("CapabilityStatement", foreign_keys=[capability_statement_id])
    project = db.relationship("Project", backref="pipeline", uselist=False, cascade="all, delete-orphan")
    activity_logs = db.relationship("ActivityLog", primaryjoin="and_(ActivityLog.record_type=='pipeline', foreign(ActivityLog.record_id)==Pipeline.id)", lazy="dynamic")

    def __repr__(self):
        return f"<Pipeline {self.id}: stage={self.stage}>"
