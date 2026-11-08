# WorkForce — Deployment Safety Package & Staging Runbook

This document establishes the mandatory pre-flight, migration, post-verification, behavioral validation, and rollback procedures for migration `20261105000001_organizer_full_control_and_membership_boundary.sql`.

---

## 1. Migration Package Overview

| Script Name | Purpose | Execution Timing |
| :--- | :--- | :--- |
| [`supabase/deployment_safety/01_preflight_compatibility_check.sql`](file:///d:/WorkForce/supabase/deployment_safety/01_preflight_compatibility_check.sql) | Read-only dependency & schema preflight check (40 explicit checks) | Run BEFORE migration |
| [`supabase/migrations/20261105000001_organizer_full_control_and_membership_boundary.sql`](file:///d:/WorkForce/supabase/migrations/20261105000001_organizer_full_control_and_membership_boundary.sql) | Core DDL migration (5 functions) | Maintenance window |
| [`supabase/deployment_safety/02_post_migration_verification.sql`](file:///d:/WorkForce/supabase/deployment_safety/02_post_migration_verification.sql) | Verification of signatures, search paths, catalog ACLs & triggers | Immediately AFTER migration |
| [`supabase/deployment_safety/04_behavioral_validation_suite.sql`](file:///d:/WorkForce/supabase/deployment_safety/04_behavioral_validation_suite.sql) | Non-destructive behavioral probe suite (12 assertions, `BEGIN ... ROLLBACK`) | Post-verification validation |
| [`supabase/deployment_safety/03_rollback_20261105000001.sql`](file:///d:/WorkForce/supabase/deployment_safety/03_rollback_20261105000001.sql) | Exact historical rollback script | In event of regression (Emergency only) |

---

## 2. Lineage and Impact of Replaced Functions

The five functions updated in `20261105000001` originated in disparate historical migrations:

1. **`public.is_org_organizer(org_id uuid) -> boolean`**:
   - *Original Source*: Migration `20261030000001_add_member_system_and_remove_blocked_status.sql` (Line 489).
   - *Security Change*: Removed `OR o.created_by = auth.uid()` bypass. Authority is now strictly derived from an active `organization_memberships` record with `role = 'organizer'`.
2. **`public.is_org_admin(org_id uuid) -> boolean`**:
   - *Original Source*: Migration `20261102000001_admin_and_hr_role_governance.sql` (Line 18).
   - *Security Change*: Removed `OR o.created_by = auth.uid()` bypass. Authority is derived from an active `organization_memberships` record with `role IN ('organizer', 'admin')`.
3. **`public.is_org_manager_or_admin(org_id uuid) -> boolean`**:
   - *Original Source*: Migration `20261011000001_restrict_organization_creation.sql` (Line 59).
   - *RBAC Change*: Added `'organizer'` to role hierarchy so `role IN ('organizer', 'admin', 'manager')`.
4. **`public.enforce_project_manager_eligibility() -> trigger`**:
   - *Original Source*: Migration `20261014000001_projects_and_tasks_schema.sql` (Line 319).
   - *Business Rule Change*: Added `'organizer'` to permitted manager roles in trigger validation, allowing Organizers to be assigned as Project Managers.
5. **`public.cleanup_membership_references() -> trigger`**:
   - *Original Source*: Migration `20261014000001_projects_and_tasks_schema.sql` (Line 610).
   - *Data Integrity Change*: Added `'organizer'` to role de-escalation protection so Organizers are not stripped of assigned project management responsibilities upon unrelated role checks.

---

## 3. Migration Statement Rerun Safety & Trigger Design

### Statement-by-Statement Rerun Safety
Every statement in `20261105000001_organizer_full_control_and_membership_boundary.sql` is verified safe for re-execution:
- **`CREATE OR REPLACE FUNCTION`**: Replaces the AST/definition in-place while preserving the function's internal OID in `pg_proc`. It does not alter, lock, or truncate table data.
- **`ALTER FUNCTION ... OWNER TO postgres`**: Re-asserts ownership to the privileged superuser. Idempotent.
- **`REVOKE ... FROM PUBLIC, anon` / `GRANT ... TO authenticated`**: Re-asserts intended ACL entries. Idempotent.

### Absence of Trigger DROP/CREATE Statements
Trigger recreation statements (`DROP TRIGGER ...; CREATE TRIGGER ...`) are **intentionally absent** from this migration:
1. In PostgreSQL, triggers created via `CREATE TRIGGER ... EXECUTE FUNCTION <func>()` link to the function's OID (`pg_trigger.tgfoid`).
2. When `CREATE OR REPLACE FUNCTION` replaces a function with the same argument signature (or `RETURNS trigger`), PostgreSQL retains the existing `pg_proc.oid`.
3. Existing triggers (`trg_enforce_project_manager_insert`, `trg_enforce_project_manager_update`, `trg_cleanup_membership_references`) remain attached and active; they immediately execute the updated function body for all subsequent table writes.
4. Omitting `DROP TRIGGER` avoids acquiring `ACCESS EXCLUSIVE` table locks and eliminates any transient window where writes could bypass trigger validation.
5. Preflight check `01_preflight_compatibility_check.sql` validates that all three triggers exist prior to migration execution.

---

## 4. Preflight Compatibility Check Specification

[`01_preflight_compatibility_check.sql`](file:///d:/WorkForce/supabase/deployment_safety/01_preflight_compatibility_check.sql) performs **40 dynamic checks** before applying the migration:

- **Tables (5)**: `public.organizations`, `public.organization_memberships`, `public.projects`, `public.tasks`, `public.project_members`.
- **Columns (17)**:
  - `organizations`: `id`, `created_by`.
  - `organization_memberships`: `id`, `organization_id`, `user_id`, `role`, `status`.
  - `projects`: `id`, `organization_id`, `manager_id`, `name`, `status`.
  - `tasks`: `id`, `organization_id`, `assigned_to`.
  - `project_members`: `project_id`, `organization_id`, `user_id`.
- **Enums & Labels (8)**:
  - `public.user_role`: `'organizer'`, `'admin'`, `'manager'`, `'hr'`, `'employee'`.
  - `public.membership_status`: `'active'`, `'invited'`, `'suspended'`.
- **Function Dependencies (1)**: `auth.uid()`.
- **Database Roles (3)**: `postgres`, `authenticated`, `anon`.
- **Target Triggers (3)**:
  - `public.trg_enforce_project_manager_insert` on `public.projects`.
  - `public.trg_enforce_project_manager_update` on `public.projects`.
  - `public.trg_cleanup_membership_references` on `public.organization_memberships`.
- **Trigger Functions (2)**:
  - `public.enforce_project_manager_eligibility()`.
  - `public.cleanup_membership_references()`.
- **Helper Functions (1)**:
  - `public.is_org_organizer(uuid)`.

*Exit Behavior*: If any prerequisite fails, the script raises an `EXCEPTION` with a specific error code and description, halting execution. When all pass, it logs `✅ [SUCCESS] PREFLIGHT AUDIT PASSED: 40 of 40 dependency checks verified.`.

---

## 5. Post-Migration Verification Specification

[`02_post_migration_verification.sql`](file:///d:/WorkForce/supabase/deployment_safety/02_post_migration_verification.sql) validates the post-migration state:

1. **Schema Scoping**: All object searches are explicitly scoped to `n.nspname = 'public'`.
2. **Exact Identity Signature & Return Types**:
   - Checks `pg_get_function_identity_arguments()` and `pg_get_function_result()`.
   - Prevents undetected overload collisions or improper parameter definitions.
3. **Normalized Search Path Configuration (`proconfig`)**:
   - Normalizes empty search path (`{"search_path=\"\""}` formatted as `search_path=""`) for `is_org_organizer`, `is_org_admin`, and `is_org_manager_or_admin`.
   - Normalizes search path `search_path=pg_catalog, public, pg_temp` for `enforce_project_manager_eligibility` and `cleanup_membership_references`.
4. **Trigger Existence, Attachment, and Enabled State**:
   - Loops over all 3 required triggers: `trg_enforce_project_manager_insert`, `trg_enforce_project_manager_update`, `trg_cleanup_membership_references`.
   - Verifies target table attachment (`public.projects` and `public.organization_memberships`).
   - Verifies procedure binding (`enforce_project_manager_eligibility()` and `cleanup_membership_references()`).
   - Requires `tgenabled IN ('O', 'A')` (Origin or Always enabled). Fails if disabled (`'D'`) or replica-only (`'R'`).
5. **PostgreSQL Catalog ACL Inspection via `aclexplode()`**:
   - In PostgreSQL, `PUBLIC` is a pseudo-role represented in ACLs by `grantee = 0`.
   - If `pg_proc.proacl` is NULL, PostgreSQL falls back to default privileges (`acldefault('f', proowner)`), which grants `EXECUTE` to `PUBLIC`.
   - The verification script analyzes `aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner)))`:
     - Fails if `grantee = 0 AND privilege_type = 'EXECUTE'` (catches both explicit PUBLIC grants and inherited defaults).
     - Fails if `r.rolname = 'anon' AND privilege_type = 'EXECUTE'`.
     - Fails if `r.rolname NOT IN ('postgres', 'authenticated', 'service_role', 'supabase_admin', 'dashboard_user')` (detects unexpected roles).
     - For helpers: requires `r.rolname = 'authenticated' AND privilege_type = 'EXECUTE'`.
     - For trigger functions: strictly denies `authenticated` direct execute.
   - Dual-verifies effective runtime privileges via `has_function_privilege()`.

---

## 6. Behavioral Validation Suite Specification

The behavioral suite [`04_behavioral_validation_suite.sql`](file:///d:/WorkForce/supabase/deployment_safety/04_behavioral_validation_suite.sql) tests real execution under transactional isolation (`BEGIN ... ROLLBACK`):

- **Synthetic Data Isolation**: Uses `gen_random_uuid()` for all entities, preventing primary key or seed data collisions.
- **Trigger Invariant Compatibility**:
  - Automatically adapts to `on_auth_user_created -> handle_new_user()` inserting into `public.user_profiles`.
  - Satisfies `trg_enforce_membership_role_invariants` by creating dedicated synthetic organizations matching `created_by = user_id` for each organizer.
- **12 Verified Test Scenarios**:
  - `Scenario 1`: Active Organizer in Org A has organizer (`TRUE`), admin (`TRUE`), and manager (`TRUE`) privileges.
  - `Scenario 2`: Active Admin in Org A has admin (`TRUE`) and manager (`TRUE`) privileges, but denied organizer (`FALSE`).
  - `Scenario 3`: Active Manager in Org A has manager (`TRUE`) privileges, but denied admin (`FALSE`) and organizer (`FALSE`).
  - `Scenario 4`: Suspended Organizer (organization creator) is strictly denied all privileges (`FALSE`, `FALSE`, `FALSE`). Confirms elimination of the `created_by` bypass.
  - `Scenario 5`: Cross-Organization User is denied all privileges in Org A (`FALSE`, `FALSE`, `FALSE`).
  - `Scenario 6a`: Organizer is successfully designated as Project Manager.
  - `Scenario 6b`: Admin is successfully designated as Project Manager.
  - `Scenario 6c`: Manager is successfully designated as Project Manager.
  - `Scenario 6d`: Employee is rejected with SQLSTATE `42501` (`Manager must have active organizer, admin, or manager role`).
  - `Scenario 6e`: HR member is rejected with SQLSTATE `42501` (`Manager must have active organizer, admin, or manager role`).
  - `Scenario 6f`: Suspended Organizer is rejected with SQLSTATE `42501` (`Manager must have active organizer, admin, or manager role`).
  - `Scenario 6g`: Non-member UUID is rejected with SQLSTATE `23503` (Foreign key violation on `organization_memberships`).

*Guarantee*: The script concludes with `ROLLBACK`, guaranteeing zero persistent data artifacts or test remnants in the target database.

---

## 7. Rollback Safety & Emergency Warning

> [!CAUTION]
> **EMERGENCY SECURITY REGRESSION WARNING**:
> Executing [`supabase/deployment_safety/03_rollback_20261105000001.sql`](file:///d:/WorkForce/supabase/deployment_safety/03_rollback_20261105000001.sql) is an **emergency recovery procedure only**.
> 
> Rolling back restores the exact historical definitions from migrations `20261030000001`, `20261102000001`, `20261011000001`, and `20261014000001`. This reintroduces the legacy security vulnerability `OR o.created_by = auth.uid()` into `is_org_organizer` and `is_org_admin`, allowing organization creators whose membership is suspended or deleted to bypass RLS policies and execute privileged organization operations.
> 
> Rollback also removes `'organizer'` from `is_org_manager_or_admin`, `enforce_project_manager_eligibility`, and `cleanup_membership_references`, causing subsequent project creations with an Organizer as Project Manager to fail with permission errors.

### Parity Audit of Rollback Script

| Function | Rollback Source Migration | Signature & Return Parity | Search Path Parity | SecDef Parity |
| :--- | :--- | :--- | :--- | :--- |
| `is_org_organizer` | `20261030000001` (Line 489) | `(org_id uuid) -> boolean` | `""` (empty) | `SECURITY DEFINER` |
| `is_org_admin` | `20261102000001` (Line 18) | `(org_id uuid) -> boolean` | `""` (empty) | `SECURITY DEFINER` |
| `is_org_manager_or_admin` | `20261011000001` (Line 59) | `(org_id uuid) -> boolean` | `""` (empty) | `SECURITY DEFINER` |
| `enforce_project_manager_eligibility` | `20261014000001` (Line 319) | `() -> trigger` | `pg_catalog, public, pg_temp` | `SECURITY DEFINER` |
| `cleanup_membership_references` | `20261014000001` (Line 610) | `() -> trigger` | `pg_catalog, public, pg_temp` | `SECURITY DEFINER` |

---

## 8. Local Rehearsal Runbook (Developer Workstation)

Execute the complete verification sequence against local Supabase Docker before any remote deployment:

```powershell
# 1. Run Preflight Compatibility Check
Get-Content supabase/deployment_safety/01_preflight_compatibility_check.sql -Raw | docker exec -i supabase_db_WorkForce psql -U postgres -d postgres

# 2. Run Post-Migration Verification (includes Catalog ACL checks)
Get-Content supabase/deployment_safety/02_post_migration_verification.sql -Raw | docker exec -i supabase_db_WorkForce psql -U postgres -d postgres

# 3. Run Behavioral Validation Suite (Transaction isolated BEGIN...ROLLBACK)
Get-Content supabase/deployment_safety/04_behavioral_validation_suite.sql -Raw | docker exec -i supabase_db_WorkForce psql -U postgres -d postgres
```

---

## 9. Staging Rehearsal Runbook

### Staging Target Specifications
- **Staging Project ID**: `biejxkrhypkkcvpbzjhh`
- **Staging Supabase URL**: `https://biejxkrhypkkcvpbzjhh.supabase.co`
- **Production Reference (FORBIDDEN)**: `wxkjygctdonpeypgrcnf` (must NEVER be targeted during staging rehearsal)
- **Staging Environment Files**: `frontend/.env.staging`, `backend/.env.staging`, `.env.staging`

### Step 1: Upstream Git Reconciliation (Outside Sandbox)
```bash
git fetch origin main
git log HEAD..origin/main --oneline
```
Confirm no divergence exists between local `main` (5 commits ahead) and `origin/main`.

### Step 2: Database Backup
Create a snapshot in the Supabase Dashboard:
`Settings -> Database -> Backups -> Create Backup Now`.

### Step 3: Run Staging Preflight Compatibility Check
In the Staging Supabase SQL Editor:
Execute `supabase/deployment_safety/01_preflight_compatibility_check.sql`.
*Required Result*:
`NOTICE: ✅ [SUCCESS] PREFLIGHT AUDIT PASSED: 40 of 40 dependency checks verified.`

### Step 4: Execute Migration with Transaction Wrapper
In the Staging Supabase SQL Editor:
```sql
BEGIN;
-- Paste contents of supabase/migrations/20261105000001_organizer_full_control_and_membership_boundary.sql
COMMIT;
```
*Note*: The migration file itself omits an outer `BEGIN ... COMMIT` block to allow automated migration harnesses (such as `supabase db push` or CI/CD pipelines) to manage transactional boundaries independently. When applying manually in SQL Editor, the manual transaction wrapper is mandatory.

### Step 5: Execute Post-Migration Verification
In the Staging Supabase SQL Editor:
Execute `supabase/deployment_safety/02_post_migration_verification.sql`.
*Required Result*:
`NOTICE: ✅ [SUCCESS] ALL POST-MIGRATION CHECKS PASSED (100% VERIFIED)`

### Step 6: Execute Behavioral Validation Suite
In the Staging Supabase SQL Editor:
Execute `supabase/deployment_safety/04_behavioral_validation_suite.sql`.
*Required Result*:
`NOTICE: BEHAVIORAL SUITE RESULTS: 12 passed, 0 failed` followed by automatic `ROLLBACK`.

### Step 7: Staging Integration Smoke Tests & Service Execution

> [!WARNING]
> **DO NOT USE ORDINARY STARTUP COMMANDS (`npm run dev` or bare `uvicorn app.main:app`) FOR STAGING.**
> 
> - **Frontend**: Next.js automatically loads `frontend/.env.local` during standard `npm run dev`, which targets the **production** project (`wxkjygctdonpeypgrcnf`). Standard commands will connect to production.
> - **Backend**: Without an explicit `ENV_FILE`, FastAPI defaults to loading `backend/.env`, which contains the production URL. Ordinary startup is actively **blocked** by our safety guard (`ACCIDENTAL PRODUCTION DATABASE TARGETING BLOCKED`), halting execution to prevent accidental production mutations.
> 
> Environment selection must be explicit and deterministic. Use the designated staging commands below:

**Frontend Staging Startup**:
```bash
# In frontend/ directory:
npm run dev:staging

# What this does:
# 1. frontend/scripts/run_with_env.js parses frontend/.env.staging.
# 2. Verifies all 5 required staging variables (URL, project ref, anon key, publishable key, environment).
# 3. Strictly asserts project reference is biejxkrhypkkcvpbzjhh.
# 4. Strictly rejects any appearance of production reference wxkjygctdonpeypgrcnf.
# 5. Injects these variables directly into process.env before Next.js initializes,
#    guaranteeing Next.js @next/env cannot silently fall back to frontend/.env.local.
```

**Backend Staging Startup**:
```bash
# In backend/ directory:
# Linux / macOS / Bash:
ENV_FILE=.env.staging uvicorn app.main:app --port 8000 --reload

# Windows PowerShell:
$env:ENV_FILE=".env.staging"; python -m uvicorn app.main:app --port 8000 --reload

# What this does:
# 1. backend/app/core/config.py explicitly resolves backend/.env.staging via ENV_FILE.
# 2. Settings validator asserts project reference is biejxkrhypkkcvpbzjhh.
# 3. Settings validator rejects production reference wxkjygctdonpeypgrcnf.
# 4. Settings validator asserts all staging credentials are populated and not placeholders.
```

**Intentional Production Operation (Production Runtime Only)**:
```bash
# Connecting to production requires explicit dual confirmation:
ENVIRONMENT=production ALLOW_PRODUCTION_SUPABASE=true uvicorn app.main:app
```

Run frontend authorization smoke tests and backend test suites against Staging to confirm operational integrity.

---

## 10. Production Restrictions & Mandatory Approval Requirements

> [!IMPORTANT]
> **PRODUCTION DEPLOYMENT IS NOT AUTHORIZED AT THIS STAGE.**
> 
> Production deployment cannot occur until the following conditions are strictly fulfilled:
> 1. **Staging Rehearsal Sign-Off**: The complete staging rehearsal sequence (Steps 1–7 above) must execute with 100% pass rates and zero warnings.
> 2. **Engineering Leadership Approval**: Written authorization from the Lead Architect and Lead Security Engineer approving the removal of the `created_by` bypass.
> 3. **Change Window Authorization**: Execution scheduled within an approved maintenance window with incident responders on standby.
> 4. **Pre-Deployment Production Backup**: Verified production database snapshot completed immediately prior to migration.
