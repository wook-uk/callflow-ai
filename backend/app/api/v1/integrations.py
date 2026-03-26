"""
Integrations API — /api/v1/integrations
  GET  /                      — list workspace integrations
  GET  /hubspot/oauth-url     — start HubSpot OAuth
  POST /hubspot/connect       — exchange code for tokens
  DELETE /hubspot             — disconnect
  GET  /google/oauth-url      — start Google Calendar OAuth
  POST /google/connect        — exchange code for tokens
  DELETE /google              — disconnect
"""
import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Integration, Workspace, WorkspaceMember

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────

async def _get_workspace(db, user_id) -> Workspace:
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .limit(1)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


async def _upsert_integration(
    db: AsyncSession,
    workspace_id,
    user_id,
    provider: str,
    access_token: str,
    refresh_token: str | None,
    expires_at,
    scope: str | None,
    ext_id: str | None,
    ext_email: str | None,
    meta: dict | None = None,
) -> Integration:
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == provider,
        )
    )
    integration = result.scalar_one_or_none()

    if integration:
        integration.access_token = access_token
        integration.refresh_token = refresh_token or integration.refresh_token
        integration.token_expires_at = expires_at
        integration.scope = scope
        integration.external_account_id = ext_id
        integration.external_account_email = ext_email
        integration.meta = meta or {}
        integration.is_active = True
    else:
        integration = Integration(
            workspace_id=workspace_id,
            user_id=user_id,
            provider=provider,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=expires_at,
            scope=scope,
            external_account_id=ext_id,
            external_account_email=ext_email,
            meta=meta or {},
        )
        db.add(integration)

    await db.commit()
    return integration


# ── List integrations ─────────────────────────

@router.get("")
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ws = await _get_workspace(db, current_user.id)
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == ws.id,
            Integration.is_active == True,
        )
    )
    integrations = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "provider": i.provider,
            "external_account_email": i.external_account_email,
            "is_active": i.is_active,
            "created_at": i.created_at.isoformat(),
        }
        for i in integrations
    ]


# ── HubSpot ───────────────────────────────────

HUBSPOT_SCOPES = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.companies.read",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "crm.objects.notes.write",
    "crm.objects.tasks.write",
]


@router.get("/hubspot/oauth-url")
async def hubspot_oauth_url(current_user=Depends(get_current_user)):
    params = {
        "client_id": settings.HUBSPOT_CLIENT_ID,
        "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
        "scope": " ".join(HUBSPOT_SCOPES),
        "response_type": "code",
    }
    url = "https://app.hubspot.com/oauth/authorize?" + urlencode(params)
    return {"oauth_url": url}


class OAuthCodeRequest(BaseModel):
    code: str


@router.post("/hubspot/connect")
async def hubspot_connect(
    req: OAuthCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://api.hubapi.com/oauth/v1/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.HUBSPOT_CLIENT_ID,
                "client_secret": settings.HUBSPOT_CLIENT_SECRET,
                "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
                "code": req.code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(400, f"HubSpot token exchange failed: {token_resp.text}")
        tokens = token_resp.json()

        # Fetch HubSpot portal info
        info_resp = await client.get(
            "https://api.hubapi.com/oauth/v1/access-tokens/" + tokens["access_token"]
        )
        info = info_resp.json() if info_resp.status_code == 200 else {}

    from datetime import datetime, timedelta, timezone
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 1800))

    ws = await _get_workspace(db, current_user.id)
    await _upsert_integration(
        db=db,
        workspace_id=ws.id,
        user_id=current_user.id,
        provider="hubspot",
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        expires_at=expires_at,
        scope=tokens.get("scope"),
        ext_id=str(info.get("hub_id", "")),
        ext_email=info.get("user"),
        meta={"hub_domain": info.get("hub_domain"), "hub_id": info.get("hub_id")},
    )

    # Update workspace settings to reflect HubSpot as CRM
    from app.models.models import WorkspaceSettings, CRMProvider
    settings_result = await db.execute(
        select(WorkspaceSettings).where(WorkspaceSettings.workspace_id == ws.id)
    )
    ws_settings = settings_result.scalar_one_or_none()
    if ws_settings:
        ws_settings.crm_provider = CRMProvider.hubspot
        await db.commit()

    return {"status": "connected", "account": info.get("user")}


@router.delete("/hubspot")
async def hubspot_disconnect(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ws = await _get_workspace(db, current_user.id)
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == ws.id,
            Integration.provider == "hubspot",
        )
    )
    integration = result.scalar_one_or_none()
    if integration:
        integration.is_active = False
        await db.commit()
    return {"status": "disconnected"}


# ── Google Calendar ───────────────────────────

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]


@router.get("/google/oauth-url")
async def google_oauth_url(current_user=Depends(get_current_user)):
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return {"oauth_url": url}


@router.post("/google/connect")
async def google_connect(
    req: OAuthCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": req.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(400, f"Google token exchange failed: {token_resp.text}")
        tokens = token_resp.json()

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo = userinfo_resp.json() if userinfo_resp.status_code == 200 else {}

    from datetime import datetime, timedelta, timezone
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))

    ws = await _get_workspace(db, current_user.id)
    await _upsert_integration(
        db=db,
        workspace_id=ws.id,
        user_id=current_user.id,
        provider="google",
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        expires_at=expires_at,
        scope=tokens.get("scope"),
        ext_id=userinfo.get("sub"),
        ext_email=userinfo.get("email"),
    )

    return {"status": "connected", "account": userinfo.get("email")}
