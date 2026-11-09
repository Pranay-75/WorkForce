import os
from typing import Any, List, Optional, Union
from urllib.parse import urlparse
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def resolve_env_file() -> Optional[str]:
    """Explicitly and deterministically resolves the environment file to load.

    Priority:
    1. ENV_FILE environment variable (e.g. ENV_FILE=.env.staging):
       - If explicitly set to empty string or 'none' / 'off' / 'false', returns None
         (explicitly disables dotenv file loading).
       - If set to a specific file, checks current working directory, then relative to 'backend/'.
    2. Default:
       - Returns '.env' or 'backend/.env' for normal application runtime.
    """
    env_file = os.getenv("ENV_FILE")
    if env_file is not None:
        if env_file == "" or env_file.lower() in ("none", "null", "false", "off"):
            return None
        if os.path.exists(env_file):
            return env_file
        backend_rel = os.path.join("backend", env_file)
        if os.path.exists(backend_rel):
            return backend_rel
        return env_file

    if os.path.exists(".env"):
        return ".env"
    if os.path.exists(os.path.join("backend", ".env")):
        return os.path.join("backend", ".env")
    return ".env"


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

    # Deliberate opt-in flag required to target production Supabase database
    ALLOW_PRODUCTION_SUPABASE: bool = False

    # Impersonation / Dev Controls (Strictly opt-in; prohibited in production)
    ENABLE_DEMO_AUTH_HEADER: bool = False

    # AI Engine Configuration
    GEMINI_API_KEY: str = ""

    # CORS Origins (supports comma-separated string, JSON array, or list of origins)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "https://workforce-platform.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        default_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "https://workforce-platform.vercel.app",
        ]
        if v is None:
            return default_origins

        if isinstance(v, str):
            v_trimmed = v.strip()
            if not v_trimmed:
                return default_origins
            # Support JSON array string e.g. '["https://..."]'
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                import json
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        v = parsed
                except Exception:
                    pass
            if isinstance(v, str):
                v = [origin.strip() for origin in v.split(",") if origin.strip()]

        if isinstance(v, (list, tuple, set)):
            cleaned: List[str] = []
            for item in v:
                if not isinstance(item, str):
                    continue
                origin = item.strip().rstrip("/")
                if not origin:
                    continue
                # Security safeguard: Wildcard '*' is strictly forbidden when allow_credentials=True
                if origin == "*":
                    raise ValueError(
                        "SECURITY VIOLATION: Wildcard '*' CORS origin is strictly forbidden when credentials are enabled."
                    )
                if origin not in cleaned:
                    cleaned.append(origin)
            return cleaned if cleaned else default_origins

        return default_origins

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, *args, **kwargs):
        if "_env_file" not in kwargs:
            kwargs["_env_file"] = resolve_env_file()
        super().__init__(*args, **kwargs)

    @model_validator(mode="after")
    def validate_staging_production_guardrails(self) -> "Settings":
        """Strictly prevents accidental production database connections and validates environment integrity."""
        prod_ref = "wxkjygctdonpeypgrcnf"
        prod_host = "wxkjygctdonpeypgrcnf.supabase.co"
        staging_ref = "biejxkrhypkkcvpbzjhh"
        staging_host = "biejxkrhypkkcvpbzjhh.supabase.co"
        env = self.ENVIRONMENT.lower()

        # Parse and strictly validate SUPABASE_URL structure
        try:
            parsed = urlparse(self.SUPABASE_URL)
        except Exception as e:
            raise ValueError(f"MALFORMED SUPABASE_URL: Unable to parse URL '{self.SUPABASE_URL}': {e}")

        if not parsed.scheme or not parsed.hostname:
            raise ValueError(
                f"MALFORMED SUPABASE_URL: Invalid URL missing scheme or hostname: '{self.SUPABASE_URL}'"
            )

        scheme = (parsed.scheme or "").lower()
        hostname = (parsed.hostname or "").lower()

        # Prohibit userinfo in SUPABASE_URL (e.g. user:pass@host)
        if parsed.username or parsed.password:
            raise ValueError(
                f"SECURITY VIOLATION: Userinfo (username/password) embedded in SUPABASE_URL is prohibited: '{self.SUPABASE_URL}'"
            )

        # Prohibit query parameters in SUPABASE_URL
        if parsed.query:
            raise ValueError(
                f"SECURITY VIOLATION: Query parameters embedded in SUPABASE_URL are prohibited: '{self.SUPABASE_URL}'"
            )

        # 1. Staging Mode Isolation & Prerequisite Validation
        if env == "staging":
            # Staging must always reject the production project reference under all circumstances
            if prod_ref in self.SUPABASE_URL.lower():
                raise ValueError(
                    f"CRITICAL SAFETY VIOLATION: Staging environment attempted to connect to PRODUCTION Supabase project ({prod_ref})!"
                )
            if scheme != "https":
                raise ValueError(
                    f"STAGING MISCONFIGURATION: Staging SUPABASE_URL must use 'https' scheme. Found '{scheme}' in: {self.SUPABASE_URL}"
                )
            if hostname != staging_host:
                raise ValueError(
                    f"STAGING MISCONFIGURATION: Staging environment must target exact hostname '{staging_host}'. Found: '{hostname}' in: {self.SUPABASE_URL}"
                )
            if parsed.path not in ("", "/"):
                raise ValueError(
                    f"STAGING MISCONFIGURATION: Non-root path in staging SUPABASE_URL is prohibited: '{parsed.path}'"
                )

            # Ensure required staging credentials are present and not empty or unconfigured placeholders
            unpopulated = []
            if not self.SUPABASE_KEY or "placeholder" in self.SUPABASE_KEY.lower():
                unpopulated.append("SUPABASE_KEY")
            if not self.SUPABASE_SERVICE_ROLE_KEY or "placeholder" in self.SUPABASE_SERVICE_ROLE_KEY.lower():
                unpopulated.append("SUPABASE_SERVICE_ROLE_KEY")
            if not self.SUPABASE_JWT_SECRET or "placeholder" in self.SUPABASE_JWT_SECRET.lower():
                unpopulated.append("SUPABASE_JWT_SECRET")

            if unpopulated:
                unpopulated_str = ", ".join(unpopulated)
                raise ValueError(
                    f"STAGING CREDENTIALS MISSING: Required staging credentials are missing or unconfigured placeholders: {unpopulated_str}"
                )

        # 2. Production Environment Requirements (All conditions required: opt-in + production env + prod host + https)
        if env == "production":
            if scheme != "https":
                raise ValueError(
                    f"PRODUCTION CONFIGURATION MISMATCH: Production SUPABASE_URL must use 'https' scheme. Found '{scheme}' in: {self.SUPABASE_URL}"
                )
            if hostname != prod_host:
                raise ValueError(
                    f"PRODUCTION CONFIGURATION MISMATCH: ENVIRONMENT is 'production', but SUPABASE_URL does not match approved production project '{prod_host}'. Found: '{hostname}' in: {self.SUPABASE_URL}"
                )
            if parsed.path not in ("", "/"):
                raise ValueError(
                    f"PRODUCTION CONFIGURATION MISMATCH: Non-root path in production SUPABASE_URL is prohibited: '{parsed.path}'"
                )
            if not self.ALLOW_PRODUCTION_SUPABASE:
                raise ValueError(
                    f"PRODUCTION DATABASE OPT-IN REQUIRED: ENVIRONMENT is 'production', but ALLOW_PRODUCTION_SUPABASE is not true. Connecting to production requires explicit opt-in."
                )

        # 3. Accidental Production Database Targeting Guard (for all non-production environments)
        if (prod_ref in self.SUPABASE_URL.lower() or hostname == prod_host) and env != "production":
            raise ValueError(
                f"ACCIDENTAL PRODUCTION DATABASE TARGETING BLOCKED: Target SUPABASE_URL contains production project reference '{prod_ref}', but ENVIRONMENT is '{self.ENVIRONMENT}'. "
                f"Production database access is strictly prohibited outside ENVIRONMENT='production'. "
                f"To run local development, use local Docker (http://127.0.0.1:54321); "
                f"to run staging, set ENV_FILE=.env.staging; "
                f"or to intentionally connect to production in production deployment runtime, set ENVIRONMENT=production and ALLOW_PRODUCTION_SUPABASE=true."
            )

        return self


settings = Settings()
