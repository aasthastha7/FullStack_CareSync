"""CareSync FastAPI backend entry point.

Run from the backend folder:
    python -m uvicorn app.main:app --reload

Interactive docs: http://127.0.0.1:8000/docs
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import get_connection, redact_password
from app.routers.auth import router as auth_router
from app.routers.caregiver import router as caregiver_router
from app.routers.shifts import router as shifts_router
from app.routers.staff import router as staff_router
from app.routers.alerts import router as alerts_router
from app.routers.mood import router as mood_router
from app.routers.sync import router as sync_router
from app.routers.chat import router as chat_router
from app.routers.support_contacts import router as support_contacts_router

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")

DEFAULT_ORIGINS = ["http://localhost:5173"]


def get_allowed_origins() -> list[str]:
    """Parse ALLOWED_ORIGINS (comma-separated) for the CORS middleware."""
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or DEFAULT_ORIGINS


app = FastAPI(
    title="CareSync API",
    description="Backend API for the CareSync home-care application.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes in app/routers/auth.py: /auth/signup, /auth/login, /me
# All routes are prefixed with /api so the Vite proxy can forward them.
app.include_router(auth_router, prefix="/api")
app.include_router(caregiver_router, prefix="/api")
app.include_router(shifts_router, prefix="/api")
app.include_router(staff_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(mood_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(support_contacts_router, prefix="/api")


@app.get("/")
def root() -> dict:
    """Service info."""
    return {
        "message": "CareSync API is running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    """Health check that also verifies the database connection."""
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001 - report any failure as unhealthy
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": redact_password(str(exc)),
            },
        )
    return {"status": "healthy", "database": "connected"}