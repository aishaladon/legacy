from datetime import datetime, timezone
from app.extensions import db


class Keyword(db.Model):
    __tablename__ = "keywords"

    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(300), nullable=False, unique=True)
    active = db.Column(db.Boolean, default=True)
    track = db.Column(db.String(50), default="All")  # Government / Grant / Professional / All
    priority = db.Column(db.String(20), default="Medium")  # High / Medium / Low
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text)

    def __repr__(self):
        return f"<Keyword {self.id}: {self.keyword}>"
