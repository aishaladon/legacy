from datetime import datetime, timezone
from app.extensions import db


class DailyDigest(db.Model):
    __tablename__ = "daily_digests"

    id = db.Column(db.Integer, primary_key=True)
    date_sent = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    new_opportunities_count = db.Column(db.Integer, default=0)
    top_aligned_opportunities = db.Column(db.Text)
    grant_awards_found = db.Column(db.Integer, default=0)
    expiring_contracts_found = db.Column(db.Integer, default=0)
    subcontract_opportunities_found = db.Column(db.Integer, default=0)
    full_digest_text = db.Column(db.Text)
    notes = db.Column(db.Text)

    def __repr__(self):
        return f"<DailyDigest {self.id}: {self.date_sent}>"
