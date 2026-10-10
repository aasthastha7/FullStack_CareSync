"""Shifts API routes.

Endpoints:
    GET  /shifts             list shifts for the logged-in user
    GET  /shifts/{shift_id}  get a single shift with tasks and report
    POST /shifts/{shift_id}/tasks/{task_id}/toggle   flip a task's done flag
    POST /shifts/{shift_id}/report   save / submit vitals + notes
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["shifts"])


def _fetch_shifts(user_id: str, shift_date: str | None = None) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if shift_date:
                cur.execute(
                    """SELECT id, patient_name, start_time, end_time, address,
                              task, duration, priority, shift_date, checked_in_at, status
                       FROM public.shifts
                       WHERE user_id = %s AND shift_date = %s
                       ORDER BY start_time""",
                    (user_id, shift_date),
                )
            else:
                cur.execute(
                    """SELECT id, patient_name, start_time, end_time, address,
                              task, duration, priority, shift_date, checked_in_at, status
                       FROM public.shifts
                       WHERE user_id = %s
                       ORDER BY shift_date DESC, start_time
                       LIMIT 20""",
                    (user_id,),
                )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def _fetch_shift(shift_id: str, user_id: str) -> dict[str, Any] | None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, patient_name, start_time, end_time, address,
                          task, duration, priority, shift_date, checked_in_at, status
                   FROM public.shifts
                   WHERE id = %s AND user_id = %s""",
                (shift_id, user_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            shift = dict(zip(cols, row))

            cur.execute(
                """SELECT id, label, medication_note, done
                   FROM public.shift_tasks
                   WHERE shift_id = %s AND user_id = %s ORDER BY label""",
                (shift_id, user_id),
            )
            task_cols = [d[0] for d in cur.description]
            shift["tasks"] = [dict(zip(task_cols, r)) for r in cur.fetchall()]

            cur.execute(
                """SELECT id, temp_f, pulse_bpm, bp, notes, status, submitted_at
                   FROM public.shift_reports
                   WHERE shift_id = %s AND user_id = %s""",
                (shift_id, user_id),
            )
            rpt = cur.fetchone()
            shift["report"] = (
                dict(zip([d[0] for d in cur.description], rpt)) if rpt else None
            )
            return shift
    finally:
        conn.close()


@router.get("/shifts", summary="List shifts for the logged-in user")
def list_shifts(
    shift_date: str | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return _fetch_shifts(current_user["id"], shift_date)


@router.get("/shifts/upcoming", summary="List upcoming shifts (today or later)")
def list_upcoming_shifts(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Read user's timezone from profile
            try:
                cur.execute(
                    "SELECT timezone FROM public.profiles WHERE id = %s",
                    (current_user["id"],),
                )
                tz_row = cur.fetchone()
                tz = tz_row[0] if tz_row and tz_row[0] else "Australia/Sydney"
            except Exception:
                tz = "Australia/Sydney"

            cur.execute(
                """SELECT id, patient_name, start_time, end_time, address,
                          task, duration, priority, shift_date, checked_in_at, status
                   FROM public.shifts
                   WHERE user_id = %s
                     AND shift_date >= (now() AT TIME ZONE %s)::date
                   ORDER BY shift_date ASC, start_time
                   LIMIT 10""",
                (current_user["id"], tz),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


@router.get("/shifts/{shift_id}", summary="Get a single shift with tasks and report")
def get_shift(
    shift_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    shift = _fetch_shift(shift_id, current_user["id"])
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found.")
    return shift


@router.post("/shifts/{shift_id}/tasks/{task_id}/toggle", summary="Toggle a task")
def toggle_task(
    shift_id: str,
    task_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.shift_tasks SET done = NOT done
                   WHERE id = %s AND shift_id = %s AND user_id = %s
                   RETURNING id, label, medication_note, done""",
                (task_id, shift_id, current_user["id"]),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Task not found.")
            conn.commit()
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()


@router.post("/shifts/{shift_id}/report", summary="Save or submit shift report")
def save_report(
    shift_id: str,
    body: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM public.shifts WHERE id = %s AND user_id = %s",
                (shift_id, current_user["id"]),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Shift not found.")
            submit = body.get("submit", False)
            report_status = "submitted" if submit else "draft"
            cur.execute(
                """INSERT INTO public.shift_reports
                       (shift_id, user_id, temp_f, pulse_bpm, bp, notes, status, submitted_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s, CASE WHEN %s THEN now() ELSE NULL END)
                   ON CONFLICT (shift_id) DO UPDATE SET
                       temp_f=EXCLUDED.temp_f, pulse_bpm=EXCLUDED.pulse_bpm,
                       bp=EXCLUDED.bp, notes=EXCLUDED.notes, status=EXCLUDED.status,
                       submitted_at=CASE WHEN EXCLUDED.status='submitted' THEN now()
                                         ELSE public.shift_reports.submitted_at END
                   RETURNING id, temp_f, pulse_bpm, bp, notes, status, submitted_at""",
                (shift_id, current_user["id"], body.get("temp_f"),
                 body.get("pulse_bpm"), body.get("bp"), body.get("notes"),
                 report_status, submit),
            )
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            result = dict(zip(cols, row))
            if submit:
                cur.execute(
                    "UPDATE public.shifts SET status='submitted' WHERE id=%s",
                    (shift_id,),
                )
            conn.commit()
            return result
    finally:
        conn.close()