import bcrypt
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app
from flask_login import login_user, logout_user, login_required, UserMixin, current_user
from app.extensions import login_manager

auth_bp = Blueprint("auth", __name__)


class AppUser(UserMixin):
    """Single-user auth — credentials live in .env."""

    def __init__(self):
        self.id = "1"
        self.username = None

    @staticmethod
    def get(user_id):
        if user_id == "1":
            u = AppUser()
            u.username = current_app.config["ADMIN_USERNAME"]
            return u
        return None


@login_manager.user_loader
def load_user(user_id):
    return AppUser.get(user_id)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        expected_user = current_app.config["ADMIN_USERNAME"]
        expected_pass = current_app.config["ADMIN_PASSWORD"]

        if username == expected_user and password == expected_pass:
            user = AppUser()
            user.username = username
            login_user(user, remember=True)
            next_page = request.args.get("next")
            return redirect(next_page or url_for("dashboard.index"))
        else:
            error = "Incorrect username or password."

    return render_template("auth/login.html", error=error)


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login"))
