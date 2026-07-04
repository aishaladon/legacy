"""
Run once to create all tables and load seed data.
Usage: python init_db.py
"""
import os
import pymysql
from dotenv import load_dotenv
from app import create_app
from app.extensions import db

load_dotenv()


def run_sql_file(cursor, path):
    with open(path) as f:
        sql = f.read()
    for statement in sql.split(";"):
        stmt = statement.strip()
        if stmt:
            cursor.execute(stmt)


def main():
    app = create_app()
    with app.app_context():
        print("Creating tables...")
        db.create_all()
        print("Tables created.")

        conn = pymysql.connect(
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", 3306)),
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            database=os.environ["DB_NAME"],
            charset="utf8mb4",
        )
        cursor = conn.cursor()

        seeds_dir = os.path.join(os.path.dirname(__file__), "database", "seeds")
        seed_files = [
            "naics_codes.sql",
            "keywords.sql",
            "user_settings.sql",
            "funders.sql",
            "data_sources.sql",
        ]

        for fname in seed_files:
            path = os.path.join(seeds_dir, fname)
            if os.path.exists(path):
                print(f"  Loading {fname}...")
                try:
                    run_sql_file(cursor, path)
                    conn.commit()
                except Exception as e:
                    print(f"  Warning: {e} (may already exist)")
                    conn.rollback()

        cursor.close()
        conn.close()
        print("Done. Database is ready.")
        print("\nLog in with:")
        print(f"  Username: {os.environ.get('ADMIN_USERNAME', 'aisha')}")
        print(f"  Password: [from your .env ADMIN_PASSWORD]")


if __name__ == "__main__":
    main()
