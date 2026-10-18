import uuid
import jwt
from jwt import PyJWKClient, PyJWTError, ExpiredSignatureError, InvalidSignatureError, InvalidIssuerError, InvalidAudienceError
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.database import get_supabase_admin

# Caches JWKS keys from Supabase Auth endpoint
_jwks_client: Optional[PyJWKClient] = None

def get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is None and settings.SUPABASE_URL:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
        except Exception:
            _jwks_client = None
    return _jwks_client

def _validate_sub(sub: Any) -> str:
    """
    Validates that subject identifier is present, a string, and a valid UUID.
    Rejects missing, non-string, or malformed UUID strings.
    """
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing or non-string subject identifier (sub).",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        uuid_obj = uuid.UUID(sub)
        return str(uuid_obj)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject identifier (sub) is not a valid UUID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def verify_and_decode_token(
    token: str,
    secret_key_override: Optional[str] = None,
    verify_iss: bool = True,
    verify_aud: bool = True,
) -> Dict[str, Any]:
    """
    Cryptographically verifies and decodes a Supabase Auth access token.
    Never trusts a token without signature and claim verification.

    Supported verification methods in order of preference:
    1. Secret Key Override / Configured SUPABASE_JWT_SECRET (HS256).
    2. Supabase JWKS Asymmetric Verification (RS256/ES256/Ed25519).
    3. Supabase Auth Service verification (auth.get_user) only on recoverable key-retrieval errors.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expected_issuer = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if (verify_iss and settings.SUPABASE_URL) else None
    jwt_secret = secret_key_override or settings.SUPABASE_JWT_SECRET

    # Strategy 1: Shared HMAC Secret (HS256)
    if jwt_secret:
        try:
            decode_kwargs: Dict[str, Any] = {
                "algorithms": ["HS256"],
                "options": {
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": bool(expected_issuer),
                    "verify_aud": False,  # Custom Supabase audience check below
                },
            }
            if expected_issuer:
                decode_kwargs["issuer"] = expected_issuer

            payload = jwt.decode(token, jwt_secret, **decode_kwargs)

            # Validate audience if required (strictly 'authenticated' for Supabase Auth)
            if verify_aud:
                aud = payload.get("aud")
                if aud != "authenticated":
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid token audience: '{aud}'. Expected 'authenticated'.",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

            payload["sub"] = _validate_sub(payload.get("sub"))
            return payload

        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except InvalidIssuerError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token issuer is invalid or does not match this Supabase project.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except InvalidSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature. Cryptographic verification failed.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Strategy 2: Asymmetric JWKS Verification (.well-known/jwks.json)
    jwks_client = get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except Exception:
            # Key retrieval or network error; fall through to remote Supabase verification
            signing_key = None

        if signing_key:
            try:
                decode_kwargs = {
                    "algorithms": ["RS256", "ES256", "Ed25519"],
                    "options": {
                        "verify_signature": True,
                        "verify_exp": True,
                        "verify_iss": bool(expected_issuer),
                        "verify_aud": False,
                    },
                }
                if expected_issuer:
                    decode_kwargs["issuer"] = expected_issuer

                payload = jwt.decode(token, signing_key.key, **decode_kwargs)

                if verify_aud:
                    aud = payload.get("aud")
                    if aud != "authenticated":
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail=f"Invalid token audience: '{aud}'. Expected 'authenticated'.",
                            headers={"WWW-Authenticate": "Bearer"},
                        )

                payload["sub"] = _validate_sub(payload.get("sub"))
                return payload

            except ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token has expired. Please sign in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except InvalidIssuerError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token issuer is invalid or does not match this Supabase project.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except InvalidSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token signature. Cryptographic verification failed.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except PyJWTError as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid authentication token: {str(e)}",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    # Strategy 3: Supabase Auth Service Verification (Direct RPC/API)
    # Reached ONLY if local JWKS key retrieval failed or secret is not configured
    try:
        admin_client = get_supabase_admin()
        user_response = admin_client.auth.get_user(token)
        if user_response and user_response.user:
            u = user_response.user
            sub_valid = _validate_sub(u.id)
            return {
                "sub": sub_valid,
                "email": u.email,
                "role": u.role or "authenticated",
                "app_metadata": u.app_metadata,
                "user_metadata": u.user_metadata,
            }
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e).lower()
        if "expired" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # If all cryptographic verification attempts fail, reject by default
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token: Cryptographic verification failed.",
        headers={"WWW-Authenticate": "Bearer"},
    )
