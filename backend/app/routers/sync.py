"""Sync API routes — handles shift completion and wellbeing request submissions.

Endpoints:
    POST /sync/shift      submit shift data (tasks, vitals, notes)
    POST /sync/wellbeing  submit a wellbeing request (mental-health / shift-swap)
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["sync"])


@router.post("/sync/shift", summary="Submit shift completion data")
def sync_shift(
    body: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Accepts shift completion data: shift_id, tasks, vitals, notes.
    Returns a success summary."""
    shift_id = body.get("shift_id")
    if not shift_id:
        raise HTTPException(status_code=400, detail="shift_id is required.")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Verify shift belongs to user
            cur.execute(
                """SELECT id, patient_name FROM public.shifts
                   WHERE id = %s AND user_id = %s""",
                (shift_id, current_user["id"]),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Shift not found.")

            patient_name = row[1]

            # Save report if vitals/notes provided
            vitals = body.get("vitals", {})
            notes = body.get("notes", "")
            submit = body.get("submit", True)
            report_status = "submitted" if submit else "draft"

            cur.execute(
                """INSERT INTO public.shift_reports
                       (shift_id, user_id, temp_f, pulse_bpm, bp, notes, status, submitted_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s, CASE WHEN %s THEN now() ELSE NULL END)
                   ON CONFLICT (shift_id) DO UPDATE SET
                       temp_f=EXCLUDED.temp_f, pulse_bpm=EXCLUDED.pulse_bpm,
                       bp=EXCLUDED.bp, notes=EXCLUDED.notes, status=EXCLUDED.status,
                       submitted_at=CASE WHEN EXCLUDED.status='submitted' THEN now()
                                         ELSE public.shift_reports.submitted_at END""",
                (
                    shift_id, current_user["id"],
                    vitals.get("temp") or None,
                    int(vitals["pulse"]) if vitals.get("pulse") else None,
                    vitals.get("bp") or None,
                    notes or None,
                    report_status,
                    submit,
                ),
            )

            # Mark shift as submitted
            if submit:
                cur.execute(
                    "UPDATE public.shifts SET status = 'submitted' WHERE id = %s",
                    (shift_id,),
                )
            conn.commit()

            return {
                "ok": True,
                "message": f"Shift for {patient_name} submitted successfully.",
                "shift_id": shift_id,
            }
    finally:
        conn.close()


@router.post("/sync/wellbeing", summary="Submit a wellbeing request")
def sync_wellbeing(
    body: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    wellbeing_type = body.get("type")
    if wellbeing_type not in ("mental-health", "shift-swap"):
        raise HTTPException(status_code=400, detail="Invalid wellbeing type.")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.support_requests (user_id, request_type, status)
                   VALUES (%s, %s, 'pending')
                   RETURNING id, request_type, status, created_at""",
                (current_user["id"], wellbeing_type),
            )
            row = cur.fetchone()
            conn.commit()
            cols = [d[0] for d in cur.description]
            result = dict(zip(cols, row))
            result["ok"] = True
            label = "Mental Health Day" if wellbeing_type == "mental-health" else "Shift Swap"
            result["message"] = f"{label} request submitted successfully."
            return result
    finally:
        conn.close()