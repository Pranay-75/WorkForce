-- =============================================================================
-- WorkForce Database Migration: Admin & HR Role Governance & Privilege Boundary
-- File: supabase/migrations/20261102000001_admin_and_hr_role_governance.sql
-- =============================================================================
-- ROLE RULES ENFORCED:
-- - Organizer can assign Admin, HR, Manager, and Staff (employee).
-- - Admin can assign HR, Manager, and Staff, but cannot assign or promote anyone to Admin.
-- - HR, Manager, and Staff cannot assign roles.
-- - Only an Organizer can assign or promote anyone to Admin.
-- - Demoting or modifying an Admin's role is restricted to the Organizer.
-- - Demoting the Organizer is forbidden (ownership transfer required).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper: is_org_admin (Canonical)
-- Returns TRUE if caller is an active Organizer or active Admin in the org.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
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
              m.role IN ('organizer'::public.user_role, 'admin'::public.user_role)
              OR o.created_by = auth.uid()
          )
    );
$$;

ALTER FUNCTION public.is_org_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. RPC: add_organization_member
-- Enforces:
-- - Caller must be Organizer or Admin.
-- - Target role 'admin' can ONLY be added by the Organizer.
-- - Target role 'organizer' is strictly rejected.
-- -----------------------------------------------------------------------------
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
    v_is_organizer BOOLEAN;
    v_is_admin BOOLEAN;
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
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to add members.' USING ERRCODE = '42501';
    END IF;

    -- Caller authorization check
    v_is_organizer := public.is_org_organizer(p_organization_id);
    v_is_admin := public.is_org_admin(p_organization_id);

    IF NOT (v_is_organizer OR v_is_admin) THEN
        RAISE EXCEPTION 'Only organization administrators or organizers can add members.' USING ERRCODE = '42501';
    END IF;

    IF p_email IS NULL OR pg_catalog.btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Member email address is required.' USING ERRCODE = '22023';
    END IF;
    v_clean_email := pg_catalog.lower(pg_catalog.btrim(p_email));

    IF p_role IS NULL THEN
        RAISE EXCEPTION 'A valid organization role must be specified.' USING ERRCODE = '22023';
    END IF;

    IF p_role = 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Cannot add a member as organizer. Ownership must be transferred.' USING ERRCODE = '42501';
    END IF;

    -- Privilege escalation prevention: Only Organizer can assign or invite Admin
    IF p_role = 'admin'::public.user_role AND NOT v_is_organizer THEN
        RAISE EXCEPTION 'Only the organization organizer can add or invite an administrator.' USING ERRCODE = '42501';
    END IF;

    IF p_role NOT IN (
        'admin'::public.user_role,
        'hr'::public.user_role,
        'manager'::public.user_role,
        'employee'::public.user_role
    ) THEN
        RAISE EXCEPTION 'Invalid role. Members can only be added as Admin, HR, Manager, or Employee.' USING ERRCODE = '42501';
    END IF;

    -- Check if target user profile already exists
    SELECT id INTO v_target_user_id
    FROM public.user_profiles
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_target_user_id IS NOT NULL THEN
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

            IF v_existing_role = 'organizer'::public.user_role THEN
                RAISE EXCEPTION 'Cannot modify the organizer role through member addition.' USING ERRCODE = '42501';
            END IF;

            -- Non-organizer admins cannot modify an existing admin's role
            IF v_existing_role = 'admin'::public.user_role AND NOT v_is_organizer THEN
                RAISE EXCEPTION 'Only the organization organizer can modify an administrator role.' USING ERRCODE = '42501';
            END IF;

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

    -- Audit log
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


-- -----------------------------------------------------------------------------
-- 3. RPC: update_member_role
-- Enforces:
-- - Caller must be Organizer or Admin.
-- - Only Organizer can assign or promote anyone to 'admin'.
-- - Only Organizer can modify or demote an existing 'admin'.
-- - Demoting the Organizer is forbidden.
-- -----------------------------------------------------------------------------
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
    v_is_organizer BOOLEAN;
    v_is_admin BOOLEAN;
    v_current_role public.user_role;
    v_membership_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update roles.' USING ERRCODE = '42501';
    END IF;

    v_is_organizer := public.is_org_organizer(p_organization_id);
    v_is_admin := public.is_org_admin(p_organization_id);

    IF NOT (v_is_organizer OR v_is_admin) THEN
        RAISE EXCEPTION 'Only organization administrators or organizers can update member roles.' USING ERRCODE = '42501';
    END IF;

    SELECT id, role INTO v_membership_id, v_current_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id
      AND status = 'active'::public.membership_status;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Active member not found in this organization.' USING ERRCODE = '42501';
    END IF;

    IF v_current_role = 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Cannot demote the organization organizer. Ownership must be transferred.' USING ERRCODE = '42501';
    END IF;

    IF p_new_role = 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Cannot assign organizer role directly. Use ownership transfer.' USING ERRCODE = '42501';
    END IF;

    -- Only Organizer can assign or promote anyone to Admin
    IF p_new_role = 'admin'::public.user_role AND NOT v_is_organizer THEN
        RAISE EXCEPTION 'Only the organization organizer can assign the administrator role.' USING ERRCODE = '42501';
    END IF;

    -- Only Organizer can modify or demote an existing Admin
    IF v_current_role = 'admin'::public.user_role AND NOT v_is_organizer THEN
        RAISE EXCEPTION 'Only the organization organizer can modify an administrator role.' USING ERRCODE = '42501';
    END IF;

    IF p_new_role NOT IN (
        'admin'::public.user_role,
        'hr'::public.user_role,
        'manager'::public.user_role,
        'employee'::public.user_role
    ) THEN
        RAISE EXCEPTION 'Invalid role. Allowed roles are Admin, HR, Manager, or Employee.' USING ERRCODE = '42501';
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


-- -----------------------------------------------------------------------------
-- 4. RPC: process_pending_invitations_for_user
-- Permits claiming HR, Manager, and Staff invitations.
-- Permits claiming Admin invitations ONLY if invited_by is the verified Organizer.
-- Preserves established RETURNS JSONB contract and response shape.
-- -----------------------------------------------------------------------------
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
    v_is_inviter_organizer BOOLEAN;
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
        SELECT id, organization_id, role, invited_by
        FROM public.organization_invitations
        WHERE pg_catalog.lower(email) = v_clean_email
          AND status = 'pending'
          AND expires_at > pg_catalog.timezone('utc'::text, pg_catalog.now())
        ORDER BY created_at ASC, id ASC
        FOR UPDATE
    LOOP
        -- Check if inviter is verified Organizer for Admin invitations
        IF v_inv.role = 'admin'::public.user_role THEN
            SELECT (o.created_by = v_inv.invited_by OR m.role = 'organizer'::public.user_role)
            INTO v_is_inviter_organizer
            FROM public.organizations o
            LEFT JOIN public.organization_memberships m 
                   ON m.organization_id = o.id AND m.user_id = v_inv.invited_by
            WHERE o.id = v_inv.organization_id;

            IF NOT COALESCE(v_is_inviter_organizer, FALSE) THEN
                -- Untrusted admin invitation: mark superseded, never grant admin
                UPDATE public.organization_invitations
                SET status = 'superseded'
                WHERE id = v_inv.id;
                v_superseded_count := v_superseded_count + 1;
                CONTINUE;
            END IF;
        END IF;

        -- Defense-in-depth: Invitations can only be for Admin, HR, Manager, or Employee
        IF v_inv.role NOT IN (
            'admin'::public.user_role,
            'hr'::public.user_role,
            'manager'::public.user_role,
            'employee'::public.user_role
        ) THEN
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


-- -----------------------------------------------------------------------------
-- 5. RPC: remove_organization_member
-- Enforces:
-- - Organizer and Admin can remove HR, Manager, and Staff (Employee).
-- - Only Organizer can remove an Admin.
-- - No one can remove the Organizer.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_organization_member(
    p_organization_id UUID,
    p_member_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_is_organizer BOOLEAN;
    v_is_admin BOOLEAN;
    v_target_role public.user_role;
    v_membership_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_is_organizer := public.is_org_organizer(p_organization_id);
    v_is_admin := public.is_org_admin(p_organization_id);

    IF NOT (v_is_organizer OR v_is_admin) THEN
        RAISE EXCEPTION 'Only organization administrators or organizers can remove members.' USING ERRCODE = '42501';
    END IF;

    SELECT id, role INTO v_membership_id, v_target_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id
      AND status = 'active'::public.membership_status;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Active member not found in this organization.' USING ERRCODE = '42501';
    END IF;

    IF v_target_role = 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Cannot remove the organization organizer. Ownership must be transferred.' USING ERRCODE = '42501';
    END IF;

    -- Only Organizer can remove an Admin
    IF v_target_role = 'admin'::public.user_role AND NOT v_is_organizer THEN
        RAISE EXCEPTION 'Only the organization organizer can remove an administrator.' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.organization_memberships WHERE id = v_membership_id;

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
        'member.removed',
        pg_catalog.jsonb_build_object(
            'removed_user_id', p_member_user_id,
            'role', v_target_role,
            'membership_id', v_membership_id
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'member_removed',
        'membership_id', v_membership_id,
        'user_id', p_member_user_id,
        'role', v_target_role
    );
END;
$$;

ALTER FUNCTION public.remove_organization_member(UUID, UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 6. Table Constraint: Update chk_org_invitations_role on organization_invitations
-- Permits pending invitations for Admin (Organizer-only), HR, Manager, and Employee.
-- Strictly excludes 'organizer' role from pending invitations.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'chk_org_invitations_role'
          AND t.relname = 'organization_invitations'
          AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.organization_invitations DROP CONSTRAINT chk_org_invitations_role;
    END IF;

    ALTER TABLE public.organization_invitations
    ADD CONSTRAINT chk_org_invitations_role
    CHECK (
        status <> 'pending'
        OR role IN (
            'admin'::public.user_role,
            'hr'::public.user_role,
            'manager'::public.user_role,
            'employee'::public.user_role
        )
    );
END $$;


