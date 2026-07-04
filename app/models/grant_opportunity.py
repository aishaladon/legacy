from app.extensions import db


class GrantOpportunity(db.Model):
    __tablename__ = "grant_opportunities"

    id = db.Column(db.Integer, primary_key=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey("opportunities.id"), nullable=False)
    funder_id = db.Column(db.Integer, db.ForeignKey("funders.id"))
    grant_program_name = db.Column(db.String(500))
    grant_purpose = db.Column(db.Text)
    award_amount = db.Column(db.Numeric(15, 2))
    award_date = db.Column(db.Date)
    grant_type = db.Column(db.String(50))  # Single Year / Multi-Year
    grant_duration = db.Column(db.Integer)  # number of years
    current_year_of_grant = db.Column(db.Integer)
    year2_followup_date = db.Column(db.Date)
    year3_followup_date = db.Column(db.Date)
    institution_id = db.Column(db.Integer, db.ForeignKey("institutions.id"))
    institution_contact_id = db.Column(db.Integer, db.ForeignKey("contacts.id"))
    eligibility_requirements = db.Column(db.Text)
    outreach_status = db.Column(db.String(100), default="Not Started")  # Not Started / Contacted / Responded / Meeting Scheduled / Proposal Sent / Won / Lost
    outreach_date = db.Column(db.Date)
    notes = db.Column(db.Text)

    funder = db.relationship("Funder", backref="grant_opportunities")
    institution = db.relationship("Institution", foreign_keys=[institution_id])
    institution_contact = db.relationship("Contact", foreign_keys=[institution_contact_id])

    def __repr__(self):
        return f"<GrantOpportunity {self.id}: {self.grant_program_name}>"
