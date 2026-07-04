from flask import Blueprint, render_template
from flask_login import login_required
from app.extensions import db
from app.models.opportunity import Opportunity
from app.models.pipeline import Pipeline
from app.models.daily_digest import DailyDigest
from datetime import date, timedelta

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
@login_required
def index():
    today = date.today()
    week_out = today + timedelta(days=7)

    new_opps = Opportunity.query.filter_by(status="New").count()
    active_pipeline = Pipeline.query.filter(
        Pipeline.stage.in_(["Reviewing", "Go Decision", "Preparing Bid", "Submitted", "Under Evaluation"])
    ).count()
    due_soon = Opportunity.query.filter(
        Opportunity.due_date.between(today, week_out),
        Opportunity.status.in_(["New", "Reviewing", "Bidding"])
    ).order_by(Opportunity.due_date).limit(5).all()
    recent_opps = Opportunity.query.order_by(Opportunity.date_added.desc()).limit(8).all()
    last_digest = DailyDigest.query.order_by(DailyDigest.date_sent.desc()).first()

    return render_template(
        "dashboard/index.html",
        new_opps=new_opps,
        active_pipeline=active_pipeline,
        due_soon=due_soon,
        recent_opps=recent_opps,
        last_digest=last_digest,
        today=today,
    )
