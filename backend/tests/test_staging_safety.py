import os
import tempfile
import pytest
from backend.app.core.config import Settings, resolve_env_file


def test_default_development_env(monkeypatch):
    """When running with local dummy URL, Settings initializes safely in development without production opt-in."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    monkeypatch.delenv("ALLOW_PRODUCTION_SUPABASE", raising=False)
    s = Settings(SUPABASE_URL="http://127.0.0.1:54321", ENVIRONMENT="development")
    assert s.ENVIRONMENT == "development"
    assert s.ALLOW_PRODUCTION_SUPABASE is False


def test_case_1_production_url_no_opt_in_rejected(monkeypatch):
    """Case 1: Production URL + no opt-in -> rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    monkeypatch.delenv("ALLOW_PRODUCTION_SUPABASE", raising=False)
    with pytest.raises(ValueError, match="ACCIDENTAL PRODUCTION DATABASE TARGETING BLOCKED.*wxkjygctdonpeypgrcnf"):
        Settings(
            ENVIRONMENT="development",
            SUPABASE_URL="https://wxkjygctdonpeypgrcnf.supabase.co",
            ALLOW_PRODUCTION_SUPABASE=False,
        )


def test_case_2_production_url_opt_in_non_production_env_rejected(monkeypatch):
    """Case 2: Production URL + opt-in + non-production environment -> rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="ACCIDENTAL PRODUCTION DATABASE TARGETING BLOCKED.*wxkjygctdonpeypgrcnf"):
        Settings(
            ENVIRONMENT="development",
            SUPABASE_URL="https://wxkjygctdonpeypgrcnf.supabase.co",
            ALLOW_PRODUCTION_SUPABASE=True,
        )


def test_case_3_production_url_opt_in_production_env_accepted(monkeypatch):
    """Case 3: Production URL + opt-in + production environment -> accepted by configuration validation only."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    s = Settings(
        ENVIRONMENT="production",
        SUPABASE_URL="https://wxkjygctdonpeypgrcnf.supabase.co",
        ALLOW_PRODUCTION_SUPABASE=True,
    )
    assert s.ENVIRONMENT == "production"
    assert s.ALLOW_PRODUCTION_SUPABASE is True
    assert "wxkjygctdonpeypgrcnf" in s.SUPABASE_URL


def test_case_4_staging_url_production_opt_in_accepted_only_as_staging(monkeypatch):
    """Case 4: Staging URL + production opt-in -> accepted only as staging, never treated as production."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    s = Settings(
        ENVIRONMENT="staging",
        SUPABASE_URL="https://biejxkrhypkkcvpbzjhh.supabase.co",
        SUPABASE_KEY="dummy-staging-anon-key",
        SUPABASE_SERVICE_ROLE_KEY="dummy-staging-service-role-key",
        SUPABASE_JWT_SECRET="dummy-staging-jwt-secret-value",
        ALLOW_PRODUCTION_SUPABASE=True,  # Opt-in flag set, but target is staging
    )
    assert s.ENVIRONMENT == "staging"
    assert "biejxkrhypkkcvpbzjhh" in s.SUPABASE_URL
    assert "wxkjygctdonpeypgrcnf" not in s.SUPABASE_URL


def test_case_5_production_url_in_staging_rejected_under_all_circumstances(monkeypatch):
    """Case 5: Production URL in staging -> rejected under all circumstances (even with opt-in enabled)."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="CRITICAL SAFETY VIOLATION.*wxkjygctdonpeypgrcnf"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://wxkjygctdonpeypgrcnf.supabase.co",
            SUPABASE_KEY="dummy-key",
            SUPABASE_SERVICE_ROLE_KEY="dummy-key",
            SUPABASE_JWT_SECRET="dummy-key",
            ALLOW_PRODUCTION_SUPABASE=True,  # Even with opt-in, staging cannot connect to production
        )


def test_case_6_wrong_project_url_in_production_env_rejected(monkeypatch):
    """Case 6: Wrong project URL with production environment -> rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="PRODUCTION CONFIGURATION MISMATCH.*wxkjygctdonpeypgrcnf"):
        Settings(
            ENVIRONMENT="production",
            SUPABASE_URL="https://wrong-project-ref.supabase.co",
            ALLOW_PRODUCTION_SUPABASE=True,
        )


def test_explicit_staging_env_file(monkeypatch):
    """When ENV_FILE points to a valid staging env file with populated credentials, it loads cleanly."""
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("ALLOW_PRODUCTION_SUPABASE", raising=False)

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".staging") as f:
        f.write(
            "ENVIRONMENT=staging\n"
            "SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co\n"
            "SUPABASE_KEY=valid-staging-anon-key\n"
            "SUPABASE_SERVICE_ROLE_KEY=valid-staging-service-role-key\n"
            "SUPABASE_JWT_SECRET=valid-staging-jwt-secret-value\n"
        )
        temp_path = f.name

    try:
        monkeypatch.setenv("ENV_FILE", temp_path)
        s = Settings()
        assert s.ENVIRONMENT == "staging"
        assert s.SUPABASE_URL == "https://biejxkrhypkkcvpbzjhh.supabase.co"
        assert s.SUPABASE_KEY == "valid-staging-anon-key"
        assert s.SUPABASE_SERVICE_ROLE_KEY == "valid-staging-service-role-key"
        assert s.SUPABASE_JWT_SECRET == "valid-staging-jwt-secret-value"
    finally:
        os.remove(temp_path)


def test_missing_staging_credentials_fail_safely(monkeypatch):
    """Missing or placeholder staging credentials must raise an explicit ValueError."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    
    # 1. Missing keys
    with pytest.raises(ValueError, match="STAGING CREDENTIALS MISSING"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://biejxkrhypkkcvpbzjhh.supabase.co",
            SUPABASE_KEY="",
            SUPABASE_SERVICE_ROLE_KEY="",
            SUPABASE_JWT_SECRET="",
        )

    # 2. Placeholder keys
    with pytest.raises(ValueError, match="STAGING CREDENTIALS MISSING.*SUPABASE_KEY.*SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_JWT_SECRET"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://biejxkrhypkkcvpbzjhh.supabase.co",
            SUPABASE_KEY="your-staging-anon-key-placeholder",
            SUPABASE_SERVICE_ROLE_KEY="your-staging-service-role-key-placeholder",
            SUPABASE_JWT_SECRET="your-staging-jwt-secret-placeholder",
        )


def test_resolve_env_file_relative_and_absolute(monkeypatch, tmp_path):
    """resolve_env_file correctly resolves absolute, relative, and backend paths."""
    # Absolute
    temp_file = tmp_path / "custom.env"
    temp_file.write_text("FOO=BAR")
    monkeypatch.setenv("ENV_FILE", str(temp_file))
    assert resolve_env_file() == str(temp_file)

    # Disabled / empty string values return None
    monkeypatch.setenv("ENV_FILE", "")
    assert resolve_env_file() is None

    monkeypatch.setenv("ENV_FILE", "none")
    assert resolve_env_file() is None

    # Unset defaults to .env (normal application runtime)
    monkeypatch.delenv("ENV_FILE", raising=False)
    resolved = resolve_env_file()
    assert resolved.endswith(".env")


def test_test_settings_cannot_load_values_from_backend_dotenv(monkeypatch):
    """Regression test: Proves test-created Settings instances have dotenv loading disabled and cannot load backend/.env.

    Safety: Does not open, print, modify or expose any credentials from backend/.env.
    Mechanism: Under standard test configuration (ENV_FILE=""), resolve_env_file() returns None.
    If SUPABASE_URL is deleted from os.environ, Settings must fall back to its in-memory default
    ('http://127.0.0.1:54321') and succeed. If backend/.env were read by Pydantic, it would attempt to load
    the production Supabase URL stored on disk and fail validation with ACCIDENTAL PRODUCTION DATABASE TARGETING BLOCKED.
    """
    # 1. Verify default test environment resolves to None (dotenv loading disabled)
    assert resolve_env_file() is None

    # 2. Verify Settings does not load SUPABASE_URL from backend/.env
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    s = Settings(ENVIRONMENT="development")
    assert s.SUPABASE_URL == "http://127.0.0.1:54321"

    # 3. Explicit _env_file=None also successfully prevents loading any dotenv file
    s_explicit = Settings(_env_file=None, ENVIRONMENT="development")
    assert s_explicit.SUPABASE_URL == "http://127.0.0.1:54321"


def test_staging_url_path_spoofing_rejected(monkeypatch):
    """Path spoofing attempts like https://attacker.com/biejxkrhypkkcvpbzjhh must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="STAGING MISCONFIGURATION.*exact hostname"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://attacker.com/biejxkrhypkkcvpbzjhh",
            SUPABASE_KEY="valid-key",
            SUPABASE_SERVICE_ROLE_KEY="valid-key",
            SUPABASE_JWT_SECRET="valid-key",
        )


def test_staging_url_userinfo_spoofing_rejected(monkeypatch):
    """Userinfo spoofing attempts like https://biejxkrhypkkcvpbzjhh@attacker.com must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="SECURITY VIOLATION.*Userinfo"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://biejxkrhypkkcvpbzjhh@attacker.com",
            SUPABASE_KEY="valid-key",
            SUPABASE_SERVICE_ROLE_KEY="valid-key",
            SUPABASE_JWT_SECRET="valid-key",
        )


def test_staging_url_query_spoofing_rejected(monkeypatch):
    """Query parameter spoofing attempts must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="SECURITY VIOLATION.*Query parameters"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://biejxkrhypkkcvpbzjhh.supabase.co?query=attacker",
            SUPABASE_KEY="valid-key",
            SUPABASE_SERVICE_ROLE_KEY="valid-key",
            SUPABASE_JWT_SECRET="valid-key",
        )


def test_staging_url_non_root_path_rejected(monkeypatch):
    """Non-root path on staging hostname must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="STAGING MISCONFIGURATION.*Non-root path"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="https://biejxkrhypkkcvpbzjhh.supabase.co/extra/path",
            SUPABASE_KEY="valid-key",
            SUPABASE_SERVICE_ROLE_KEY="valid-key",
            SUPABASE_JWT_SECRET="valid-key",
        )


def test_staging_url_http_scheme_rejected(monkeypatch):
    """HTTP scheme for staging must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="STAGING MISCONFIGURATION.*must use 'https' scheme"):
        Settings(
            ENVIRONMENT="staging",
            SUPABASE_URL="http://biejxkrhypkkcvpbzjhh.supabase.co",
            SUPABASE_KEY="valid-key",
            SUPABASE_SERVICE_ROLE_KEY="valid-key",
            SUPABASE_JWT_SECRET="valid-key",
        )


def test_production_url_path_spoofing_rejected(monkeypatch):
    """Path spoofing with production ref like https://attacker.com/wxkjygctdonpeypgrcnf must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="ACCIDENTAL PRODUCTION DATABASE TARGETING BLOCKED"):
        Settings(
            ENVIRONMENT="development",
            SUPABASE_URL="https://attacker.com/wxkjygctdonpeypgrcnf",
            ALLOW_PRODUCTION_SUPABASE=False,
        )


def test_malformed_url_rejected(monkeypatch):
    """Malformed URLs without scheme or host must be rejected."""
    monkeypatch.delenv("ENV_FILE", raising=False)
    with pytest.raises(ValueError, match="MALFORMED SUPABASE_URL"):
        Settings(
            ENVIRONMENT="development",
            SUPABASE_URL="not_a_valid_url",
        )


def test_conftest_environment_overrides():
    """Verify that conftest.py sets safe test defaults and prevents test leakage."""
    assert os.environ.get("ENVIRONMENT") == "development"
    assert os.environ.get("SUPABASE_URL") == "http://127.0.0.1:54321"
    assert os.environ.get("ALLOW_PRODUCTION_SUPABASE") == "false"
