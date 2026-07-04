from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.institution import Institution
from app.models.contact import Contact

institutions_bp = Blueprint("institutions", __name__, url_prefix="/institutions")

INSTITUTION_TYPES = [
    "Museum", "HBCU", "Library", "Archive", "Historical Society",
    "University", "Tribal Nation", "Government Agency", "Private", "Foundation", "Other"
]


@institutions_bp.route("/")
@login_required
def index():
    itype = request.args.get("type")
    region = request.args.get("region")
    past_client = request.args.get("past_client")
    query = Institution.query
    if itype:
        query = query.filter(Institution.institution_type == itype)
    if region:
        query = query.filter(Institution.region == region)
    if past_client == "yes":
        query = query.filter(Institution.past_client == True)
    institutions = query.order_by(Institution.name).all()
    return render_template("institutions/index.html", institutions=institutions, institution_types=INSTITUTION_TYPES)


@institutions_bp.route("/<int:inst_id>")
@login_required
def detail(inst_id):
    inst = Institution.query.get_or_404(inst_id)
    contacts = Contact.query.filter_by(institution_id=inst_id).order_by(Contact.last_name).all()
    return render_template("institutions/detail.html", inst=inst, contacts=contacts)


@institutions_bp.route("/new", methods=["GET", "POST"])
@login_required
def new():
    if request.method == "POST":
        inst = Institution(
            name=request.form["name"],
            institution_type=request.form.get("institution_type"),
            address=request.form.get("address"),
            city=request.form.get("city"),
            state=request.form.get("state"),
            region=request.form.get("region"),
            website=request.form.get("website"),
            past_client=request.form.get("past_client") == "on",
            past_project_summary=request.form.get("past_project_summary"),
            grant_history=request.form.get("grant_history"),
            notes=request.form.get("notes"),
        )
        db.session.add(inst)
        db.session.commit()
        flash("Institution added.", "success")
        return redirect(url_for("institutions.detail", inst_id=inst.id))
    return render_template("institutions/form.html", inst=None, institution_types=INSTITUTION_TYPES)


@institutions_bp.route("/<int:inst_id>/edit", methods=["GET", "POST"])
@login_required
def edit(inst_id):
    inst = Institution.query.get_or_404(inst_id)
    if request.method == "POST":
        inst.name = request.form["name"]
        inst.institution_type = request.form.get("institution_type")
        inst.address = request.form.get("address")
        inst.city = request.form.get("city")
        inst.state = request.form.get("state")
        inst.region = request.form.get("region")
        inst.website = request.form.get("website")
        inst.past_client = request.form.get("past_client") == "on"
        inst.past_project_summary = request.form.get("past_project_summary")
        inst.grant_history = request.form.get("grant_history")
        inst.notes = request.form.get("notes")
        db.session.commit()
        flash("Institution updated.", "success")
        return redirect(url_for("institutions.detail", inst_id=inst_id))
    return render_template("institutions/form.html", inst=inst, institution_types=INSTITUTION_TYPES)
