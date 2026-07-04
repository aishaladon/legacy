from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.opportunity import Opportunity
from app.models.activity_log import ActivityLog
from datetime import datetime, timezone

opportunities_bp = Blueprint("opportunities", __name__, url_prefix="/opportunities")


def _apply_filters(query):
    status = request.args.get("status")
    track = request.args.get("track")
    region = request.args.get("region")
    opp_type = request.args.get("type")
    set_aside = request.args.get("set_aside")

    if status:
        query = query.filter(Opportunity.status == status)
    if track:
        query = query.filter(Opportunity.track == track)
    if region:
        query = query.filter(Opportunity.region == region)
    if opp_type:
        query = query.filter(Opportunity.opportunity_type == opp_type)
    if set_aside:
        query = query.filter(Opportunity.set_aside_type == set_aside)

    return query


@opportunities_bp.route("/")
@login_required
def index():
    query = Opportunity.query.filter(Opportunity.status != "Archived")
    query = _apply_filters(query)
    opps = query.order_by(Opportunity.date_added.desc()).all()
    return render_template("opportunities/index.html", opps=opps)


@opportunities_bp.route("/<int:opp_id>")
@login_required
def detail(opp_id):
    opp = Opportunity.query.get_or_404(opp_id)
    logs = ActivityLog.query.filter_by(record_type="opportunity", record_id=opp_id).order_by(ActivityLog.activity_date.desc()).all()
    return render_template("opportunities/detail.html", opp=opp, logs=logs)


@opportunities_bp.route("/new", methods=["GET", "POST"])
@login_required
def new():
    if request.method == "POST":
        opp = Opportunity(
            title=request.form["title"],
            description=request.form.get("description"),
            source=request.form.get("source"),
            source_url=request.form.get("source_url"),
            opportunity_type=request.form.get("opportunity_type"),
            posted_date=_parse_date(request.form.get("posted_date")),
            due_date=_parse_date(request.form.get("due_date")),
            contract_amount_min=_parse_decimal(request.form.get("contract_amount_min")),
            contract_amount_max=_parse_decimal(request.form.get("contract_amount_max")),
            naics_code=request.form.get("naics_code"),
            set_aside_type=request.form.get("set_aside_type"),
            institution_type=request.form.get("institution_type"),
            location_city=request.form.get("location_city"),
            location_state=request.form.get("location_state"),
            region=request.form.get("region"),
            alignment_score=_parse_int(request.form.get("alignment_score")),
            status=request.form.get("status", "New"),
            track=request.form.get("track"),
            notes=request.form.get("notes"),
        )
        db.session.add(opp)
        db.session.commit()
        flash("Opportunity added.", "success")
        return redirect(url_for("opportunities.detail", opp_id=opp.id))
    return render_template("opportunities/form.html", opp=None)


@opportunities_bp.route("/<int:opp_id>/edit", methods=["GET", "POST"])
@login_required
def edit(opp_id):
    opp = Opportunity.query.get_or_404(opp_id)
    if request.method == "POST":
        opp.title = request.form["title"]
        opp.description = request.form.get("description")
        opp.source = request.form.get("source")
        opp.source_url = request.form.get("source_url")
        opp.opportunity_type = request.form.get("opportunity_type")
        opp.posted_date = _parse_date(request.form.get("posted_date"))
        opp.due_date = _parse_date(request.form.get("due_date"))
        opp.contract_amount_min = _parse_decimal(request.form.get("contract_amount_min"))
        opp.contract_amount_max = _parse_decimal(request.form.get("contract_amount_max"))
        opp.naics_code = request.form.get("naics_code")
        opp.set_aside_type = request.form.get("set_aside_type")
        opp.institution_type = request.form.get("institution_type")
        opp.location_city = request.form.get("location_city")
        opp.location_state = request.form.get("location_state")
        opp.region = request.form.get("region")
        opp.alignment_score = _parse_int(request.form.get("alignment_score"))
        opp.status = request.form.get("status", opp.status)
        opp.track = request.form.get("track")
        opp.notes = request.form.get("notes")
        db.session.commit()
        flash("Opportunity updated.", "success")
        return redirect(url_for("opportunities.detail", opp_id=opp.id))
    return render_template("opportunities/form.html", opp=opp)


@opportunities_bp.route("/<int:opp_id>/status", methods=["POST"])
@login_required
def update_status(opp_id):
    opp = Opportunity.query.get_or_404(opp_id)
    new_status = request.form.get("status")
    if new_status:
        old_status = opp.status
        opp.status = new_status
        log = ActivityLog(
            record_type="opportunity",
            record_id=opp_id,
            activity_type="Status Changed",
            description=f"Status changed from {old_status} to {new_status}",
            activity_date=datetime.now(timezone.utc),
        )
        db.session.add(log)
        db.session.commit()
    return redirect(url_for("opportunities.detail", opp_id=opp_id))


@opportunities_bp.route("/<int:opp_id>/log", methods=["POST"])
@login_required
def add_log(opp_id):
    Opportunity.query.get_or_404(opp_id)
    log = ActivityLog(
        record_type="opportunity",
        record_id=opp_id,
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
    return redirect(url_for("opportunities.detail", opp_id=opp_id))


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


def _parse_int(val):
    if not val:
        return None
    try:
        return int(val)
    except ValueError:
        return None
