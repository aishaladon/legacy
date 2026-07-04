from datetime import datetime, timezone
from app.extensions import db


class Opportunity(db.Model):
    __tablename__ = "opportunities"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    source = db.Column(db.String(200))
    source_url = db.Column(db.String(1000))
    opportunity_type = db.Column(db.String(100))  # Government Contract / Grant-Funded Project / Gig / Job / Subcontract / RFP
    posted_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    contract_amount_min = db.Column(db.Numeric(15, 2))
    contract_amount_max = db.Column(db.Numeric(15, 2))
    naics_code = db.Column(db.String(20))
    set_aside_type = db.Column(db.String(100))  # WOSB / EDWOSB / 8(a) / HUBZone / Unrestricted
    institution_type = db.Column(db.String(100))  # Museum / HBCU / Library / Archive / etc.
    location_city = db.Column(db.String(200))
    location_state = db.Column(db.String(100))
    region = db.Column(db.String(100))  # Northeast / Southeast / California / Midwest / etc.
    alignment_score = db.Column(db.Integer)  # 1–10
    status = db.Column(db.String(50), default="New")  # New / Reviewing / Bidding / Submitted / Won / Lost / Passed / Archived
    notes = db.Column(db.Text)
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    source_id_external = db.Column(db.String(200))  # external ID for dedup (e.g. SAM.gov notice ID)
    track = db.Column(db.String(50))  # Government / Grant / Professional

    # Relationships
    government_contract = db.relationship("GovernmentContract", backref="opportunity", uselist=False, cascade="all, delete-orphan")
    grant_opportunity = db.relationship("GrantOpportunity", backref="opportunity", uselist=False, cascade="all, delete-orphan")
    pipeline = db.relationship("Pipeline", backref="opportunity", uselist=False, cascade="all, delete-orphan")
    activity_logs = db.relationship("ActivityLog", primaryjoin="and_(ActivityLog.record_type=='opportunity', foreign(ActivityLog.record_id)==Opportunity.id)", lazy="dynamic")
    documents = db.relationship("Document", primaryjoin="and_(Document.record_type=='opportunity', foreign(Document.record_id)==Opportunity.id)", lazy="dynamic")

    def __repr__(self):
        return f"<Opportunity {self.id}: {self.title[:60]}>"
