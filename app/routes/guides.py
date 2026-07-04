from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.bid_writing_guide import BidWritingGuide
from app.models.capability_statement import CapabilityStatement

guides_bp = Blueprint("guides", __name__, url_prefix="/guides")


@guides_bp.route("/")
@login_required
def index():
    guides = BidWritingGuide.query.order_by(BidWritingGuide.name).all()
    cap_statements = CapabilityStatement.query.order_by(CapabilityStatement.version_name).all()
    return render_template("guides/index.html", guides=guides, cap_statements=cap_statements)


@guides_bp.route("/<int:guide_id>")
@login_required
def detail(guide_id):
    guide = BidWritingGuide.query.get_or_404(guide_id)
    return render_template("guides/detail.html", guide=guide)


@guides_bp.route("/new", methods=["GET", "POST"])
@login_required
def new():
    if request.method == "POST":
        guide = BidWritingGuide(
            name=request.form["name"],
            opportunity_type=request.form.get("opportunity_type"),
            naics_code=request.form.get("naics_code"),
            institution_type=request.form.get("institution_type"),
            guide_steps=request.form.get("guide_steps"),
            key_questions=request.form.get("key_questions"),
            sections_required=request.form.get("sections_required"),
            tips_and_warnings=request.form.get("tips_and_warnings"),
            capability_statement_id=_parse_int(request.form.get("capability_statement_id")),
            example_language=request.form.get("example_language"),
        )
        db.session.add(guide)
        db.session.commit()
        flash("Bid writing guide added.", "success")
        return redirect(url_for("guides.detail", guide_id=guide.id))
    cap_statements = CapabilityStatement.query.order_by(CapabilityStatement.version_name).all()
    return render_template("guides/form.html", guide=None, cap_statements=cap_statements)


@guides_bp.route("/<int:guide_id>/edit", methods=["GET", "POST"])
@login_required
def edit(guide_id):
    guide = BidWritingGuide.query.get_or_404(guide_id)
    if request.method == "POST":
        guide.name = request.form["name"]
        guide.opportunity_type = request.form.get("opportunity_type")
        guide.naics_code = request.form.get("naics_code")
        guide.institution_type = request.form.get("institution_type")
        guide.guide_steps = request.form.get("guide_steps")
        guide.key_questions = request.form.get("key_questions")
        guide.sections_required = request.form.get("sections_required")
        guide.tips_and_warnings = request.form.get("tips_and_warnings")
        guide.capability_statement_id = _parse_int(request.form.get("capability_statement_id"))
        guide.example_language = request.form.get("example_language")
        db.session.commit()
        flash("Guide updated.", "success")
        return redirect(url_for("guides.detail", guide_id=guide_id))
    cap_statements = CapabilityStatement.query.order_by(CapabilityStatement.version_name).all()
    return render_template("guides/form.html", guide=guide, cap_statements=cap_statements)


# ── Capability Statements ─────────────────────────────────────────────────────

@guides_bp.route("/capability-statements/new", methods=["GET", "POST"])
@login_required
def new_capability():
    if request.method == "POST":
        cap = CapabilityStatement(
            version_name=request.form["version_name"],
            version_type=request.form.get("version_type"),
            file_location=request.form.get("file_location"),
            naics_codes_highlighted=request.form.get("naics_codes_highlighted"),
            key_differentiators=request.form.get("key_differentiators"),
            notes=request.form.get("notes"),
        )
        db.session.add(cap)
        db.session.commit()
        flash("Capability statement added.", "success")
        return redirect(url_for("guides.index"))
    return render_template("guides/capability_form.html", cap=None)


@guides_bp.route("/capability-statements/<int:cap_id>/edit", methods=["GET", "POST"])
@login_required
def edit_capability(cap_id):
    cap = CapabilityStatement.query.get_or_404(cap_id)
    if request.method == "POST":
        cap.version_name = request.form["version_name"]
        cap.version_type = request.form.get("version_type")
        cap.file_location = request.form.get("file_location")
        cap.naics_codes_highlighted = request.form.get("naics_codes_highlighted")
        cap.key_differentiators = request.form.get("key_differentiators")
        cap.notes = request.form.get("notes")
        db.session.commit()
        flash("Capability statement updated.", "success")
        return redirect(url_for("guides.index"))
    return render_template("guides/capability_form.html", cap=cap)


def _parse_int(val):
    if not val:
        return None
    try:
        return int(val)
    except ValueError:
        return None
