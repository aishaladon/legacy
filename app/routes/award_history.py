from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.award_history import AwardHistory

award_history_bp = Blueprint("award_history", __name__, url_prefix="/awards")


@award_history_bp.route("/")
@login_required
def index():
    award_type = request.args.get("type")
    subcontract = request.args.get("subcontract")
    query = AwardHistory.query
    if award_type:
        query = query.filter(AwardHistory.award_type == award_type)
    if subcontract == "yes":
        query = query.filter(AwardHistory.subcontract_opportunity == True)
    awards = query.order_by(AwardHistory.award_date.desc()).all()
    return render_template("award_history/index.html", awards=awards)


@award_history_bp.route("/<int:award_id>")
@login_required
def detail(award_id):
    award = AwardHistory.query.get_or_404(award_id)
    return render_template("award_history/detail.html", award=award)


@award_history_bp.route("/new", methods=["GET", "POST"])
@login_required
def new():
    if request.method == "POST":
        award = AwardHistory(
            award_type=request.form.get("award_type"),
            awardee_name=request.form.get("awardee_name"),
            awardee_type=request.form.get("awardee_type"),
            award_amount=_parse_decimal(request.form.get("award_amount")),
            award_date=_parse_date(request.form.get("award_date")),
            awarding_agency_or_funder=request.form.get("awarding_agency_or_funder"),
            naics_code=request.form.get("naics_code"),
            description=request.form.get("description"),
            period_of_performance_start=_parse_date(request.form.get("period_of_performance_start")),
            period_of_performance_end=_parse_date(request.form.get("period_of_performance_end")),
            expiration_date=_parse_date(request.form.get("expiration_date")),
            subcontract_opportunity=request.form.get("subcontract_opportunity") == "on",
            subcontract_outreach_status=request.form.get("subcontract_outreach_status", "Not Started"),
            notes=request.form.get("notes"),
        )
        db.session.add(award)
        db.session.commit()
        flash("Award added.", "success")
        return redirect(url_for("award_history.detail", award_id=award.id))
    return render_template("award_history/form.html", award=None)


@award_history_bp.route("/<int:award_id>/edit", methods=["GET", "POST"])
@login_required
def edit(award_id):
    award = AwardHistory.query.get_or_404(award_id)
    if request.method == "POST":
        award.award_type = request.form.get("award_type")
        award.awardee_name = request.form.get("awardee_name")
        award.awardee_type = request.form.get("awardee_type")
        award.award_amount = _parse_decimal(request.form.get("award_amount"))
        award.award_date = _parse_date(request.form.get("award_date"))
        award.awarding_agency_or_funder = request.form.get("awarding_agency_or_funder")
        award.naics_code = request.form.get("naics_code")
        award.description = request.form.get("description")
        award.period_of_performance_start = _parse_date(request.form.get("period_of_performance_start"))
        award.period_of_performance_end = _parse_date(request.form.get("period_of_performance_end"))
        award.expiration_date = _parse_date(request.form.get("expiration_date"))
        award.subcontract_opportunity = request.form.get("subcontract_opportunity") == "on"
        award.subcontract_outreach_status = request.form.get("subcontract_outreach_status", award.subcontract_outreach_status)
        award.notes = request.form.get("notes")
        db.session.commit()
        flash("Award updated.", "success")
        return redirect(url_for("award_history.detail", award_id=award_id))
    return render_template("award_history/form.html", award=award)


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
