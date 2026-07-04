from app.extensions import db


class AwardHistory(db.Model):
    __tablename__ = "award_history"

    id = db.Column(db.Integer, primary_key=True)
    award_type = db.Column(db.String(50))  # Contract / Grant
    awardee_name = db.Column(db.String(500))
    awardee_type = db.Column(db.String(100))  # Prime Contractor / Institution
    award_amount = db.Column(db.Numeric(15, 2))
    award_date = db.Column(db.Date)
    awarding_agency_or_funder = db.Column(db.String(500))
    naics_code = db.Column(db.String(20))
    description = db.Column(db.Text)
    period_of_performance_start = db.Column(db.Date)
    period_of_performance_end = db.Column(db.Date)
    expiration_date = db.Column(db.Date)
    subcontract_opportunity = db.Column(db.Boolean, default=False)
    subcontract_outreach_status = db.Column(db.String(100), default="Not Started")  # Not Started / Contacted / Responded / Won / Lost
    contact_id = db.Column(db.Integer, db.ForeignKey("contacts.id"))
    notes = db.Column(db.Text)
    source_id_external = db.Column(db.String(200))  # for dedup

    contact = db.relationship("Contact", foreign_keys=[contact_id])

    def __repr__(self):
        return f"<AwardHistory {self.id}: {self.awardee_name}>"
