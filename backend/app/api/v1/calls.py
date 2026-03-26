"""
Calls API Router
Handles file upload, status polling, CRM apply actions
"""
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.models import Call, CallStatus, CallInsights, Transcript, Workspace
from app.schemas.calls import (
    CallCreateResponse, CallDetailResponse, CallListResponse,
    CRMApplyRequest, CRMApplyResponse,
)
from app.services.storage import StorageService
from workers.tasks import process_call, sync_to_crm

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB


# ──────────────────────────────────────────────
# UPLOAD
# ──────────────────────────────────────────────

@router.post("/upload", response_model=CallCreateResponse, status_code=201)
async def upload_call(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    customer_name: str = Form(default=""),
    customer_company: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Upload an audio file (mp3/mp4/m4a/wav/webm) and kick off async processing.
    Returns immediately with a call_id for status polling.
    """
    # Validate file type
    allowed = {"audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm",
               "video/mp4", "video/webm"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Supported: mp3, mp4, m4a, wav, webm"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 500 MB)")

    # Get workspace (assume first workspace for now — in prod, from header)
    workspace = await _get_user_workspace(db, current_user.id)

    # Check usage quota
    limit_bytes_remaining = workspace.monthly_minutes_limit - workspace.monthly_minutes_used
    if limit_bytes_remaining <= 0:
        raise HTTPException(status_code=429, detail="Monthly call processing limit reached")

    # Upload to S3/R2
    storage = StorageService()
    s3_key = f"recordings/{workspace.id}/{uuid.uuid4()}/{file.filename}"
    await storage.upload(s3_key, content, content_type=file.content_type)

    # Create Call record
    call = Call(
        workspace_id=workspace.id,
        owner_id=current_user.id,
        title=title or file.filename,
        customer_name=customer_name or None,
        customer_company=customer_company or None,
        audio_s3_key=s3_key,
        audio_file_size_bytes=len(content),
        status=CallStatus.uploading,
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    # Enqueue Celery task
    process_call.delay(str(call.id))
    logger.info(f"Call {call.id} queued for processing")

    return CallCreateResponse(
        id=str(call.id),
        status=call.status.value,
        title=call.title,
        created_at=call.created_at.isoformat(),
    )


# ──────────────────────────────────────────────
# LIST
# ──────────────────────────────────────────────

@router.get("", response_model=CallListResponse)
async def list_calls(
    limit: int = 20,
    offset: int = 0,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    workspace = await _get_user_workspace(db, current_user.id)

    q = select(Call).where(Call.workspace_id == workspace.id)
    if status_filter:
        try:
            q = q.where(Call.status == CallStatus(status_filter))
        except ValueError:
            pass

    q = q.order_by(Call.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    calls = result.scalars().all()

    return CallListResponse(
        calls=[_serialize_call_summary(c) for c in calls],
        total=len(calls),
        offset=offset,
        limit=limit,
    )


# ──────────────────────────────────────────────
# DETAIL
# ──────────────────────────────────────────────

@router.get("/{call_id}", response_model=CallDetailResponse)
async def get_call(
    call_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    call = await _get_call_or_404(db, call_id, current_user)

    transcript = None
    insights = None
    crm_sync = None

    if call.status == CallStatus.completed:
        t_result = await db.execute(select(Transcript).where(Transcript.call_id == call.id))
        transcript = t_result.scalar_one_or_none()

        i_result = await db.execute(select(CallInsights).where(CallInsights.call_id == call.id))
        insights = i_result.scalar_one_or_none()

    return CallDetailResponse(
        id=str(call.id),
        title=call.title,
        status=call.status.value,
        customer_name=call.customer_name,
        customer_company=call.customer_company,
        duration_seconds=call.duration_seconds,
        created_at=call.created_at.isoformat(),
        transcript=_serialize_transcript(transcript) if transcript else None,
        insights=_serialize_insights(insights) if insights else None,
        crm_sync=_serialize_crm_sync(crm_sync) if crm_sync else None,
    )


# ──────────────────────────────────────────────
# STATUS POLLING (lightweight)
# ──────────────────────────────────────────────

@router.get("/{call_id}/status")
async def get_call_status(
    call_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    call = await _get_call_or_404(db, call_id, current_user)
    return {
        "id": str(call.id),
        "status": call.status.value,
        "error": call.error_message,
        "processing_started_at": call.processing_started_at.isoformat() if call.processing_started_at else None,
        "processing_completed_at": call.processing_completed_at.isoformat() if call.processing_completed_at else None,
    }


# ──────────────────────────────────────────────
# CRM APPLY
# ──────────────────────────────────────────────

@router.post("/{call_id}/apply-to-crm", response_model=CRMApplyResponse)
async def apply_to_crm(
    call_id: str,
    request: CRMApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    User clicks 'Apply to HubSpot' — kicks off CRM sync task.
    """
    call = await _get_call_or_404(db, call_id, current_user)

    if call.status != CallStatus.completed:
        raise HTTPException(status_code=400, detail="Call processing not yet complete")

    workspace = await _get_user_workspace(db, current_user.id)

    sync_to_crm.delay(str(call.id), str(workspace.id))

    return CRMApplyResponse(
        message="CRM sync started. Results will appear within 30 seconds.",
        call_id=call_id,
    )


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

async def _get_user_workspace(db: AsyncSession, user_id) -> Workspace:
    from app.models.models import WorkspaceMember
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .limit(1)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="No workspace found")
    return workspace


async def _get_call_or_404(db: AsyncSession, call_id: str, current_user) -> Call:
    workspace = await _get_user_workspace(db, current_user.id)
    result = await db.execute(
        select(Call).where(
            Call.id == call_id,
            Call.workspace_id == workspace.id,
        )
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


def _serialize_call_summary(call: Call) -> dict:
    return {
        "id": str(call.id),
        "title": call.title,
        "customer_name": call.customer_name,
        "customer_company": call.customer_company,
        "status": call.status.value,
        "duration_seconds": call.duration_seconds,
        "created_at": call.created_at.isoformat(),
    }


def _serialize_transcript(t) -> dict | None:
    if not t:
        return None
    return {
        "full_text": t.full_text,
        "segments": t.segments,
        "word_count": t.word_count,
        "language": t.language,
    }


def _serialize_insights(i) -> dict | None:
    if not i:
        return None
    return {
        "meeting_summary": i.meeting_summary,
        "sentiment": i.sentiment.value if i.sentiment else None,
        "sentiment_reasoning": i.sentiment_reasoning,
        "budget": i.budget,
        "authority": i.authority,
        "need": i.need,
        "timeline": i.timeline,
        "customer_goals": i.customer_goals,
        "competitors_mentioned": i.competitors_mentioned,
        "objections": i.objections,
        "decision_makers": i.decision_makers,
        "next_actions_internal": i.next_actions_internal,
        "next_actions_external": i.next_actions_external,
        "email_followup_subject": i.email_followup_subject,
        "email_followup_body": i.email_followup_body,
        "tags": i.tags or [],
    }


def _serialize_crm_sync(s) -> dict | None:
    if not s:
        return None
    return {
        "provider": s.provider.value,
        "contact_id": s.contact_id,
        "deal_id": s.deal_id,
        "is_applied": s.is_applied,
        "synced_at": s.synced_at.isoformat() if s.synced_at else None,
    }
