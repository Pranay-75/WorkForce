"""Rate Limiting Architecture for WorkForce Backend API.

Necessity & Threat Model:
1. AI Endpoints (/api/v1/ai/*):
   - External Google Gemini API invocations are computationally expensive and subject to strict vendor quotas.
   - Unbounded invocations risk quota exhaustion, denial of service for other tenants, and unintended costs.
2. Member Management Endpoints (/api/v1/auth/members/*):
   - Member additions and role assignments perform privileged state mutations and external invitation dispatches.
   - Rate limiting prevents brute-force user enumeration, invitation bombing, and automated privilege testing.
3. Multi-Instance & Architectural Considerations:
   - For single-instance or local dev deployments, an in-memory sliding window using Python standard library
     (collections.deque, threading.Lock) is active by default with zero external dependencies.
   - For multi-instance, auto-scaled production deployments, an optional Redis backend (via REDIS_URL) coordinates
     rate limits globally across all cluster nodes.
   - When REDIS_URL is not configured in multi-instance environments, an explicit architectural warning is logged,
     noting that rate limits are enforced per-instance rather than globally.
4. CORS & Preflight Safety:
   - HTTP OPTIONS requests bypass rate limiting immediately to ensure preflight handshakes are never throttled.
   - Proper RFC headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After) are provided.
5. Identity & Proxy Governance (SEC-01, SEC-02 & Phase 3.1):
   - Authenticated identities are strictly based on cryptographically verified JWT subject identifiers (`sub`).
   - Unverified JWT payloads are never trusted to establish a rate-limit identity (falling back to IP).
   - Trusted proxies support CIDR notation via Python's `ipaddress` module and evaluate forwarding chains right-to-left.
   - When distributed rate limiting is mandatory, runtime Redis outages fail closed with HTTP 503.
"""

import ipaddress
import logging
import time
from collections import defaultdict, deque
from typing import Dict, Iterable, List, Optional, Tuple, Set, Union
from urllib.parse import urlparse, urlunparse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger("workforce.rate_limit")


class RedisOutageException(Exception):
    """Raised when Redis experiences a runtime failure and policy requires failing closed."""
    pass


def sanitize_redis_url(url: Optional[str]) -> str:
    """Masks Redis credentials to prevent sensitive credentials leaking into log sinks."""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        if parsed.password:
            masked_netloc = parsed.netloc.replace(f":{parsed.password}@", ":***@")
            return urlunparse(parsed._replace(netloc=masked_netloc))
        elif parsed.username:
            masked_netloc = parsed.netloc.replace(f"{parsed.username}@", "***@")
            return urlunparse(parsed._replace(netloc=masked_netloc))
        return url
    except Exception:
        return "redis://***"


def is_ip_in_trusted_proxies(ip_str: Optional[str], trusted_proxies: Optional[Union[Iterable[str], str]]) -> bool:
    """Checks whether an IP address matches any trusted proxy (exact IP, hostname, or CIDR network range).
    
    Uses Python's `ipaddress` module for robust IPv4/IPv6 CIDR and IP matching.
    Safely rejects malformed IP addresses without raising unhandled exceptions.
    """
    if not ip_str or not trusted_proxies:
        return False

    clean_ip = ip_str.strip()
    if not clean_ip:
        return False

    # Normalize trusted proxies list
    if isinstance(trusted_proxies, str):
        trusted_proxies = [trusted_proxies]

    # Fast path: exact string match (e.g. 'testclient', '127.0.0.1', 'localhost')
    if clean_ip in trusted_proxies:
        return True

    # Parse candidate IP safely
    try:
        addr = ipaddress.ip_address(clean_ip)
    except ValueError:
        # Candidate is not a valid IP address (could be a test client or hostname)
        return False

    for entry in trusted_proxies:
        if not entry:
            continue
        entry_str = str(entry).strip()
        if not entry_str:
            continue

        # Check for CIDR network (e.g., '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7')
        if "/" in entry_str:
            try:
                net = ipaddress.ip_network(entry_str, strict=False)
                if addr in net:
                    return True
            except ValueError:
                continue
        else:
            try:
                if addr == ipaddress.ip_address(entry_str):
                    return True
            except ValueError:
                # String comparison fallback for hostnames or test clients
                if clean_ip == entry_str:
                    return True

    return False


class InMemorySlidingWindowStore:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self):
        import threading
        self._lock = threading.Lock()
        self._hits: Dict[str, deque] = defaultdict(deque)

    def check_and_record(
        self, key: str, max_requests: int, window_seconds: int = 60
    ) -> Tuple[bool, int, int]:
        """Checks if request is allowed under sliding window and records hit.
        
        Returns:
            (allowed: bool, remaining: int, reset_seconds: int)
        """
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            queue = self._hits[key]
            # Expire timestamps outside the sliding window
            while queue and queue[0] <= window_start:
                queue.popleft()

            current_count = len(queue)
            if current_count >= max_requests:
                # Earliest request determines reset time
                earliest = queue[0] if queue else now
                reset_seconds = max(1, int(window_seconds - (now - earliest)))
                return False, 0, reset_seconds

            # Record hit
            queue.append(now)
            remaining = max(0, max_requests - (current_count + 1))
            earliest = queue[0]
            reset_seconds = max(1, int(window_seconds - (now - earliest)))
            return True, remaining, reset_seconds

    def reset(self):
        """Clears all stored rate limit entries (used in tests)."""
        with self._lock:
            self._hits.clear()

    def cleanup(self, max_age_seconds: int = 300):
        """Removes stale keys to prevent memory leaks."""
        now = time.time()
        window_start = now - max_age_seconds
        with self._lock:
            empty_keys = [k for k, q in self._hits.items() if not q or q[-1] <= window_start]
            for k in empty_keys:
                del self._hits[k]


class RedisSlidingWindowStore:
    """Redis-backed distributed sliding window rate limiter for multi-instance clusters."""

    def __init__(self, redis_url: str):
        sanitized_url = sanitize_redis_url(redis_url)
        is_mandatory = getattr(settings, "MULTI_INSTANCE_MODE", False) or getattr(settings, "REQUIRE_DISTRIBUTED_RATE_LIMIT", False)
        try:
            import redis
            self._client = redis.from_url(redis_url, decode_responses=True)
            self._client.ping()
            self._available = True
            logger.info(f"Distributed Redis rate limiter connected successfully to {sanitized_url}.")
        except Exception as e:
            # Never expose raw connection strings/passwords in error logs
            safe_err = type(e).__name__
            if is_mandatory:
                raise RuntimeError(
                    f"FATAL: Redis connection failed ({safe_err}) while MULTI_INSTANCE_MODE is enabled or distributed rate limiting is mandatory. "
                    f"Target: {sanitized_url}. Refusing silent in-memory fallback in multi-instance production."
                )
            logger.warning(
                f"Redis connection failed ({safe_err}) for {sanitized_url}. Falling back to in-memory rate limiter. "
                "Architectural Warning: In multi-instance deployments without Redis, rate limits are enforced per-instance."
            )
            self._available = False
            self._fallback = InMemorySlidingWindowStore()

    def check_and_record(
        self, key: str, max_requests: int, window_seconds: int = 60
    ) -> Tuple[bool, int, int]:
        if not self._available:
            return self._fallback.check_and_record(key, max_requests, window_seconds)

        now = time.time()
        window_start = now - window_seconds
        redis_key = f"rate_limit:{key}"

        try:
            pipe = self._client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zcard(redis_key)
            pipe.zrange(redis_key, 0, 0, withscores=True)
            results = pipe.execute()

            current_count = results[1]
            earliest_items = results[2]

            if current_count >= max_requests:
                earliest_time = earliest_items[0][1] if earliest_items else now
                reset_seconds = max(1, int(window_seconds - (now - earliest_time)))
                return False, 0, reset_seconds

            pipe = self._client.pipeline()
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, window_seconds + 5)
            pipe.execute()

            remaining = max(0, max_requests - (current_count + 1))
            earliest_time = earliest_items[0][1] if earliest_items else now
            reset_seconds = max(1, int(window_seconds - (now - earliest_time)))
            return True, remaining, reset_seconds
        except Exception as e:
            safe_err = type(e).__name__
            is_mandatory = (
                getattr(settings, "MULTI_INSTANCE_MODE", False)
                or getattr(settings, "REQUIRE_DISTRIBUTED_RATE_LIMIT", False)
            )
            policy = getattr(settings, "REDIS_OUTAGE_POLICY", "fail_closed").lower()

            # When distributed rate limiting is mandatory, fail closed rather than silently bypassing limits
            if is_mandatory or policy == "fail_closed":
                logger.error(
                    f"Redis rate limiter runtime failure ({safe_err}). "
                    f"Distributed rate limiting policy is {policy}; failing closed with HTTP 503."
                )
                raise RedisOutageException(f"Redis rate limiter runtime failure ({safe_err})")

            logger.warning(
                f"Redis rate limiter runtime failure ({safe_err}); policy is {policy}, allowing request to fail open."
            )
            return True, max_requests, 0

    def reset(self):
        if not self._available:
            self._fallback.reset()


# Global Rate Limiter Store Singleton
_rate_limiter_store = None

def get_rate_limiter_store():
    global _rate_limiter_store
    if _rate_limiter_store is None:
        is_mandatory = (
            getattr(settings, "MULTI_INSTANCE_MODE", False)
            or getattr(settings, "REQUIRE_DISTRIBUTED_RATE_LIMIT", False)
        )
        if is_mandatory:
            if not getattr(settings, "REDIS_URL", None):
                raise RuntimeError(
                    "FATAL: Distributed rate limiting is mandatory, but REDIS_URL is not configured. "
                    "Refusing silent in-memory rate limiting in multi-instance production."
                )
        if getattr(settings, "REDIS_URL", None):
            _rate_limiter_store = RedisSlidingWindowStore(settings.REDIS_URL)
        else:
            _rate_limiter_store = InMemorySlidingWindowStore()
    return _rate_limiter_store


def get_client_identifier(request: Request) -> str:
    """Extracts a stable client identifier for rate limiting.
    
    Phase 3.1 Security Hardening:
    - Authenticated users are deterministically identified by their verified JWT subject (`sub`).
    - Raw token strings are NEVER hashed as identities, ensuring token refresh/rotation does not reset quotas.
    - Unverified JWT payloads are NEVER trusted to establish rate-limit identities; invalid signatures fall back to IP.
    - Forwarding headers (X-Forwarded-For) are ONLY inspected if the immediate connecting peer matches TRUSTED_PROXIES.
    - CIDR ranges (e.g. 10.0.0.0/8, 172.16.0.0/12) are fully supported via Python's `ipaddress` module.
    - Forwarding chains are evaluated right-to-left to locate the rightmost non-proxy IP, neutralizing spoofed leftmost headers.
    - Malformed IP addresses are safely rejected.
    """
    # 1. Existing verified authentication context on request.state (if set upstream or by dependency)
    if hasattr(request.state, "authenticated_user") and request.state.authenticated_user:
        user = request.state.authenticated_user
        return f"user_{user.user_id}"

    # 2. Bearer token cryptographic verification (extract stable sub claim)
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        try:
            from app.core.security import verify_and_decode_token
            payload = verify_and_decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                # Cache verified token payload on request state for downstream handlers
                if hasattr(request, "state"):
                    request.state.verified_sub = user_id
                    request.state.verified_jwt_payload = payload
                return f"user_{user_id}"
        except Exception as e:
            # Cryptographic signature, issuer, audience, expiration, or format verification failed.
            # NEVER trust an unverified JWT payload to establish a rate-limit identity.
            # Do NOT extract sub from an unverified token; fall through to anonymous IP rate limiting.
            logger.debug(f"Bearer token cryptographic verification failed for rate limiting: {type(e).__name__}. Falling back to IP.")

    # 3. Development / Demo mock identity (strictly opt-in and prohibited in production)
    x_demo_user_id = request.headers.get("x-demo-user-id")
    if (
        settings.ENVIRONMENT != "production"
        and getattr(settings, "ENABLE_DEMO_AUTH_HEADER", False)
        and x_demo_user_id
    ):
        from app.api.deps import DEV_ROLE_MAPPING
        if x_demo_user_id in DEV_ROLE_MAPPING:
            return f"user_{x_demo_user_id}"

    # 4. Anonymous IP-based rate limiting with CIDR trusted proxy support
    peer_ip = request.client.host if (request.client and request.client.host) else None
    trusted_proxies = getattr(settings, "TRUSTED_PROXIES", [])

    if peer_ip and is_ip_in_trusted_proxies(peer_ip, trusted_proxies):
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            hops = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
            # Right-to-left traversal: select rightmost IP that is not a trusted proxy
            for hop in reversed(hops):
                if not is_ip_in_trusted_proxies(hop, trusted_proxies):
                    # Validate hop is a valid IP address
                    try:
                        ipaddress.ip_address(hop)
                        return f"ip_{hop}"
                    except ValueError:
                        # Malformed IP address in chain; reject safely and continue traversal
                        continue

    # Safe fallback: direct peer host
    if peer_ip:
        try:
            ipaddress.ip_address(peer_ip)
            return f"ip_{peer_ip}"
        except ValueError:
            return f"ip_{peer_ip}"

    return "unknown_client"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware enforcing sliding-window rate limits on sensitive endpoints."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Always bypass preflight CORS OPTIONS requests immediately
        if request.method == "OPTIONS":
            return await call_next(request)

        # 2. Check if rate limiting is globally enabled
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return await call_next(request)

        path = request.url.path

        # Determine rate limit bucket
        limit: Optional[int] = None
        category: Optional[str] = None

        if path.startswith("/api/v1/ai"):
            limit = getattr(settings, "RATE_LIMIT_AI_PER_MINUTE", 15)
            category = "ai"
        elif path.startswith("/api/v1/auth/members"):
            limit = getattr(settings, "RATE_LIMIT_AUTH_PER_MINUTE", 20)
            category = "auth_members"

        # If endpoint is not throttled, proceed normally
        if limit is None or category is None:
            return await call_next(request)

        client_id = get_client_identifier(request)
        rate_key = f"{category}:{client_id}"

        store = get_rate_limiter_store()
        try:
            allowed, remaining, reset_seconds = store.check_and_record(rate_key, limit, window_seconds=60)
        except RedisOutageException:
            # When distributed limiting is mandatory, fail closed with HTTP 503 rather than silently bypassing limits
            headers = {
                "Retry-After": "5",
            }
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Rate limiting service temporarily unavailable. Please retry shortly."
                },
                headers=headers,
            )

        if not allowed:
            headers = {
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_seconds),
                "Retry-After": str(reset_seconds),
            }
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded for {category}. Please try again in {reset_seconds} seconds."
                },
                headers=headers,
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_seconds)
        return response
