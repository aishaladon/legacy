from flask import Flask
from app.config import Config
from app.extensions import db, login_manager


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)

    from app.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.opportunities import opportunities_bp
    from app.routes.government import government_bp
    from app.routes.grants import grants_bp
    from app.routes.pipeline import pipeline_bp
    from app.routes.projects import projects_bp
    from app.routes.contacts import contacts_bp
    from app.routes.institutions import institutions_bp
    from app.routes.funders import funders_bp
    from app.routes.award_history import award_history_bp
    from app.routes.guides import guides_bp
    from app.routes.settings import settings_bp
    from app.routes.digest_log import digest_log_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(opportunities_bp)
    app.register_blueprint(government_bp)
    app.register_blueprint(grants_bp)
    app.register_blueprint(pipeline_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(contacts_bp)
    app.register_blueprint(institutions_bp)
    app.register_blueprint(funders_bp)
    app.register_blueprint(award_history_bp)
    app.register_blueprint(guides_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(digest_log_bp)

    return app
