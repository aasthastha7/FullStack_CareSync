"""Support contacts API routes.

Endpoints:
    GET /support-contacts   list crisis/support phone numbers
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.database import get_connection

router = APIRouter(tags=["support-contacts"])


@router.get(
    "/support-contacts",
    summary="List support / crisis phone numbers",
)
def list_support_contacts() -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, label, phone, description, is_crisis
                   FROM public.support_contacts
                   ORDER BY created_at"""
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()