import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.core.config import settings
from app.core.rate_limit import (
    get_rate_limiter_store,
    InMemorySlidingWindowStore,
    RedisSlidingWindowStore,
    sanitize_redis_url,
    get_client_identifier,
)


@pytest.fixture(autouse=True)
def reset_rate_limiter(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", ["testclient", "10.0.0.1"])
    monkeypatch.setattr(settings, "MULTI_INSTANCE_MODE", False)
    monkeypatch.setattr(settings, "REQUIRE_DISTRIBUTED_RATE_LIMIT", False)
    store = get_rate_limiter_store()
    if hasattr(store, "reset"):
        store.reset()
    yield
    if hasattr(store, "reset"):
        store.reset()


def test_public_endpoint_not_rate_limited():
    app = create_app()
    client = TestClient(app)

    for _ in range(30):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert "X-RateLimit-Limit" not in response.headers


def test_cors_options_preflight_bypasses_rate_limit():
    app = create_app()
    client = TestClient(app)

    for _ in range(30):
        response = client.options(
            "/api/v1/ai/workload-insights",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert "X-RateLimit-Limit" not in response.headers


def test_ai_endpoint_rate_limiting_enforcement():
    app = create_app()
    client = TestClient(app)

    limit = settings.RATE_LIMIT_AI_PER_MINUTE
    endpoint = "/api/v1/ai/workload-insights"

    # Make requests up to the limit
    for i in range(limit):
        response = client.post(endpoint, json={"total_employees": 10}, headers={"X-Forwarded-For": "198.51.100.1"})
        assert "X-RateLimit-Limit" in response.headers
        assert response.headers["X-RateLimit-Limit"] == str(limit)
        expected_remaining = limit - (i + 1)
        assert response.headers["X-RateLimit-Remaining"] == str(expected_remaining)

    # Next request must be throttled with 429
    throttled_response = client.post(
        endpoint,
        json={"total_employees": 10},
        headers={"X-Forwarded-For": "198.51.100.1"},
    )
    assert throttled_response.status_code == 429
    assert throttled_response.headers["X-RateLimit-Remaining"] == "0"
    assert "Retry-After" in throttled_response.headers
    assert int(throttled_response.headers["Retry-After"]) > 0
    assert "Rate limit exceeded for ai" in throttled_response.json()["detail"]


def test_rate_limit_per_client_isolation():
    app = create_app()
    client = TestClient(app)

    limit = settings.RATE_LIMIT_AI_PER_MINUTE
    endpoint = "/api/v1/ai/workload-insights"

    # Exhaust limit for Client A
    for _ in range(limit):
        client.post(endpoint, json={"total_employees": 10}, headers={"X-Forwarded-For": "203.0.113.10"})

    # Client A is blocked
    resp_a = client.post(endpoint, json={"total_employees": 10}, headers={"X-Forwarded-For": "203.0.113.10"})
    assert resp_a.status_code == 429

    # Client B should NOT be blocked
    resp_b = client.post(endpoint, json={"total_employees": 10}, headers={"X-Forwarded-For": "203.0.113.20"})
    assert resp_b.status_code != 429
    assert int(resp_b.headers["X-RateLimit-Remaining"]) == limit - 1


def test_auth_members_endpoint_rate_limiting_enforcement():
    app = create_app()
    client = TestClient(app)

    limit = settings.RATE_LIMIT_AUTH_PER_MINUTE
    endpoint = "/api/v1/auth/members/add"

    for i in range(limit):
        response = client.post(
            endpoint,
            json={"email": "newbie@example.com", "role": "employee"},
            headers={"X-Forwarded-For": "198.51.100.99"},
        )
        assert "X-RateLimit-Limit" in response.headers
        assert response.headers["X-RateLimit-Limit"] == str(limit)
        expected_remaining = limit - (i + 1)
        assert response.headers["X-RateLimit-Remaining"] == str(expected_remaining)

    # Next request throttled
    throttled = client.post(
        endpoint,
        json={"email": "newbie@example.com", "role": "employee"},
        headers={"X-Forwarded-For": "198.51.100.99"},
    )
    assert throttled.status_code == 429
    assert throttled.headers["X-RateLimit-Remaining"] == "0"
    assert "Rate limit exceeded for auth_members" in throttled.json()["detail"]


def test_redis_store_graceful_fallback_in_single_instance_mode():
    # Pass non-existent Redis URL in single-instance mode; must fall back to in-memory store without crashing
    redis_store = RedisSlidingWindowStore(redis_url="redis://127.0.0.1:63799/0")
    assert not redis_store._available

    # Should safely record and rate limit via fallback
    allowed, remaining, _ = redis_store.check_and_record("test_key", max_requests=2, window_seconds=60)
    assert allowed
    assert remaining == 1

    allowed, remaining, _ = redis_store.check_and_record("test_key", max_requests=2, window_seconds=60)
    assert allowed
    assert remaining == 0

    allowed, remaining, _ = redis_store.check_and_record("test_key", max_requests=2, window_seconds=60)
    assert not allowed
    assert remaining == 0


def test_redis_multi_instance_refuses_silent_fallback(monkeypatch):
    """SEC-01: Multi-instance production must refuse silent in-memory fallback on Redis failure."""
    monkeypatch.setattr(settings, "MULTI_INSTANCE_MODE", True)
    with pytest.raises(RuntimeError) as exc_info:
        RedisSlidingWindowStore(redis_url="redis://127.0.0.1:63799/0")
    assert "MULTI_INSTANCE_MODE is enabled" in str(exc_info.value)
    assert "Refusing silent in-memory fallback" in str(exc_info.value)


def test_redis_credentials_masked_in_sanitization():
    """SEC-01: Sensitive Redis credentials must never leak in logs or error representations."""
    raw_url = "redis://admin:super_secret_password_123@redis.render.com:6379/0"
    sanitized = sanitize_redis_url(raw_url)
    assert "super_secret_password_123" not in sanitized
    assert ":***@" in sanitized
    assert "redis.render.com:6379/0" in sanitized

    # Token with no password
    user_url = "redis://user_no_pass@redis.local:6379/0"
    assert "user_no_pass" not in sanitize_redis_url(user_url)


def test_trusted_proxy_forwarding_header_handling(monkeypatch):
    """SEC-02: Test spoofed, missing, and valid forwarding headers."""
    from starlette.requests import Request

    # Case 1: Untrusted immediate peer sending spoofed header -> Header ignored, peer IP used
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", ["10.0.0.1"])
    scope = {
        "type": "http",
        "client": ("198.51.100.55", 12345),
        "headers": [(b"x-forwarded-for", b"1.1.1.1, 2.2.2.2")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_198.51.100.55"

    # Case 2: Trusted immediate peer with multi-hop chain -> Rightmost untrusted IP extracted
    scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": [(b"x-forwarded-for", b"spoofed.client, 203.0.113.88, 10.0.0.1")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_203.0.113.88"

    # Case 3: Trusted immediate peer with single valid client IP
    scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": [(b"x-forwarded-for", b"198.51.100.77")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_198.51.100.77"

    # Case 4: Trusted peer with missing forwarding header -> Fall back to peer host
    scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": [],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_10.0.0.1"

    # Case 5: No trusted proxy configuration configured -> Direct peer IP always used
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", [])
    scope = {
        "type": "http",
        "client": ("192.168.1.100", 12345),
        "headers": [(b"x-forwarded-for", b"8.8.8.8")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_192.168.1.100"


# =============================================================================
# PHASE 3.1 TESTS: STABLE IDENTITIES, TOKEN ROTATION, FORGED JWTS, CIDR & REDIS
# =============================================================================

TEST_JWT_SECRET = "rate-limit-super-secret-key-for-testing-32bytes!"

def create_test_token(sub: str, secret: str = TEST_JWT_SECRET, exp_offset: int = 3600, aud: str = "authenticated"):
    import time
    import jwt
    payload = {
        "sub": sub,
        "aud": aud,
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else None,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_token_rotation_preserves_rate_limit_bucket(monkeypatch):
    """Phase 3.1: Token refresh/rotation must NOT reset the user's rate-limit bucket."""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    app = create_app()
    client = TestClient(app)

    user_sub = "00000000-0000-0000-0000-000000000001"
    limit = settings.RATE_LIMIT_AI_PER_MINUTE
    endpoint = "/api/v1/ai/workload-insights"

    # Make limit - 1 requests with Token 1
    token_1 = create_test_token(sub=user_sub, exp_offset=3600)
    for _ in range(limit - 1):
        resp = client.post(endpoint, json={"total_employees": 10}, headers={"Authorization": f"Bearer {token_1}"})
        assert resp.status_code != 429

    # Generate Token 2 (simulating token rotation with refreshed expiration and new signature)
    token_2 = create_test_token(sub=user_sub, exp_offset=7200)
    assert token_1 != token_2

    # Request limit with Token 2 should succeed (last allowed request)
    resp = client.post(endpoint, json={"total_employees": 10}, headers={"Authorization": f"Bearer {token_2}"})
    assert resp.status_code != 429
    assert resp.headers["X-RateLimit-Remaining"] == "0"

    # Next request with Token 2 must be throttled (rotation did NOT bypass the quota)
    throttled_resp = client.post(endpoint, json={"total_employees": 10}, headers={"Authorization": f"Bearer {token_2}"})
    assert throttled_resp.status_code == 429
    assert throttled_resp.headers["X-RateLimit-Remaining"] == "0"


def test_forged_jwt_never_spoofs_victim_rate_limit(monkeypatch):
    """Phase 3.1: Forged JWTs fail cryptographic verification and fall back to IP; never spoof victim identity."""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    app = create_app()
    client = TestClient(app)

    victim_sub = "00000000-0000-0000-0000-000000000099"
    limit = settings.RATE_LIMIT_AI_PER_MINUTE
    endpoint = "/api/v1/ai/workload-insights"

    # Attacker crafts forged token with victim's sub signed with wrong secret
    forged_token = create_test_token(sub=victim_sub, secret="attacker-wrong-secret-invalid-key-32b!")

    # Attacker spams requests with forged token from IP A
    for _ in range(limit):
        client.post(
            endpoint,
            json={"total_employees": 10},
            headers={
                "Authorization": f"Bearer {forged_token}",
                "X-Forwarded-For": "198.51.100.22",
            },
        )

    # Attacker is throttled on their IP
    attacker_resp = client.post(
        endpoint,
        json={"total_employees": 10},
        headers={
            "Authorization": f"Bearer {forged_token}",
            "X-Forwarded-For": "198.51.100.22",
        },
    )
    assert attacker_resp.status_code == 429

    # The legitimate victim now makes a request with a valid token from IP B
    valid_victim_token = create_test_token(sub=victim_sub, secret=TEST_JWT_SECRET)
    victim_resp = client.post(
        endpoint,
        json={"total_employees": 10},
        headers={
            "Authorization": f"Bearer {valid_victim_token}",
            "X-Forwarded-For": "203.0.113.88",
        },
    )
    # Victim's bucket was NOT exhausted by the attacker!
    assert victim_resp.status_code != 429
    assert int(victim_resp.headers["X-RateLimit-Remaining"]) == limit - 1


def test_cross_user_isolation(monkeypatch):
    """Phase 3.1: Multiple authenticated users have strictly isolated rate limit quotas."""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    app = create_app()
    client = TestClient(app)

    endpoint = "/api/v1/ai/workload-insights"
    limit = settings.RATE_LIMIT_AI_PER_MINUTE

    user_a_token = create_test_token(sub="00000000-0000-0000-0000-00000000000a")
    user_b_token = create_test_token(sub="00000000-0000-0000-0000-00000000000b")

    # Exhaust User A's quota
    for _ in range(limit):
        client.post(endpoint, json={"total_employees": 10}, headers={"Authorization": f"Bearer {user_a_token}"})

    # User A is blocked
    resp_a = client.post(endpoint, json={"total_employees": 10}, headers={"Authorization": f"Bearer {user_a_token}"})
    assert resp_a.status_code == 429

    # User B should NOT be blocked
    resp_b = client.post(endpoint, json={"total_employees": 10}, headers={"Authorization": f"Bearer {user_b_token}"})
    assert resp_b.status_code != 429
    assert int(resp_b.headers["X-RateLimit-Remaining"]) == limit - 1


def test_trusted_proxy_cidr_range_matching(monkeypatch):
    """Phase 3.1: Support CIDR ranges in TRUSTED_PROXIES via ipaddress module."""
    from starlette.requests import Request

    # Configure multiple CIDR subnets
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"])

    # Case 1: Peer in 10.0.0.0/8 CIDR range (e.g. 10.244.5.12) is trusted proxy
    scope = {
        "type": "http",
        "client": ("10.244.5.12", 50000),
        "headers": [(b"x-forwarded-for", b"203.0.113.195, 10.244.5.12")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_203.0.113.195"

    # Case 2: Peer in 172.16.0.0/12 CIDR range (e.g. 172.20.10.1) is trusted proxy
    scope = {
        "type": "http",
        "client": ("172.20.10.1", 50000),
        "headers": [(b"x-forwarded-for", b"198.51.100.42")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_198.51.100.42"

    # Case 3: Peer outside CIDR ranges (e.g. public IP 198.51.100.99) is untrusted -> X-Forwarded-For ignored
    scope = {
        "type": "http",
        "client": ("198.51.100.99", 50000),
        "headers": [(b"x-forwarded-for", b"1.1.1.1, 2.2.2.2")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_198.51.100.99"


def test_trusted_proxy_malformed_ips_rejected_safely(monkeypatch):
    """Phase 3.1: Malformed IP strings in peers or forwarding headers must be handled safely."""
    from starlette.requests import Request

    monkeypatch.setattr(settings, "TRUSTED_PROXIES", ["10.0.0.0/8"])

    # Malformed IP in X-Forwarded-For should be safely skipped during right-to-left traversal
    scope = {
        "type": "http",
        "client": ("10.0.0.1", 50000),
        "headers": [(b"x-forwarded-for", b"203.0.113.77, not-a-valid-ip, 999.999.999.999")],
    }
    req = Request(scope)
    assert get_client_identifier(req) == "ip_203.0.113.77"


def test_redis_runtime_outage_fails_closed_with_http_503(monkeypatch):
    """Phase 3.1: When distributed rate limiting is mandatory, Redis runtime failure fails closed with HTTP 503."""
    app = create_app()
    client = TestClient(app)

    store = get_rate_limiter_store()

    # Simulate a Redis runtime outage during check_and_record
    def mock_broken_check_and_record(key, max_requests, window_seconds=60):
        from app.core.rate_limit import RedisOutageException
        raise RedisOutageException("Connection timed out to Redis cluster")

    monkeypatch.setattr(store, "check_and_record", mock_broken_check_and_record)

    endpoint = "/api/v1/ai/workload-insights"
    response = client.post(endpoint, json={"total_employees": 10}, headers={"X-Forwarded-For": "198.51.100.1"})

    assert response.status_code == 503
    assert "Rate limiting service temporarily unavailable" in response.json()["detail"]
    assert response.headers.get("Retry-After") == "5"


def test_redis_runtime_outage_fails_open_when_explicitly_configured(monkeypatch):
    """Phase 3.1: When REDIS_OUTAGE_POLICY is fail_open and distributed is not mandatory, fails open safely."""
    from app.core.rate_limit import RedisSlidingWindowStore
    monkeypatch.setattr(settings, "MULTI_INSTANCE_MODE", False)
    monkeypatch.setattr(settings, "REQUIRE_DISTRIBUTED_RATE_LIMIT", False)
    monkeypatch.setattr(settings, "REDIS_OUTAGE_POLICY", "fail_open")

    redis_store = RedisSlidingWindowStore.__new__(RedisSlidingWindowStore)
    redis_store._available = True

    # Mock client pipeline to raise connection error
    class MockBrokenClient:
        def pipeline(self):
            raise ConnectionError("Redis node unreachable")

    redis_store._client = MockBrokenClient()

    allowed, remaining, _ = redis_store.check_and_record("test_key", max_requests=10)
    assert allowed is True
    assert remaining == 10

