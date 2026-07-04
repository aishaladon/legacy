from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.contact import Contact
from app.models.activity_log import ActivityLog
from datetime import datetime, timezone

contacts_bp = Blueprint("contacts", __name__, url_prefix="/contacts")

CONTACT_TYPES = [
    "Contracting Officer", "Program Officer", "Institution Staff",
    "Prime Contractor", "Referral Source", "Listserv Connection", "Other"
]


@contacts_bp.route("/")
@login_required
def index():
    warmth = request.args.get("warmth")
    ctype = request.args.get("type")
    query = Contact.query
    if warmth:
        query = query.filter(Contact.relationship_warmth == warmth)
    if ctype:
        query = query.filter(Contact.contact_type == ctype)
    contacts = query.order_by(Contact.last_name).all()
    return render_template("contacts/index.html", contacts=contacts, contact_types=CONTACT_TYPES)


@contacts_bp.route("/<int:contact_id>")
@login_required
def detail(contact_id):
    contact = Contact.query.get_or_404(contact_id)
    logs = ActivityLog.query.filter_by(record_type="contact", record_id=contact_id).order_by(ActivityLog.activity_date.desc()).all()
    return render_template("contacts/detail.html", contact=contact, logs=logs)


@contacts_bp.route("/new", methods=["GET", "POST"])
@login_required
def new():
    if request.method == "POST":
        contact = Contact(
            first_name=request.form["first_name"],
            last_name=request.form["last_name"],
            title=request.form.get("title"),
            institution_id=_parse_int(request.form.get("institution_id")),
            email=request.form.get("email"),
            phone=request.form.get("phone"),
            contact_type=request.form.get("contact_type"),
            relationship_warmth=request.form.get("relationship_warmth", "Cold"),
            last_contact_date=_parse_date(request.form.get("last_contact_date")),
            next_followup_date=_parse_date(request.form.get("next_followup_date")),
            linkedin_url=request.form.get("linkedin_url"),
            notes=request.form.get("notes"),
        )
        db.session.add(contact)
        db.session.commit()
        flash("Contact added.", "success")
        return redirect(url_for("contacts.detail", contact_id=contact.id))
    from app.models.institution import Institution
    institutions = Institution.query.order_by(Institution.name).all()
    return render_template("contacts/form.html", contact=None, institutions=institutions, contact_types=CONTACT_TYPES)


@contacts_bp.route("/<int:contact_id>/edit", methods=["GET", "POST"])
@login_required
def edit(contact_id):
    contact = Contact.query.get_or_404(contact_id)
    if request.method == "POST":
        contact.first_name = request.form["first_name"]
        contact.last_name = request.form["last_name"]
        contact.title = request.form.get("title")
        contact.institution_id = _parse_int(request.form.get("institution_id"))
        contact.email = request.form.get("email")
        contact.phone = request.form.get("phone")
        contact.contact_type = request.form.get("contact_type")
        contact.relationship_warmth = request.form.get("relationship_warmth", contact.relationship_warmth)
        contact.last_contact_date = _parse_date(request.form.get("last_contact_date"))
        contact.next_followup_date = _parse_date(request.form.get("next_followup_date"))
        contact.linkedin_url = request.form.get("linkedin_url")
        contact.notes = request.form.get("notes")
        db.session.commit()
        flash("Contact updated.", "success")
        return redirect(url_for("contacts.detail", contact_id=contact_id))
    from app.models.institution import Institution
    institutions = Institution.query.order_by(Institution.name).all()
    return render_template("contacts/form.html", contact=contact, institutions=institutions, contact_types=CONTACT_TYPES)


@contacts_bp.route("/<int:contact_id>/log", methods=["POST"])
@login_required
def add_log(contact_id):
    Contact.query.get_or_404(contact_id)
    log = ActivityLog(
        record_type="contact",
        record_id=contact_id,
        activity_type=request.form.get("activity_type"),
        description=request.form.get("description"),
        outcome=request.form.get("outcome"),
        next_action=request.form.get("next_action"),
        next_action_date=_parse_date(request.form.get("next_action_date")),
        activity_date=datetime.now(timezone.utc),
    )
    db.session.add(log)
    db.session.commit()
    flash("Activity logged.", "success")
    return redirect(url_for("contacts.detail", contact_id=contact_id))


def _parse_date(val):
    if not val:
        return None
    try:
        from datetime import date
        return date.fromisoformat(val)
    except ValueError:
        return None


def _parse_int(val):
    if not val:
        return None
    try:
        return int(val)
    except ValueError:
        return None
