from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.pipeline import Pipeline
from app.models.opportunity import Opportunity
from app.models.activity_log import ActivityLog
from datetime import datetime, timezone

pipeline_bp = Blueprint("pipeline", __name__, url_prefix="/pipeline")

STAGES = [
    "Identified", "Reviewing", "Go Decision", "Preparing Bid",
    "Submitted", "Under Evaluation", "Won", "Lost", "Withdrawn"
]


@pipeline_bp.route("/")
@login_required
def index():
    stage = request.args.get("stage")
    go_no_go = request.args.get("go_no_go")
    query = db.session.query(Pipeline, Opportunity).join(
        Opportunity, Pipeline.opportunity_id == Opportunity.id
    )
    if stage:
        query = query.filter(Pipeline.stage == stage)
    if go_no_go:
        query = query.filter(Pipeline.go_no_go == go_no_go)
    items = query.order_by(Pipeline.date_added.desc()).all()
    return render_template("pipeline/index.html", items=items, stages=STAGES)


@pipeline_bp.route("/<int:pipeline_id>")
@login_required
def detail(pipeline_id):
    item = Pipeline.query.get_or_404(pipeline_id)
    logs = ActivityLog.query.filter_by(record_type="pipeline", record_id=pipeline_id).order_by(ActivityLog.activity_date.desc()).all()
    return render_template("pipeline/detail.html", item=item, logs=logs, stages=STAGES)


@pipeline_bp.route("/new/<int:opp_id>", methods=["POST"])
@login_required
def create_from_opportunity(opp_id):
    Opportunity.query.get_or_404(opp_id)
    existing = Pipeline.query.filter_by(opportunity_id=opp_id).first()
    if existing:
        flash("This opportunity is already in the pipeline.", "info")
        return redirect(url_for("pipeline.detail", pipeline_id=existing.id))
    item = Pipeline(opportunity_id=opp_id, stage="Identified", go_no_go="Pending")
    db.session.add(item)
    db.session.commit()
    flash("Added to pipeline.", "success")
    return redirect(url_for("pipeline.detail", pipeline_id=item.id))


@pipeline_bp.route("/<int:pipeline_id>/edit", methods=["GET", "POST"])
@login_required
def edit(pipeline_id):
    item = Pipeline.query.get_or_404(pipeline_id)
    if request.method == "POST":
        item.stage = request.form.get("stage", item.stage)
        item.go_no_go = request.form.get("go_no_go", item.go_no_go)
        item.decision_date = _parse_date(request.form.get("decision_date"))
        item.submission_date = _parse_date(request.form.get("submission_date"))
        item.submitted_amount = _parse_decimal(request.form.get("submitted_amount"))
        item.outcome = request.form.get("outcome")
        item.outcome_date = _parse_date(request.form.get("outcome_date"))
        item.lessons_learned = request.form.get("lessons_learned")
        item.followup_date = _parse_date(request.form.get("followup_date"))
        item.notes = request.form.get("notes")
        db.session.commit()
        flash("Pipeline record updated.", "success")
        return redirect(url_for("pipeline.detail", pipeline_id=pipeline_id))
    return render_template("pipeline/form.html", item=item, stages=STAGES)


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
