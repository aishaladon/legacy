from app.extensions import db


class Funder(db.Model):
    __tablename__ = "funders"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(500), nullable=False)
    funder_type = db.Column(db.String(50))  # Federal / State / Foundation / Private
    website = db.Column(db.String(500))
    typical_award_min = db.Column(db.Numeric(15, 2))
    typical_award_max = db.Column(db.Numeric(15, 2))
    eligible_institution_types = db.Column(db.Text)
    application_cycle_open = db.Column(db.Date)
    application_cycle_close = db.Column(db.Date)
    award_announcement_date = db.Column(db.Date)
    program_officer_id = db.Column(db.Integer, db.ForeignKey("contacts.id"))
    notes = db.Column(db.Text)

    program_officer = db.relationship("Contact", foreign_keys=[program_officer_id])

    def __repr__(self):
        return f"<Funder {self.id}: {self.name}>"
