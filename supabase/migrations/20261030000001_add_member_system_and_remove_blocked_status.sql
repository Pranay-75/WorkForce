-- =============================================================================
-- WorkForce Phase 2 Migration: Core Schema, Member System & Task Status Hardening
-- File: supabase/migrations/20261030000001_add_member_system_and_remove_blocked_status.sql
--
-- STATUS: PROPOSED / UNAPPLIED.
-- Per project safety instructions, this file is provided for documentation and review.
-- Do NOT execute against hosted production/staging databases without explicit approval.
--
-- PREREQUISITE: Phase 1 (20261030000000_phase1_add_organizer_enum.sql) must be executed
-- and committed in a separate transaction first so that 'organizer' enum value is accessible.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TASK STATUS ENUM MIGRATION & REMOVAL OF 'blocked'
-- =============================================================================

-- Step 1.1: Convert approved legacy blocked task (504fba22) to 'todo' with safe trigger handling.
DO $$
DECLARE
    v_approved_task_id UUID := '504fba22-38d9-444b-b4de-b79b59c0bcb7';
    v_authors_org_id UUID := '98ff125e-5418-41ee-83bb-be7787f20441';
    v_trg_state CHAR(1);
    v_blocked_task_count INT;
    v_approved_task_count INT;
BEGIN
    -- 1. Inspect existing trigger state on public.tasks
    SELECT tgenabled INTO v_trg_state
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.tasks'::regclass
      AND tgname = 'trg_enforce_task_update_permissions'
      AND NOT tgisinternal;

    -- 2. Temporarily disable trigger if active ('O', 'A', 'R')
    IF v_trg_state IN ('O', 'A', 'R') THEN
        EXECUTE 'ALTER TABLE public.tasks DISABLE TRIGGER trg_enforce_task_update_permissions;';
    END IF;

    -- 3. Scope validation: check blocked task count
    SELECT COUNT(*) INTO v_blocked_task_count
    FROM public.tasks
    WHERE status = 'blocked'::public.task_status;

    IF v_blocked_task_count = 1 THEN
        -- Verify the single task is the approved target task
        SELECT COUNT(*) INTO v_approved_task_count
        FROM public.tasks
        WHERE id = v_approved_task_id
          AND organization_id = v_authors_org_id
          AND status = 'blocked'::public.task_status;

        IF v_approved_task_count <> 1 THEN
            RAISE EXCEPTION 'Aborting: Single blocked task found but does not match approved target % in org %.',
                v_approved_task_id, v_authors_org_id;
        END IF;

        UPDATE public.tasks
        SET status = 'todo'::public.task_status,
            updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
        WHERE id = v_approved_task_id
          AND organization_id = v_authors_org_id
          AND status = 'blocked'::public.task_status;

    ELSIF v_blocked_task_count > 1 THEN
        RAISE EXCEPTION 'Aborting: Found % blocked tasks. Data migration scope was strictly approved for task 504fba22. Operator triage required.',
            v_blocked_task_count;
    END IF;

    -- 4. Restore trigger to exact prior state
    IF v_trg_state = 'O' THEN
        EXECUTE 'ALTER TABLE public.tasks ENABLE TRIGGER trg_enforce_task_update_permissions;';
    ELSIF v_trg_state = 'A' THEN
        EXECUTE 'ALTER TABLE public.tasks ENABLE ALWAYS TRIGGER trg_enforce_task_update_permissions;';
    ELSIF v_trg_state = 'R' THEN
        EXECUTE 'ALTER TABLE public.tasks ENABLE REPLICA TRIGGER trg_enforce_task_update_permissions;';
    END IF;

    -- 5. Invariant assertion: zero blocked tasks remain
    SELECT COUNT(*) INTO v_blocked_task_count
    FROM public.tasks
    WHERE status = 'blocked'::public.task_status;

    IF v_blocked_task_count <> 0 THEN
        RAISE EXCEPTION 'Invariant violation: % blocked task(s) still remain in the database', v_blocked_task_count;
    END IF;

    -- 6. Enforce check constraint restricting tasks to the 4 supported statuses
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'chk_tasks_supported_statuses'
    ) THEN
        ALTER TABLE public.tasks
        ADD CONSTRAINT chk_tasks_supported_statuses
        CHECK (status::text IN ('todo', 'in_progress', 'in_review', 'completed'));
    END IF;
END $$;


-- =============================================================================
-- 2. ORGANIZATIONS OWNERSHIP & DETERMINISTIC CREATOR BACKFILL
-- =============================================================================

-- Step 2.1: Add created_by column to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);

-- Step 2.2: Deterministic backfill reconciling all organization ownership archetypes
DO $$
DECLARE
    v_admin_trg_state CHAR(1);
    v_invariant_trg_state CHAR(1);
    v_org RECORD;
    v_target_user_id UUID;
    v_target_membership_id UUID;
    v_secondary_organizer RECORD;
BEGIN
    -- 1. Inspect trigger state for last-active-admin protection
    SELECT tgenabled INTO v_admin_trg_state
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.organization_memberships'::regclass
      AND tgname = 'trg_protect_last_active_admin'
      AND NOT tgisinternal;

    IF v_admin_trg_state IN ('O', 'A', 'R') THEN
        EXECUTE 'ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;';
    END IF;

    -- Inspect pre-existing invariant trigger state if re-running
    SELECT tgenabled INTO v_invariant_trg_state
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.organization_memberships'::regclass
      AND tgname = 'trg_enforce_membership_role_invariants'
      AND NOT tgisinternal;

    IF v_invariant_trg_state IN ('O', 'A', 'R') THEN
        EXECUTE 'ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_enforce_membership_role_invariants;';
    END IF;

    -- 2. Iterate through each organization
    FOR v_org IN
        SELECT o.id, o.name, o.slug, o.created_by
        FROM public.organizations o
        ORDER BY o.created_at ASC, o.id ASC
    LOOP
        v_target_user_id := NULL;
        v_target_membership_id := NULL;

        -- Check for existing active organizer matching created_by
        IF v_org.created_by IS NOT NULL THEN
            SELECT m.user_id, m.id INTO v_target_user_id, v_target_membership_id
            FROM public.organization_memberships m
            WHERE m.organization_id = v_org.id
              AND m.user_id = v_org.created_by
              AND m.role = 'organizer'::public.user_role
              AND m.status = 'active'::public.membership_status;
        END IF;

        -- If no matching active created_by organizer, check for any existing active organizer
        IF v_target_user_id IS NULL THEN
            SELECT m.user_id, m.id INTO v_target_user_id, v_target_membership_id
            FROM public.organization_memberships m
            WHERE m.organization_id = v_org.id
              AND m.role = 'organizer'::public.user_role
              AND m.status = 'active'::public.membership_status
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT 1;
        END IF;

        -- If still no organizer found, inspect created_by pointer for an active admin
        IF v_target_user_id IS NULL AND v_org.created_by IS NOT NULL THEN
            SELECT m.user_id, m.id INTO v_target_user_id, v_target_membership_id
            FROM public.organization_memberships m
            WHERE m.organization_id = v_org.id
              AND m.user_id = v_org.created_by
              AND m.role = 'admin'::public.user_role
              AND m.status = 'active'::public.membership_status;
        END IF;

        -- If still no target found, promote earliest active admin
        IF v_target_user_id IS NULL THEN
            SELECT m.user_id, m.id INTO v_target_user_id, v_target_membership_id
            FROM public.organization_memberships m
            WHERE m.organization_id = v_org.id
              AND m.role = 'admin'::public.user_role
              AND m.status = 'active'::public.membership_status
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT 1;
        END IF;

        -- Apply reconciliation decisions in safe atomic sequence:
        IF v_target_user_id IS NOT NULL THEN
            -- Step A: Set organizations.created_by first
            IF v_org.created_by IS NULL OR v_org.created_by <> v_target_user_id THEN
                UPDATE public.organizations
                SET created_by = v_target_user_id
                WHERE id = v_org.id;
            END IF;

            -- Step B: Promote chosen target to organizer
            UPDATE public.organization_memberships
            SET role = 'organizer'::public.user_role,
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            WHERE id = v_target_membership_id
              AND role <> 'organizer'::public.user_role;

            -- Step C: Demote secondary organizers to admin to enforce single-owner policy
            FOR v_secondary_organizer IN
                SELECT m.id, m.user_id
                FROM public.organization_memberships m
                WHERE m.organization_id = v_org.id
                  AND m.role = 'organizer'::public.user_role
                  AND m.user_id <> v_target_user_id
            LOOP
                UPDATE public.organization_memberships
                SET role = 'admin'::public.user_role,
                    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
                WHERE id = v_secondary_organizer.id;

                RAISE NOTICE 'Demoted redundant secondary organizer % in org % to admin.',
                    v_secondary_organizer.user_id, v_org.id;
            END LOOP;
        ELSE
            -- Headless organization: explicitly set created_by to NULL if stale
            IF v_org.created_by IS NOT NULL THEN
                UPDATE public.organizations
                SET created_by = NULL
                WHERE id = v_org.id;
            END IF;

            RAISE WARNING 'Organization % (%) has no active admin or organizer. Explicitly set created_by to NULL. Manual operator recovery required.',
                v_org.id, v_org.slug;
        END IF;
    END LOOP;

    -- 3. Restore triggers to exact prior state
    IF v_admin_trg_state = 'O' THEN
        EXECUTE 'ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;';
    ELSIF v_admin_trg_state = 'A' THEN
        EXECUTE 'ALTER TABLE public.organization_memberships ENABLE ALWAYS TRIGGER trg_protect_last_active_admin;';
    ELSIF v_admin_trg_state = 'R' THEN
        EXECUTE 'ALTER TABLE public.organization_memberships ENABLE REPLICA TRIGGER trg_protect_last_active_admin;';
    END IF;

    IF v_invariant_trg_state = 'O' THEN
        EXECUTE 'ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_enforce_membership_role_invariants;';
    ELSIF v_invariant_trg_state = 'A' THEN
        EXECUTE 'ALTER TABLE public.organization_memberships ENABLE ALWAYS TRIGGER trg_enforce_membership_role_invariants;';
    ELSIF v_invariant_trg_state = 'R' THEN
        EXECUTE 'ALTER TABLE public.organization_memberships ENABLE REPLICA TRIGGER trg_enforce_membership_role_invariants;';
    END IF;
END $$;

-- Step 2.3: Restrict update privileges on public.organizations (only name permitted)
REVOKE UPDATE ON TABLE public.organizations FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name) ON TABLE public.organizations TO authenticated;

-- Step 2.4: Install single active organizer unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_organizer_per_org
    ON public.organization_memberships (organization_id)
    WHERE role = 'organizer'::public.user_role AND status = 'active'::public.membership_status;

-- Step 2.5: Install membership role invariant trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_membership_role_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Invariant 1: 'organizer' role requires matching organizations.created_by
    IF NEW.role = 'organizer'::public.user_role THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = NEW.organization_id
              AND o.created_by = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Cannot assign organizer role to user % without matching organization creator designation',
                NEW.user_id USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Invariant 2: Cannot demote designated organization creator
    IF TG_OP = 'UPDATE' AND OLD.role = 'organizer'::public.user_role AND NEW.role <> 'organizer'::public.user_role THEN
        IF EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = OLD.organization_id
              AND o.created_by = OLD.user_id
        ) THEN
            RAISE EXCEPTION 'Cannot demote the active organization creator. Ownership must be transferred first.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_enforce_membership_role_invariants() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_enforce_membership_role_invariants ON public.organization_memberships;
CREATE TRIGGER trg_enforce_membership_role_invariants
    BEFORE INSERT OR UPDATE OF role ON public.organization_memberships
    FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_membership_role_invariants();


-- =============================================================================
-- 2.6 OWNERSHIP TRANSFER RPC (DESIGNATED OWNER-ONLY)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
    p_organization_id UUID,
    p_new_organizer_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_current_owner_id UUID;
    v_target_membership_id UUID;
    v_target_role public.user_role;
    v_caller_membership_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_new_organizer_user_id IS NULL THEN
        RAISE EXCEPTION 'Target user ID is required.' USING ERRCODE = '22023';
    END IF;

    -- 1. Confirm organization exists and lock row
    SELECT created_by INTO v_current_owner_id
    FROM public.organizations
    WHERE id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization % not found.', p_organization_id USING ERRCODE = 'P0002';
    END IF;

    -- 2. Verify caller is the exact designated owner (created_by)
    IF v_current_owner_id IS DISTINCT FROM v_caller_id THEN
        RAISE EXCEPTION 'Only the designated organization owner can transfer ownership.' USING ERRCODE = '42501';
    END IF;

    IF v_caller_id = p_new_organizer_user_id THEN
        RAISE EXCEPTION 'Cannot transfer ownership to yourself.' USING ERRCODE = '22023';
    END IF;

    -- 3. Verify caller has active membership AND holds organizer role
    SELECT id INTO v_caller_membership_id
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = v_caller_id
      AND role = 'organizer'::public.user_role
      AND status = 'active'::public.membership_status
    FOR UPDATE;

    IF v_caller_membership_id IS NULL THEN
        RAISE EXCEPTION 'Caller must be the active organizer of this organization.' USING ERRCODE = '42501';
    END IF;

    -- 4. Verify target has active membership
    SELECT id, role INTO v_target_membership_id, v_target_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_new_organizer_user_id
      AND status = 'active'::public.membership_status
    FOR UPDATE;

    IF v_target_membership_id IS NULL THEN
        RAISE EXCEPTION 'Target user must be an active member of this organization.' USING ERRCODE = '42501';
    END IF;

    IF v_target_role = 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Target user is already an organizer.' USING ERRCODE = '22023';
    END IF;

    -- 5. Atomic transfer sequence avoiding partial unique index collision:
    -- a. Point ownership anchor to new owner first
    UPDATE public.organizations
    SET created_by = p_new_organizer_user_id,
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = p_organization_id;

    -- b. Demote current organizer to admin FIRST
    -- (Active organizer count drops from 1 to 0; invariant trigger permits because created_by != caller_id)
    UPDATE public.organization_memberships
    SET role = 'admin'::public.user_role,
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = v_caller_membership_id;

    -- c. Promote target member to organizer
    -- (Active organizer count becomes 1; matches created_by; no index collision)
    UPDATE public.organization_memberships
    SET role = 'organizer'::public.user_role,
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = v_target_membership_id;

    -- 6. Audit logging
    INSERT INTO public.organization_audit_logs (
        organization_id, actor_user_id, target_user_id, action, details
    ) VALUES (
        p_organization_id, v_caller_id, p_new_organizer_user_id,
        'organization.ownership_transferred',
        pg_catalog.jsonb_build_object('previous_owner', v_caller_id, 'new_owner', p_new_organizer_user_id)
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'ownership_transferred',
        'organization_id', p_organization_id,
        'new_organizer_user_id', p_new_organizer_user_id
    );
END;
$$;

ALTER FUNCTION public.transfer_organization_ownership(UUID, UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.transfer_organization_ownership(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_organization_ownership(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_organization_ownership(UUID, UUID) TO authenticated;


-- =============================================================================
-- 3. ORGANIZATION INVITATIONS TABLE & CONCURRENCY INDEXES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'employee',
    invited_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired', 'superseded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '30 days')
);

-- Partial unique index: strictly one pending invitation per (organization_id, lower(email))
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_unique_pending
    ON public.organization_invitations (organization_id, lower(email))
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);

-- Enable RLS on organization_invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Strip public/anon/authenticated write privileges.
-- Authenticated users CANNOT directly INSERT, UPDATE, or DELETE on organization_invitations.
-- Narrow column-level SELECT grant ensures token is NEVER exposed to clients.
REVOKE ALL ON TABLE public.organization_invitations FROM PUBLIC;
REVOKE ALL ON TABLE public.organization_invitations FROM anon;
REVOKE ALL ON TABLE public.organization_invitations FROM authenticated;

-- Narrowly scoped safe field SELECT grant (token is strictly omitted to prevent token exposure to any client)
GRANT SELECT (id, organization_id, email, role, invited_by, status, created_at, expires_at)
    ON TABLE public.organization_invitations TO authenticated;

-- Service role & Postgres maintain full access for internal triggers and SECURITY DEFINER RPCs
GRANT ALL ON TABLE public.organization_invitations TO service_role;
GRANT ALL ON TABLE public.organization_invitations TO postgres;

-- Check constraint: Forbids pending admin invitations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'chk_org_invitations_role'
    ) THEN
        ALTER TABLE public.organization_invitations
        ADD CONSTRAINT chk_org_invitations_role
        CHECK (status <> 'pending' OR role IN ('manager'::public.user_role, 'employee'::public.user_role));
    END IF;
END $$;


-- =============================================================================
-- 4. DEDICATED is_org_organizer HELPER (CANONICAL)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_org_organizer(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        INNER JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.organization_id = org_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'::public.membership_status
          AND (
              m.role = 'organizer'::public.user_role
              OR o.created_by = auth.uid()
          )
    );
$$;

ALTER FUNCTION public.is_org_organizer(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_organizer(UUID) TO authenticated;


-- =============================================================================
-- 5. DEDICATED ADD ORGANIZATION MEMBER RPC (ORGANIZER-ONLY)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_organization_member(
    p_organization_id UUID,
    p_email TEXT,
    p_role public.user_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_target_user_id UUID;
    v_clean_email TEXT;
    v_invitation_id UUID;
    v_membership_id UUID;
    v_existing_role public.user_role;
    v_existing_status public.membership_status;
    v_email_confirmed_at TIMESTAMPTZ;
    v_is_inserted BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Authentication check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to add members.' USING ERRCODE = '42501';
    END IF;

    -- 2. Authorization check: Caller MUST be the verified Organizer
    IF NOT public.is_org_organizer(p_organization_id) THEN
        RAISE EXCEPTION 'Only the organization organizer can add members.' USING ERRCODE = '42501';
    END IF;

    -- 3. Input validation & strict role boundary: Manager or Employee only
    IF p_email IS NULL OR pg_catalog.btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Member email address is required.' USING ERRCODE = '22023';
    END IF;
    v_clean_email := pg_catalog.lower(pg_catalog.btrim(p_email));

    IF p_role IS NULL THEN
        RAISE EXCEPTION 'A valid organization role must be specified.' USING ERRCODE = '22023';
    END IF;

    IF p_role NOT IN ('manager'::public.user_role, 'employee'::public.user_role) THEN
        RAISE EXCEPTION 'Invalid role. Members can only be added as Manager or Employee.' USING ERRCODE = '42501';
    END IF;

    -- 4. Check if user profile already exists
    SELECT id INTO v_target_user_id
    FROM public.user_profiles
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_target_user_id IS NOT NULL THEN
        -- Target user already registered: inspect existing membership in this organization with row lock
        SELECT id, role, status
        INTO v_membership_id, v_existing_role, v_existing_status
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND user_id = v_target_user_id
        FOR UPDATE;

        SELECT email_confirmed_at
        INTO v_email_confirmed_at
        FROM auth.users
        WHERE id = v_target_user_id;

        IF v_membership_id IS NOT NULL THEN
            IF v_existing_status = 'suspended'::public.membership_status THEN
                RAISE EXCEPTION 'Cannot modify a suspended member. Reactivation must use dedicated reinstatement.' USING ERRCODE = '42501';
            END IF;

            IF v_existing_role IN ('admin'::public.user_role, 'organizer'::public.user_role) THEN
                RAISE EXCEPTION 'Cannot modify an administrator or organizer role through member addition.' USING ERRCODE = '42501';
            END IF;

            -- Update role and preserve status
            UPDATE public.organization_memberships
            SET role = p_role,
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            WHERE id = v_membership_id;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'membership_updated',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );
        ELSIF v_email_confirmed_at IS NOT NULL THEN
            -- Verified existing auth account: directly link membership
            INSERT INTO public.organization_memberships (
                organization_id,
                user_id,
                role,
                status
            )
            VALUES (
                p_organization_id,
                v_target_user_id,
                p_role,
                'active'::public.membership_status
            )
            ON CONFLICT (organization_id, user_id) DO UPDATE SET
                role = EXCLUDED.role,
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            RETURNING id INTO v_membership_id;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'member_added',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );
        ELSE
            -- Unverified existing account: persist pending setup
            INSERT INTO public.organization_invitations (
                organization_id,
                email,
                role,
                invited_by,
                status,
                expires_at,
                token,
                created_at
            )
            VALUES (
                p_organization_id,
                v_clean_email,
                p_role,
                v_caller_id,
                'pending',
                pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '30 days'),
                pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
                pg_catalog.timezone('utc'::text, pg_catalog.now())
            )
            ON CONFLICT (organization_id, lower(email)) WHERE status = 'pending'
            DO UPDATE SET
                role = EXCLUDED.role,
                invited_by = EXCLUDED.invited_by,
                expires_at = EXCLUDED.expires_at,
                created_at = EXCLUDED.created_at
            RETURNING id, (xmax = 0) INTO v_invitation_id, v_is_inserted;

            v_result := pg_catalog.jsonb_build_object(
                'status', CASE WHEN v_is_inserted THEN 'member_pending_setup' ELSE 'member_setup_updated' END,
                'invitation_id', v_invitation_id,
                'email', v_clean_email,
                'role', p_role
            );
        END IF;

    ELSE
        -- Target user not registered yet: persist pending setup immediately
        INSERT INTO public.organization_invitations (
            organization_id,
            email,
            role,
            invited_by,
            status,
            expires_at,
            token,
            created_at
        )
        VALUES (
            p_organization_id,
            v_clean_email,
            p_role,
            v_caller_id,
            'pending',
            pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '30 days'),
            pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
            pg_catalog.timezone('utc'::text, pg_catalog.now())
        )
        ON CONFLICT (organization_id, lower(email)) WHERE status = 'pending'
        DO UPDATE SET
            role = EXCLUDED.role,
            invited_by = EXCLUDED.invited_by,
            expires_at = EXCLUDED.expires_at,
            created_at = EXCLUDED.created_at
        RETURNING id, (xmax = 0) INTO v_invitation_id, v_is_inserted;

        v_result := pg_catalog.jsonb_build_object(
            'status', CASE WHEN v_is_inserted THEN 'member_pending_setup' ELSE 'member_setup_updated' END,
            'invitation_id', v_invitation_id,
            'email', v_clean_email,
            'role', p_role
        );
    END IF;

    -- Audit logging
    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        details
    ) VALUES (
        p_organization_id,
        v_caller_id,
        v_target_user_id,
        'member.added',
        pg_catalog.jsonb_build_object(
            'target_email', v_clean_email,
            'assigned_role', p_role,
            'status', v_result->>'status'
        )
    );

    RETURN v_result;
END;
$$;

ALTER FUNCTION public.add_organization_member(UUID, TEXT, public.user_role) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.add_organization_member(UUID, TEXT, public.user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_organization_member(UUID, TEXT, public.user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_organization_member(UUID, TEXT, public.user_role) TO authenticated;


-- =============================================================================
-- 6. UPDATE MEMBER ROLE RPC (ORGANIZER-ONLY)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_member_role(
    p_organization_id UUID,
    p_member_user_id UUID,
    p_new_role public.user_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_current_role public.user_role;
    v_membership_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update roles.' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_org_organizer(p_organization_id) THEN
        RAISE EXCEPTION 'Only the organization organizer can update member roles.' USING ERRCODE = '42501';
    END IF;

    SELECT id, role INTO v_membership_id, v_current_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id
      AND status = 'active'::public.membership_status;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Active member not found in this organization.' USING ERRCODE = '42501';
    END IF;

    IF v_current_role = 'organizer'::public.user_role AND p_new_role != 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Cannot demote the organization organizer.' USING ERRCODE = '42501';
    END IF;

    IF p_new_role NOT IN (
        'manager'::public.user_role,
        'employee'::public.user_role
    ) THEN
        RAISE EXCEPTION 'Invalid role. Member roles can only be changed to Manager or Employee.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.organization_memberships
    SET role = p_new_role,
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = v_membership_id;

    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        details
    ) VALUES (
        p_organization_id,
        v_caller_id,
        p_member_user_id,
        'member.role_updated',
        pg_catalog.jsonb_build_object(
            'previous_role', v_current_role,
            'new_role', p_new_role
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'role_updated',
        'membership_id', v_membership_id,
        'user_id', p_member_user_id,
        'role', p_new_role
    );
END;
$$;

ALTER FUNCTION public.update_member_role(UUID, UUID, public.user_role) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, public.user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, public.user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, public.user_role) TO authenticated;


-- =============================================================================
-- 6.1 REVOKE ORGANIZATION INVITATION RPC (ORGANIZER-ONLY)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.revoke_organization_invitation(
    p_organization_id UUID,
    p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_inv_email TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_org_organizer(p_organization_id) THEN
        RAISE EXCEPTION 'Only the organization organizer can revoke invitations.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.organization_invitations
    SET status = 'revoked'
    WHERE id = p_invitation_id
      AND organization_id = p_organization_id
      AND status = 'pending'
    RETURNING email INTO v_inv_email;

    IF v_inv_email IS NULL THEN
        RAISE EXCEPTION 'Pending invitation not found in this organization.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        action,
        details
    ) VALUES (
        p_organization_id,
        v_caller_id,
        'invitation.revoked',
        pg_catalog.jsonb_build_object(
            'invitation_id', p_invitation_id,
            'email', v_inv_email
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'invitation_revoked',
        'invitation_id', p_invitation_id,
        'email', v_inv_email
    );
END;
$$;

ALTER FUNCTION public.revoke_organization_invitation(UUID, UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.revoke_organization_invitation(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_organization_invitation(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_organization_invitation(UUID, UUID) TO authenticated;


-- =============================================================================
-- 7. PROTECTED check_pending_setup RPC (NO INFORMATION DISCLOSURE)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_pending_setup(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN pg_catalog.jsonb_build_object(
        'status', 'ready',
        'message', 'If an invitation exists for this email address, you may proceed with account setup.'
    );
END;
$$;

ALTER FUNCTION public.check_pending_setup(TEXT) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.check_pending_setup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pending_setup(TEXT) TO anon, authenticated, service_role;


-- =============================================================================
-- 8. DEDUPLICATED INVITATION CLAIM ENGINE & CLIENT RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_pending_invitations_for_user(
    p_user_id UUID,
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_clean_email TEXT;
    v_inv RECORD;
    v_existing_id UUID;
    v_existing_role public.user_role;
    v_existing_status public.membership_status;
    v_new_membership_id UUID;
    v_claimed_count INT := 0;
    v_superseded_count INT := 0;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('claimed_count', 0, 'status', 'noop');
    END IF;

    -- 1. Verify user identity directly against auth.users
    SELECT email, email_confirmed_at
    INTO v_auth_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = p_user_id;

    IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('claimed_count', 0, 'status', 'email_unconfirmed');
    END IF;
    v_clean_email := pg_catalog.lower(pg_catalog.btrim(v_auth_email));

    -- 2. Reject mismatched or stale email argument
    IF p_email IS NOT NULL AND pg_catalog.lower(pg_catalog.btrim(p_email)) <> v_clean_email THEN
        RETURN pg_catalog.jsonb_build_object('claimed_count', 0, 'status', 'email_mismatch');
    END IF;

    -- 3. Confirm profile existence to prevent FK constraint failure
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
        RETURN pg_catalog.jsonb_build_object('claimed_count', 0, 'status', 'profile_missing');
    END IF;

    -- 4. Acquire user profile row lock to serialize intra-user claims
    PERFORM 1 FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;

    -- 5. Advisory transaction lock for cross-session claim isolation
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('workforce:invitation_claim')::integer,
        pg_catalog.hashtext(v_clean_email)::integer
    );

    -- 6. Process pending invitations matching confirmed email
    FOR v_inv IN
        SELECT id, organization_id, role
        FROM public.organization_invitations
        WHERE pg_catalog.lower(email) = v_clean_email
          AND status = 'pending'
          AND expires_at > pg_catalog.timezone('utc'::text, pg_catalog.now())
        ORDER BY created_at ASC, id ASC
        FOR UPDATE
    LOOP
        -- Defense-in-depth: Never grant admin or organizer role via invitation claiming
        IF v_inv.role NOT IN ('manager'::public.user_role, 'employee'::public.user_role) THEN
            CONTINUE;
        END IF;

        SELECT id, role, status
        INTO v_existing_id, v_existing_role, v_existing_status
        FROM public.organization_memberships
        WHERE organization_id = v_inv.organization_id
          AND user_id = p_user_id
        FOR UPDATE;

        IF v_existing_id IS NULL THEN
            -- User has no membership: insert with ON CONFLICT DO NOTHING
            INSERT INTO public.organization_memberships (
                organization_id, user_id, role, status
            )
            VALUES (
                v_inv.organization_id, p_user_id, v_inv.role, 'active'::public.membership_status
            )
            ON CONFLICT (organization_id, user_id) DO NOTHING
            RETURNING id INTO v_new_membership_id;

            IF v_new_membership_id IS NOT NULL THEN
                UPDATE public.organization_invitations
                SET status = 'accepted'
                WHERE id = v_inv.id;
                v_claimed_count := v_claimed_count + 1;
            END IF;

        ELSIF v_existing_status = 'suspended'::public.membership_status THEN
            -- Invariant: Suspended members cannot claim invitations
            CONTINUE;

        ELSIF v_existing_status = 'active'::public.membership_status THEN
            -- Invariant: Existing active memberships never change role silently
            IF v_existing_role = v_inv.role THEN
                UPDATE public.organization_invitations
                SET status = 'accepted'
                WHERE id = v_inv.id;
                v_claimed_count := v_claimed_count + 1;
            ELSE
                -- Conflicting role: mark invitation superseded without mutating membership
                UPDATE public.organization_invitations
                SET status = 'superseded'
                WHERE id = v_inv.id;
                v_superseded_count := v_superseded_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN pg_catalog.jsonb_build_object(
        'status', 'completed',
        'claimed_count', v_claimed_count,
        'superseded_count', v_superseded_count
    );
END;
$$;

ALTER FUNCTION public.process_pending_invitations_for_user(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.process_pending_invitations_for_user(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_pending_invitations_for_user(UUID, TEXT) TO service_role, postgres;

-- Trigger wrapper
CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.process_pending_invitations_for_user(NEW.id, NEW.email);
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.claim_pending_invitations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_pending_invitations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_invitations() TO service_role, postgres;

-- Client RPC wrapper
CREATE OR REPLACE FUNCTION public.claim_my_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_email TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_caller_id;
    RETURN public.process_pending_invitations_for_user(v_caller_id, v_email);
END;
$$;

ALTER FUNCTION public.claim_my_invitations() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.claim_my_invitations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_my_invitations() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_my_invitations() TO authenticated;

-- Attach triggers
DROP TRIGGER IF EXISTS on_user_profile_claim_invitations ON public.user_profiles;
DROP TRIGGER IF EXISTS on_auth_user_confirmed_claim_invitations ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_claim_invitations
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION public.claim_pending_invitations();


-- =============================================================================
-- 9. RLS POLICIES FOR ORGANIZER-ONLY MANAGEMENT
-- =============================================================================

-- Organizations update policy: Organizers can update organization details
DROP POLICY IF EXISTS "Only organization admins can update organization details" ON public.organizations;
DROP POLICY IF EXISTS "Only organization organizers can update organization details" ON public.organizations;
CREATE POLICY "Only organization organizers can update organization details"
    ON public.organizations FOR UPDATE
    TO authenticated
    USING (public.is_org_organizer(id))
    WITH CHECK (public.is_org_organizer(id));

-- Direct client insertion into organization_memberships is strictly disallowed.
DROP POLICY IF EXISTS "Only organization admins can add new members" ON public.organization_memberships;
DROP POLICY IF EXISTS "Only organization organizers can add new members" ON public.organization_memberships;

DROP POLICY IF EXISTS "Only organization admins can update memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "Only organization organizers can update memberships" ON public.organization_memberships;
CREATE POLICY "Only organization organizers can update memberships"
    ON public.organization_memberships FOR UPDATE
    TO authenticated
    USING (public.is_org_organizer(organization_id))
    WITH CHECK (
        public.is_org_organizer(organization_id)
        AND role IN (
            'manager'::public.user_role,
            'employee'::public.user_role
        )
    );

-- Invitations: Strictly Organizer-only SELECT on safe fields.
DROP POLICY IF EXISTS "Admins can view invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Organizers can view invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Organizers can view safe invitation fields in their organization" ON public.organization_invitations;
CREATE POLICY "Organizers can view safe invitation fields in their organization"
    ON public.organization_invitations FOR SELECT
    TO authenticated
    USING (
        public.is_org_organizer(organization_id)
    );

-- Drop all direct write policies for authenticated users on organization_invitations
DROP POLICY IF EXISTS "Admins can create invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Organizers can create invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Admins can update invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Organizers can update invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations in their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Organizers can delete invitations in their organization" ON public.organization_invitations;

COMMIT;
