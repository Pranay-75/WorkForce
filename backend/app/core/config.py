import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "WorkForce API"
    VERSION: str = "0.2.0"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"

    # Supabase Configuration (loaded from .env or environment)
    SUPABASE_URL: str = "http://127.0.0.1:54321"
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Impersonation / Dev Controls (Strictly opt-in; prohibited in production)
    ENABLE_DEMO_AUTH_HEADER: bool = False

    # AI Engine Configuration
    GEMINI_API_KEY: str = ""

    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
