"""
Auth API — /api/v1/auth
  POST /signup      — email + password registration
  POST /login       — credential login → JWT
  POST /google      — Google OAuth token exchange
  GET  /me          — current user profile
  POST /refresh     — token refresh (sliding window)
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token, get_current_user,
    hash_password, verify_password,
)
from app.core.database import get_db
from app.models.models import User, Workspace, WorkspaceMember, WorkspaceRole, WorkspaceSettings

router = APIRouter()


# ── Schemas ───────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    workspace_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str  # Google ID token from frontend


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    workspace: dict | None = None


# ── Helpers ───────────────────────────────────

def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "is_verified": user.is_verified,
    }


def _workspace_dict(ws: Workspace) -> dict:
    return {
        "id": str(ws.id),
        "name": ws.name,
        "slug": ws.slug,
        "plan_tier": ws.plan_tier.value if ws.plan_tier else "starter",
        "monthly_minutes_limit": ws.monthly_minutes_limit,
        "monthly_minutes_used": ws.monthly_minutes_used,
    }


async def _create_workspace_for_user(
    db: AsyncSession,
    user: User,
    workspace_name: str,
) -> Workspace:
    """Create a workspace, make the user admin, add default settings"""
    import re, uuid

    slug_base = re.sub(r"[^a-z0-9]+", "-", workspace_name.lower()).strip("-")[:50]
    # Ensure uniqueness by appending short UUID suffix
    slug = f"{slug_base}-{str(uuid.uuid4())[:6]}"

    ws = Workspace(name=workspace_name, slug=slug)
    db.add(ws)
    await db.flush()  # Get ID before creating FK records

    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        role=WorkspaceRole.admin,
    )
    db.add(member)

    settings_row = WorkspaceSettings(workspace_id=ws.id)
    db.add(settings_row)

    await db.flush()
    return ws


# ── Endpoints ─────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    workspace = await _create_workspace_for_user(db, user, req.workspace_name)
    await db.commit()
    await db.refresh(user)
    await db.refresh(workspace)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user=_user_dict(user),
        workspace=_workspace_dict(workspace),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # Fetch workspace
    ws_result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
        .limit(1)
    )
    workspace = ws_result.scalar_one_or_none()

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user=_user_dict(user),
        workspace=_workspace_dict(workspace) if workspace else None,
    )


@router.post("/google", response_model=TokenResponse)
async def google_auth(req: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify Google ID token and create/find user.
    Frontend sends the token obtained from Google Sign-In.
    """
    import httpx

    # Verify token with Google's tokeninfo endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": req.id_token},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        google_data = resp.json()

    email = google_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email not available from Google")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        # First-time Google login — create user + workspace
        user = User(
            email=email,
            full_name=google_data.get("name"),
            avatar_url=google_data.get("picture"),
            is_verified=True,  # Google email is pre-verified
        )
        db.add(user)
        await db.flush()

        company = google_data.get("hd") or email.split("@")[1].split(".")[0].title()
        workspace = await _create_workspace_for_user(db, user, f"{company} Workspace")
        await db.commit()
        await db.refresh(workspace)
    else:
        ws_result = await db.execute(
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user.id)
            .limit(1)
        )
        workspace = ws_result.scalar_one_or_none()

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user=_user_dict(user),
        workspace=_workspace_dict(workspace) if workspace else None,
    )


@router.get("/me")
async def get_me(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ws_result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .limit(1)
    )
    workspace = ws_result.scalar_one_or_none()

    return {
        "user": _user_dict(current_user),
        "workspace": _workspace_dict(workspace) if workspace else None,
    }
