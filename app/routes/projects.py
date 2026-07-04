from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.project import Project
from app.models.pipeline import Pipeline
from app.models.activity_log import ActivityLog
from datetime import datetime, timezone

projects_bp = Blueprint("projects", __name__, url_prefix="/projects")


@projects_bp.route("/")
@login_required
def index():
    projects = Project.query.order_by(Project.start_date.desc()).all()
    return render_template("projects/index.html", projects=projects)


@projects_bp.route("/<int:project_id>")
@login_required
def detail(project_id):
    project = Project.query.get_or_404(project_id)
    logs = ActivityLog.query.filter_by(record_type="project", record_id=project_id).order_by(ActivityLog.activity_date.desc()).all()
    return render_template("projects/detail.html", project=project, logs=logs)


@projects_bp.route("/new/<int:pipeline_id>", methods=["POST"])
@login_required
def create_from_pipeline(pipeline_id):
    pl = Pipeline.query.get_or_404(pipeline_id)
    existing = Project.query.filter_by(pipeline_id=pipeline_id).first()
    if existing:
        flash("A project already exists for this pipeline record.", "info")
        return redirect(url_for("projects.detail", project_id=existing.id))
    project = Project(pipeline_id=pipeline_id, project_type="Government Contract")
    db.session.add(project)
    db.session.commit()
    flash("Project created.", "success")
    return redirect(url_for("projects.detail", project_id=project.id))


@projects_bp.route("/<int:project_id>/edit", methods=["GET", "POST"])
@login_required
def edit(project_id):
    project = Project.query.get_or_404(project_id)
    if request.method == "POST":
        project.contract_or_grant_number = request.form.get("contract_or_grant_number")
        project.project_type = request.form.get("project_type")
        project.start_date = _parse_date(request.form.get("start_date"))
        project.end_date = _parse_date(request.form.get("end_date"))
        project.total_value = _parse_decimal(request.form.get("total_value"))
        project.payment_schedule = request.form.get("payment_schedule")
        project.payment_milestones = request.form.get("payment_milestones")
        project.milestone_status = request.form.get("milestone_status")
        project.subcontractors = request.form.get("subcontractors")
        project.deliverables = request.form.get("deliverables")
        project.deliverable_status = request.form.get("deliverable_status")
        project.travel_required = request.form.get("travel_required") == "on"
        project.travel_dates = request.form.get("travel_dates")
        project.accommodation_details = request.form.get("accommodation_details")
        project.monthly_report_due_dates = request.form.get("monthly_report_due_dates")
        project.notes = request.form.get("notes")
        db.session.commit()
        flash("Project updated.", "success")
        return redirect(url_for("projects.detail", project_id=project_id))
    return render_template("projects/form.html", project=project)


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
