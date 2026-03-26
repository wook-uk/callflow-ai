"""
Billing API — /api/v1/billing
  POST /checkout          — create Stripe Checkout session
  POST /portal            — customer portal (manage/cancel)
  POST /webhook           — Stripe webhook (must be raw body)
  GET  /status            — current subscription status
"""
import logging
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Workspace, WorkspaceMember, PlanTier

stripe.api_key = settings.STRIPE_SECRET_KEY
logger = logging.getLogger(__name__)
router = APIRouter()

PLAN_PRICES = {
    "starter": settings.STRIPE_PRICE_STARTER,
    "pro": settings.STRIPE_PRICE_PRO,
}

PLAN_LIMITS = {
    "starter": 6_000,   # 100 hrs/month
    "pro": 24_000,      # 400 hrs/month
}


# ── Schemas ───────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: Literal["starter", "pro"]
    success_url: str = "https://app.callflow.ai/billing?success=1"
    cancel_url: str = "https://app.callflow.ai/billing"


# ── Helpers ───────────────────────────────────

async def _get_workspace(db: AsyncSession, user_id) -> Workspace:
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


async def _get_or_create_stripe_customer(ws: Workspace, user_email: str) -> str:
    if ws.stripe_customer_id:
        return ws.stripe_customer_id
    customer = stripe.Customer.create(
        email=user_email,
        metadata={"workspace_id": str(ws.id), "workspace_name": ws.name},
    )
    return customer.id


# ── Endpoints ─────────────────────────────────

@router.post("/checkout")
async def create_checkout(
    req: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    price_id = PLAN_PRICES.get(req.plan)
    if not price_id:
        raise HTTPException(400, f"Unknown plan: {req.plan}")

    ws = await _get_workspace(db, current_user.id)
    customer_id = await _get_or_create_stripe_customer(ws, current_user.email)

    # Persist customer ID immediately
    ws.stripe_customer_id = customer_id
    await db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=req.success_url + "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url=req.cancel_url,
        subscription_data={
            "metadata": {
                "workspace_id": str(ws.id),
                "plan": req.plan,
            }
        },
        allow_promotion_codes=True,
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/portal")
async def create_portal(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ws = await _get_workspace(db, current_user.id)
    if not ws.stripe_customer_id:
        raise HTTPException(400, "No active subscription found")

    session = stripe.billing_portal.Session.create(
        customer=ws.stripe_customer_id,
        return_url="https://app.callflow.ai/billing",
    )
    return {"portal_url": session.url}


@router.get("/status")
async def billing_status(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ws = await _get_workspace(db, current_user.id)

    subscription = None
    if ws.stripe_subscription_id:
        try:
            subscription = stripe.Subscription.retrieve(ws.stripe_subscription_id)
        except stripe.error.StripeError:
            pass

    return {
        "plan": ws.plan_tier.value if ws.plan_tier else "free",
        "monthly_minutes_limit": ws.monthly_minutes_limit,
        "monthly_minutes_used": ws.monthly_minutes_used,
        "usage_pct": round(ws.monthly_minutes_used / max(ws.monthly_minutes_limit, 1) * 100, 1),
        "subscription_status": subscription.status if subscription else None,
        "current_period_end": subscription.current_period_end if subscription else None,
        "cancel_at_period_end": subscription.cancel_at_period_end if subscription else False,
    }


# ── Webhook (raw body required) ───────────────

@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except (stripe.error.SignatureVerificationError, ValueError) as e:
        logger.warning(f"Stripe webhook signature failed: {e}")
        raise HTTPException(400, "Invalid webhook signature")

    event_type = event["type"]
    logger.info(f"Stripe webhook: {event_type}")

    # ── Subscription activated ────────────────
    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        sub = event["data"]["object"]
        workspace_id = sub.get("metadata", {}).get("workspace_id")
        plan = sub.get("metadata", {}).get("plan", "starter")

        if workspace_id:
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            ws = result.scalar_one_or_none()
            if ws:
                ws.stripe_subscription_id = sub["id"]
                ws.plan_tier = PlanTier(plan) if plan in PlanTier._value2member_map_ else PlanTier.starter
                ws.monthly_minutes_limit = PLAN_LIMITS.get(plan, 6_000)
                ws.is_active = sub["status"] in ("active", "trialing")
                await db.commit()
                logger.info(f"Workspace {workspace_id} updated to plan={plan}")

    # ── Subscription cancelled ────────────────
    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        workspace_id = sub.get("metadata", {}).get("workspace_id")
        if workspace_id:
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            ws = result.scalar_one_or_none()
            if ws:
                ws.plan_tier = PlanTier.starter
                ws.monthly_minutes_limit = 6_000
                ws.stripe_subscription_id = None
                await db.commit()
                logger.info(f"Workspace {workspace_id} downgraded to starter")

    # ── Payment failed ────────────────────────
    elif event_type == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        logger.warning(f"Payment failed for customer {customer_id}")
        # TODO: send email notification via SendGrid/Resend

    return {"received": True}
