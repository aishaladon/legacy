from datetime import datetime, timezone
from app.extensions import db


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(500), nullable=False)
    document_type = db.Column(db.String(100))  # Capability Statement / Proposal / Contract / Bid Response / RFP / Grant Application / Invoice / Report / Other
    record_type = db.Column(db.String(50))  # opportunity / pipeline / project / contact / institution
    record_id = db.Column(db.Integer)
    file_path_or_url = db.Column(db.String(1000))
    file_format = db.Column(db.String(20))  # PDF / DOCX / XLSX / JPG / etc.
    version = db.Column(db.String(50))
    date_uploaded = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text)

    def __repr__(self):
        return f"<Document {self.id}: {self.name}>"
