-- =============================================================================
-- WorkForce Database Migration: Security & Concurrency Hardening
-- File: supabase/migrations/20261014000004_security_and_concurrency_hardening.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. HARDEN INVITATION ROLE GOVERNANCE
-- Reject any invitation assigning the 'admin' role. Admin promotion must use
-- the separately authorized and audited promote_member_to_admin() RPC.
-- =============================================================================

-- 1.1 Restrict admin invitations while preserving historical records
-- Revoke any pending admin invitations before adding the constraint.
UPDATE public.organization_invitations
SET status = 'revoked'
WHERE status = 'pending'
  AND role = 'admin'::public.user_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'organization_invitations'
          AND c.conname = 'chk_org_invitations_role'
    ) THEN
        ALTER TABLE public.organization_invitations
        ADD CONSTRAINT chk_org_invitations_role
        CHECK (
            status <> 'pending'
            OR role IN (
                'manager'::public.user_role,
                'employee'::public.user_role
            )
        );
    END IF;
END $$;

-- 1.2 Harden invite_organization_member RPC
CREATE OR REPLACE FUNCTION public.invite_organization_member(
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
    v_result JSONB;
BEGIN
    -- 1. Authentication check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to invite members.' USING ERRCODE = '42501';
    END IF;

    -- 2. Authorization check: Caller must be an active admin of the target organization
    IF NOT public.is_org_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Only organization administrators can invite members or assign roles.' USING ERRCODE = '42501';
    END IF;

    -- 3. Input sanitation & Role boundary enforcement
    IF p_email IS NULL OR pg_catalog.btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Recipient email address is required.' USING ERRCODE = '22023';
    END IF;
    v_clean_email := pg_catalog.lower(pg_catalog.btrim(p_email));

    IF p_role IS NULL THEN
        RAISE EXCEPTION 'A valid role must be specified.' USING ERRCODE = '22023';
    END IF;

    -- Strict role validation inside the SECURITY DEFINER RPC:
    -- Invitations can NEVER grant the admin role. Admin promotions must route through promote_member_to_admin().
    IF p_role = 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Invitations cannot assign the admin role. Administrator promotion must use the dedicated promotion workflow.' USING ERRCODE = '42501';
    END IF;

    IF p_role NOT IN ('manager'::public.user_role, 'employee'::public.user_role) THEN
        RAISE EXCEPTION 'Invalid role specified for invitation.' USING ERRCODE = '22023';
    END IF;

    -- 4. Check if user profile already exists
    SELECT id INTO v_target_user_id
    FROM public.user_profiles
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_target_user_id IS NOT NULL THEN
        -- Target user already registered: directly manage active membership
        SELECT id INTO v_membership_id
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND user_id = v_target_user_id;

        IF v_membership_id IS NOT NULL THEN
            UPDATE public.organization_memberships
            SET role = p_role,
                status = 'active'::public.membership_status,
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            WHERE id = v_membership_id;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'membership_updated',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );
        ELSE
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
            RETURNING id INTO v_membership_id;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'member_added',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );
        END IF;

        -- Cleanly mark any existing pending invitations for this email as accepted
        UPDATE public.organization_invitations
        SET status = 'accepted'
        WHERE organization_id = p_organization_id
          AND lower(email) = v_clean_email
          AND status = 'pending';

    ELSE
        -- Target user has not registered yet: check for existing pending invitation
        SELECT id INTO v_invitation_id
        FROM public.organization_invitations
        WHERE organization_id = p_organization_id
          AND lower(email) = v_clean_email
          AND status = 'pending'
        LIMIT 1;

        IF v_invitation_id IS NOT NULL THEN
            -- Update existing pending invitation with new role, fresh token, and new expiration
            UPDATE public.organization_invitations
            SET role = p_role,
                invited_by = v_caller_id,
                expires_at = pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '7 days'),
                token = pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
                created_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            WHERE id = v_invitation_id;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'invitation_updated',
                'invitation_id', v_invitation_id,
                'email', v_clean_email,
                'role', p_role
            );
        ELSE
            -- Insert fresh pending invitation
            INSERT INTO public.organization_invitations (
                organization_id,
                email,
                role,
                invited_by,
                status,
                expires_at
            )
            VALUES (
                p_organization_id,
                v_clean_email,
                p_role,
                v_caller_id,
                'pending',
                pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '7 days')
            )
            RETURNING id INTO v_invitation_id;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'invitation_created',
                'invitation_id', v_invitation_id,
                'email', v_clean_email,
                'role', p_role
            );
        END IF;
    END IF;

    -- 5. Audit Logging
    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        details
    )
    VALUES (
        p_organization_id,
        v_caller_id,
        v_target_user_id,
        CASE
            WHEN v_result->>'status' = 'invitation_updated' THEN 'member.invitation_updated'
            ELSE 'member.invited'
        END,
        pg_catalog.jsonb_build_object(
            'target_email', v_clean_email,
            'assigned_role', p_role,
            'status', v_result->>'status',
            'direct_membership', v_target_user_id IS NOT NULL,
            'resource_id', COALESCE(v_membership_id, v_invitation_id)
        )
    );

    RETURN v_result;
END;
$$;

ALTER FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) TO authenticated;

-- =============================================================================
-- 2. HARDEN INVITATION CLAIM BEHAVIOR
-- Prevents unverified email claims, preserves existing roles, never elevates
-- or reactivates suspended users, and marks invitations accepted only upon success.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_target_email TEXT;
    v_auth_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_inv RECORD;
    v_existing_id UUID;
    v_existing_role public.user_role;
    v_existing_status public.membership_status;
BEGIN
    v_user_id := NEW.id;

    -- 1. Trustworthy email verification check:
    -- Verify that the user exists in auth.users and has a verified email_confirmed_at timestamp.
    SELECT email, email_confirmed_at
    INTO v_auth_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_user_id;

    IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN
        -- Unverified email: strictly abort claiming
        RETURN NEW;
    END IF;

    v_target_email := pg_catalog.lower(pg_catalog.btrim(v_auth_email));

    IF NEW.email IS NOT NULL AND pg_catalog.lower(pg_catalog.btrim(NEW.email)) <> v_target_email THEN
        -- Email mismatch between auth.users and payload: abort
        RETURN NEW;
    END IF;

    -- User profiles record must exist before inserting membership FK
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = v_user_id
    ) THEN
        RETURN NEW;
    END IF;

    -- 2. Iterate through pending, non-expired invitations matching the verified email
    FOR v_inv IN
        SELECT id, organization_id, role
        FROM public.organization_invitations
        WHERE pg_catalog.lower(email) = v_target_email
          AND status = 'pending'
          AND expires_at > pg_catalog.timezone('utc'::text, pg_catalog.now())
        ORDER BY created_at ASC, id ASC
        FOR UPDATE
    LOOP
        -- Defense-in-depth: Never grant admin role via invitation claiming
        IF v_inv.role = 'admin'::public.user_role THEN
            CONTINUE;
        END IF;

        -- Check existing membership in target organization
        SELECT id, role, status
        INTO v_existing_id, v_existing_role, v_existing_status
        FROM public.organization_memberships
        WHERE organization_id = v_inv.organization_id
          AND user_id = v_user_id
        FOR UPDATE;

        IF v_existing_id IS NULL THEN
            -- Safe insert: user has no membership in this organization
            INSERT INTO public.organization_memberships (
                organization_id,
                user_id,
                role,
                status
            )
            VALUES (
                v_inv.organization_id,
                v_user_id,
                v_inv.role,
                'active'::public.membership_status
            );

            -- Mark invitation accepted only upon successful creation
            UPDATE public.organization_invitations
            SET status = 'accepted'
            WHERE id = v_inv.id;

        ELSIF v_existing_status = 'suspended'::public.membership_status THEN
            -- Suspended member: Do NOT reactivate, do NOT overwrite role, do NOT mark invitation accepted
            CONTINUE;

        ELSIF v_existing_status = 'active'::public.membership_status THEN
            -- Active member: Do NOT overwrite role.
            -- If role matches, invitation was redundant, mark accepted.
            -- If role differs, leave membership role intact and do NOT accept invitation.
            IF v_existing_role = v_inv.role THEN
                UPDATE public.organization_invitations
                SET status = 'accepted'
                WHERE id = v_inv.id;
            END IF;

        ELSIF v_existing_status = 'invited'::public.membership_status THEN
            -- Invited placeholder: activate membership without elevating role
            IF v_existing_role = v_inv.role THEN
                UPDATE public.organization_memberships
                SET status = 'active'::public.membership_status,
                    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
                WHERE id = v_existing_id;

                UPDATE public.organization_invitations
                SET status = 'accepted'
                WHERE id = v_inv.id;
            ELSE
                -- Keep existing role, do NOT overwrite, activate only if non-admin
                IF v_existing_role != 'admin'::public.user_role THEN
                    UPDATE public.organization_memberships
                    SET status = 'active'::public.membership_status,
                        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
                    WHERE id = v_existing_id;

                    UPDATE public.organization_invitations
                    SET status = 'accepted'
                    WHERE id = v_inv.id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.claim_pending_invitations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_pending_invitations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_invitations() TO service_role, postgres;

-- 2.2 Wire triggers for both profile creation and subsequent email confirmation
DROP TRIGGER IF EXISTS on_user_profile_claim_invitations ON public.user_profiles;
CREATE TRIGGER on_user_profile_claim_invitations
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.claim_pending_invitations();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_claim_invitations ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_claim_invitations
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION public.claim_pending_invitations();

-- =============================================================================
-- 3. HARDEN TASK ASSIGNMENT RPC: assign_task()
-- Enforce consistent Level 1 -> Level 2 locking order, cross-tenant isolation,
-- task existence validation, and concurrent modification protection.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_task(
    p_task_id uuid,
    p_assignee_id uuid
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task public.tasks;
    v_caller_id uuid;
    v_org_id uuid;
    v_status text;
BEGIN
    -- 1. Authentication check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- 2. Identify organization of the task
    SELECT organization_id INTO v_org_id
    FROM public.tasks
    WHERE id = p_task_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Task % not found.', p_task_id USING ERRCODE = 'P0002';
    END IF;

    -- 3. Verify caller is an active manager or admin in the task's organization
    IF NOT public.is_org_manager_or_admin(v_org_id) THEN
        RAISE EXCEPTION 'Only managers and admins can assign or reassign tasks.' USING ERRCODE = '42501';
    END IF;

    -- 4. Lock Level 1: Acquire FOR SHARE on organization_memberships FIRST
    -- Maintains global lock hierarchy: organization_memberships -> tasks
    IF p_assignee_id IS NOT NULL THEN
        SELECT status::text INTO v_status
        FROM public.organization_memberships
        WHERE organization_id = v_org_id
          AND user_id = p_assignee_id
        FOR SHARE;

        IF v_status IS NULL THEN
            RAISE EXCEPTION 'Assignee must be a member of the organization.' USING ERRCODE = '23503';
        END IF;

        IF v_status <> 'active' THEN
            RAISE EXCEPTION 'Assignee must be an active member of the organization.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 5. Lock Level 2: Lock and update task SECOND, constrained by BOTH task ID and authorized organization ID
    UPDATE public.tasks
    SET assigned_to = p_assignee_id,
        updated_at = pg_catalog.now()
    WHERE id = p_task_id
      AND organization_id = v_org_id
    RETURNING * INTO v_task;

    IF NOT FOUND OR v_task.id IS NULL THEN
        RAISE EXCEPTION 'Task % not found or organization changed concurrently.', p_task_id USING ERRCODE = 'P0002';
    END IF;

    RETURN v_task;
END;
$$;

ALTER FUNCTION public.assign_task(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.assign_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_task(uuid, uuid) TO authenticated;

COMMIT;
