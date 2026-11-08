import sys
import os
from pathlib import Path

# Add backend directory to sys.path so tests can import `app` from any working directory
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Explicitly disable dotenv file loading for test-created Settings instances
# Setting ENV_FILE="" causes resolve_env_file() to return None (_env_file=None in Pydantic)
# This guarantees tests never read backend/.env or .env from disk
os.environ["ENV_FILE"] = ""

# Deterministic test-only environment overrides
# Guarantees unit tests always execute against local dummy mocks, overriding any inherited shell variables
os.environ["ENVIRONMENT"] = "development"
os.environ["SUPABASE_URL"] = "http://127.0.0.1:54321"
os.environ["SUPABASE_KEY"] = "mock-anon-key-for-unit-testing"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-role-key-for-unit-testing"
os.environ["SUPABASE_JWT_SECRET"] = "mock-jwt-secret-for-unit-testing-32-chars-long"
os.environ["ALLOW_PRODUCTION_SUPABASE"] = "false"
