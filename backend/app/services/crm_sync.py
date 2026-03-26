"""
CRMSyncService
Reads insights from DB → writes to HubSpot/Pipedrive
Called by the Celery sync_to_crm task after the user clicks "Apply"
or automatically if auto_crm_sync is enabled.
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Call, CallInsights, CRMSync, Integration, Workspace,
    WorkspaceMember, WorkspaceSettings, CRMProvider,
)

logger = logging.getLogger(__name__)


class CRMSyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def sync_call(self, call_id: UUID, workspace_id: UUID) -> dict:
        """
        Full sync pipeline:
        1. Load call + insights from DB
        2. Get active CRM integration token
        3. Send to appropriate CRM client
        4. Persist sync record
        """
        call = await self._get_call(call_id)
        insights = await self._get_insights(call_id)
        settings = await self._get_settings(workspace_id)

        if not insights:
            raise ValueError(f"No insights found for call {call_id}")

        crm_provider = settings.crm_provider if settings else None
        if not crm_provider:
            raise ValueError("No CRM provider configured for this workspace")

        token = await self._get_token(workspace_id, crm_provider)
        if not token:
            raise ValueError(f"No active {crm_provider.value} integration found")

        # Build attendee email list for contact matching
        attendee_emails = [
            a.get("email") for a in (call.attendees or [])
            if a.get("email")
        ]

        result = {}

        if crm_provider == CRMProvider.hubspot:
            result = await self._sync_hubspot(
                token=token,
                call=call,
                insights=insights,
                attendee_emails=attendee_emails,
            )
        elif crm_provider == CRMProvider.pipedrive:
            # Pipedrive support — structure is similar, different API endpoints
            logger.warning("Pipedrive sync not yet implemented")
            raise NotImplementedError("Pipedrive sync coming soon")

        # Persist CRM sync record
        await self._save_crm_sync(call_id, crm_provider, result)
        return result

    # ── HubSpot ───────────────────────────────

    async def _sync_hubspot(
        self,
        token: str,
        call: Call,
        insights: CallInsights,
        attendee_emails: list[str],
    ) -> dict:
        from integrations.hubspot.client import HubSpotSyncService

        # Format summary note for HubSpot
        note_parts = [
            f"[CallFlow AI — {datetime.now(timezone.utc).strftime('%b %d, %Y')}]",
            "",
            insights.meeting_summary or "No summary available.",
            "",
        ]

        if insights.need:
            note_parts.append("**Pain Points:**")
            note_parts.extend(f"  • {n}" for n in (insights.need or [])[:5])
            note_parts.append("")

        if insights.objections:
            note_parts.append("**Objections:**")
            note_parts.extend(
                f"  • [{o.get('category', '?')}] {o.get('description', '')}"
                for o in (insights.objections or [])[:5]
            )
            note_parts.append("")

        if insights.budget:
            note_parts.append(f"**Budget:** {insights.budget}")
        if insights.timeline:
            note_parts.append(f"**Timeline:** {insights.timeline}")

        note_body = "\n".join(note_parts)

        svc = HubSpotSyncService(token)
        return await svc.sync_call(
            attendee_emails=attendee_emails,
            summary=note_body,
            actions_internal=insights.next_actions_internal or [],
            actions_external=insights.next_actions_external or [],
        )

    # ── Persistence ───────────────────────────

    async def _save_crm_sync(
        self,
        call_id: UUID,
        provider: CRMProvider,
        result: dict,
    ) -> None:
        # Upsert — idempotent on re-sync
        existing = await self.db.execute(
            select(CRMSync).where(CRMSync.call_id == call_id)
        )
        sync = existing.scalar_one_or_none()

        if sync:
            sync.note_id = result.get("note_id")
            sync.task_ids = result.get("task_ids", [])
            sync.contact_id = result.get("contact_id")
            sync.deal_id = result.get("deal_id")
            sync.synced_at = datetime.now(timezone.utc)
            sync.is_applied = True
            sync.sync_error = None
        else:
            sync = CRMSync(
                call_id=call_id,
                provider=provider,
                contact_id=result.get("contact_id"),
                deal_id=result.get("deal_id"),
                note_id=result.get("note_id"),
                task_ids=result.get("task_ids", []),
                deal_stage_before=result.get("deal_stage_before"),
                synced_at=datetime.now(timezone.utc),
                is_applied=True,
            )
            self.db.add(sync)

        await self.db.commit()

    # ── DB helpers ────────────────────────────

    async def _get_call(self, call_id: UUID) -> Call:
        result = await self.db.execute(select(Call).where(Call.id == call_id))
        call = result.scalar_one_or_none()
        if not call:
            raise ValueError(f"Call {call_id} not found")
        return call

    async def _get_insights(self, call_id: UUID) -> CallInsights | None:
        result = await self.db.execute(
            select(CallInsights).where(CallInsights.call_id == call_id)
        )
        return result.scalar_one_or_none()

    async def _get_settings(self, workspace_id: UUID) -> WorkspaceSettings | None:
        result = await self.db.execute(
            select(WorkspaceSettings).where(WorkspaceSettings.workspace_id == workspace_id)
        )
        return result.scalar_one_or_none()

    async def _get_token(self, workspace_id: UUID, provider: CRMProvider) -> str | None:
        result = await self.db.execute(
            select(Integration).where(
                Integration.workspace_id == workspace_id,
                Integration.provider == provider.value,
                Integration.is_active == True,
            )
        )
        integration = result.scalar_one_or_none()
        if not integration:
            return None

        # Refresh token if expired
        if integration.token_expires_at:
            from datetime import timedelta
            if integration.token_expires_at < datetime.now(timezone.utc) + timedelta(minutes=5):
                refreshed = await self._refresh_token(integration)
                if refreshed:
                    return refreshed

        return integration.access_token

    async def _refresh_token(self, integration: Integration) -> str | None:
        """Refresh expired OAuth tokens"""
        if not integration.refresh_token:
            return None

        from app.core.config import settings as app_settings
        import httpx
        from datetime import timedelta, timezone

        try:
            if integration.provider == "hubspot":
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.hubapi.com/oauth/v1/token",
                        data={
                            "grant_type": "refresh_token",
                            "client_id": app_settings.HUBSPOT_CLIENT_ID,
                            "client_secret": app_settings.HUBSPOT_CLIENT_SECRET,
                            "refresh_token": integration.refresh_token,
                        },
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )
                    if resp.status_code == 200:
                        tokens = resp.json()
                        integration.access_token = tokens["access_token"]
                        integration.refresh_token = tokens.get("refresh_token", integration.refresh_token)
                        integration.token_expires_at = (
                            datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 1800))
                        )
                        await self.db.commit()
                        return integration.access_token

        except Exception as e:
            logger.error(f"Token refresh failed for integration {integration.id}: {e}")

        return None
