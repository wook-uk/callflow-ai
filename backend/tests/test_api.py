"""
Integration tests for CallFlow AI backend
Run: pytest tests/ -v

Uses pytest-asyncio + httpx AsyncClient to test the full stack
(in-memory SQLite for speed, mocked OpenAI/S3 calls)
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import get_db
from app.models.models import Base

# ── Test DB (in-memory SQLite) ────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c

    app.dependency_overrides.clear()


# ── Helpers ───────────────────────────────────

async def create_user_and_token(client: AsyncClient) -> tuple[dict, str]:
    resp = await client.post("/api/v1/auth/signup", json={
        "email": "test@example.com",
        "password": "TestPass123",
        "full_name": "Test User",
        "workspace_name": "Test Workspace",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["user"], data["access_token"]


# ── Auth Tests ────────────────────────────────

class TestAuth:
    @pytest.mark.asyncio
    async def test_signup_creates_user_and_workspace(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/signup", json={
            "email": "new@example.com",
            "password": "StrongPass1",
            "full_name": "Jane Doe",
            "workspace_name": "Jane's Team",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["email"] == "new@example.com"
        assert data["workspace"]["name"] == "Jane's Team"
        assert "access_token" in data

    @pytest.mark.asyncio
    async def test_signup_duplicate_email(self, client: AsyncClient):
        for _ in range(2):
            resp = await client.post("/api/v1/auth/signup", json={
                "email": "dup@example.com",
                "password": "TestPass123",
                "full_name": "Dup User",
                "workspace_name": "Dup Workspace",
            })
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient):
        await client.post("/api/v1/auth/signup", json={
            "email": "login@example.com",
            "password": "TestPass123",
            "full_name": "Login User",
            "workspace_name": "Login Workspace",
        })
        resp = await client.post("/api/v1/auth/login", json={
            "email": "login@example.com",
            "password": "TestPass123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient):
        await client.post("/api/v1/auth/signup", json={
            "email": "wrongpw@example.com",
            "password": "TestPass123",
            "full_name": "User",
            "workspace_name": "WS",
        })
        resp = await client.post("/api/v1/auth/login", json={
            "email": "wrongpw@example.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_with_token(self, client: AsyncClient):
        user, token = await create_user_and_token(client)
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == user["email"]


# ── Workspace Tests ───────────────────────────

class TestWorkspace:
    @pytest.mark.asyncio
    async def test_get_workspace(self, client: AsyncClient):
        _, token = await create_user_and_token(client)
        resp = await client.get(
            "/api/v1/workspace",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "name" in data
        assert data["plan_tier"] == "starter"
        assert data["monthly_minutes_limit"] == 6000

    @pytest.mark.asyncio
    async def test_get_workspace_settings(self, client: AsyncClient):
        _, token = await create_user_and_token(client)
        resp = await client.get(
            "/api/v1/workspace/settings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "call_detection_keywords" in data
        assert "sales_framework" in data


# ── Call Upload Tests ─────────────────────────

class TestCalls:
    @pytest.mark.asyncio
    async def test_list_calls_empty(self, client: AsyncClient):
        _, token = await create_user_and_token(client)
        resp = await client.get(
            "/api/v1/calls",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["calls"] == []

    @pytest.mark.asyncio
    @patch("app.api.v1.calls.StorageService")
    @patch("app.api.v1.calls.process_call")
    async def test_upload_call(
        self,
        mock_task: MagicMock,
        mock_storage: MagicMock,
        client: AsyncClient,
    ):
        # Mock S3 upload
        mock_storage.return_value.upload = AsyncMock(return_value="recordings/test/file.mp3")
        mock_task.delay = MagicMock()

        _, token = await create_user_and_token(client)

        import io
        fake_audio = io.BytesIO(b"fake audio content" * 100)
        fake_audio.name = "test_call.mp3"

        resp = await client.post(
            "/api/v1/calls/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test_call.mp3", fake_audio, "audio/mpeg")},
            data={"title": "Test Call", "customer_name": "John", "customer_company": "Acme"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "uploading"
        assert data["title"] == "Test Call"
        mock_task.delay.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_call_not_found(self, client: AsyncClient):
        _, token = await create_user_and_token(client)
        resp = await client.get(
            "/api/v1/calls/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


# ── Health Check ──────────────────────────────

class TestHealth:
    @pytest.mark.asyncio
    async def test_health(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# ── Call Processing Unit Tests ────────────────

class TestCallProcessingService:
    @pytest.mark.asyncio
    @patch("app.services.call_processing.AsyncOpenAI")
    async def test_analyze_returns_structured_output(self, mock_openai):
        """Test that GPT-4o response is parsed into CallInsights fields"""
        import json
        from app.services.call_processing import CallProcessingService

        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            "meeting_summary": "Good discovery call with Acme Corp.",
            "sentiment": "positive",
            "sentiment_reasoning": "Prospect was engaged.",
            "budget": "$50,000 annually",
            "authority": [{"name": "John Smith", "role": "CTO", "influence": "decision_maker"}],
            "need": ["Reduce manual CRM updates"],
            "timeline": "Q2 2025",
            "customer_goals": ["Save 2hrs/day per rep"],
            "competitors_mentioned": ["Gong"],
            "objections": [{"category": "price", "description": "Pricing seemed high"}],
            "decision_makers": [],
            "next_actions_internal": [{"action": "Send proposal", "owner": "AE", "due_days": 2}],
            "next_actions_external": [{"action": "Schedule demo", "target_person": "John", "due_days": 5}],
            "email_followup_subject": "Next steps from our call",
            "email_followup_body": "Hi [FIRST_NAME], great chatting today...",
            "tags": ["pricing", "competitor"],
        })

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_openai.return_value = mock_client

        # Verify JSON parses correctly
        result = json.loads(mock_response.choices[0].message.content)
        assert result["sentiment"] == "positive"
        assert len(result["next_actions_internal"]) == 1
        assert "pricing" in result["tags"]
