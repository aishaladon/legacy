from app.extensions import db


class GovernmentContract(db.Model):
    __tablename__ = "government_contracts"

    id = db.Column(db.Integer, primary_key=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey("opportunities.id"), nullable=False)
    solicitation_number = db.Column(db.String(200))
    agency_name = db.Column(db.String(500))
    agency_type = db.Column(db.String(50))  # Federal / State / County / City / Municipal
    contracting_officer_id = db.Column(db.Integer, db.ForeignKey("contacts.id"))
    naics_code = db.Column(db.String(20))
    psc_code = db.Column(db.String(20))
    set_aside_type = db.Column(db.String(100))
    contract_type = db.Column(db.String(100))  # Fixed Price / T&M / IDIQ / BPA / etc.
    estimated_value = db.Column(db.Numeric(15, 2))
    response_type = db.Column(db.String(100))  # Sources Sought / RFI / RFP / RFQ / Sole Source
    expiration_date = db.Column(db.Date)
    incumbent_contractor = db.Column(db.String(500))
    qa_deadline = db.Column(db.Date)
    submission_deadline = db.Column(db.Date)
    amendment_history = db.Column(db.Text)

    contracting_officer = db.relationship("Contact", foreign_keys=[contracting_officer_id])

    def __repr__(self):
        return f"<GovernmentContract {self.id}: {self.solicitation_number}>"
