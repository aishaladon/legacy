from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.grant_opportunity import GrantOpportunity
from app.models.opportunity import Opportunity
from app.models.funder import Funder
from app.models.institution import Institution

grants_bp = Blueprint("grants", __name__, url_prefix="/grants")


@grants_bp.route("/")
@login_required
def index():
    status = request.args.get("status")
    query = db.session.query(GrantOpportunity, Opportunity).join(
        Opportunity, GrantOpportunity.opportunity_id == Opportunity.id
    )
    if status:
        query = query.filter(GrantOpportunity.outreach_status == status)
    grants = query.order_by(Opportunity.date_added.desc()).all()
    return render_template("grants/index.html", grants=grants)


@grants_bp.route("/<int:grant_id>")
@login_required
def detail(grant_id):
    grant = GrantOpportunity.query.get_or_404(grant_id)
    return render_template("grants/detail.html", grant=grant)
