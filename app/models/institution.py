from app.extensions import db


class Institution(db.Model):
    __tablename__ = "institutions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(500), nullable=False)
    institution_type = db.Column(db.String(100))  # Museum / HBCU / Library / Archive / Historical Society / Private / etc.
    address = db.Column(db.String(500))
    city = db.Column(db.String(200))
    state = db.Column(db.String(100))
    region = db.Column(db.String(100))
    website = db.Column(db.String(500))
    primary_contact_id = db.Column(db.Integer, db.ForeignKey("contacts.id"))
    past_client = db.Column(db.Boolean, default=False)
    past_project_summary = db.Column(db.Text)
    grant_history = db.Column(db.Text)
    notes = db.Column(db.Text)

    primary_contact = db.relationship("Contact", foreign_keys=[primary_contact_id])
    contacts = db.relationship("Contact", foreign_keys="Contact.institution_id", back_populates="institution", lazy="dynamic")
    grant_opportunities = db.relationship("GrantOpportunity", foreign_keys="GrantOpportunity.institution_id", back_populates="institution", lazy="dynamic")
    projects = db.relationship("Project", back_populates="institution", lazy="dynamic")

    def __repr__(self):
        return f"<Institution {self.id}: {self.name}>"
