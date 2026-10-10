"""Database utilities for the CareSync backend.

Connects to the Supabase PostgreSQL database with psycopg2 and provides
helpers to run the SQL scripts in the ``sql`` folder. The SQL scripts are
run ONCE via ``python app/database.py`` -- not on every server start.
"""
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
SQL_DIR = BASE_DIR / "sql"

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")


class DatabaseError(RuntimeError):
    """Raised when the database connection cannot be established."""


def get_database_url() -> str:
    """Return the DATABASE_URL from the environment."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise DatabaseError(
            "DATABASE_URL is not set. Copy .env.example to .env and fill in "
            "your Supabase database password."
        )
    return database_url


def redact_password(message: str) -> str:
    """Remove the database password from a message so it is never printed."""
    database_url = os.getenv("DATABASE_URL", "")
    if database_url:
        try:
            password = (
                database_url.split("://", 1)[1].rsplit("@", 1)[0].split(":", 1)[1]
            )
        except IndexError:
            password = ""
        if password:
            message = message.replace(password, "********")
    return message


def get_connection():
    """Open a psycopg2 connection to the Supabase PostgreSQL database."""
    database_url = get_database_url()
    try:
        return psycopg2.connect(database_url)
    except psycopg2.OperationalError as exc:
        raise DatabaseError(redact_password(str(exc))) from None


def run_sql_file(conn, filename: str) -> None:
    """Execute a SQL file from the ``sql`` folder inside the open connection."""
    path = SQL_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")
    sql = path.read_text(encoding="utf-8")
    with conn.cursor() as cursor:
        cursor.execute(sql)
    conn.commit()


def init_database() -> None:
    """Create tables, trigger and RLS policies, then seed staff (run once)."""
    conn = get_connection()
    try:
        run_sql_file(conn, "schema.sql")
        run_sql_file(conn, "seed_staff.sql")
        run_sql_file(conn, "003_signup_improvements.sql")
        run_sql_file(conn, "004_support_contacts.sql")
        run_sql_file(conn, "005_support_requests_extend.sql")
        run_sql_file(conn, "006_upcoming_shifts.sql")
        run_sql_file(conn, "007_timezone_fix.sql")
    finally:
        conn.close()
    print("Database initialization completed successfully")


if __name__ == "__main__":
    init_database()