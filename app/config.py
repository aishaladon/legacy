import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key-change-before-deploy")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{os.environ.get('DB_USER')}:{os.environ.get('DB_PASSWORD')}"
        f"@{os.environ.get('DB_HOST', 'localhost')}:{os.environ.get('DB_PORT', '3306')}"
        f"/{os.environ.get('DB_NAME', 'legacy_bd')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 280,
        "pool_pre_ping": True,
    }

    TZ = os.environ.get("TZ", "America/Los_Angeles")

    IMAP_HOST = os.environ.get("IMAP_HOST")
    IMAP_PORT = int(os.environ.get("IMAP_PORT", 993))
    IMAP_USERNAME = os.environ.get("IMAP_USERNAME")
    IMAP_PASSWORD = os.environ.get("IMAP_PASSWORD")
    IMAP_USE_SSL = os.environ.get("IMAP_USE_SSL", "true").lower() == "true"

    SMTP_HOST = os.environ.get("SMTP_HOST")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
    SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
    DIGEST_FROM = os.environ.get("DIGEST_FROM")

    SAM_GOV_API_KEY = os.environ.get("SAM_GOV_API_KEY")

    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "aisha")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "change-me")
