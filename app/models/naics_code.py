from datetime import datetime, timezone
from app.extensions import db


class NaicsCode(db.Model):
    __tablename__ = "naics_codes"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), nullable=False, unique=True)
    description = db.Column(db.String(500), nullable=False)
    active = db.Column(db.Boolean, default=True)
    track = db.Column(db.String(50), default="All")  # Government / Grant / Professional / All
    primary = db.Column(db.Boolean, default=False)
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text)

    def __repr__(self):
        return f"<NaicsCode {self.code}: {self.description}>"
