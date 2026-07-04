from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.funder import Funder

funders_bp = Blueprint("funders", __name__, url_prefix="/funders")


@funders_bp.route("/")
@login_required
def index():
    funders = Funder.query.order_by(Funder.name).all()
    return render_template("funders/index.html", funders=funders)


@funders_bp.route("/<int:funder_id>")
@login_required
def detail(funder_id):
    funder = Funder.query.get_or_404(funder_id)
    return render_template("funders/detail.html", funder=funder)


@funders_bp.route("/new", methods=["GET", "POST"])
@login_required
def new():
    if request.method == "POST":
        funder = Funder(
            name=request.form["name"],
            funder_type=request.form.get("funder_type"),
            website=request.form.get("website"),
            typical_award_min=_parse_decimal(request.form.get("typical_award_min")),
            typical_award_max=_parse_decimal(request.form.get("typical_award_max")),
            eligible_institution_types=request.form.get("eligible_institution_types"),
            application_cycle_open=_parse_date(request.form.get("application_cycle_open")),
            application_cycle_close=_parse_date(request.form.get("application_cycle_close")),
            award_announcement_date=_parse_date(request.form.get("award_announcement_date")),
            notes=request.form.get("notes"),
        )
        db.session.add(funder)
        db.session.commit()
        flash("Funder added.", "success")
        return redirect(url_for("funders.detail", funder_id=funder.id))
    return render_template("funders/form.html", funder=None)


@funders_bp.route("/<int:funder_id>/edit", methods=["GET", "POST"])
@login_required
def edit(funder_id):
    funder = Funder.query.get_or_404(funder_id)
    if request.method == "POST":
        funder.name = request.form["name"]
        funder.funder_type = request.form.get("funder_type")
        funder.website = request.form.get("website")
        funder.typical_award_min = _parse_decimal(request.form.get("typical_award_min"))
        funder.typical_award_max = _parse_decimal(request.form.get("typical_award_max"))
        funder.eligible_institution_types = request.form.get("eligible_institution_types")
        funder.application_cycle_open = _parse_date(request.form.get("application_cycle_open"))
        funder.application_cycle_close = _parse_date(request.form.get("application_cycle_close"))
        funder.award_announcement_date = _parse_date(request.form.get("award_announcement_date"))
        funder.notes = request.form.get("notes")
        db.session.commit()
        flash("Funder updated.", "success")
        return redirect(url_for("funders.detail", funder_id=funder_id))
    return render_template("funders/form.html", funder=funder)


def _parse_date(val):
    if not val:
        return None
    try:
        from datetime import date
        return date.fromisoformat(val)
    except ValueError:
        return None


def _parse_decimal(val):
    if not val:
        return None
    try:
        return float(val.replace(",", ""))
    except ValueError:
        return None
