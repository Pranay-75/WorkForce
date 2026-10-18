from supabase import create_client, Client
from app.core.config import settings

_supabase_admin_client: Client = None

def get_supabase_admin() -> Client:
    """
    Returns privileged Supabase client for trusted server-side operations
    such as verifying membership records and running administrative queries.
    """
    global _supabase_admin_client
    if _supabase_admin_client is None:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        _supabase_admin_client = create_client(settings.SUPABASE_URL, key)
    return _supabase_admin_client

def get_supabase_client_for_user(access_token: str) -> Client:
    """
    Returns an authenticated Supabase client scoping operations
    to the specific user session and subject to PostgreSQL RLS policies.
    """
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    # Set the auth token in postgrest client headers
    client.postgrest.auth(access_token)
    return client
