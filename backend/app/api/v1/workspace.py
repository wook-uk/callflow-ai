"""
Workspace API — /api/v1/workspace
  GET    /              — workspace info + usage
  PATCH  /              — update workspace name/logo
  GET    /settings      — call detection + CRM settings
  PATCH  /settings      — update settings
  GET    /members       — list team members
  POST   /invite        — invite by email
  DELETE /members/{id}  — remove member
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.models import (
    Workspace, WorkspaceMember, WorkspaceSettings,
    WorkspaceRole, User, CRMProvider,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────

class WorkspaceUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None


class SettingsUpdate(BaseModel):
    call_detection_keywords: list[str] | None = None
    auto_crm_sync: bool | None = None
    crm_provider: str | None = None
    sales_framework: str | None = None
    followup_email_enabled: bool | None = None
    data_retention_days: int | None = None


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "member"


# ── Helpers ───────────────────────────────────

async def _get_workspace_and_settings(db: AsyncSession, user_id):
    ws_result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .limit(1)
    )
    ws = ws_result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, "Workspace not found")

    s_result = await db.execute(
        select(WorkspaceSettings).where(WorkspaceSettings.workspace_id == ws.id)
    )
    settings = s_result.scalar_one_or_none()
    return ws, settings


# ── Endpoints ─────────────────────────────────

@router.get("")
async def get_workspace(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ws, _ = await _get_workspace_and_settings(db, current_user.id)
    return {
        "id": str(ws.id),
        "name": ws.name,
        "slug": ws.slug,
        "logo_url": ws.logo_url,
        "plan_tier": ws.plan_tier.value if ws.plan_tier else "starter",
        "monthly_minutes_limit": ws.monthly_minutes_limit,
        "monthly_minutes_used": ws.monthly_minutes_used,
        "is_active": ws.is_active,
        "created_at": ws.created_at.isoformat(),
    }


@router.patch("")
async def update_workspace(
    body: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    ws, _ = await _get_workspace_and_settings(db, current_user.id)
    if body.name is not None:
        ws.name = body.name
    if body.logo_url is not None:
        ws.logo_url = body.logo_url
    await db.commit()
    return {"updated": True}


@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _, settings = await _get_workspace_and_settings(db, current_user.id)
    if not settings:
        raise HTTPException(404, "Settings not initialized")
    return {
        "call_detection_keywords": settings.call_detection_keywords or [],
        "auto_crm_sync": settings.auto_crm_sync,
        "crm_provider": settings.crm_provider.value if settings.crm_provider else None,
        "sales_framework": settings.sales_framework,
        "followup_email_enabled": settings.followup_email_enabled,
        "data_retention_days": settings.data_retention_days,
    }


@router.patch("/settings")
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    _, settings = await _get_workspace_and_settings(db, current_user.id)
    if not settings:
        raise HTTPException(404, "Settings not initialized")

    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        if key == "crm_provider" and value:
            try:
                value = CRMProvider(value)
            except ValueError:
                raise HTTPException(400, f"Invalid CRM provider: {value}")
        setattr(settings, key, value)

    await db.commit()
    return {"updated": True}


@router.get("/members")
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ws, _ = await _get_workspace_and_settings(db, current_user.id)

    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == ws.id)
    )
    rows = result.all()

    return [
        {
            "id": str(member.id),
            "user_id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "role": member.role.value,
            "joined_at": member.joined_at.isoformat(),
        }
        for member, user in rows
    ]


@router.post("/invite")
async def invite_member(
    body: InviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """
    Invite a user to the workspace.
    If user exists → add them directly.
    If not → send invite email (TODO: integrate SendGrid/Resend).
    """
    ws, _ = await _get_workspace_and_settings(db, current_user.id)

    # Check if already a member
    user_result = await db.execute(select(User).where(User.email == body.email))
    existing_user = user_result.scalar_one_or_none()

    if existing_user:
        # Check not already in workspace
        member_check = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == ws.id,
                WorkspaceMember.user_id == existing_user.id,
            )
        )
        if member_check.scalar_one_or_none():
            raise HTTPException(409, "User is already a member")

        try:
            role = WorkspaceRole(body.role)
        except ValueError:
            role = WorkspaceRole.member

        member = WorkspaceMember(
            workspace_id=ws.id,
            user_id=existing_user.id,
            role=role,
        )
        db.add(member)
        await db.commit()
        return {"status": "added", "email": body.email}
    else:
        # TODO: Send invite email via Resend/SendGrid
        # For now, return a placeholder
        logger.info(f"Invite email would be sent to {body.email} for workspace {ws.id}")
        return {"status": "invited", "email": body.email, "note": "Invite email queued"}


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    ws, _ = await _get_workspace_and_settings(db, current_user.id)

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == ws.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found")

    # Cannot remove yourself if you're the only admin
    if str(member.user_id) == str(current_user.id):
        raise HTTPException(400, "Cannot remove yourself from workspace")

    await db.delete(member)
    await db.commit()
    return {"removed": True}
