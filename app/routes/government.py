from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.opportunity import Opportunity
from app.models.government_contract import GovernmentContract

government_bp = Blueprint("government", __name__, url_prefix="/government")


@government_bp.route("/")
@login_required
def index():
    contracts = (
        db.session.query(GovernmentContract, Opportunity)
        .join(Opportunity, GovernmentContract.opportunity_id == Opportunity.id)
        .filter(Opportunity.status != "Archived")
        .order_by(Opportunity.date_added.desc())
        .all()
    )
    return render_template("government/index.html", contracts=contracts)


@government_bp.route("/<int:contract_id>")
@login_required
def detail(contract_id):
    contract = GovernmentContract.query.get_or_404(contract_id)
    return render_template("government/detail.html", contract=contract)
