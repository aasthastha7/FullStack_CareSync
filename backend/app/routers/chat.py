"""Chat API routes.

Endpoints:
    GET  /chat/{staff_id}   messages between the logged-in user and a colleague
    POST /chat/{staff_id}   send a new message (sender = 'caregiver')
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.database import get_connection
from app.routers.auth import get_current_user

router = APIRouter(tags=["chat"])


# ------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------
class ChatMessageCreate(BaseModel):
    """Body for POST /chat/{staff_id}."""

    text: str = Field(
        ..., min_length=1, max_length=1000, description="Message text (1-1000 chars)"
    )


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@router.get(
    "/chat/{staff_id}",
    summary="Get messages with a colleague",
)
def get_chat_messages(
    staff_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Verify the staff member exists
            cur.execute(
                "SELECT id FROM public.staff WHERE id = %s", (staff_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Staff member not found.")

            cur.execute(
                """SELECT id, user_id, staff_id, sender, text, created_at
                   FROM public.chat_messages
                   WHERE user_id = %s AND staff_id = %s
                   ORDER BY created_at ASC""",
                (current_user["id"], staff_id),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


@router.post(
    "/chat/{staff_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Send a chat message to a colleague",
)
def send_chat_message(
    staff_id: str,
    body: ChatMessageCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Verify the staff member exists
            cur.execute(
                "SELECT id FROM public.staff WHERE id = %s", (staff_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Staff member not found.")

            cur.execute(
                """INSERT INTO public.chat_messages
                       (user_id, staff_id, sender, text)
                   VALUES (%s, %s, 'caregiver', %s)
                   RETURNING id, user_id, staff_id, sender, text, created_at""",
                (current_user["id"], staff_id, body.text),
            )
            row = cur.fetchone()
            conn.commit()
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()