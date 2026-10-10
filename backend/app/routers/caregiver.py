"""Caregiver workflow API routes.

Endpoints (all require login):
    GET    /shifts/current                latest shift with tasks & report
    POST   /shifts/{shift_id}/check-in    mark arrival time
    PATCH  /tasks/{task_id}               set task done / not-done
    PUT    /shifts/{shift_id}/report      save draft vitals & notes
    POST   /shifts/{shift_id}/submit      submit report + shift
    GET    /mood/today                    today's mood check-in if any
    POST   /support-requests              request mental-health day, swap, etc.
    PATCH  /alerts/{alert_id}/read        mark an alert as read
    DELETE /me/data                       clear all personal data (keeps account)
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["caregiver"])

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------
_VALID_REQUEST_TYPES = ("mental_health_day", "shift_swap", "fatigue", "injury")
_NO_NOTE_TYPES = ("mental_health_day", "shift_swap")
_BP_RE = re.compile(r"^\d{2,3}/\d{2,3}$")


# ------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------
class TaskUpdateRequest(BaseModel):
    """Body for PATCH /tasks/{task_id}."""

    done: bool = Field(..., description="Whether the task is completed")


class ReportDraft(BaseModel):
    """Body for PUT /shifts/{shift_id}/report."""

    temp_f: float | None = Field(
        None, ge=90, le=110, description="Temperature in Fahrenheit (90-110)"
    )
    pulse_bpm: int | None = Field(
        None, ge=20, le=250, description="Pulse in BPM (20-250)"
    )
    bp: str | None = Field(
        None, description="Blood pressure as systolic/diastolic, e.g. '120/80'"
    )
    notes: str | None = Field(None, description="Free-text notes")

    @field_validator("bp")
    @classmethod
    def validate_bp(cls, v: str | None) -> str | None:
        if v is not None and v != "" and not _BP_RE.match(v):
            raise ValueError(
                "Blood pressure must look like '120/80' (systolic/diastolic)."
            )
        return v or None


class SupportRequestCreate(BaseModel):
    """Body for POST /support-requests."""

    request_type: str = Field(
        ...,
        description="One of: mental_health_day, shift_swap, fatigue, injury",
    )
    note: str | None = Field(
        None, description="Optional note (ignored for mental_health_day & shift_swap)"
    )
    requested_date: str | None = Field(
        None, description="ISO date (YYYY-MM-DD) for the requested day"
    )
    swap_shift_id: str | None = Field(
        None, description="Shift id the user wants to swap (shift_swap only)"
    )
    swap_with_staff_id: str | None = Field(
        None, description="Staff id of the colleague to swap with (optional)"
    )

    @field_validator("request_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in _VALID_REQUEST_TYPES:
            raise ValueError(
                f"request_type must be one of {', '.join(_VALID_REQUEST_TYPES)}."
            )
        return v


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _row_to_dict(cur, row):
    """Convert a cursor row to a dict keyed by column names."""
    return dict(zip([d[0] for d in cur.description], row)) if row else None


def _rows_to_list(cur, rows):
    """Convert cursor rows to a list of dicts."""
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]


# ------------------------------------------------------------------
# 1. GET /shifts/current
# ------------------------------------------------------------------
def _get_user_timezone(cur, user_id: str) -> str:
    """Return the user's stored timezone, defaulting to Australia/Sydney."""
    try:
        cur.execute(
            "SELECT timezone FROM public.profiles WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
    except Exception:
        pass  # column may not exist yet
    return "Australia/Sydney"


@router.get(
    "/shifts/current",
    summary="Get the user's latest shift with tasks and report",
)
def get_current_shift(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            tz = _get_user_timezone(cur, user_id)
            # Find today's shift in the user's timezone, or the most recent
            cur.execute(
                """SELECT id, patient_name, start_time, end_time, address,
                          task, duration, priority, shift_date,
                          checked_in_at, status
                   FROM public.shifts
                   WHERE user_id = %s
                     AND shift_date = (now() AT TIME ZONE %s)::date
                   ORDER BY start_time
                   LIMIT 1""",
                (user_id, tz),
            )
            shift_row = cur.fetchone()
            if not shift_row:
                # Fallback: latest shift (past or future)
                cur.execute(
                    """SELECT id, patient_name, start_time, end_time, address,
                              task, duration, priority, shift_date,
                              checked_in_at, status
                       FROM public.shifts
                       WHERE user_id = %s
                       ORDER BY shift_date DESC, start_time DESC
                       LIMIT 1""",
                    (user_id,),
                )
                shift_row = cur.fetchone()
            if not shift_row:
                # Create starter shift for new/returning users
                cur.execute(
                    """INSERT INTO public.shifts
                           (user_id, patient_name, start_time, end_time,
                            address, task, duration, priority, shift_date, status)
                       VALUES (%s, 'Eleanor Smith', '09:00', '11:00',
                               '42 Maple Close, Bristol BS4 3HQ',
                               'Morning medication & vitals check',
                               '2 hours', 'Normal',
                               (now() AT TIME ZONE %s)::date, 'scheduled')
                       RETURNING id, patient_name, start_time, end_time, address,
                                 task, duration, priority, shift_date,
                                 checked_in_at, status""",
                    (user_id, tz),
                )
                shift_row = cur.fetchone()
                shift = _row_to_dict(cur, shift_row)
                shift_id = shift["id"]

                # Seed starter tasks
                starter_tasks = [
                    ("Administer Morning Meds", "Lisinopril 10mg, Aspirin 81mg"),
                    ("Check Blood Pressure", None),
                    ("Prepare Breakfast", "Low-sodium diet"),
                    ("Document Vitals & Notes", None),
                ]
                for label, note in starter_tasks:
                    cur.execute(
                        """INSERT INTO public.shift_tasks
                               (shift_id, user_id, label, medication_note, done)
                           VALUES (%s, %s, %s, %s, false)""",
                        (shift_id, user_id, label, note),
                    )

                # Create a draft report
                cur.execute(
                    """INSERT INTO public.shift_reports
                           (shift_id, user_id, status)
                       VALUES (%s, %s, 'draft')
                       RETURNING id, temp_f, pulse_bpm, bp, notes,
                                 status, submitted_at""",
                    (shift_id, user_id),
                )
                shift["report"] = _row_to_dict(cur, cur.fetchone())
                conn.commit()

                # Fetch the tasks we just created
                cur.execute(
                    """SELECT id, label, medication_note, done
                       FROM public.shift_tasks
                       WHERE shift_id = %s AND user_id = %s
                       ORDER BY label""",
                    (shift_id, user_id),
                )
                shift["tasks"] = _rows_to_list(cur, cur.fetchall())
                return shift
            shift = _row_to_dict(cur, shift_row)
            shift_id = shift["id"]

            cur.execute(
                """SELECT id, label, medication_note, done
                   FROM public.shift_tasks
                   WHERE shift_id = %s AND user_id = %s
                   ORDER BY label""",
                (shift_id, user_id),
            )
            shift["tasks"] = _rows_to_list(cur, cur.fetchall())

            cur.execute(
                """SELECT id, temp_f, pulse_bpm, bp, notes,
                          status, submitted_at
                   FROM public.shift_reports
                   WHERE shift_id = %s AND user_id = %s""",
                (shift_id, user_id),
            )
            report_row = cur.fetchone()
            if report_row:
                shift["report"] = _row_to_dict(cur, report_row)
            else:
                cur.execute(
                    """INSERT INTO public.shift_reports
                           (shift_id, user_id, status)
                       VALUES (%s, %s, 'draft')
                       RETURNING id, temp_f, pulse_bpm, bp, notes,
                                 status, submitted_at""",
                    (shift_id, user_id),
                )
                shift["report"] = _row_to_dict(cur, cur.fetchone())
                conn.commit()
            return shift
    finally:
        conn.close()
# ------------------------------------------------------------------
# 2. POST /shifts/{shift_id}/check-in
# ------------------------------------------------------------------
@router.post(
    "/shifts/{shift_id}/check-in",
    status_code=status.HTTP_200_OK,
    summary="Check in to a shift (record arrival time)",
)
def check_in_shift(
    shift_id: str,
    body: dict[str, Any] | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    lat = (body or {}).get("lat")
    lng = (body or {}).get("lng")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, checked_in_at
                   FROM public.shifts
                   WHERE id = %s AND user_id = %s""",
                (shift_id, user_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Shift not found.")
            if row[1] is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Already checked in.",
                )
            cur.execute(
                """UPDATE public.shifts
                   SET checked_in_at = now(),
                       checked_in_lat = %s,
                       checked_in_lng = %s
                   WHERE id = %s AND user_id = %s
                   RETURNING id, checked_in_at, checked_in_lat, checked_in_lng""",
                (lat, lng, shift_id, user_id),
            )
            updated = cur.fetchone()
            conn.commit()
            return _row_to_dict(cur, updated)
    finally:
        conn.close()


# ------------------------------------------------------------------
# 3. PATCH /tasks/{task_id}
# ------------------------------------------------------------------
@router.patch("/tasks/{task_id}", summary="Mark a task done or not-done")
def update_task(
    task_id: str,
    body: TaskUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.shift_tasks
                   SET done = %s
                   WHERE id = %s AND user_id = %s
                   RETURNING id, label, medication_note, done""",
                (body.done, task_id, current_user["id"]),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Task not found.")
            conn.commit()
            return _row_to_dict(cur, row)
    finally:
        conn.close()


# ------------------------------------------------------------------
# 4. PUT /shifts/{shift_id}/report
# ------------------------------------------------------------------
@router.put("/shifts/{shift_id}/report", summary="Save a draft shift report")
def save_report_draft(
    shift_id: str,
    body: ReportDraft,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM public.shifts WHERE id = %s AND user_id = %s",
                (shift_id, user_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Shift not found.")
            cur.execute(
                """INSERT INTO public.shift_reports
                       (shift_id, user_id, temp_f, pulse_bpm, bp, notes, status)
                   VALUES (%s, %s, %s, %s, %s, %s, 'draft')
                   ON CONFLICT (shift_id) DO UPDATE SET
                       temp_f    = EXCLUDED.temp_f,
                       pulse_bpm = EXCLUDED.pulse_bpm,
                       bp        = EXCLUDED.bp,
                       notes     = EXCLUDED.notes
                   RETURNING id, temp_f, pulse_bpm, bp, notes,
                             status, submitted_at""",
                (shift_id, user_id, body.temp_f, body.pulse_bpm,
                 body.bp, body.notes),
            )
            row = cur.fetchone()
            conn.commit()
            return _row_to_dict(cur, row)
    finally:
        conn.close()
# ------------------------------------------------------------------
# 5. POST /shifts/{shift_id}/submit
# ------------------------------------------------------------------
@router.post(
    "/shifts/{shift_id}/submit",
    summary="Submit the shift report and mark shift as submitted",
)
def submit_shift(
    shift_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM public.shifts WHERE id = %s AND user_id = %s",
                (shift_id, user_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Shift not found.")
            cur.execute(
                """UPDATE public.shift_reports
                   SET status = 'submitted', submitted_at = now()
                   WHERE shift_id = %s AND user_id = %s
                   RETURNING id, temp_f, pulse_bpm, bp, notes,
                             status, submitted_at""",
                (shift_id, user_id),
            )
            report_row = cur.fetchone()
            if not report_row:
                raise HTTPException(
                    status_code=400,
                    detail="No report found. Save a report before submitting.",
                )
            # Convert immediately while cur.description is still valid
            # (the next execute has no RETURNING and would clear it)
            report = _row_to_dict(cur, report_row)
            cur.execute(
                "UPDATE public.shifts SET status = 'submitted' WHERE id = %s",
                (shift_id,),
            )
            conn.commit()
            return report
    finally:
        conn.close()


# ------------------------------------------------------------------
# 6. GET /mood/today
# ------------------------------------------------------------------
@router.get("/mood/today", summary="Get today's mood check-in if any")
def get_todays_mood(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            tz = _get_user_timezone(cur, current_user["id"])
            cur.execute(
                """SELECT id, mood, created_at
                   FROM public.mood_checkins
                   WHERE user_id = %s
                     AND created_at::date = (now() AT TIME ZONE %s)::date
                   ORDER BY created_at DESC LIMIT 1""",
                (current_user["id"], tz),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=404, detail="No mood check-in today."
                )
            return _row_to_dict(cur, row)
    finally:
        conn.close()


# ------------------------------------------------------------------
# 7. POST /support-requests
# ------------------------------------------------------------------
@router.post(
    "/support-requests",
    status_code=status.HTTP_201_CREATED,
    summary="Create a support or wellbeing request",
)
def create_support_request(
    body: SupportRequestCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    note = None if body.request_type in _NO_NOTE_TYPES else body.note
    # Only pass swap fields for shift_swap requests
    req_date = body.requested_date if body.request_type in ("mental_health_day", "shift_swap") else None
    swap_shift = body.swap_shift_id if body.request_type == "shift_swap" else None
    swap_staff = body.swap_with_staff_id if body.request_type == "shift_swap" else None
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.support_requests
                       (user_id, request_type, note, status,
                        requested_date, swap_shift_id, swap_with_staff_id)
                   VALUES (%s, %s, %s, 'pending', %s, %s, %s)
                   RETURNING id, request_type, note, status, requested_date,
                             swap_shift_id, swap_with_staff_id, created_at""",
                (current_user["id"], body.request_type, note,
                 req_date, swap_shift, swap_staff),
            )
            row = cur.fetchone()
            # Convert immediately while cur.description is still valid
            # (the next execute has no RETURNING and would clear it)
            result = _row_to_dict(cur, row)
            # Create an alert so the user sees "Request received"
            type_labels = {
                "mental_health_day": "Mental Health Day",
                "shift_swap": "Shift Swap",
                "fatigue": "Fatigue Report",
                "injury": "Injury Report",
            }
            label = type_labels.get(body.request_type, body.request_type)
            cur.execute(
                """INSERT INTO public.alerts (user_id, icon, title, body, is_read)
                   VALUES (%s, 'calendar', %s, %s, false)""",
                (current_user["id"],
                 "Request received",
                 f"Your {label} request has been received and is pending review."),
            )
            conn.commit()
            return result
    finally:
        conn.close()


# ------------------------------------------------------------------
# 8. GET /support-requests
# ------------------------------------------------------------------
@router.get(
    "/support-requests",
    summary="List the current user's support requests",
)
def list_support_requests(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, request_type, note, status,
                          requested_date, swap_shift_id, swap_with_staff_id,
                          decided_at, created_at
                   FROM public.support_requests
                   WHERE user_id = %s
                   ORDER BY created_at DESC""",
                (current_user["id"],),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


# ------------------------------------------------------------------
# 9. PATCH /support-requests/{request_id}/cancel
# ------------------------------------------------------------------
@router.patch(
    "/support-requests/{request_id}/cancel",
    summary="Cancel a pending support request",
)
def cancel_support_request(
    request_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.support_requests
                   SET status = 'declined', decided_at = now()
                   WHERE id = %s AND user_id = %s AND status = 'pending'
                   RETURNING id, request_type, note, status,
                             requested_date, swap_shift_id, swap_with_staff_id,
                             decided_at, created_at""",
                (request_id, current_user["id"]),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(
                    status_code=404,
                    detail="Request not found or not in pending status.",
                )
            conn.commit()
            return _row_to_dict(cur, row)
    finally:
        conn.close()


# ------------------------------------------------------------------
# 10. PATCH /alerts/{alert_id}/read
# ------------------------------------------------------------------
@router.patch("/alerts/{alert_id}/read", summary="Mark an alert as read")
def mark_alert_read(
    alert_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.alerts
                   SET is_read = true
                   WHERE id = %s AND user_id = %s
                   RETURNING id, icon, title, body, is_read, created_at""",
                (alert_id, current_user["id"]),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Alert not found.")
            conn.commit()
            return _row_to_dict(cur, row)
    finally:
        conn.close()


# ------------------------------------------------------------------
# 9. DELETE /me/data
# ------------------------------------------------------------------
@router.delete("/me/data", summary="Clear all personal data (keeps the account)")
def delete_my_data(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM public.shift_reports WHERE user_id = %s",
                (user_id,),
            )
            reports = cur.rowcount
            cur.execute(
                "DELETE FROM public.mood_checkins WHERE user_id = %s",
                (user_id,),
            )
            moods = cur.rowcount
            cur.execute(
                "DELETE FROM public.support_requests WHERE user_id = %s",
                (user_id,),
            )
            requests_count = cur.rowcount
            cur.execute(
                "DELETE FROM public.chat_messages WHERE user_id = %s",
                (user_id,),
            )
            chats = cur.rowcount
            conn.commit()
            return {
                "ok": True,
                "deleted": {
                    "shift_reports": reports,
                    "mood_checkins": moods,
                    "support_requests": requests_count,
                    "chat_messages": chats,
                },
            }
    finally:
        conn.close()