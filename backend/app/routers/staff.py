"""Staff directory API routes.

Endpoints:
    GET  /staff                      list staff filtered by name query
    GET  /staff/{staff_id}           get a single staff member with all fields
    PATCH /staff/{staff_id}          update contact details (email/phone)
    GET  /staff/{staff_id}/attendance  attendance records newest first
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["staff"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------
class StaffUpdateRequest(BaseModel):
    """Body for PATCH /staff/{staff_id}."""

    email: str | None = Field(None, description="New email address")
    phone: str | None = Field(None, description="New phone number")


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _row_to_dict(cur, row):
    """Convert a cursor row to a dict keyed by column names."""
    return dict(zip([d[0] for d in cur.description], row)) if row else None


def _fetch_staff_row(cur, staff_id: str) -> dict[str, Any]:
    """Fetch a single staff row or raise 404."""
    cur.execute(
        """SELECT id, name, role, employee_id, email, phone,
                  date_joined, employment_type, supervisor,
                  last_activity, last_login, patients_attended,
                  current_status, total_tasks, average_time,
                  completion_rate, present_days, absent_days,
                  late_days, present_percent, punctuality_percent
           FROM public.staff WHERE id = %s""",
        (staff_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    return dict(zip([d[0] for d in cur.description], row))


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@router.get("/staff", summary="List staff members filtered by name")
def list_staff(
    q: str | None = Query(None, description="Name search (case-insensitive)"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    if not q or not q.strip():
        return []
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, role, employee_id, email, phone,
                          date_joined, employment_type, supervisor,
                          last_activity, last_login, patients_attended,
                          current_status, total_tasks, average_time,
                          completion_rate, present_days, absent_days,
                          late_days, present_percent, punctuality_percent
                   FROM public.staff
                   WHERE name ILIKE %s
                     AND user_id IS DISTINCT FROM %s
                   ORDER BY name""",
                (f"%{q.strip()}%", current_user["id"]),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


@router.get("/staff/{staff_id}", summary="Get a single staff member")
def get_staff(
    staff_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            return _fetch_staff_row(cur, staff_id)
    finally:
        conn.close()


@router.patch("/staff/{staff_id}", summary="Update staff contact details")
def update_staff(
    staff_id: str,
    body: StaffUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if body.email is not None and not _EMAIL_RE.match(body.email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email format.",
        )
    if body.email is None and body.phone is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of email or phone.",
        )
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM public.staff WHERE id = %s", (staff_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Staff member not found.")
            if body.email is not None:
                cur.execute(
                    "UPDATE public.staff SET email = %s WHERE id = %s",
                    (body.email, staff_id),
                )
            if body.phone is not None:
                cur.execute(
                    "UPDATE public.staff SET phone = %s WHERE id = %s",
                    (body.phone, staff_id),
                )
            conn.commit()
            return _fetch_staff_row(cur, staff_id)
    finally:
        conn.close()


@router.get(
    "/staff/{staff_id}/attendance",
    summary="Get attendance records for a staff member",
)
def get_staff_attendance(
    staff_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM public.staff WHERE id = %s", (staff_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Staff member not found.")
            cur.execute(
                """SELECT id, staff_id, work_date, status
                   FROM public.staff_attendance
                   WHERE staff_id = %s ORDER BY work_date DESC""",
                (staff_id,),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()