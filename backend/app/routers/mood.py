"""Mood check-in API routes.

Endpoints:
    POST /mood   save a mood check-in
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["mood"])


@router.post("/mood", summary="Save a mood check-in")
def save_mood(
    body: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    mood = body.get("mood")
    if mood not in ("Rough", "Okay", "Good", "Great"):
        raise HTTPException(status_code=400, detail="Invalid mood value.")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.mood_checkins (user_id, mood)
                   VALUES (%s, %s)
                   RETURNING id, mood, created_at""",
                (current_user["id"], mood),
            )
            row = cur.fetchone()
            conn.commit()
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()