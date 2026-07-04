from datetime import datetime, timezone
from app.extensions import db


class BidWritingGuide(db.Model):
    __tablename__ = "bid_writing_guides"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(500), nullable=False)
    opportunity_type = db.Column(db.String(100))  # Government RFP / Sources Sought / RFI / Grant-Funded Project / Gig / Subcontract
    naics_code = db.Column(db.String(20))
    institution_type = db.Column(db.String(100))
    guide_steps = db.Column(db.Text)
    key_questions = db.Column(db.Text)
    sections_required = db.Column(db.Text)
    tips_and_warnings = db.Column(db.Text)
    capability_statement_id = db.Column(db.Integer, db.ForeignKey("capability_statements.id"))
    example_language = db.Column(db.Text)
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    capability_statement = db.relationship("CapabilityStatement", foreign_keys=[capability_statement_id])

    def __repr__(self):
        return f"<BidWritingGuide {self.id}: {self.name}>"
