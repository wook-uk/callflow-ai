# CallFlow AI 🎯

> AI-powered sales meeting assistant. Upload a call recording → get BANT/MEDDIC analysis, auto-generated follow-up email, and one-click HubSpot sync.

---

## What it does

1. **Upload** a Zoom/Meet/Teams recording (MP3, MP4, M4A, WAV)
2. **Transcribe** with OpenAI Whisper (~2 min for a 60-min call)
3. **Analyze** with GPT-4o — extracts BANT fields, objections, sentiment, competitor mentions
4. **Review** insights in a clean dashboard
5. **Apply to HubSpot** — note, tasks, and deal stage update in one click

**Saves 1-2 hours/day** per sales rep on CRM admin.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | FastAPI (Python 3.12), async/await |
| Database | PostgreSQL via Supabase |
| Queue | Celery + Redis |
| STT | OpenAI Whisper API |
| LLM | GPT-4o (JSON mode) |
| Storage | Cloudflare R2 (S3-compatible) |
| Payments | Stripe (subscriptions + webhooks) |
| CRM | HubSpot API v3 |
| Deploy | Railway (API + Worker) + Vercel (frontend) |
| CI/CD | GitHub Actions |

---

## Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.12+

### Quick start

```bash
git clone https://github.com/yourorg/callflow-ai
cd callflow-ai

# Copy and fill in environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Start everything
docker compose up -d

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Celery monitor: http://localhost:5555

### Running tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

---

## Project Structure

```
callflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── core/
│   │   │   ├── auth.py              # JWT + password hashing
│   │   │   ├── config.py            # Settings (pydantic-settings)
│   │   │   └── database.py          # Async SQLAlchemy setup
│   │   ├── models/models.py         # All DB models (8 tables)
│   │   ├── api/v1/
│   │   │   ├── auth.py              # Signup, login, Google OAuth
│   │   │   ├── calls.py             # Upload, list, detail, CRM apply
│   │   │   ├── workspace.py         # Team management, settings
│   │   │   ├── integrations.py      # HubSpot + Google Calendar OAuth
│   │   │   └── billing.py           # Stripe checkout + webhooks
│   │   └── services/
│   │       ├── call_processing.py   # Whisper → GPT-4o pipeline
│   │       ├── crm_sync.py          # HubSpot write-back
│   │       └── storage.py           # S3/R2 upload/download
│   ├── integrations/
│   │   └── hubspot/client.py        # HubSpot API client
│   ├── workers/tasks.py             # Celery async tasks
│   ├── alembic/                     # DB migrations
│   ├── tests/test_api.py            # Integration tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── auth/login/          # Login page
│       │   ├── auth/signup/         # Signup page
│       │   ├── onboarding/          # 4-step onboarding
│       │   └── dashboard/
│       │       ├── page.tsx         # Call list + upload
│       │       ├── calls/[id]/      # Call detail + insights
│       │       ├── settings/        # Integrations + config
│       │       └── billing/         # Plans + Stripe checkout
│       ├── components/
│       │   ├── dashboard/CallCard.tsx
│       │   ├── dashboard/StatsBar.tsx
│       │   ├── dashboard/UploadModal.tsx
│       │   ├── call/SentimentBadge.tsx
│       │   └── call/TagList.tsx
│       ├── hooks/
│       │   ├── useCalls.ts          # SWR with 5s polling
│       │   ├── useCall.ts           # SWR with smart interval
│       │   └── useAuthStore.ts      # In-memory auth state
│       ├── lib/
│       │   ├── api.ts               # Typed API client
│       │   └── billing.ts           # Stripe helpers
│       └── middleware.ts            # Edge auth guard
│
├── deploy/RUNBOOK.md                # Step-by-step deploy guide
├── docker-compose.yml               # Full local stack
└── .github/workflows/ci.yml        # CI/CD pipeline
```

---

## API Endpoints

```
POST   /api/v1/auth/signup           Create account + workspace
POST   /api/v1/auth/login            Email/password login
POST   /api/v1/auth/google           Google OAuth login
GET    /api/v1/auth/me               Current user profile

POST   /api/v1/calls/upload          Upload audio file
GET    /api/v1/calls                 List calls (with filters)
GET    /api/v1/calls/{id}            Full call detail + insights
GET    /api/v1/calls/{id}/status     Processing status (poll)
POST   /api/v1/calls/{id}/apply-to-crm  Sync to HubSpot

GET    /api/v1/workspace             Workspace info
PATCH  /api/v1/workspace             Update name/logo
GET    /api/v1/workspace/settings    Call detection config
PATCH  /api/v1/workspace/settings    Update settings
GET    /api/v1/workspace/members     List team
POST   /api/v1/workspace/invite      Invite member

GET    /api/v1/integrations          List connected integrations
GET    /api/v1/integrations/hubspot/oauth-url  Start HubSpot OAuth
POST   /api/v1/integrations/hubspot/connect    Complete OAuth
GET    /api/v1/integrations/google/oauth-url   Start Google OAuth
POST   /api/v1/integrations/google/connect     Complete OAuth

POST   /api/v1/billing/checkout      Create Stripe Checkout session
POST   /api/v1/billing/portal        Open Stripe customer portal
GET    /api/v1/billing/status        Subscription + usage info
POST   /api/v1/billing/webhook       Stripe webhook receiver
```

---

## Pricing

| Plan | Price | Calls/month | Team size |
|------|-------|-------------|-----------|
| Starter | $199/mo | 100 hours | ≤10 members |
| Pro | $499/mo | 400 hours | ≤50 members |

Beta promo: first 10 teams get **50% off forever** with code `BETA50`.

---

## Roadmap

- [ ] Real-time bot joining (Zoom/Meet SDK)
- [ ] Pipedrive + Salesforce connectors
- [ ] Team analytics dashboard
- [ ] Email notifications (Resend)
- [ ] Slack summaries
- [ ] MEDDIC scoring
- [ ] Custom prompt templates per workspace

---

## License

Proprietary — all rights reserved.
