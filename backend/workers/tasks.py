"""
Celery workers for async background processing
Tasks are enqueued after file upload and processed independently
"""
import asyncio
import logging
from uuid import UUID

from celery import Celery
from celery.utils.log import get_task_logger

from app.core.config import settings

logger = get_task_logger(__name__)

celery_app = Celery(
    "callflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,              # Ack after processing (vs at pickup)
    worker_prefetch_multiplier=1,     # Don't pre-fetch — calls are heavy
    task_soft_time_limit=540,         # 9 min soft limit
    task_time_limit=600,              # 10 min hard kill
    task_routes={
        "workers.tasks.process_call": {"queue": "calls"},
        "workers.tasks.sync_to_crm": {"queue": "crm"},
    },
    beat_schedule={
        # Retry stuck calls every 15 minutes
        "retry-stuck-calls": {
            "task": "workers.tasks.retry_stuck_calls",
            "schedule": 900.0,
        },
        # Reset monthly usage counter on 1st of month
        "reset-monthly-usage": {
            "task": "workers.tasks.reset_monthly_usage",
            "schedule": {"minute": 0, "hour": 0, "day_of_month": 1},
        },
    },
)


def run_async(coro):
    """Run an async coroutine from a sync Celery task"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    name="workers.tasks.process_call",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def process_call(self, call_id: str):
    """
    Main call processing pipeline:
    transcribe → analyze → save → (optionally sync CRM)
    """
    logger.info(f"Starting call processing: {call_id}")

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.services.call_processing import CallProcessingService

        async with AsyncSessionLocal() as db:
            service = CallProcessingService(db)
            await service.process_call(UUID(call_id))

    run_async(_run())
    logger.info(f"Call processing complete: {call_id}")


@celery_app.task(
    bind=True,
    name="workers.tasks.sync_to_crm",
    max_retries=3,
    default_retry_delay=30,
)
def sync_to_crm(self, call_id: str, workspace_id: str):
    """Apply generated insights to the connected CRM"""
    logger.info(f"Starting CRM sync for call: {call_id}")

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.services.crm_sync import CRMSyncService

        async with AsyncSessionLocal() as db:
            service = CRMSyncService(db)
            await service.sync_call(UUID(call_id), UUID(workspace_id))

    run_async(_run())


@celery_app.task(name="workers.tasks.retry_stuck_calls")
def retry_stuck_calls():
    """Find calls stuck in processing states > 15 minutes and re-queue them"""
    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import Call, CallStatus
        from sqlalchemy import select, and_
        from datetime import datetime, timedelta

        cutoff = datetime.utcnow() - timedelta(minutes=15)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Call).where(
                    and_(
                        Call.status.in_([CallStatus.transcribing, CallStatus.analyzing]),
                        Call.processing_started_at < cutoff,
                    )
                )
            )
            stuck = result.scalars().all()
            for call in stuck:
                logger.warning(f"Re-queuing stuck call: {call.id}")
                process_call.delay(str(call.id))

    run_async(_run())


@celery_app.task(name="workers.tasks.reset_monthly_usage")
def reset_monthly_usage():
    """Reset monthly_minutes_used for all workspaces"""
    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import Workspace
        from sqlalchemy import update

        async with AsyncSessionLocal() as db:
            await db.execute(update(Workspace).values(monthly_minutes_used=0))
            await db.commit()
            logger.info("Monthly usage counters reset")

    run_async(_run())
