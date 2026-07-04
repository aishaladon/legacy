from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.extensions import db
from app.models.user_settings import UserSettings
from app.models.naics_code import NaicsCode
from app.models.keyword import Keyword
from app.models.data_source import DataSource
from datetime import datetime, timezone

settings_bp = Blueprint("settings", __name__, url_prefix="/settings")


@settings_bp.route("/")
@login_required
def index():
    settings = UserSettings.query.order_by(UserSettings.name).all()
    naics_codes = NaicsCode.query.order_by(NaicsCode.code).all()
    keywords = Keyword.query.order_by(Keyword.keyword).all()
    data_sources = DataSource.query.order_by(DataSource.name).all()
    return render_template(
        "settings/index.html",
        settings=settings,
        naics_codes=naics_codes,
        keywords=keywords,
        data_sources=data_sources,
    )


@settings_bp.route("/update", methods=["POST"])
@login_required
def update():
    for key, value in request.form.items():
        if key.startswith("setting_"):
            name = key[len("setting_"):]
            UserSettings.set(name, value)
    flash("Settings saved.", "success")
    return redirect(url_for("settings.index"))


# ── NAICS ─────────────────────────────────────────────────────────────────────

@settings_bp.route("/naics/new", methods=["POST"])
@login_required
def naics_new():
    code = NaicsCode(
        code=request.form["code"],
        description=request.form["description"],
        active=request.form.get("active") == "on",
        track=request.form.get("track", "All"),
        primary=request.form.get("primary") == "on",
        notes=request.form.get("notes"),
    )
    db.session.add(code)
    db.session.commit()
    flash(f"NAICS {code.code} added.", "success")
    return redirect(url_for("settings.index") + "#naics")


@settings_bp.route("/naics/<int:code_id>/toggle", methods=["POST"])
@login_required
def naics_toggle(code_id):
    code = NaicsCode.query.get_or_404(code_id)
    code.active = not code.active
    db.session.commit()
    return redirect(url_for("settings.index") + "#naics")


# ── Keywords ──────────────────────────────────────────────────────────────────

@settings_bp.route("/keywords/new", methods=["POST"])
@login_required
def keyword_new():
    kw = Keyword(
        keyword=request.form["keyword"],
        active=request.form.get("active") == "on",
        track=request.form.get("track", "All"),
        priority=request.form.get("priority", "Medium"),
        notes=request.form.get("notes"),
    )
    db.session.add(kw)
    db.session.commit()
    flash(f"Keyword '{kw.keyword}' added.", "success")
    return redirect(url_for("settings.index") + "#keywords")


@settings_bp.route("/keywords/<int:kw_id>/toggle", methods=["POST"])
@login_required
def keyword_toggle(kw_id):
    kw = Keyword.query.get_or_404(kw_id)
    kw.active = not kw.active
    db.session.commit()
    return redirect(url_for("settings.index") + "#keywords")


# ── Data Sources ──────────────────────────────────────────────────────────────

@settings_bp.route("/sources/new", methods=["GET", "POST"])
@login_required
def source_new():
    if request.method == "POST":
        source = DataSource(
            name=request.form["name"],
            source_type=request.form.get("source_type"),
            source_url=request.form.get("source_url"),
            login_required=request.form.get("login_required") == "on",
            credentials_location=request.form.get("credentials_location"),
            check_frequency=request.form.get("check_frequency"),
            active=request.form.get("active") == "on",
            naics_filter=request.form.get("naics_filter"),
            keyword_filter=request.form.get("keyword_filter"),
            track=request.form.get("track"),
            notes=request.form.get("notes"),
        )
        db.session.add(source)
        db.session.commit()
        flash("Data source added.", "success")
        return redirect(url_for("settings.index") + "#sources")
    return render_template("settings/source_form.html", source=None)


@settings_bp.route("/sources/<int:source_id>/toggle", methods=["POST"])
@login_required
def source_toggle(source_id):
    source = DataSource.query.get_or_404(source_id)
    source.active = not source.active
    db.session.commit()
    return redirect(url_for("settings.index") + "#sources")
