from datetime import datetime, timezone
from app.extensions import db


class ActivityLog(db.Model):
    __tablename__ = "activity_log"

    id = db.Column(db.Integer, primary_key=True)
    record_type = db.Column(db.String(50), nullable=False)  # opportunity / contact / institution / project / pipeline / grant / etc.
    record_id = db.Column(db.Integer, nullable=False)
    activity_type = db.Column(db.String(100))  # Email Sent / Phone Call / Meeting / Bid Submitted / Follow-Up / Note Added / Status Changed / Document Uploaded / etc.
    activity_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    description = db.Column(db.Text)
    outcome = db.Column(db.Text)
    next_action = db.Column(db.Text)
    next_action_date = db.Column(db.Date)
    created_by = db.Column(db.String(100), default="Aisha")

    def __repr__(self):
        return f"<ActivityLog {self.id}: {self.record_type}#{self.record_id} — {self.activity_type}>"
