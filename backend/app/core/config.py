"""
Application configuration using pydantic-settings
All secrets loaded from environment variables
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "CallFlow AI"
    ENV: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/callflow"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Redis (Celery broker)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Storage (S3 / Cloudflare R2)
    S3_BUCKET: str = "callflow-recordings"
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_ENDPOINT_URL: str | None = None  # R2 endpoint if using Cloudflare

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    WHISPER_MODEL: str = "whisper-1"

    # HubSpot
    HUBSPOT_APP_ID: str = ""
    HUBSPOT_CLIENT_ID: str = ""
    HUBSPOT_CLIENT_SECRET: str = ""
    HUBSPOT_REDIRECT_URI: str = "http://localhost:3000/integrations/hubspot/callback"

    # Google (Calendar + OAuth)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/integrations/google/callback"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STARTER: str = ""  # $199/mo
    STRIPE_PRICE_PRO: str = ""      # $499/mo

    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Processing limits
    MAX_AUDIO_FILE_SIZE_MB: int = 500
    MAX_AUDIO_DURATION_HOURS: int = 4
    PROCESSING_TIMEOUT_SECONDS: int = 600


settings = Settings()
