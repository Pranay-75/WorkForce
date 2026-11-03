-- =============================================================================
-- WorkForce Database Migration: Invitation Role & Membership Status Hardening
-- File: supabase/migrations/20261014000005_invite_role_and_status_hardening.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Explicitly revoke any legacy pending invitations that assigned 'admin' role
-- Safe data handling: never silently delete records, preserve for auditability.
-- -----------------------------------------------------------------------------
UPDATE public.organization_invitations
SET status = 'revoked'
WHERE status = 'pending'
  AND role = 'admin'::public.user_role;

-- -----------------------------------------------------------------------------
-- 2. Ensure chk_org_invitations_role check constraint handles legacy data safely
-- Forbids any pending invitation from assigning the 'admin' role while preserving
-- historical audit records for previously revoked/accepted entries.
-- -----------------------------------------------------------------------------
ALTER TABLE public.organization_invitations
    DROP CONSTRAINT IF EXISTS chk_org_invitations_role;

ALTER TABLE public.organization_invitations
    ADD CONSTRAINT chk_org_invitations_role
    CHECK (status <> 'pending' OR role IN ('manager'::public.user_role, 'employee'::public.user_role));

-- -----------------------------------------------------------------------------
-- 3. Harden invite_organization_member RPC
-- - Do not reactivate suspended members
-- - Do not change an administrator's role through invitations
-- - Require email confirmation before granting direct active membership
-- - Block unverified users with existing 'invited' status from becoming 'active'
-- - Concurrency-safe pending invitation creation and updates (ON CONFLICT)
-- - Distinguish audit actions: member.invited, member.invitation_updated,
--   member.added, and member.role_updated
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
    v_existing_role public.user_role;
    v_existing_status public.membership_status;
    v_email_confirmed_at TIMESTAMPTZ;
    v_is_inserted BOOLEAN;
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
        -- Target user already registered: inspect existing membership in this organization with row lock
        SELECT id, role, status
        INTO v_membership_id, v_existing_role, v_existing_status
        FROM public.organization_memberships
        WHERE organization_id = p_organization_id
          AND user_id = v_target_user_id
        FOR UPDATE;

        -- Check email verification status from auth.users
        SELECT email_confirmed_at
        INTO v_email_confirmed_at
        FROM auth.users
        WHERE id = v_target_user_id;

        IF v_membership_id IS NOT NULL THEN
            -- Requirement 1 & 4: Do not automatically reactivate a suspended member
            IF v_existing_status = 'suspended'::public.membership_status THEN
                RAISE EXCEPTION 'Cannot invite or modify a suspended member. Reactivation must use the dedicated member reinstatement workflow.' USING ERRCODE = '42501';
            END IF;

            -- Requirement 2 & 4: Do not change an existing administrator's role through invitations
            IF v_existing_role = 'admin'::public.user_role THEN
                RAISE EXCEPTION 'Cannot modify an administrator''s role through the invitation workflow. Administrator management must use the dedicated workflow.' USING ERRCODE = '42501';
            END IF;

            -- Inspect existing membership status
            IF v_existing_status = 'invited'::public.membership_status THEN
                IF v_email_confirmed_at IS NOT NULL THEN
                    -- Email IS verified: safely transition from 'invited' to 'active' and update role
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

                    -- Cleanly mark any existing pending invitations for this email as accepted
                    UPDATE public.organization_invitations
                    SET status = 'accepted'
                    WHERE organization_id = p_organization_id
                      AND lower(email) = v_clean_email
                      AND status = 'pending';
                ELSE
                    -- Target user has an 'invited' membership, but their email is UNVERIFIED:
                    -- MUST NOT change to 'active'. Preserve 'invited' status, update role if needed.
                    UPDATE public.organization_memberships
                    SET role = p_role,
                        status = 'invited'::public.membership_status,
                        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
                    WHERE id = v_membership_id;

                    -- Concurrency-safe pending invitation creation or update
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
                        pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '7 days'),
                        pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
                        pg_catalog.timezone('utc'::text, pg_catalog.now())
                    )
                    ON CONFLICT (organization_id, lower(email)) WHERE status = 'pending'
                    DO UPDATE SET
                        role = EXCLUDED.role,
                        invited_by = EXCLUDED.invited_by,
                        expires_at = EXCLUDED.expires_at,
                        token = EXCLUDED.token,
                        created_at = EXCLUDED.created_at
                    RETURNING id, (xmax = 0) INTO v_invitation_id, v_is_inserted;

                    v_result := pg_catalog.jsonb_build_object(
                        'status', CASE WHEN v_is_inserted THEN 'invitation_created' ELSE 'invitation_updated' END,
                        'invitation_id', v_invitation_id,
                        'email', v_clean_email,
                        'role', p_role,
                        'membership_id', v_membership_id
                    );
                END IF;

            ELSE
                -- Member is already 'active': update role and preserve active status
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

                -- Cleanly mark any existing pending invitations for this email as accepted
                UPDATE public.organization_invitations
                SET status = 'accepted'
                WHERE organization_id = p_organization_id
                  AND lower(email) = v_clean_email
                  AND status = 'pending';
            END IF;

        ELSIF v_email_confirmed_at IS NOT NULL THEN
            -- Target user has verified email and no existing membership: safely grant direct active membership
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
                status = CASE
                    WHEN organization_memberships.status = 'suspended'::public.membership_status THEN organization_memberships.status
                    ELSE 'active'::public.membership_status
                END,
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            RETURNING id, status INTO v_membership_id, v_existing_status;

            IF v_existing_status = 'suspended'::public.membership_status THEN
                RAISE EXCEPTION 'Cannot invite or modify a suspended member. Reactivation must use the dedicated member reinstatement workflow.' USING ERRCODE = '42501';
            END IF;

            v_result := pg_catalog.jsonb_build_object(
                'status', 'member_added',
                'membership_id', v_membership_id,
                'user_id', v_target_user_id,
                'role', p_role
            );

            -- Cleanly mark any existing pending invitations for this email as accepted
            UPDATE public.organization_invitations
            SET status = 'accepted'
            WHERE organization_id = p_organization_id
              AND lower(email) = v_clean_email
              AND status = 'pending';

        ELSE
            -- Target user profile exists, but email is unverified:
            -- Do NOT grant direct active membership. Create/update a pending invitation instead.
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
                pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '7 days'),
                pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
                pg_catalog.timezone('utc'::text, pg_catalog.now())
            )
            ON CONFLICT (organization_id, lower(email)) WHERE status = 'pending'
            DO UPDATE SET
                role = EXCLUDED.role,
                invited_by = EXCLUDED.invited_by,
                expires_at = EXCLUDED.expires_at,
                token = EXCLUDED.token,
                created_at = EXCLUDED.created_at
            RETURNING id, (xmax = 0) INTO v_invitation_id, v_is_inserted;

            v_result := pg_catalog.jsonb_build_object(
                'status', CASE WHEN v_is_inserted THEN 'invitation_created' ELSE 'invitation_updated' END,
                'invitation_id', v_invitation_id,
                'email', v_clean_email,
                'role', p_role
            );
        END IF;

    ELSE
        -- Target user has not registered yet: concurrency-safe pending invitation creation or update
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
            pg_catalog.timezone('utc'::text, pg_catalog.now() + interval '7 days'),
            pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
            pg_catalog.timezone('utc'::text, pg_catalog.now())
        )
        ON CONFLICT (organization_id, lower(email)) WHERE status = 'pending'
        DO UPDATE SET
            role = EXCLUDED.role,
            invited_by = EXCLUDED.invited_by,
            expires_at = EXCLUDED.expires_at,
            token = EXCLUDED.token,
            created_at = EXCLUDED.created_at
        RETURNING id, (xmax = 0) INTO v_invitation_id, v_is_inserted;

        v_result := pg_catalog.jsonb_build_object(
            'status', CASE WHEN v_is_inserted THEN 'invitation_created' ELSE 'invitation_updated' END,
            'invitation_id', v_invitation_id,
            'email', v_clean_email,
            'role', p_role
        );
    END IF;

    -- 5. Audit Logging: accurately distinguish invitations, membership creation, role updates, and invitation updates
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
            WHEN v_result->>'status' = 'membership_updated' THEN 'member.role_updated'
            WHEN v_result->>'status' = 'member_added' THEN 'member.added'
            ELSE 'member.invited'
        END,
        pg_catalog.jsonb_build_object(
            'target_email', v_clean_email,
            'assigned_role', p_role,
            'status', v_result->>'status',
            'direct_membership', (v_result->>'status' IN ('member_added', 'membership_updated')),
            'resource_id', COALESCE(v_membership_id, v_invitation_id)
        )
    );

    RETURN v_result;
END;
$$;

ALTER FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_organization_member(UUID, TEXT, public.user_role) TO authenticated;

COMMIT;
