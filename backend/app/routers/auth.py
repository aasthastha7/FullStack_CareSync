"""Authentication routes and Supabase Auth integration.

Endpoints:
    POST /auth/signup   create a Supabase Auth user (metadata drives the
                        database trigger that seeds profile + demo data)
    POST /auth/login    exchange email + password for an access token
    GET  /me            return the logged-in user's row from public.profiles

Security notes:
    * Passwords and access tokens are never logged and never echoed back
      in error messages.
    * Every route except signup/login uses the ``get_current_user``
      dependency (Authorization: Bearer <token>).
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.database import get_connection, redact_password

router = APIRouter(tags=["auth"])

# Swagger UI "Authorize" button: paste the access_token from POST /auth/login.
_bearer = HTTPBearer(auto_error=False)

SUPABASE_TIMEOUT_SECONDS = 10.0
MIN_PASSWORD_LENGTH = 8
DEFAULT_ROLE = "Home Care Assistant"
_EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
_DUPLICATE_EMAIL_DETAIL = (
    "An account with this email already exists. Try logging in instead."
)


# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------
class SignupRequest(BaseModel):
    """Body for POST /auth/signup."""

    email: str = Field(..., pattern=_EMAIL_PATTERN, description="Email address")
    password: str = Field(..., description="At least 8 characters")
    full_name: str = Field(..., min_length=1, description="Full name")
    role: str = Field(default=DEFAULT_ROLE, description="Job role")
    employee_id: str | None = Field(default=None, description="Optional employee id")
    timezone: str | None = Field(default=None, description="IANA timezone, e.g. 'Asia/Kathmandu'")


class LoginRequest(BaseModel):
    """Body for POST /auth/login."""

    email: str = Field(..., pattern=_EMAIL_PATTERN, description="Email address")
    password: str = Field(..., description="Account password")


class UserSummary(BaseModel):
    """Small user object returned by signup/login."""

    id: str | None = None
    email: str | None = None
    full_name: str | None = None


class SignupUser(UserSummary):
    role: str = DEFAULT_ROLE
    employee_id: str | None = None


class SignupResponse(BaseModel):
    message: str
    user: SignupUser


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary


class ProfileOut(BaseModel):
    """Row from public.profiles."""

    id: str
    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    employee_id: str | None = None
    region: str | None = None
    timezone: str | None = None
    created_at: str | None = None


# ------------------------------------------------------------------
# Supabase Auth REST helpers (httpx)
# ------------------------------------------------------------------
class SupabaseAuthError(Exception):
    """Mapped Supabase Auth failure with an HTTP status and safe detail."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _supabase_config() -> tuple[str, str]:
    """Return (base_url, anon_key) from the environment."""
    url = os.getenv("SUPABASE_URL", "").strip()
    if not url:
        raise SupabaseAuthError(500, "SUPABASE_URL is not set on the server.")
    # The publishable key is the modern name for the anon key.
    key = (
        os.getenv("SUPABASE_ANON_KEY", "").strip()
        or os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    )
    if not key:
        raise SupabaseAuthError(500, "Supabase API key is not set on the server.")
    return url.rstrip("/"), key


def _json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _error_detail(payload: dict[str, Any], fallback: str) -> str:
    """Extract a human-readable message from a Supabase error body."""
    for key in ("msg", "message", "error_description", "error"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback


def supabase_sign_up(
    *, email: str, password: str, metadata: dict[str, Any]
) -> dict[str, Any]:
    """Create a user in Supabase Auth.

    ``metadata`` becomes raw_user_meta_data, which the ``handle_new_user``
    database trigger reads to create the profile and starter rows.
    """
    url, key = _supabase_config()
    try:
        response = httpx.post(
            f"{url}/auth/v1/signup",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            json={"email": email, "password": password, "data": metadata},
            timeout=SUPABASE_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise SupabaseAuthError(
            503, "Could not reach the authentication service. Try again later."
        ) from exc

    payload = _json(response)
    if response.status_code in (200, 201):
        user = payload.get("user") or {}
        if user.get("identities") == []:
            # Obfuscated signup response: the email already has an account.
            raise SupabaseAuthError(409, _DUPLICATE_EMAIL_DETAIL)
        return payload
    if response.status_code == 429:
        raise SupabaseAuthError(
            429,
            "Too many signup attempts. Please wait a few minutes and try again.",
        )
    detail = _error_detail(payload, "Could not create the account.")
    if response.status_code in (400, 409, 422):
        if (
            payload.get("error_code") == "email_exists"
            or "already" in detail.lower()
            or "exists" in detail.lower()
        ):
            raise SupabaseAuthError(409, _DUPLICATE_EMAIL_DETAIL)
        raise SupabaseAuthError(400, detail)
    raise SupabaseAuthError(502, detail)


def supabase_sign_in(*, email: str, password: str) -> dict[str, Any]:
    """Exchange email + password for a Supabase session (access token)."""
    url, key = _supabase_config()
    try:
        response = httpx.post(
            f"{url}/auth/v1/token",
            params={"grant_type": "password"},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            json={"email": email, "password": password},
            timeout=SUPABASE_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise SupabaseAuthError(
            503, "Could not reach the authentication service. Try again later."
        ) from exc

    payload = _json(response)
    if response.status_code == 200 and payload.get("access_token"):
        return payload
    detail = _error_detail(payload, "Login failed.")
    if (
        "not confirmed" in detail.lower()
        or payload.get("error_code") == "email_not_confirmed"
    ):
        raise SupabaseAuthError(
            403, "Email not confirmed. Check your inbox, then log in again."
        )
    if response.status_code == 429:
        raise SupabaseAuthError(
            429,
            "Too many login attempts. Please wait a few minutes and try again.",
        )
    if response.status_code in (400, 401, 403):
        raise SupabaseAuthError(401, "Incorrect email or password.")
    raise SupabaseAuthError(502, detail)


def supabase_get_user(access_token: str) -> dict[str, Any]:
    """Verify a bearer token against Supabase and return the auth user."""
    url, key = _supabase_config()
    try:
        response = httpx.get(
            f"{url}/auth/v1/user",
            headers={"apikey": key, "Authorization": f"Bearer {access_token}"},
            timeout=SUPABASE_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise SupabaseAuthError(
            503, "Could not reach the authentication service. Try again later."
        ) from exc

    if response.status_code == 200:
        payload = _json(response)
        if payload.get("id"):
            return payload
    if response.status_code in (401, 403, 404):
        raise SupabaseAuthError(401, "Invalid or expired token.")
    raise SupabaseAuthError(502, "Could not verify the token.")


# ------------------------------------------------------------------
# Database helper
# ------------------------------------------------------------------
def fetch_profile(user_id: str) -> dict[str, Any] | None:
    """Return the public.profiles row for a user, or None if it is missing."""
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    select id, full_name, email, role, employee_id,
                           region, timezone, created_at
                    from public.profiles
                    where id = %s
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()
        finally:
            conn.close()
    except Exception as exc:
        msg = str(exc)
        # If the timezone column doesn't exist yet (migration not applied),
        # retry without it so the app doesn't crash.
        if "timezone" in msg and "does not exist" in msg:
            conn2 = get_connection()
            try:
                with conn2.cursor() as cursor:
                    cursor.execute(
                        """
                        select id, full_name, email, role, employee_id,
                               region, created_at
                        from public.profiles
                        where id = %s
                        """,
                        (user_id,),
                    )
                    row = cursor.fetchone()
            finally:
                conn2.close()
            if row is None:
                return None
            return {
                "id": str(row[0]),
                "full_name": row[1],
                "email": row[2],
                "role": row[3],
                "employee_id": row[4],
                "region": row[5],
                "timezone": "Australia/Sydney",
                "created_at": row[6].isoformat() if row[6] else None,
            }
        raise HTTPException(
            status_code=503, detail=redact_password(msg)
        ) from None
    if row is None:
        return None
    return {
        "id": str(row[0]),
        "full_name": row[1],
        "email": row[2],
        "role": row[3],
        "employee_id": row[4],
        "region": row[5],
        "timezone": row[6],
        "created_at": row[7].isoformat() if row[7] else None,
    }


def ensure_profile(user_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
    """Return the profile row, creating one from *metadata* if it does not exist.

    This makes ``GET /me`` resilient when the database trigger failed or the
    user was created via an older schema that did not seed a profile.
    """
    profile = fetch_profile(user_id)
    if profile is not None:
        return profile

    # Build the row from the token's metadata
    full_name = (metadata.get("full_name") or "").strip() or None
    email = (metadata.get("email") or "").strip() or None
    role = (metadata.get("role") or DEFAULT_ROLE).strip()
    employee_id = (metadata.get("employee_id") or "").strip() or None
    tz = (metadata.get("timezone") or "").strip() or "Australia/Sydney"

    try:
        conn = get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    insert into public.profiles
                        (id, full_name, email, role, employee_id, timezone)
                    values (%s, %s, %s, %s, %s, %s)
                    on conflict (id) do update set
                        full_name   = coalesce(excluded.full_name, public.profiles.full_name),
                        email       = coalesce(excluded.email,     public.profiles.email),
                        role        = coalesce(excluded.role,      public.profiles.role),
                        employee_id = coalesce(excluded.employee_id, public.profiles.employee_id),
                        timezone    = coalesce(excluded.timezone,   public.profiles.timezone)
                    returning id, full_name, email, role, employee_id,
                              region, timezone, created_at
                    """,
                    (user_id, full_name, email, role, employee_id, tz),
                )
                row = cursor.fetchone()
                conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        msg = str(exc)
        # If timezone column doesn't exist, retry without it
        if "timezone" in msg and "does not exist" in msg:
            conn2 = get_connection()
            try:
                with conn2.cursor() as cursor:
                    cursor.execute(
                        """
                        insert into public.profiles
                            (id, full_name, email, role, employee_id)
                        values (%s, %s, %s, %s, %s)
                        on conflict (id) do update set
                            full_name   = coalesce(excluded.full_name, public.profiles.full_name),
                            email       = coalesce(excluded.email,     public.profiles.email),
                            role        = coalesce(excluded.role,      public.profiles.role),
                            employee_id = coalesce(excluded.employee_id, public.profiles.employee_id)
                        returning id, full_name, email, role, employee_id,
                                  region, created_at
                        """,
                        (user_id, full_name, email, role, employee_id),
                    )
                    row = cursor.fetchone()
                    conn2.commit()
            finally:
                conn2.close()
            if row is None:
                raise HTTPException(
                    status_code=500,
                    detail="Could not create or retrieve the user profile.",
                )
            return {
                "id": str(row[0]),
                "full_name": row[1],
                "email": row[2],
                "role": row[3],
                "employee_id": row[4],
                "region": row[5],
                "timezone": "Australia/Sydney",
                "created_at": row[6].isoformat() if row[6] else None,
            }
        raise HTTPException(
            status_code=503, detail=redact_password(msg)
        ) from None

    if row is None:
        raise HTTPException(
            status_code=500,
            detail="Could not create or retrieve the user profile.",
        )
    return {
        "id": str(row[0]),
        "full_name": row[1],
        "email": row[2],
        "role": row[3],
        "employee_id": row[4],
        "region": row[5],
        "timezone": row[6],
        "created_at": row[7].isoformat() if row[7] else None,
    }


# ------------------------------------------------------------------
# Reusable dependency
# ------------------------------------------------------------------
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Verify ``Authorization: Bearer <token>`` against Supabase.

    Returns a small user dict (id, email, full_name). Raises 401 when the
    header is missing or the token is not valid. Every route except /,
    /health, /auth/signup and /auth/login must depend on this.
    """
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not credentials.credentials
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Send 'Authorization: Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user = supabase_get_user(credentials.credentials)
    except SupabaseAuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "full_name": (user.get("user_metadata") or {}).get("full_name"),
    }


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@router.post(
    "/auth/signup",
    status_code=status.HTTP_201_CREATED,
    response_model=SignupResponse,
    summary="Create a new account",
)
def signup(payload: SignupRequest) -> dict[str, Any]:
    if len(payload.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )
    metadata: dict[str, Any] = {
        "full_name": payload.full_name,
        "role": payload.role,
    }
    if payload.employee_id:
        metadata["employee_id"] = payload.employee_id
    if payload.timezone:
        metadata["timezone"] = payload.timezone
    try:
        data = supabase_sign_up(
            email=payload.email, password=payload.password, metadata=metadata
        )
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None

    user = data.get("user") or {}
    if data.get("access_token"):
        message = "Account created. You can now log in."
    else:
        message = (
            "Account created. Check your email to confirm your address, "
            "then log in."
        )
    return {
        "message": message,
        "user": {
            "id": user.get("id"),
            "email": user.get("email") or payload.email,
            "full_name": payload.full_name,
            "role": payload.role,
            "employee_id": payload.employee_id,
        },
    }


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    summary="Log in with email and password",
)
def login(payload: LoginRequest) -> dict[str, Any]:
    try:
        data = supabase_sign_in(email=payload.email, password=payload.password)
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None

    auth_user = data.get("user") or {}
    user_id = auth_user.get("id")
    profile = fetch_profile(user_id) if user_id else None
    full_name = (
        (profile or {}).get("full_name")
        or (auth_user.get("user_metadata") or {}).get("full_name")
        or payload.email.split("@")[0]
    )
    return {
        "access_token": data.get("access_token"),
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": auth_user.get("email") or payload.email,
            "full_name": full_name,
        },
    }


@router.get(
    "/me",
    response_model=ProfileOut,
    summary="Get the logged-in user's profile",
)
def read_me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    # Build metadata from the token so ensure_profile can create a row if
    # the database trigger failed or the profile was never seeded.
    metadata: dict[str, Any] = {
        "full_name": current_user.get("full_name"),
        "email": current_user.get("email"),
    }
    profile = ensure_profile(current_user["id"], metadata)
    return profile