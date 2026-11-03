-- =============================================================================
-- WorkForce Database Migration: Organization Member Invitations & Role Governance
-- File: supabase/migrations/20261014000002_member_invitations_and_roles.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: organization_invitations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'employee',
    invited_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);

-- Enable RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations for their organization
DROP POLICY IF EXISTS "Admins can view invitations in their organization" ON public.organization_invitations;
CREATE POLICY "Admins can view invitations in their organization"
    ON public.organization_invitations FOR SELECT
    TO authenticated
    USING (public.is_org_admin(organization_id));

-- Admins can create invitations
DROP POLICY IF EXISTS "Admins can create invitations in their organization" ON public.organization_invitations;
CREATE POLICY "Admins can create invitations in their organization"
    ON public.organization_invitations FOR INSERT
    TO authenticated
    WITH CHECK (public.is_org_admin(organization_id));

-- Admins can update/revoke invitations
DROP POLICY IF EXISTS "Admins can update invitations in their organization" ON public.organization_invitations;
CREATE POLICY "Admins can update invitations in their organization"
    ON public.organization_invitations FOR UPDATE
    TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- Admins can delete invitations
DROP POLICY IF EXISTS "Admins can delete invitations in their organization" ON public.organization_invitations;
CREATE POLICY "Admins can delete invitations in their organization"
    ON public.organization_invitations FOR DELETE
    TO authenticated
    USING (public.is_org_admin(organization_id));

-- -----------------------------------------------------------------------------
-- 2. RPC: invite_organization_member
-- Only an active organization admin can invite or add members
-- -----------------------------------------------------------------------------
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
        RAISE EXCEPTION 'Authentication required to invite members.';
    END IF;

    -- 2. Authorization check: Caller must be an active admin of the target organization
    IF NOT public.is_org_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Only organization administrators can invite members or assign roles.';
    END IF;

    -- 3. Input sanitation
    IF p_email IS NULL OR pg_catalog.btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Recipient email address is required.';
    END IF;
    v_clean_email := pg_catalog.lower(pg_catalog.btrim(p_email));

    IF p_role IS NULL THEN
        RAISE EXCEPTION 'A valid role must be specified.';
    END IF;

    -- 4. Check if user profile already exists
    SELECT id INTO v_target_user_id
    FROM public.user_profiles
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_target_user_id IS NOT NULL THEN
        -- Check if already a member
        SELECT id INTO v_membership_id
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND user_id = v_target_user_id;

        IF v_membership_id IS NOT NULL THEN
            -- Update existing membership status and role if needed
            UPDATE public.organization_memberships
            SET role = p_role,
                status = 'active',
                updated_at = timezone('utc'::text, now())
            WHERE id = v_membership_id;

            v_result := jsonb_build_object(
                'status', 'membership_updated',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );
        ELSE
            -- Direct membership insertion for registered user
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
                'active'
            )
            RETURNING id INTO v_membership_id;

            v_result := jsonb_build_object(
                'status', 'member_added',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );
        END IF;
    ELSE
        -- User has not registered yet: create or update pending invitation
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
            timezone('utc'::text, now() + interval '7 days')
        )
        ON CONFLICT (token) DO NOTHING
        RETURNING id INTO v_invitation_id;

        v_result := jsonb_build_object(
            'status', 'invitation_created',
            'invitation_id', v_invitation_id,
            'email', v_clean_email,
            'role', p_role
        );
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
        'member.invited',
        jsonb_build_object(
            'target_email', v_clean_email,
            'assigned_role', p_role,
            'direct_membership', v_target_user_id IS NOT NULL,
            'resource_id', COALESCE(v_membership_id, v_invitation_id)
        )
    );

    RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. RPC: update_member_role
-- Admin can reassign a member's role (e.g. employee -> manager)
-- Prevents demoting the last active admin
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
    v_current_role public.user_role;
    v_admin_count INT;
    v_membership_id UUID;
BEGIN
    -- 1. Authentication check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update roles.';
    END IF;

    -- 2. Authorization check
    IF NOT public.is_org_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Only organization administrators can update member roles.';
    END IF;

    -- 3. Target membership check
    SELECT id, role INTO v_membership_id, v_current_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id
      AND status = 'active';

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Active member not found in this organization.';
    END IF;

    -- 4. Prevent demoting the last remaining active admin
    IF v_current_role = 'admin' AND p_new_role != 'admin' THEN
        SELECT count(*) INTO v_admin_count
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND role = 'admin'
          AND status = 'active';

        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot demote the sole active administrator. Appoint another administrator first.';
        END IF;
    END IF;

    -- 5. Update role
    UPDATE public.organization_memberships
    SET role = p_new_role,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_membership_id;

    -- 6. Audit Logging
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
        p_member_user_id,
        'member.role_updated',
        jsonb_build_object(
            'target_user_id', p_member_user_id,
            'previous_role', v_current_role,
            'new_role', p_new_role,
            'membership_id', v_membership_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'membership_id', v_membership_id,
        'user_id', p_member_user_id,
        'role', p_new_role
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC: remove_organization_member
-- Admin can remove a member from their organization
-- Prevents removing the last active admin
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
    v_current_role public.user_role;
    v_admin_count INT;
    v_membership_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT public.is_org_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Only organization administrators can remove members.';
    END IF;

    SELECT id, role INTO v_membership_id, v_current_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Member not found.';
    END IF;

    IF v_current_role = 'admin' THEN
        SELECT count(*) INTO v_admin_count
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND role = 'admin'
          AND status = 'active';

        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot remove the sole active administrator.';
        END IF;
    END IF;

    DELETE FROM public.organization_memberships WHERE id = v_membership_id;

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
        p_member_user_id,
        'member.removed',
        jsonb_build_object(
            'removed_user_id', p_member_user_id,
            'role', v_current_role,
            'membership_id', v_membership_id
        )
    );

    RETURN jsonb_build_object('success', true, 'removed_user_id', p_member_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. FUNCTION & TRIGGER: auto_claim_invitations_on_signup
-- When an invited user completes registration, auto-claim pending invitations
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    FOR v_inv IN
        SELECT id, organization_id, role
        FROM public.organization_invitations
        WHERE lower(email) = lower(new.email)
          AND status = 'pending'
          AND expires_at > timezone('utc'::text, now())
    LOOP
        -- Insert active membership
        INSERT INTO public.organization_memberships (
            organization_id,
            user_id,
            role,
            status
        )
        VALUES (
            v_inv.organization_id,
            new.id,
            v_inv.role,
            'active'
        )
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET role = EXCLUDED.role, status = 'active';

        -- Mark invitation as accepted
        UPDATE public.organization_invitations
        SET status = 'accepted'
        WHERE id = v_inv.id;
    END LOOP;

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_user_profile_claim_invitations ON public.user_profiles;
CREATE TRIGGER on_user_profile_claim_invitations
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.claim_pending_invitations();

-- -----------------------------------------------------------------------------
-- 6. PRIVILEGE RESTRICTIONS
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, public.user_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) TO authenticated;
