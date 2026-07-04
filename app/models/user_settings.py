from datetime import datetime, timezone
from app.extensions import db


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    value = db.Column(db.Text)
    setting_type = db.Column(db.String(50))  # Email / Number / Text / Toggle / List
    description = db.Column(db.Text)
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text)

    @classmethod
    def get(cls, name, default=None):
        row = cls.query.filter_by(name=name).first()
        return row.value if row else default

    @classmethod
    def set(cls, name, value):
        row = cls.query.filter_by(name=name).first()
        if row:
            row.value = value
            row.last_updated = datetime.now(timezone.utc)
        else:
            row = cls(name=name, value=value)
            from app.extensions import db as _db
            _db.session.add(row)
        from app.extensions import db as _db
        _db.session.commit()

    def __repr__(self):
        return f"<UserSettings {self.name}={self.value}>"
