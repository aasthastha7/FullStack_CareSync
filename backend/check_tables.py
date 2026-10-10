"""Verify that the CareSync database was initialised correctly.

Checks:
  * every expected table exists in the public schema
  * the on_auth_user_created trigger exists on auth.users
  * the staff table has exactly 4 rows

Run from the backend folder:
    python check_tables.py
"""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")

EXPECTED_TABLES = [
    "alerts",
    "chat_messages",
    "mood_checkins",
    "profiles",
    "shift_reports",
    "shift_tasks",
    "shifts",
    "staff",
    "staff_attendance",
    "support_contacts",
    "support_requests",
]
EXPECTED_STAFF_ROWS = 4
TRIGGER_NAME = "on_auth_user_created"
TRIGGER_TABLE = "auth.users"

# Columns that must exist after the new migrations
SHIFTS_NEW_COLUMNS = ["checked_in_lat", "checked_in_lng", "created_at"]
SUPPORT_REQUESTS_NEW_COLUMNS = [
    "requested_date",
    "swap_shift_id",
    "swap_with_staff_id",
    "decided_at",
]
PROFILES_NEW_COLUMNS = ["timezone"]
STATUS_CONSTRAINT_NAME = "support_requests_status_check"
MIN_UPCOMING_SHIFTS_PER_USER = 4


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
    """Run all database checks and return a process exit code."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")
        return 1

    errors = []
    conn = None
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        with conn.cursor() as cursor:
            # 1. All tables must exist in the public schema
            cursor.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ANY(%s)
                """,
                (EXPECTED_TABLES,),
            )
            found = {row[0] for row in cursor.fetchall()}

            for table in sorted(EXPECTED_TABLES):
                if table in found:
                    print(f"Table found: public.{table}")
                else:
                    errors.append(f"missing table public.{table}")
                    print(f"Table missing: public.{table}")

            # 2. The signup trigger must exist on auth.users
            cursor.execute(
                """
                SELECT 1
                FROM pg_trigger
                WHERE tgname = %s
                  AND tgrelid = %s::regclass
                  AND NOT tgisinternal
                """,
                (TRIGGER_NAME, TRIGGER_TABLE),
            )
            if cursor.fetchone():
                print(f"Trigger found: {TRIGGER_NAME} on {TRIGGER_TABLE}")
            else:
                errors.append(f"missing trigger {TRIGGER_NAME} on {TRIGGER_TABLE}")
                print(f"Trigger missing: {TRIGGER_NAME} on {TRIGGER_TABLE}")

            # 3. The staff table must hold exactly 4 seeded rows
            if "staff" in found:
                cursor.execute("SELECT count(*) FROM public.staff")
                staff_rows = cursor.fetchone()[0]
                if staff_rows == EXPECTED_STAFF_ROWS:
                    print(f"Staff rows: {staff_rows} (expected {EXPECTED_STAFF_ROWS})")
                else:
                    errors.append(
                        f"staff has {staff_rows} rows, expected {EXPECTED_STAFF_ROWS}"
                    )
                    print(
                        f"Staff rows: {staff_rows} "
                        f"(expected {EXPECTED_STAFF_ROWS}) -- MISMATCH"
                    )

            # 4. support_contacts exists and has rows
            if "support_contacts" in found:
                cursor.execute("SELECT count(*) FROM public.support_contacts")
                sc_rows = cursor.fetchone()[0]
                if sc_rows >= 1:
                    print(f"support_contacts rows: {sc_rows}")
                else:
                    errors.append(
                        f"support_contacts has {sc_rows} rows, expected >= 1"
                    )
                    print(f"support_contacts rows: {sc_rows} -- expected >= 1")

            # 4b. profiles has the timezone column
            if "profiles" in found:
                cursor.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'profiles'
                      AND column_name = ANY(%s)
                    """,
                    (PROFILES_NEW_COLUMNS,),
                )
                pf_cols = {row[0] for row in cursor.fetchall()}
                for col in PROFILES_NEW_COLUMNS:
                    if col in pf_cols:
                        print(f"Column found: profiles.{col}")
                    else:
                        errors.append(f"missing column profiles.{col}")
                        print(f"Column missing: profiles.{col}")

            # 5. shifts has the new columns
            if "shifts" in found:
                cursor.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'shifts'
                      AND column_name = ANY(%s)
                    """,
                    (SHIFTS_NEW_COLUMNS,),
                )
                shifts_cols = {row[0] for row in cursor.fetchall()}
                for col in SHIFTS_NEW_COLUMNS:
                    if col in shifts_cols:
                        print(f"Column found: shifts.{col}")
                    else:
                        errors.append(f"missing column shifts.{col}")
                        print(f"Column missing: shifts.{col}")

            # 6. support_requests has the new columns + constraint
            if "support_requests" in found:
                cursor.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'support_requests'
                      AND column_name = ANY(%s)
                    """,
                    (SUPPORT_REQUESTS_NEW_COLUMNS,),
                )
                sr_cols = {row[0] for row in cursor.fetchall()}
                for col in SUPPORT_REQUESTS_NEW_COLUMNS:
                    if col in sr_cols:
                        print(f"Column found: support_requests.{col}")
                    else:
                        errors.append(f"missing column support_requests.{col}")
                        print(f"Column missing: support_requests.{col}")

                cursor.execute(
                    """
                    SELECT 1 FROM pg_constraint
                    WHERE conname = %s
                      AND conrelid = 'public.support_requests'::regclass
                    """,
                    (STATUS_CONSTRAINT_NAME,),
                )
                if cursor.fetchone():
                    print(f"Constraint found: {STATUS_CONSTRAINT_NAME}")
                else:
                    errors.append(
                        f"missing constraint {STATUS_CONSTRAINT_NAME}"
                    )
                    print(f"Constraint missing: {STATUS_CONSTRAINT_NAME}")

            # 7. Each existing user has >= 4 upcoming shifts
            if "profiles" in found and "shifts" in found:
                cursor.execute(
                    """
                    SELECT p.id, count(s.id)
                    FROM public.profiles p
                    LEFT JOIN public.shifts s
                      ON s.user_id = p.id
                     AND s.shift_date > current_date
                    GROUP BY p.id
                    """
                )
                rows = cursor.fetchall()
                if rows:
                    for user_id, cnt in rows:
                        if cnt >= MIN_UPCOMING_SHIFTS_PER_USER:
                            print(
                                f"User {user_id}: {cnt} upcoming shifts "
                                f"(>= {MIN_UPCOMING_SHIFTS_PER_USER})"
                            )
                        else:
                            errors.append(
                                f"user {user_id} has {cnt} upcoming shifts"
                            )
                            print(
                                f"User {user_id}: {cnt} upcoming shifts -- "
                                f"expected >= {MIN_UPCOMING_SHIFTS_PER_USER}"
                            )
                else:
                    print("No profiles found (no users to check upcoming shifts)")
    except Exception as exc:  # noqa: BLE001 - any failure means checks failed
        errors.append(redact_password(str(exc)))
        print("Database check failed:", redact_password(str(exc)))
    finally:
        if conn is not None:
            conn.close()

    if errors:
        print("\nDatabase check FAILED:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("\nAll database checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())