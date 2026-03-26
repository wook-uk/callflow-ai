"""
HubSpot API Client
Handles contact/company/deal lookup and note/task creation
"""
import logging
from typing import Optional
from datetime import datetime, timedelta

import httpx

logger = logging.getLogger(__name__)

HUBSPOT_BASE = "https://api.hubapi.com"


class HubSpotClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._client = httpx.AsyncClient(
            base_url=HUBSPOT_BASE,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self._client.aclose()

    # ──────────────────────────────────────────────
    # MATCHING: Find the right CRM objects for a call
    # ──────────────────────────────────────────────

    async def find_contact_by_email(self, email: str) -> Optional[dict]:
        """Look up a contact by email address"""
        resp = await self._client.post(
            "/crm/v3/objects/contacts/search",
            json={
                "filterGroups": [{
                    "filters": [{
                        "propertyName": "email",
                        "operator": "EQ",
                        "value": email,
                    }]
                }],
                "properties": ["firstname", "lastname", "email", "company", "jobtitle"],
                "limit": 1,
            }
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return results[0] if results else None

    async def find_open_deal_for_contact(self, contact_id: str) -> Optional[dict]:
        """Find the most recently active open deal associated with a contact"""
        resp = await self._client.get(
            f"/crm/v3/objects/contacts/{contact_id}/associations/deals",
        )
        resp.raise_for_status()
        associations = resp.json().get("results", [])
        if not associations:
            return None

        # Fetch deals and find the latest open one
        deal_ids = [a["id"] for a in associations]
        deals = []
        for deal_id in deal_ids[:5]:  # Check last 5 deals max
            deal_resp = await self._client.get(
                f"/crm/v3/objects/deals/{deal_id}",
                params={"properties": "dealname,dealstage,closedate,amount,pipeline,hs_lastmodifieddate"}
            )
            if deal_resp.status_code == 200:
                deal = deal_resp.json()
                if deal.get("properties", {}).get("dealstage") not in ["closedwon", "closedlost"]:
                    deals.append(deal)

        if not deals:
            return None

        # Sort by last modified
        deals.sort(
            key=lambda d: d.get("properties", {}).get("hs_lastmodifieddate", ""),
            reverse=True
        )
        return deals[0]

    # ──────────────────────────────────────────────
    # WRITE: Create notes, tasks, update deals
    # ──────────────────────────────────────────────

    async def create_note(
        self,
        body: str,
        contact_id: Optional[str] = None,
        company_id: Optional[str] = None,
        deal_id: Optional[str] = None,
    ) -> dict:
        """Create a call note and associate it with CRM objects"""
        associations = []
        if contact_id:
            associations.append({
                "to": {"id": contact_id},
                "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 202}]
            })
        if deal_id:
            associations.append({
                "to": {"id": deal_id},
                "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 214}]
            })

        payload = {
            "properties": {
                "hs_note_body": body,
                "hs_timestamp": str(int(datetime.utcnow().timestamp() * 1000)),
            },
            "associations": associations,
        }

        resp = await self._client.post("/crm/v3/objects/notes", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def create_task(
        self,
        subject: str,
        body: str,
        due_date: datetime,
        owner_id: Optional[str] = None,
        contact_id: Optional[str] = None,
        deal_id: Optional[str] = None,
    ) -> dict:
        """Create a follow-up task"""
        associations = []
        if contact_id:
            associations.append({
                "to": {"id": contact_id},
                "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 204}]
            })
        if deal_id:
            associations.append({
                "to": {"id": deal_id},
                "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 216}]
            })

        payload = {
            "properties": {
                "hs_task_subject": subject,
                "hs_task_body": body,
                "hs_timestamp": str(int(due_date.timestamp() * 1000)),
                "hs_task_status": "NOT_STARTED",
                "hs_task_priority": "MEDIUM",
                **({"hubspot_owner_id": owner_id} if owner_id else {}),
            },
            "associations": associations,
        }

        resp = await self._client.post("/crm/v3/objects/tasks", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def update_deal_stage(self, deal_id: str, stage: str) -> dict:
        """Move a deal to a new pipeline stage"""
        resp = await self._client.patch(
            f"/crm/v3/objects/deals/{deal_id}",
            json={"properties": {"dealstage": stage}},
        )
        resp.raise_for_status()
        return resp.json()

    async def get_pipeline_stages(self, pipeline_id: str = "default") -> list[dict]:
        """Get all stages for a pipeline"""
        resp = await self._client.get(
            f"/crm/v3/pipelines/deals/{pipeline_id}/stages"
        )
        resp.raise_for_status()
        return resp.json().get("results", [])


class HubSpotSyncService:
    """
    Orchestrates the full HubSpot sync for a completed call.
    Called after insights are generated.
    """

    def __init__(self, access_token: str):
        self.client = HubSpotClient(access_token)

    async def sync_call(
        self,
        attendee_emails: list[str],
        summary: str,
        actions_internal: list[dict],
        actions_external: list[dict],
        deal_stage_suggestion: Optional[str] = None,
    ) -> dict:
        """Main entry: match CRM objects and create note + tasks"""
        async with self.client:
            contact = None
            deal = None

            # Try to match a contact from attendee emails
            for email in attendee_emails:
                contact = await self.client.find_contact_by_email(email)
                if contact:
                    break

            contact_id = contact["id"] if contact else None
            deal_id = None

            if contact_id:
                deal = await self.client.find_open_deal_for_contact(contact_id)
                if deal:
                    deal_id = deal["id"]

            # Create note
            note = await self.client.create_note(
                body=f"[CallFlow AI Summary]\n\n{summary}",
                contact_id=contact_id,
                deal_id=deal_id,
            )

            # Create tasks
            task_ids = []
            all_actions = [
                *[{"action": a["action"], "days": a.get("due_days", 3), "type": "internal"}
                  for a in (actions_internal or [])],
                *[{"action": a["action"], "days": a.get("due_days", 7), "type": "external"}
                  for a in (actions_external or [])],
            ]

            for action in all_actions[:10]:  # Max 10 tasks per call
                due = datetime.utcnow() + timedelta(days=action["days"])
                label = "[Internal] " if action["type"] == "internal" else "[Follow-up] "
                task = await self.client.create_task(
                    subject=label + action["action"][:100],
                    body=action["action"],
                    due_date=due,
                    contact_id=contact_id,
                    deal_id=deal_id,
                )
                task_ids.append(task["id"])

            return {
                "contact_id": contact_id,
                "deal_id": deal_id,
                "note_id": note["id"],
                "task_ids": task_ids,
                "deal_stage_before": deal.get("properties", {}).get("dealstage") if deal else None,
            }
