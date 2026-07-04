from datetime import datetime, timezone
from app.extensions import db


class CapabilityStatement(db.Model):
    __tablename__ = "capability_statements"

    id = db.Column(db.Integer, primary_key=True)
    version_name = db.Column(db.String(300), nullable=False)
    version_type = db.Column(db.String(100))  # Federal Government / State Government / Cultural Institution / HBCU / Private Client / Afro-Futuristic / etc.
    file_location = db.Column(db.String(1000))
    naics_codes_highlighted = db.Column(db.Text)
    key_differentiators = db.Column(db.Text)
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text)

    def __repr__(self):
        return f"<CapabilityStatement {self.id}: {self.version_name}>"
