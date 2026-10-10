"""Verify that the backend can connect to the Supabase PostgreSQL database.

Run once from the backend folder:
    python test_database_connection.py

Prints "Database connection successful" on success and never prints the
database password.
"""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")


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


def main() -> int:
    """Connect to the database, run a trivial query and report the result."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")
        return 1

    conn = None
    try:
        conn = psycopg2.connect(database_url)
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:  # noqa: BLE001 - any failure means no connection
        print("Database connection failed:", redact_password(str(exc)))
        return 1
    finally:
        if conn is not None:
            conn.close()

    print("Database connection successful")
    return 0


if __name__ == "__main__":
    sys.exit(main())