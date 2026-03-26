"""
CallProcessingService — orchestrates the full pipeline:
  1. Download audio from S3
  2. Transcribe via Whisper
  3. Analyze with GPT-4o (BANT/MEDDIC extraction)
  4. Store results
  5. Optionally sync to CRM
"""
import json
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

import httpx
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import Call, CallStatus, Transcript, CallInsights
from app.services.storage import StorageService
from app.integrations.hubspot.client import HubSpotClient

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# SYSTEM PROMPT for GPT-4o
# ──────────────────────────────────────────────
SALES_ANALYSIS_SYSTEM_PROMPT = """
You are an elite B2B sales analyst. Your job is to extract structured intelligence
from sales call transcripts to help reps spend less time on admin and more time closing.

You will receive:
- A transcript of a sales call (with optional speaker labels and timestamps)
- Meeting metadata (attendees, company, deal context from CRM if available)

Return a single valid JSON object — no markdown, no code fences, no commentary —
matching EXACTLY the schema below. If a field cannot be determined from the transcript,
use null for strings, [] for arrays.

Schema:
{
  "meeting_summary": "5-8 sentences covering what was discussed, decisions made, and overall outcome",
  "sentiment": "very_positive|positive|neutral|negative|very_negative",
  "sentiment_reasoning": "1-2 sentences explaining the score",
  "budget": "What budget was mentioned or implied. null if unknown",
  "authority": [{"name": "...", "role": "...", "influence": "decision_maker|influencer|champion|blocker"}],
  "need": ["list of specific business pains and problems the prospect mentioned"],
  "timeline": "When they plan to decide or implement. null if unknown",
  "customer_goals": ["list of stated or implied goals"],
  "competitors_mentioned": ["list of competitor names mentioned"],
  "objections": [{"category": "price|feature|timing|trust|resources|process", "description": "..."}],
  "decision_makers": [{"name": "...", "role": "...", "not_on_call": true|false}],
  "next_actions_internal": [{"action": "...", "owner": "...", "due_days": 3}],
  "next_actions_external": [{"action": "...", "target_person": "...", "due_days": 7}],
  "email_followup_subject": "Concise, specific subject line",
  "email_followup_body": "Professional follow-up email body. 150-200 words. Use [FIRST_NAME] placeholder.",
  "tags": ["pricing", "competitor", "technical", "executive", "champion", "at_risk"]
}

BANT assessment guidance:
- Budget: explicit number, range, or signal (e.g. "we have headcount budget")
- Authority: who signs? Who can block?
- Need: be specific — not "they need a solution" but "they need to reduce CAC below $150"
- Timeline: fiscal quarter, specific month, or dependency (e.g. "after board approval in Q2")
"""


class CallProcessingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.storage = StorageService()

    async def process_call(self, call_id: UUID) -> None:
        """Full async pipeline: transcribe → analyze → store"""
        call = await self._get_call(call_id)
        if not call:
            logger.error(f"Call {call_id} not found")
            return

        try:
            # Step 1: Transcribe
            await self._update_status(call, CallStatus.transcribing)
            transcript_data = await self._transcribe(call)

            # Step 2: Analyze
            await self._update_status(call, CallStatus.analyzing)
            insights_data = await self._analyze(call, transcript_data)

            # Step 3: Persist
            await self._save_results(call, transcript_data, insights_data)

            await self._update_status(call, CallStatus.completed)
            call.processing_completed_at = datetime.utcnow()
            await self.db.commit()

            logger.info(f"Call {call_id} processed successfully")

        except Exception as e:
            logger.exception(f"Failed to process call {call_id}: {e}")
            call.status = CallStatus.failed
            call.error_message = str(e)
            await self.db.commit()
            raise

    async def _transcribe(self, call: Call) -> dict:
        """Download audio from S3, send to Whisper API"""
        logger.info(f"Transcribing call {call.id} (s3_key={call.audio_s3_key})")

        audio_bytes = await self.storage.download(call.audio_s3_key)

        # Whisper API call
        response = await self.openai.audio.transcriptions.create(
            model=settings.WHISPER_MODEL,
            file=("audio.mp3", audio_bytes, "audio/mpeg"),
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

        # Build structured segments
        segments = []
        for seg in (response.segments or []):
            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
                "speaker": None,  # Whisper doesn't do diarization natively
            })

        return {
            "full_text": response.text,
            "segments": segments,
            "language": response.language or "en",
            "word_count": len(response.text.split()),
        }

    async def _analyze(self, call: Call, transcript_data: dict) -> dict:
        """Send transcript to GPT-4o for structured sales analysis"""
        logger.info(f"Analyzing call {call.id}")

        attendees_str = ""
        if call.attendees:
            attendees_str = "Attendees: " + ", ".join(
                f"{a.get('name', 'Unknown')} ({a.get('role', '')})"
                for a in call.attendees
            )

        user_message = f"""
Meeting title: {call.title or 'Sales Call'}
Customer: {call.customer_name or 'Unknown'} at {call.customer_company or 'Unknown Company'}
{attendees_str}
Duration: {(call.duration_seconds or 0) // 60} minutes

TRANSCRIPT:
{transcript_data['full_text']}
""".strip()

        response = await self.openai.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SALES_ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,  # Low temperature for consistent structured output
            response_format={"type": "json_object"},
            max_tokens=2000,
        )

        raw_content = response.choices[0].message.content
        parsed = json.loads(raw_content)
        parsed["_raw"] = raw_content
        parsed["_model"] = settings.OPENAI_MODEL

        return parsed

    async def _save_results(
        self,
        call: Call,
        transcript_data: dict,
        insights_data: dict,
    ) -> None:
        """Persist transcript and insights to database"""
        # Upsert transcript
        transcript = Transcript(
            call_id=call.id,
            full_text=transcript_data["full_text"],
            segments=transcript_data["segments"],
            word_count=transcript_data["word_count"],
            language=transcript_data["language"],
        )
        self.db.add(transcript)

        # Upsert insights
        insights = CallInsights(
            call_id=call.id,
            meeting_summary=insights_data.get("meeting_summary"),
            sentiment=insights_data.get("sentiment"),
            sentiment_reasoning=insights_data.get("sentiment_reasoning"),
            budget=insights_data.get("budget"),
            authority=insights_data.get("authority"),
            need=insights_data.get("need"),
            timeline=insights_data.get("timeline"),
            customer_goals=insights_data.get("customer_goals"),
            competitors_mentioned=insights_data.get("competitors_mentioned"),
            objections=insights_data.get("objections"),
            decision_makers=insights_data.get("decision_makers"),
            next_actions_internal=insights_data.get("next_actions_internal"),
            next_actions_external=insights_data.get("next_actions_external"),
            email_followup_subject=insights_data.get("email_followup_subject"),
            email_followup_body=insights_data.get("email_followup_body"),
            tags=insights_data.get("tags", []),
            raw_llm_response=json.loads(insights_data.get("_raw", "{}")),
            llm_model=insights_data.get("_model"),
        )
        self.db.add(insights)

        # Update call duration from transcript if not set
        if not call.duration_seconds and transcript_data["segments"]:
            last_seg = transcript_data["segments"][-1]
            call.duration_seconds = int(last_seg.get("end", 0))

        await self.db.flush()

    async def _update_status(self, call: Call, status: CallStatus) -> None:
        call.status = status
        if status == CallStatus.transcribing:
            call.processing_started_at = datetime.utcnow()
        await self.db.commit()

    async def _get_call(self, call_id: UUID) -> Optional[Call]:
        from sqlalchemy import select
        result = await self.db.execute(
            select(Call).where(Call.id == call_id)
        )
        return result.scalar_one_or_none()
