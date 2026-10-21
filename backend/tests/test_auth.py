import time
import uuid
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.models.schemas import UserRoleEnum, AuthenticatedUser
from app.api.deps import verify_resource_organization_access

client = TestClient(app)

TEST_SECRET = "workforce-super-secret-signing-key-for-testing-purposes-32bytes!"

def generate_custom_jwt(
    sub: str = "b0000000-0000-0000-0000-000000000001",
    email: str = "sarah.connor@acme.corp",
    issuer: str = None,
    audience: str = "authenticated",
    exp_offset: int = 3600,
    secret: str = TEST_SECRET,
    algorithm: str = "HS256",
    headers: dict = None,
) -> str:
    """Helper to generate strictly controlled JWT tokens for security testing"""
    iss = issuer if issuer is not None else f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
    payload = {
        "sub": sub,
        "email": email,
        "aud": audience,
        "iss": iss,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm, headers=headers)


# =============================================================================
# MOCK DATABASE & JWKS HELPERS (Fail-closed verification & unit isolation)
# =============================================================================

class MockQueryBuilder:
    def __init__(self, data=None, error=None, single=False, parent=None):
        self._data = data if data is not None else []
        self._error = error
        self._single = single
        self._parent = parent
        self._is_order_query = False

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        self._is_order_query = True
        return self

    def limit(self, *args, **kwargs):
        return self

    def single(self, *args, **kwargs):
        self._single = True
        return self

    def maybe_single(self, *args, **kwargs):
        return self

    def execute(self):
        if self._error:
            raise self._error
        if self._is_order_query and self._parent and self._parent.earliest_member_data is not None:
            data = self._parent.earliest_member_data
        else:
            data = self._data[0] if (self._single and self._data) else self._data
        return type("SupabaseResponse", (), {"data": data, "error": None})()


class MockSupabaseAdmin:
    def __init__(self, memberships_data=None, profiles_data=None, earliest_member_data=None, db_error=None, fail_on_auth_api=False):
        self.memberships_data = memberships_data if memberships_data is not None else []
        self.profiles_data = profiles_data if profiles_data is not None else []
        self.earliest_member_data = earliest_member_data
        self.db_error = db_error
        self.fail_on_auth_api = fail_on_auth_api

    def table(self, table_name: str):
        if self.db_error:
            raise self.db_error
        if table_name == "organization_memberships":
            return MockQueryBuilder(data=self.memberships_data, parent=self)
        elif table_name == "user_profiles":
            return MockQueryBuilder(data=self.profiles_data, parent=self)
        return MockQueryBuilder(data=[], parent=self)


    @property
    def auth(self):
        if self.fail_on_auth_api:
            raise AssertionError("Remote Supabase Auth API was unexpectedly invoked after local cryptographic failure!")
        return type("MockAuth", (), {"get_user": lambda token: None})()


class MockJWKSigningKey:
    def __init__(self, key):
        self.key = key


class MockJWKSClient:
    def __init__(self, signing_key=None, raise_error=None):
        self._signing_key = signing_key
        self._raise_error = raise_error

    def get_signing_key_from_jwt(self, token):
        if self._raise_error:
            raise self._raise_error
        return MockJWKSigningKey(self._signing_key)


# =============================================================================
# 1. TOKEN VERIFICATION & CRYPTOGRAPHIC TESTS
# =============================================================================

def test_missing_auth_header_rejected():
    """Verify protected endpoints reject requests with missing credentials with 401"""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Missing or invalid authentication credentials" in response.json()["detail"]


def test_malformed_token_rejected():
    """Verify malformed or corrupted tokens are rejected with 401"""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token-format"}
    )
    assert response.status_code == 401
    assert "Invalid authentication token" in response.json()["detail"]


def test_invalid_signature_rejected(monkeypatch):
    """Verify tokens signed with wrong secret/key are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    bad_token = generate_custom_jwt(secret="wrong-untrusted-signing-key-1234567890!")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {bad_token}"}
    )
    assert response.status_code == 401
    assert "Invalid token signature" in response.json()["detail"]


def test_expired_token_rejected(monkeypatch):
    """Verify expired JWT tokens are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    expired_token = generate_custom_jwt(exp_offset=-3600)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
    assert "token has expired" in response.json()["detail"]


def test_incorrect_issuer_rejected(monkeypatch):
    """Verify tokens with wrong issuer are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    bad_iss_token = generate_custom_jwt(issuer="https://malicious-fake-supabase.attacker.com/auth/v1")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {bad_iss_token}"}
    )
    assert response.status_code == 401
    assert "issuer is invalid" in response.json()["detail"]


def test_incorrect_audience_rejected(monkeypatch):
    """Verify tokens with wrong audience are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    bad_aud_token = generate_custom_jwt(audience="unauthorized-service")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {bad_aud_token}"}
    )
    assert response.status_code == 401
    assert "Invalid token audience" in response.json()["detail"]


def test_anon_audience_rejected(monkeypatch):
    """Verify tokens with 'anon' audience are strictly rejected for authenticated endpoints"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    anon_token = generate_custom_jwt(audience="anon")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {anon_token}"}
    )
    assert response.status_code == 401
    assert "Invalid token audience" in response.json()["detail"]


def test_workforce_api_audience_rejected(monkeypatch):
    """Verify 'workforce-api' audience is rejected as Supabase Auth issues 'authenticated'"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    token = generate_custom_jwt(audience="workforce-api")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401
    assert "Invalid token audience: 'workforce-api'. Expected 'authenticated'." in response.json()["detail"]


def test_missing_sub_rejected(monkeypatch):
    """Verify tokens missing subject (user_id) are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    payload = {
        "email": "test@acme.corp",
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": int(time.time()) + 3600,
    }
    no_sub_token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {no_sub_token}"}
    )
    assert response.status_code == 401
    assert "missing or non-string subject identifier" in response.json()["detail"].lower()


def test_non_string_sub_rejected(monkeypatch):
    """Verify tokens with non-string subject (e.g. integer) are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    payload = {
        "sub": 123456789,
        "email": "test@acme.corp",
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": int(time.time()) + 3600,
    }
    int_sub_token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {int_sub_token}"}
    )
    assert response.status_code == 401
    assert "subject must be a string" in response.json()["detail"].lower() or "subject identifier" in response.json()["detail"].lower()


def test_malformed_uuid_sub_rejected(monkeypatch):
    """Verify tokens with non-UUID string subject are rejected with 401"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    bad_uuid_token = generate_custom_jwt(sub="not-a-valid-uuid-format-12345")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {bad_uuid_token}"}
    )
    assert response.status_code == 401
    assert "not a valid uuid" in response.json()["detail"].lower()


def test_jwks_invalid_signature_fails_fast_without_remote_fallback(monkeypatch):
    """Verify that an invalid JWKS signature fails fast with 401 without invoking remote Supabase API"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")

    # Generate RSA keys
    trusted_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    trusted_public_key = trusted_private_key.public_key()

    untrusted_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Mock JWKS client returns trusted public key
    mock_jwks = MockJWKSClient(signing_key=trusted_public_key)
    monkeypatch.setattr("app.core.security.get_jwks_client", lambda: mock_jwks)

    # Mock Supabase Admin with fail_on_auth_api=True to assert remote API is never called
    mock_db = MockSupabaseAdmin(fail_on_auth_api=True)
    monkeypatch.setattr("app.core.security.get_supabase_admin", lambda: mock_db)
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    # Token signed with untrusted private key
    untrusted_token = generate_custom_jwt(
        secret=untrusted_private_key,
        algorithm="RS256",
        headers={"kid": "key-1"}
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {untrusted_token}"}
    )
    assert response.status_code == 401
    assert "Invalid token signature" in response.json()["detail"]


# =============================================================================
# 2. DETERMINISTIC ORGANIZATION CONTEXT & MULTI-ORG RESOLUTION
# =============================================================================

def test_single_active_membership_no_header_succeeds(monkeypatch):
    """Verify a user with exactly one active membership resolves organization context automatically"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "manager",
            "organization_id": "a0000000-0000-0000-0000-000000000001",
            "organizations": {
                "id": "a0000000-0000-0000-0000-000000000001",
                "name": "Acme Systems Engineering",
                "slug": "acme-systems"
            }
        }],
        profiles_data=[{
            "id": "b0000000-0000-0000-0000-000000000001",
            "email": "sarah.connor@acme.corp",
            "full_name": "Sarah Connor",
            "department": "Engineering",
            "job_title": "Engineering Lead & Architect",
            "weekly_capacity_hours": 40.0,
        }]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-000000000001",
        email="sarah.connor@acme.corp"
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "b0000000-0000-0000-0000-000000000001"
    assert data["role"] == "manager"
    assert data["organization_id"] == "a0000000-0000-0000-0000-000000000001"
    assert data["organization_name"] == "Acme Systems Engineering"


def test_multiple_active_memberships_without_header_returns_400(monkeypatch):
    """Verify a user with multiple memberships MUST provide X-Organization-Id or receive 400 Bad Request"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[
            {
                "role": "employee",
                "organization_id": "a0000000-0000-0000-0000-000000000001",
                "organizations": {"id": "a0000000-0000-0000-0000-000000000001", "name": "Acme Systems", "slug": "acme-systems"}
            },
            {
                "role": "admin",
                "organization_id": "a0000000-0000-0000-0000-000000000002",
                "organizations": {"id": "a0000000-0000-0000-0000-000000000002", "name": "Cyberdyne Labs", "slug": "cyberdyne-labs"}
            },
        ]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(sub="b0000000-0000-0000-0000-000000000001")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400
    assert "Multiple active organization memberships found" in response.json()["detail"]
    assert "X-Organization-Id" in response.json()["detail"]


def test_multiple_memberships_with_explicit_valid_header(monkeypatch):
    """Verify specifying X-Organization-Id selects the exact organization and verified role"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[
            {
                "role": "employee",
                "organization_id": "a0000000-0000-0000-0000-000000000001",
                "organizations": {"id": "a0000000-0000-0000-0000-000000000001", "name": "Acme Systems", "slug": "acme-systems"}
            },
            {
                "role": "admin",
                "organization_id": "a0000000-0000-0000-0000-000000000002",
                "organizations": {"id": "a0000000-0000-0000-0000-000000000002", "name": "Cyberdyne Labs", "slug": "cyberdyne-labs"}
            },
        ]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(sub="b0000000-0000-0000-0000-000000000001")

    # Explicitly select Org 2 (Cyberdyne Labs) where user is Admin
    response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": "a0000000-0000-0000-0000-000000000002"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["organization_id"] == "a0000000-0000-0000-0000-000000000002"
    assert data["organization_name"] == "Cyberdyne Labs"
    assert data["role"] == "admin"


def test_explicit_header_unauthorized_organization_returns_403(monkeypatch):
    """Verify selecting an organization the user does NOT belong to is rejected with 403"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "employee",
            "organization_id": "a0000000-0000-0000-0000-000000000001",
            "organizations": {"id": "a0000000-0000-0000-0000-000000000001", "name": "Acme Systems", "slug": "acme-systems"}
        }]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(sub="b0000000-0000-0000-0000-000000000001")

    # Requesting Org 999 (unauthorized)
    response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": "a0000000-0000-0000-0000-999999999999"
        }
    )
    assert response.status_code == 403
    assert "User is not an active member of requested organization" in response.json()["detail"]


# =============================================================================
# 3. CROSS-TENANT RESOURCE ISOLATION TESTS
# =============================================================================

def test_cross_organization_resource_access_boundary():
    """Verify verify_resource_organization_access strictly blocks cross-tenant access"""
    user_org1 = AuthenticatedUser(
        user_id="b0000000-0000-0000-0000-000000000001",
        email="employee@acme.corp",
        organization_id="a0000000-0000-0000-0000-000000000001",
        organization_name="Acme Systems",
        role=UserRoleEnum.EMPLOYEE,
    )

    # 1. Accessing resource of same organization -> Allowed without exception
    verify_resource_organization_access("a0000000-0000-0000-0000-000000000001", user_org1)

    # 2. Accessing resource of another organization -> Raises 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        verify_resource_organization_access("a0000000-0000-0000-0000-000000000002", user_org1)

    assert exc_info.value.status_code == 403
    assert "Access denied: Target resource belongs to organization" in exc_info.value.detail
    assert "a0000000-0000-0000-0000-000000000002" in exc_info.value.detail
    assert "a0000000-0000-0000-0000-000000000001" in exc_info.value.detail


# =============================================================================
# 4. FAIL-CLOSED MEMBERSHIP & DB FAILURE TESTS
# =============================================================================

def test_valid_token_with_no_organization_membership_returns_403(monkeypatch):
    """Verify valid token for a user with NO active organization membership is denied with 403"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(memberships_data=[])
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-999999999999",
        email="unassigned.user@example.com"
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
    assert "No active organization membership found" in response.json()["detail"]


def test_database_failure_fails_closed_with_500(monkeypatch):
    """Verify database lookup failure fails closed with a 500 error and never grants access"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(db_error=Exception("Connection to Supabase PostgreSQL timed out"))
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-000000000001",
        email="sarah.connor@acme.corp"
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 500
    assert "Authentication service unavailable" in response.json()["detail"]


def test_email_role_spoofing_prevented(monkeypatch):
    """Verify a user with 'admin' or 'manager' in their email CANNOT spoof roles without verified DB membership"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(memberships_data=[])
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    # Attacker crafts an email containing "admin" and "manager"
    attacker_token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-888888888888",
        email="fake.admin.manager@attacker.corp"
    )

    # Check /me -> Rejected with 403
    res_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {attacker_token}"}
    )
    assert res_me.status_code == 403
    assert "No active organization membership found" in res_me.json()["detail"]

    # Check /admin-area -> Rejected with 403 (does not reach role check without valid membership)
    res_admin = client.get(
        "/api/v1/auth/admin-area",
        headers={"Authorization": f"Bearer {attacker_token}"}
    )
    assert res_admin.status_code == 403


# =============================================================================
# 5. DEVELOPMENT IMPERSONATION SECURITY (X-Demo-User-Id)
# =============================================================================

def test_demo_header_disabled_by_default(monkeypatch):
    """Verify X-Demo-User-Id is rejected by default when ENABLE_DEMO_AUTH_HEADER is False"""
    monkeypatch.setattr(settings, "ENABLE_DEMO_AUTH_HEADER", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    response = client.get(
        "/api/v1/auth/admin-area",
        headers={"X-Demo-User-Id": "b0000000-0000-0000-0000-000000000008"}
    )
    assert response.status_code == 401
    assert "Missing or invalid authentication credentials" in response.json()["detail"]


def test_demo_header_prohibited_in_production(monkeypatch):
    """Verify X-Demo-User-Id is strictly prohibited in production, even if ENABLE_DEMO_AUTH_HEADER is True"""
    monkeypatch.setattr(settings, "ENABLE_DEMO_AUTH_HEADER", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    response = client.get(
        "/api/v1/auth/admin-area",
        headers={"X-Demo-User-Id": "b0000000-0000-0000-0000-000000000008"}
    )
    assert response.status_code == 401
    assert "Missing or invalid authentication credentials" in response.json()["detail"]


def test_demo_header_allowed_only_when_explicitly_opted_in(monkeypatch):
    """Verify X-Demo-User-Id functions only in non-production environments when explicitly enabled"""
    monkeypatch.setattr(settings, "ENABLE_DEMO_AUTH_HEADER", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    response = client.get(
        "/api/v1/auth/admin-area",
        headers={"X-Demo-User-Id": "b0000000-0000-0000-0000-000000000008"}
    )
    assert response.status_code == 200
    assert response.json()["admin"] == "chloe.dubois@acme.corp"


# =============================================================================
# 6. ROLE-BASED AUTHORIZATION (RBAC) GUARDS WITH VERIFIED TOKENS
# =============================================================================

def test_rbac_employee_with_verified_token(monkeypatch):
    """Verify an Employee role is blocked from Manager and Admin operations (403 Forbidden)"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "employee",
            "organization_id": "a0000000-0000-0000-0000-000000000001",
            "organizations": {"id": "a0000000-0000-0000-0000-000000000001", "name": "Acme Systems", "slug": "acme-systems"}
        }]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    employee_token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-000000000002",
        email="alex.chen@acme.corp"
    )

    # 1. Accessing Employee / Me area -> 200
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {employee_token}"})
    assert res_me.status_code == 200
    assert res_me.json()["role"] == "employee"

    # 2. Accessing Manager area -> 403
    res_manager = client.get("/api/v1/auth/manager-area", headers={"Authorization": f"Bearer {employee_token}"})
    assert res_manager.status_code == 403
    assert "Access denied" in res_manager.json()["detail"]

    # 3. Accessing Admin area -> 403
    res_admin = client.get("/api/v1/auth/admin-area", headers={"Authorization": f"Bearer {employee_token}"})
    assert res_admin.status_code == 403
    assert "Access denied" in res_admin.json()["detail"]


def test_rbac_manager_with_verified_token(monkeypatch):
    """Verify a Manager role can access manager endpoints but is blocked from admin endpoints"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "manager",
            "organization_id": "a0000000-0000-0000-0000-000000000001",
            "organizations": {"id": "a0000000-0000-0000-0000-000000000001", "name": "Acme Systems", "slug": "acme-systems"}
        }]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    manager_token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-000000000001",
        email="sarah.connor@acme.corp"
    )

    res_manager = client.get("/api/v1/auth/manager-area", headers={"Authorization": f"Bearer {manager_token}"})
    assert res_manager.status_code == 200
    assert res_manager.json()["role"] == "manager"

    res_admin = client.get("/api/v1/auth/admin-area", headers={"Authorization": f"Bearer {manager_token}"})
    assert res_admin.status_code == 403
    assert "Access denied" in res_admin.json()["detail"]


def test_rbac_admin_with_verified_token(monkeypatch):
    """Verify an Admin role has full access to both manager and admin restricted areas"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "admin",
            "organization_id": "a0000000-0000-0000-0000-000000000001",
            "organizations": {"id": "a0000000-0000-0000-0000-000000000001", "name": "Acme Systems", "slug": "acme-systems"}
        }]
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    admin_token = generate_custom_jwt(
        sub="b0000000-0000-0000-0000-000000000008",
        email="chloe.dubois@acme.corp"
    )

    res_manager = client.get("/api/v1/auth/manager-area", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_manager.status_code == 200

    res_admin = client.get("/api/v1/auth/admin-area", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    assert res_admin.json()["role"] == "admin"


# =============================================================================
# 7. ORGANIZATION BOOTSTRAP & SLUG LOGIC TESTS
# =============================================================================

def test_slug_format_validation():
    """Verify organization slug validation complies with database CHECK (slug ~ '^[a-z0-9-]+$')"""
    import re
    slug_regex = re.compile(r"^[a-z0-9-]+$")

    valid_slugs = ["acme-corp", "cyberdyne-101", "alpha-team", "engineering"]
    invalid_slugs = ["Acme-Corp", "acme_corp", "acme corp", "acme.corp", "acme/corp", "acme@corp", ""]

    for slug in valid_slugs:
        assert bool(slug_regex.match(slug)), f"Expected {slug} to be valid"

    for slug in invalid_slugs:
        assert not bool(slug_regex.match(slug)), f"Expected {slug} to be invalid"


def test_bootstrap_requires_authenticated_session_when_missing():
    """Verify organization bootstrap cannot proceed without an authenticated user token"""
    # Unauthenticated client attempting to access protected endpoints
    res = client.get("/api/v1/auth/organization")
    assert res.status_code == 401
    assert "Missing or invalid authentication credentials" in res.json()["detail"]


# =============================================================================
# 8. HEALTHCHECK
# =============================================================================

def test_health_check():
    """Verify backend health endpoint is accessible and healthy"""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.2.0"


# =============================================================================
# 9. ORGANIZER AUTHORIZATION & LEAST PRIVILEGE GOVERNANCE TESTS
# =============================================================================

def test_rbac_organizer_with_verified_token(monkeypatch):
    """Verify an Organizer role has access to organizer, admin, and manager restricted areas"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    org_id = "a0000000-0000-0000-0000-000000000001"
    organizer_uid = "b0000000-0000-0000-0000-000000000099"

    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "admin",
            "organization_id": org_id,
            "organizations": {"id": org_id, "name": "Acme Systems", "slug": "acme-systems"}
        }],
        earliest_member_data=[{"user_id": organizer_uid}],
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(
        sub=organizer_uid,
        email="founder@acme.corp"
    )

    # 1. Accessing Organizer Area -> 200
    res_org = client.get("/api/v1/auth/organizer-area", headers={"Authorization": f"Bearer {token}"})
    assert res_org.status_code == 200
    assert res_org.json()["role"] == "organizer"
    assert res_org.json()["organizer"] == "founder@acme.corp"

    # 2. Accessing Admin Area -> 200
    res_adm = client.get("/api/v1/auth/admin-area", headers={"Authorization": f"Bearer {token}"})
    assert res_adm.status_code == 200

    # 3. Accessing Manager Area -> 200
    res_mgr = client.get("/api/v1/auth/manager-area", headers={"Authorization": f"Bearer {token}"})
    assert res_mgr.status_code == 200

    # 4. Accessing Profile -> role is organizer
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["role"] == "organizer"


def test_admin_forbidden_from_organizer_area(monkeypatch):
    """Verify an ordinary Admin (non-creator) cannot access Organizer-exclusive endpoints (Least Privilege)"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    org_id = "a0000000-0000-0000-0000-000000000001"
    founder_uid = "b0000000-0000-0000-0000-000000000099"
    admin_uid = "b0000000-0000-0000-0000-000000000008"

    mock_db = MockSupabaseAdmin(
        memberships_data=[{
            "role": "admin",
            "organization_id": org_id,
            "organizations": {"id": org_id, "name": "Acme Systems", "slug": "acme-systems"}
        }],
        earliest_member_data=[{"user_id": founder_uid}],  # Different founder UID
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    admin_token = generate_custom_jwt(
        sub=admin_uid,
        email="chloe.dubois@acme.corp"
    )

    # 1. Ordinary Admin CAN access Admin area
    res_adm = client.get("/api/v1/auth/admin-area", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_adm.status_code == 200
    assert res_adm.json()["role"] == "admin"

    # 2. Ordinary Admin CANNOT access Organizer area (403 Forbidden)
    res_org = client.get("/api/v1/auth/organizer-area", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_org.status_code == 403
    assert "Access denied" in res_org.json()["detail"]
    assert "organizer" in res_org.json()["detail"]


def test_manager_and_employee_forbidden_from_organizer_area(monkeypatch):
    """Verify Managers and Employees are strictly blocked from Organizer-exclusive endpoints"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    org_id = "a0000000-0000-0000-0000-000000000001"

    # Test Manager
    mock_db_mgr = MockSupabaseAdmin(
        memberships_data=[{
            "role": "manager",
            "organization_id": org_id,
            "organizations": {"id": org_id, "name": "Acme Systems", "slug": "acme-systems"}
        }],
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db_mgr)
    mgr_token = generate_custom_jwt(sub="b0000000-0000-0000-0000-000000000001", email="sarah.connor@acme.corp")

    res_mgr = client.get("/api/v1/auth/organizer-area", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_mgr.status_code == 403

    # Test Employee
    mock_db_emp = MockSupabaseAdmin(
        memberships_data=[{
            "role": "employee",
            "organization_id": org_id,
            "organizations": {"id": org_id, "name": "Acme Systems", "slug": "acme-systems"}
        }],
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db_emp)
    emp_token = generate_custom_jwt(sub="b0000000-0000-0000-0000-000000000002", email="alex.chen@acme.corp")

    res_emp = client.get("/api/v1/auth/organizer-area", headers={"Authorization": f"Bearer {emp_token}"})
    assert res_emp.status_code == 403


def test_multi_org_role_isolation_organizer_and_employee(monkeypatch):
    """Verify multi-org role isolation: Organizer in Org 1 cannot use privileged access in Org 2"""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    user_uid = "b0000000-0000-0000-0000-000000000050"
    org_1 = "a0000000-0000-0000-0000-000000000001"
    org_2 = "a0000000-0000-0000-0000-000000000002"

    mock_db = MockSupabaseAdmin(
        memberships_data=[
            {
                "role": "admin",
                "organization_id": org_1,
                "organizations": {"id": org_1, "name": "Org One", "slug": "org-one"}
            },
            {
                "role": "employee",
                "organization_id": org_2,
                "organizations": {"id": org_2, "name": "Org Two", "slug": "org-two"}
            }
        ],
        earliest_member_data=[{"user_id": user_uid}],
    )
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: mock_db)

    token = generate_custom_jwt(sub=user_uid, email="user@acme.corp")

    # 1. With X-Organization-Id: Org 1 -> Has Organizer access
    res_org1 = client.get(
        "/api/v1/auth/organizer-area",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_1}
    )
    assert res_org1.status_code == 200
    assert res_org1.json()["role"] == "organizer"

    # 2. With X-Organization-Id: Org 2 -> Strictly Employee access; Organizer & Admin areas return 403
    res_org2 = client.get(
        "/api/v1/auth/organizer-area",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_2}
    )
    assert res_org2.status_code == 403
    assert "Access denied" in res_org2.json()["detail"]

    res_admin2 = client.get(
        "/api/v1/auth/admin-area",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_2}
    )
    assert res_admin2.status_code == 403
