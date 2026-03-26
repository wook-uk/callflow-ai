# CallFlow AI — Deployment Runbook
# Last updated: 2025

---

## Architecture Overview

```
Frontend (Vercel)  →  Backend API (Railway)  →  PostgreSQL (Supabase)
                                             →  Redis (Railway)
                                             →  S3/R2 (Cloudflare R2)
                   →  Celery Worker (Railway)
                   →  External APIs: OpenAI, HubSpot, Stripe
```

---

## 1. Prerequisites

- [ ] Node.js 20+ and pnpm
- [ ] Python 3.12+
- [ ] Railway CLI: `npm i -g @railway/cli`
- [ ] Vercel CLI: `npm i -g vercel`
- [ ] Accounts: Railway, Vercel, Supabase, Cloudflare, Stripe, OpenAI, HubSpot

---

## 2. Backend Secrets (Railway env vars)

Set these in Railway dashboard → Variables:

```bash
# Core
SECRET_KEY=<generate: openssl rand -hex 32>
ENV=production
DEBUG=false
ALLOWED_ORIGINS=["https://app.callflow.ai"]

# Database (from Supabase project → Settings → Database)
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres

# Redis (Railway Redis plugin — auto-set as REDIS_URL)
REDIS_URL=${{Redis.REDIS_URL}}

# Supabase
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_KEY=<service role key from Supabase dashboard>

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
WHISPER_MODEL=whisper-1

# Cloudflare R2 (storage for recordings)
S3_BUCKET=callflow-recordings
S3_REGION=auto
AWS_ACCESS_KEY_ID=<R2 Access Key ID>
AWS_SECRET_ACCESS_KEY=<R2 Secret Access Key>
S3_ENDPOINT_URL=https://[account-id].r2.cloudflarestorage.com

# HubSpot app (create at developers.hubspot.com)
HUBSPOT_APP_ID=<app id>
HUBSPOT_CLIENT_ID=<client id>
HUBSPOT_CLIENT_SECRET=<client secret>
HUBSPOT_REDIRECT_URI=https://app.callflow.ai/integrations/hubspot/callback

# Google OAuth (console.cloud.google.com)
GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=https://app.callflow.ai/integrations/google/callback

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...   # $199/mo price ID
STRIPE_PRICE_PRO=price_...       # $499/mo price ID

# JWT
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080   # 7 days
```

---

## 3. Frontend Secrets (Vercel env vars)

```bash
NEXT_PUBLIC_API_URL=https://api.callflow.ai
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as backend GOOGLE_CLIENT_ID>
NEXT_PUBLIC_HUBSPOT_CLIENT_ID=<same as backend HUBSPOT_CLIENT_ID>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 4. Step-by-step Deployment

### 4a. Supabase Database

```bash
# 1. Create new Supabase project at supabase.com
# 2. Note the database URL from Settings → Database
# 3. Run migrations (from /backend):
pip install alembic
DATABASE_URL="postgresql://..." alembic upgrade head
```

### 4b. Cloudflare R2

```bash
# 1. Create R2 bucket named "callflow-recordings" (Cloudflare dashboard)
# 2. Create API token with Object Read & Write permissions
# 3. Enable public access OR keep private (presigned URLs handle delivery)
# 4. Set CORS policy:
# AllowedOrigins: ["https://app.callflow.ai"]
# AllowedMethods: ["GET", "PUT"]
```

### 4c. Railway (Backend API + Worker)

```bash
cd backend
railway login
railway init   # Create new project

# Service 1: API
railway service create --name api
railway up

# Service 2: Worker (same repo, different start command)
railway service create --name worker
railway variables set START_COMMAND="celery -A workers.tasks worker --loglevel=info -Q calls,crm --concurrency=2"
railway up

# Service 3: Beat scheduler
railway service create --name beat
railway variables set START_COMMAND="celery -A workers.tasks beat --loglevel=info"
railway up

# Service 4: Redis (plugin)
railway plugin add redis

# Set custom domain
railway domain add api.callflow.ai
```

### 4d. Vercel (Frontend)

```bash
cd frontend
vercel --prod

# Set environment variables in Vercel dashboard
# Add custom domain: app.callflow.ai
# DNS: CNAME app → cname.vercel-dns.com
```

### 4e. Stripe Webhooks

```bash
# 1. Go to Stripe Dashboard → Webhooks → Add endpoint
# URL: https://api.callflow.ai/api/v1/billing/webhook
# Events to listen for:
#   customer.subscription.created
#   customer.subscription.updated
#   customer.subscription.deleted
#   invoice.payment_failed
# 2. Copy webhook signing secret → STRIPE_WEBHOOK_SECRET
```

### 4f. HubSpot App Setup

```bash
# 1. developers.hubspot.com → Create App
# 2. Auth tab → Add redirect URI: https://app.callflow.ai/integrations/hubspot/callback
# 3. Scopes: crm.objects.contacts.read/write, crm.objects.deals.read/write,
#            crm.objects.notes.write, crm.objects.tasks.write
# 4. Copy Client ID and Secret → Railway env vars
```

---

## 5. DNS Configuration

```
# Cloudflare DNS (add these records)
Type  Name   Value                   Proxy
A     @      76.76.21.21             ✓    (Vercel)
CNAME app    cname.vercel-dns.com    ✓    (Vercel frontend)
CNAME api    api.railway.app         ✓    (Railway backend)
```

---

## 6. Post-deployment Checklist

- [ ] `curl https://api.callflow.ai/health` returns `{"status":"ok"}`
- [ ] Sign up flow works end to end
- [ ] Upload a test audio file → processing completes
- [ ] HubSpot OAuth flow completes without error
- [ ] Stripe checkout redirects correctly
- [ ] Stripe webhook test event is processed (Stripe Dashboard → Webhooks → Send test event)
- [ ] Worker is picking up tasks (Railway logs → worker service)

---

## 7. Monitoring

```bash
# Railway logs (tail)
railway logs --service api
railway logs --service worker

# Sentry (add to Railway env)
SENTRY_DSN=https://...@sentry.io/...

# PostHog analytics (add to frontend .env)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 8. Estimated Monthly Costs (at launch, ~10 customers)

| Service          | Cost     | Notes                          |
|------------------|----------|--------------------------------|
| Railway (3 svcs) | ~$15     | API + Worker + Beat            |
| Railway Redis    | ~$5      | 1GB plan                       |
| Supabase         | Free     | Up to 500MB, 2 projects        |
| Cloudflare R2    | ~$5      | 10GB storage + egress          |
| OpenAI Whisper   | ~$30     | ~300hrs of transcription       |
| OpenAI GPT-4o    | ~$20     | ~500 calls analyzed            |
| Vercel           | Free     | Hobby plan sufficient at start |
| Stripe           | 2.9%+30¢ | Per transaction                |
| **Total**        | **~$75** | Before Stripe fees             |

Revenue from 10 customers on Starter: $1,990/month
---

## 9. Scaling Triggers

- **>50 calls/day**: Add second worker replica on Railway
- **>200 calls/day**: Add read replica on Supabase
- **>1,000 calls/day**: Consider dedicated GPU instance for Whisper self-hosting (~60% cost reduction)
