from datetime import datetime, timezone
from app.extensions import db


class DataSource(db.Model):
    __tablename__ = "data_sources"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(300), nullable=False)
    source_type = db.Column(db.String(50))  # API / Web Scrape / Email / RSS / Manual
    source_url = db.Column(db.String(1000))
    login_required = db.Column(db.Boolean, default=False)
    credentials_location = db.Column(db.String(500))
    check_frequency = db.Column(db.String(50))  # Hourly / Daily / Weekly
    last_checked = db.Column(db.DateTime)
    active = db.Column(db.Boolean, default=True)
    naics_filter = db.Column(db.Text)
    keyword_filter = db.Column(db.Text)
    track = db.Column(db.String(50))  # Government / Grant / Professional / All
    notes = db.Column(db.Text)

    def __repr__(self):
        return f"<DataSource {self.id}: {self.name}>"
