"""
Database models - SQLAlchemy async ORM
All tables use UUID primary keys and soft deletes
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON, Enum as SAEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(AsyncAttrs, DeclarativeBase):
    pass


def gen_uuid():
    return str(uuid.uuid4())


# ──────────────────────────────────────────────
# ENUMS
# ──────────────────────────────────────────────

class WorkspaceRole(str, Enum):
    admin = "admin"
    member = "member"


class CallStatus(str, Enum):
    uploading = "uploading"
    transcribing = "transcribing"
    analyzing = "analyzing"
    crm_syncing = "crm_syncing"
    completed = "completed"
    failed = "failed"


class CRMProvider(str, Enum):
    hubspot = "hubspot"
    pipedrive = "pipedrive"
    salesforce = "salesforce"


class PlanTier(str, Enum):
    starter = "starter"
    pro = "pro"


class SentimentScore(str, Enum):
    very_positive = "very_positive"
    positive = "positive"
    neutral = "neutral"
    negative = "negative"
    very_negative = "very_negative"


# ──────────────────────────────────────────────
# WORKSPACE
# ──────────────────────────────────────────────

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    slug = Column(String(100), unique=True, nullable=False)
    logo_url = Column(String(500), nullable=True)
    plan_tier = Column(SAEnum(PlanTier), default=PlanTier.starter)
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    monthly_minutes_limit = Column(Integer, default=6000)  # 100hrs for starter
    monthly_minutes_used = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    members = relationship("WorkspaceMember", back_populates="workspace")
    calls = relationship("Call", back_populates="workspace")
    integrations = relationship("Integration", back_populates="workspace")
    settings = relationship("WorkspaceSettings", back_populates="workspace", uselist=False)


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(SAEnum(WorkspaceRole), default=WorkspaceRole.member)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="memberships")

    __table_args__ = (
        Index("idx_workspace_member", "workspace_id", "user_id", unique=True),
    )


class WorkspaceSettings(Base):
    """Per-workspace configuration for call detection, CRM sync behavior, etc."""
    __tablename__ = "workspace_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True)
    call_detection_keywords = Column(ARRAY(String), default=["demo", "call", "meeting", "discovery"])
    auto_crm_sync = Column(Boolean, default=False)  # False = review mode
    crm_provider = Column(SAEnum(CRMProvider), nullable=True)
    sales_framework = Column(String(20), default="BANT")  # BANT or MEDDIC
    followup_email_enabled = Column(Boolean, default=True)
    data_retention_days = Column(Integer, default=90)

    workspace = relationship("Workspace", back_populates="settings")


# ──────────────────────────────────────────────
# USER
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)  # Null for SSO users
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    memberships = relationship("WorkspaceMember", back_populates="user")
    calls = relationship("Call", back_populates="owner")


# ──────────────────────────────────────────────
# CALL (core entity)
# ──────────────────────────────────────────────

class Call(Base):
    __tablename__ = "calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)

    # Metadata
    title = Column(String(500), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_company = Column(String(255), nullable=True)
    attendees = Column(JSON, default=list)  # [{name, email, role}]
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # File storage
    audio_s3_key = Column(String(500), nullable=True)
    audio_file_size_bytes = Column(Integer, nullable=True)

    # Processing
    status = Column(SAEnum(CallStatus), default=CallStatus.uploading, index=True)
    error_message = Column(Text, nullable=True)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="calls")
    owner = relationship("User", back_populates="calls")
    transcript = relationship("Transcript", back_populates="call", uselist=False)
    insights = relationship("CallInsights", back_populates="call", uselist=False)
    crm_sync = relationship("CRMSync", back_populates="call", uselist=False)

    __table_args__ = (
        Index("idx_calls_workspace_status", "workspace_id", "status"),
        Index("idx_calls_created", "workspace_id", "created_at"),
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), unique=True)
    full_text = Column(Text, nullable=False)
    segments = Column(JSON, default=list)  # [{start, end, speaker, text}]
    word_count = Column(Integer, nullable=True)
    language = Column(String(10), default="en")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    call = relationship("Call", back_populates="transcript")


class CallInsights(Base):
    """Structured LLM output - the core value of CallFlow AI"""
    __tablename__ = "call_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), unique=True)

    # Summary
    meeting_summary = Column(Text, nullable=True)
    sentiment = Column(SAEnum(SentimentScore), nullable=True)
    sentiment_reasoning = Column(Text, nullable=True)

    # BANT / MEDDIC fields
    budget = Column(Text, nullable=True)
    authority = Column(JSON, nullable=True)      # [{name, role, influence}]
    need = Column(JSON, nullable=True)           # list of pain points
    timeline = Column(Text, nullable=True)
    customer_goals = Column(JSON, nullable=True) # list
    competitors_mentioned = Column(JSON, nullable=True)  # list
    objections = Column(JSON, nullable=True)     # [{category, description}]
    decision_makers = Column(JSON, nullable=True)

    # Actions
    next_actions_internal = Column(JSON, nullable=True)  # [{action, owner, due_date}]
    next_actions_external = Column(JSON, nullable=True)
    email_followup_subject = Column(String(500), nullable=True)
    email_followup_body = Column(Text, nullable=True)

    # Tags
    tags = Column(ARRAY(String), default=list)  # auto-detected: pricing, competitor, etc.

    # Raw LLM output (for debugging / re-processing)
    raw_llm_response = Column(JSON, nullable=True)
    llm_model = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    call = relationship("Call", back_populates="insights")


# ──────────────────────────────────────────────
# CRM SYNC
# ──────────────────────────────────────────────

class CRMSync(Base):
    __tablename__ = "crm_syncs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), unique=True)
    provider = Column(SAEnum(CRMProvider), nullable=False)

    # Matched CRM objects
    contact_id = Column(String(100), nullable=True)
    company_id = Column(String(100), nullable=True)
    deal_id = Column(String(100), nullable=True)

    # What was synced
    note_id = Column(String(100), nullable=True)
    task_ids = Column(JSON, default=list)  # list of created task IDs
    deal_stage_before = Column(String(100), nullable=True)
    deal_stage_after = Column(String(100), nullable=True)

    # Status
    synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_error = Column(Text, nullable=True)
    is_applied = Column(Boolean, default=False)  # False until user clicks "Apply"

    call = relationship("Call", back_populates="crm_sync")


# ──────────────────────────────────────────────
# INTEGRATIONS (OAuth tokens)
# ──────────────────────────────────────────────

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    provider = Column(String(50), nullable=False)  # hubspot, google, zoom

    access_token = Column(Text, nullable=True)   # Encrypted in practice
    refresh_token = Column(Text, nullable=True)  # Encrypted in practice
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    scope = Column(String(500), nullable=True)
    external_account_id = Column(String(200), nullable=True)
    external_account_email = Column(String(255), nullable=True)
    meta = Column(JSON, default=dict)  # Provider-specific data

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="integrations")

    __table_args__ = (
        Index("idx_integration_workspace_provider", "workspace_id", "provider", unique=True),
    )
