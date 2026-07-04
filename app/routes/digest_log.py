from flask import Blueprint, render_template
from flask_login import login_required
from app.models.daily_digest import DailyDigest

digest_log_bp = Blueprint("digest_log", __name__, url_prefix="/digest")


@digest_log_bp.route("/")
@login_required
def index():
    digests = DailyDigest.query.order_by(DailyDigest.date_sent.desc()).limit(90).all()
    return render_template("digest_log/index.html", digests=digests)


@digest_log_bp.route("/<int:digest_id>")
@login_required
def detail(digest_id):
    digest = DailyDigest.query.get_or_404(digest_id)
    return render_template("digest_log/detail.html", digest=digest)
