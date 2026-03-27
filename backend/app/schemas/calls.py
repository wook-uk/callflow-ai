from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class CallCreateResponse(BaseModel):
    id: str
    status: str
    message: str


class TranscriptSegment(BaseModel):
    speaker: str
    text: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None


class InsightsData(BaseModel):
    summary: Optional[str] = None
    sentiment: Optional[str] = None
    action_items: Optional[List[str]] = None
    key_topics: Optional[List[str]] = None
    next_steps: Optional[str] = None
    deal_stage: Optional[str] = None
    objections: Optional[List[str]] = None
    crm_fields: Optional[Dict[str, Any]] = None


class CallDetailResponse(BaseModel):
    id: str
    title: Optional[str] = None
    status: str
    duration: Optional[int] = None
    file_url: Optional[str] = None
    transcript: Optional[List[TranscriptSegment]] = None
    insights: Optional[InsightsData] = None
    crm_synced: bool = False
    crm_sync_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CallListItem(BaseModel):
    id: str
    title: Optional[str] = None
    status: str
    duration: Optional[int] = None
    crm_synced: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CallListResponse(BaseModel):
    calls: List[CallListItem]
    total: int
    page: int
    per_page: int


class CRMApplyRequest(BaseModel):
    call_id: str
    fields: Optional[Dict[str, Any]] = None


class CRMApplyResponse(BaseModel):
    success: bool
    message: str
    crm_record_id: Optional[str] = None
