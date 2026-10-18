-- =============================================================================
-- WorkForce Database Migration: Member Invitations & Privileges Hardening
-- File: supabase/migrations/20261014000003_member_invitations_hardening.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. INVITATION DEDUPLICATION & UNIQUE PENDING CONSTRAINT
-- Guarantee there can never be conflicting pending invitations for the same
-- organization and normalized recipient email address.
-- -----------------------------------------------------------------------------

-- Clean up any historical duplicate pending invitations, retaining the newest
DELETE FROM public.organization_invitations a
USING public.organization_invitations b
WHERE a.status = 'pending'
  AND b.status = 'pending'
  AND a.organization_id = b.organization_id
  AND lower(a.email) = lower(b.email)
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- Unique partial index: exactly one pending invitation per (organization_id, lower(email))
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_unique_pending
    ON public.organization_invitations (organization_id, lower(email))
    WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 2. HARDENED RPC: invite_organization_member
-- If an invitation is already pending, safely updates the existing invitation's
-- role, token, and expiration rather than creating duplicate or conflicting rows.
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
        -- Target user already registered: directly manage active membership
        SELECT id INTO v_membership_id
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND user_id = v_target_user_id;

        IF v_membership_id IS NOT NULL THEN
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
                expires_at = timezone('utc'::text, now() + interval '7 days'),
                token = encode(extensions.gen_random_bytes(32), 'hex'),
                created_at = timezone('utc'::text, now())
            WHERE id = v_invitation_id;

            v_result := jsonb_build_object(
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
                timezone('utc'::text, now() + interval '7 days')
            )
            RETURNING id INTO v_invitation_id;

            v_result := jsonb_build_object(
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
        jsonb_build_object(
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

-- -----------------------------------------------------------------------------
-- 3. HARDENED TRIGGER FUNCTION: claim_pending_invitations
-- Processes pending invitations deterministically in creation order.
-- Strictly ignores expired, revoked, or already-claimed invitations.
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
    -- Query valid pending, non-expired invitations matching the newly registered email
    FOR v_inv IN
        SELECT id, organization_id, role
        FROM public.organization_invitations
        WHERE lower(email) = lower(new.email)
          AND status = 'pending'
          AND expires_at > timezone('utc'::text, now())
        ORDER BY created_at ASC
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

        -- Mark invitation as accepted so it can never be claimed again
        UPDATE public.organization_invitations
        SET status = 'accepted'
        WHERE id = v_inv.id;
    END LOOP;

    RETURN new;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. DATABASE PRIVILEGES HARDENING
-- Revoke all table-level access from anon and PUBLIC.
-- Revoke direct execution of internal trigger function from all non-service roles.
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.organization_invitations FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_invitations TO authenticated;
GRANT ALL ON TABLE public.organization_invitations TO service_role;

REVOKE ALL ON FUNCTION public.claim_pending_invitations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_invitations() TO service_role, postgres;
