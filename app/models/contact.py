from datetime import datetime, timezone
from app.extensions import db


class Contact(db.Model):
    __tablename__ = "contacts"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(200), nullable=False)
    last_name = db.Column(db.String(200), nullable=False)
    title = db.Column(db.String(300))
    institution_id = db.Column(db.Integer, db.ForeignKey("institutions.id"))
    email = db.Column(db.String(300))
    phone = db.Column(db.String(50))
    contact_type = db.Column(db.String(100))  # Contracting Officer / Program Officer / Institution Staff / Prime Contractor / Referral Source / Listserv Connection / etc.
    relationship_warmth = db.Column(db.String(20), default="Cold")  # Cold / Warm / Hot
    last_contact_date = db.Column(db.Date)
    next_followup_date = db.Column(db.Date)
    linkedin_url = db.Column(db.String(500))
    notes = db.Column(db.Text)
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    institution = db.relationship("Institution", foreign_keys=[institution_id], back_populates="contacts")
    activity_logs = db.relationship("ActivityLog", primaryjoin="and_(ActivityLog.record_type=='contact', foreign(ActivityLog.record_id)==Contact.id)", lazy="dynamic")
    documents = db.relationship("Document", primaryjoin="and_(Document.record_type=='contact', foreign(Document.record_id)==Contact.id)", lazy="dynamic")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __repr__(self):
        return f"<Contact {self.id}: {self.full_name}>"
