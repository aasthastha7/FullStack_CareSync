"""Alerts API routes.

Endpoints:
    GET /alerts   list alerts for the logged-in user
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["alerts"])


@router.get("/alerts", summary="List alerts for the logged-in user")
def list_alerts(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, icon, title, body, is_read, created_at
                   FROM public.alerts
                   WHERE user_id = %s
                   ORDER BY created_at DESC
                   LIMIT 20""",
                (current_user["id"],),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()