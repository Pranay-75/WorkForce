-- =============================================================================
-- WORKFORCE CORRECTED RLS BEHAVIORAL VALIDATION SUITE (STAGING)
-- File: supabase/deployment_safety/06_rls_behavioral_validation_staging.sql
--
-- Ephemeral, Non-Destructive In-Database Behavioral Test Suite for PostgreSQL RLS
-- Explicitly executes under `ROLE authenticated` with dynamic JWT claim switching.
-- Entire execution is wrapped in BEGIN ... ROLLBACK to guarantee ZERO persistent rows.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- SECTION 1: FIXTURE SETUP (Executing as postgres / table owner)
-- Create ephemeral synthetic test users, organizations, memberships, and entities
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    -- Unique run suffix to guarantee zero collisions
    v_run_id text := substr(gen_random_uuid()::text, 1, 8);

    -- Organization IDs
    v_org_a_id UUID := gen_random_uuid();
    v_org_b_id UUID := gen_random_uuid();
    v_org_susp_id UUID := gen_random_uuid();

    -- User IDs (Tenant A)
    v_organizer_id   UUID := gen_random_uuid();
    v_admin_1_id     UUID := gen_random_uuid();
    v_admin_2_id     UUID := gen_random_uuid();
    v_manager_id     UUID := gen_random_uuid();
    v_hr_id          UUID := gen_random_uuid();
    v_employee_1_id  UUID := gen_random_uuid();
    v_employee_2_id  UUID := gen_random_uuid();
    v_emp_del_id     UUID := gen_random_uuid(); -- Dedicated employee for deletion test
    v_suspended_id   UUID := gen_random_uuid();

    -- User ID (Suspended Creator)
    v_susp_creator_id UUID := gen_random_uuid();

    -- User ID (Tenant B - Cross-Tenant)
    v_org_b_admin_id UUID := gen_random_uuid();

    -- User ID (Valid Auth User with No Org Membership)
    v_non_member_id  UUID := gen_random_uuid();

    -- Project & Task IDs
    v_proj_a1_id   UUID := gen_random_uuid();
    v_proj_a2_id   UUID := gen_random_uuid();
    v_proj_b1_id   UUID := gen_random_uuid();
    v_task_emp1_id UUID := gen_random_uuid();
    v_task_emp2_id UUID := gen_random_uuid();
    v_task_b1_id   UUID := gen_random_uuid();

    -- User Emails
    v_organizer_email    text := format('organizer-%s@staging-rls.test', v_run_id);
    v_admin_1_email      text := format('admin1-%s@staging-rls.test', v_run_id);
    v_admin_2_email      text := format('admin2-%s@staging-rls.test', v_run_id);
    v_manager_email      text := format('manager-%s@staging-rls.test', v_run_id);
    v_hr_email           text := format('hr-%s@staging-rls.test', v_run_id);
    v_employee_1_email   text := format('employee1-%s@staging-rls.test', v_run_id);
    v_employee_2_email   text := format('employee2-%s@staging-rls.test', v_run_id);
    v_emp_del_email      text := format('empdel-%s@staging-rls.test', v_run_id);
    v_suspended_email    text := format('suspended-%s@staging-rls.test', v_run_id);
    v_susp_creator_email text := format('susp-creator-%s@staging-rls.test', v_run_id);
    v_org_b_admin_email  text := format('cross-admin-%s@staging-rls.test', v_run_id);
    v_non_member_email   text := format('nonmember-%s@staging-rls.test', v_run_id);
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' WORKFORCE CORRECTED RLS BEHAVIORAL SUITE: INITIALIZING FIXTURES ';
    RAISE NOTICE '================================================================';

    -- 1. Create synthetic Auth users (Trigger on_auth_user_created populates public.user_profiles)
    INSERT INTO auth.users (id, email)
    VALUES
        (v_organizer_id,     v_organizer_email),
        (v_admin_1_id,       v_admin_1_email),
        (v_admin_2_id,       v_admin_2_email),
        (v_manager_id,       v_manager_email),
        (v_hr_id,            v_hr_email),
        (v_employee_1_id,    v_employee_1_email),
        (v_employee_2_id,    v_employee_2_email),
        (v_emp_del_id,       v_emp_del_email),
        (v_suspended_id,     v_suspended_email),
        (v_susp_creator_id,  v_susp_creator_email),
        (v_org_b_admin_id,   v_org_b_admin_email),
        (v_non_member_id,    v_non_member_email);

    -- Complete profile details
    UPDATE public.user_profiles
    SET full_name = 'Test User ' || substr(id::text, 1, 6)
    WHERE id IN (
        v_organizer_id, v_admin_1_id, v_admin_2_id, v_manager_id, v_hr_id,
        v_employee_1_id, v_employee_2_id, v_emp_del_id, v_suspended_id, v_susp_creator_id,
        v_org_b_admin_id, v_non_member_id
    );

    -- 2. Create synthetic Organizations
    INSERT INTO public.organizations (id, name, slug, created_by)
    VALUES
        (v_org_a_id,    format('Staging RLS Org Alpha %s', v_run_id), format('rls-alpha-%s', v_run_id), v_organizer_id),
        (v_org_b_id,    format('Staging RLS Org Beta %s', v_run_id),  format('rls-beta-%s', v_run_id),  v_org_b_admin_id),
        (v_org_susp_id, format('Staging RLS Org Susp %s', v_run_id),  format('rls-susp-%s', v_run_id),  v_susp_creator_id);

    -- 3. Create synthetic Memberships
    -- Note: v_non_member_id is intentionally omitted from all memberships to validate membership-boundary triggers
    INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
    VALUES
        (v_org_a_id,    v_organizer_id,     'organizer'::public.user_role, 'active'::public.membership_status),
        (v_org_a_id,    v_admin_1_id,       'admin'::public.user_role,     'active'::public.membership_status),
        (v_org_a_id,    v_admin_2_id,       'admin'::public.user_role,     'active'::public.membership_status),
        (v_org_a_id,    v_manager_id,       'manager'::public.user_role,   'active'::public.membership_status),
        (v_org_a_id,    v_hr_id,            'hr'::public.user_role,        'active'::public.membership_status),
        (v_org_a_id,    v_employee_1_id,    'employee'::public.user_role,  'active'::public.membership_status),
        (v_org_a_id,    v_employee_2_id,    'employee'::public.user_role,  'active'::public.membership_status),
        (v_org_a_id,    v_emp_del_id,       'employee'::public.user_role,  'active'::public.membership_status),
        (v_org_a_id,    v_suspended_id,     'employee'::public.user_role,  'suspended'::public.membership_status),
        (v_org_b_id,    v_org_b_admin_id,   'organizer'::public.user_role, 'active'::public.membership_status),
        (v_org_susp_id, v_susp_creator_id,  'organizer'::public.user_role, 'suspended'::public.membership_status);

    -- 4. Create synthetic Projects
    -- Reconciled: Uses valid public.project_status enum ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')
    INSERT INTO public.projects (id, organization_id, name, manager_id, status)
    VALUES
        (v_proj_a1_id, v_org_a_id, 'Alpha Core Infrastructure', v_manager_id,     'in_progress'::public.project_status),
        (v_proj_a2_id, v_org_a_id, 'Alpha Security Portal',     v_admin_1_id,     'planning'::public.project_status),
        (v_proj_b1_id, v_org_b_id, 'Beta Public Services',      v_org_b_admin_id, 'in_progress'::public.project_status);

    -- 5. Create synthetic Tasks
    -- Reconciled: Uses valid public.priority_level enum ('low', 'medium', 'high', 'critical') and column assigned_to
    INSERT INTO public.tasks (id, project_id, organization_id, title, assigned_to, status, priority)
    VALUES
        (v_task_emp1_id, v_proj_a1_id, v_org_a_id, 'Deploy Database Cluster', v_employee_1_id, 'todo'::public.task_status, 'high'::public.priority_level),
        (v_task_emp2_id, v_proj_a1_id, v_org_a_id, 'Write System Documentation', v_employee_2_id, 'todo'::public.task_status, 'medium'::public.priority_level),
        (v_task_b1_id,   v_proj_b1_id, v_org_b_id, 'Beta Tenant Task', v_org_b_admin_id, 'todo'::public.task_status, 'low'::public.priority_level);

    -- 6. Create synthetic Audit Logs in Org A
    INSERT INTO public.organization_audit_logs (organization_id, actor_user_id, action, details)
    VALUES
        (v_org_a_id, v_organizer_id, 'organization.created', jsonb_build_object('resource_type', 'organization', 'resource_id', v_org_a_id)),
        (v_org_a_id, v_admin_1_id,   'project.created',      jsonb_build_object('resource_type', 'project', 'resource_id', v_proj_a2_id));

    -- 7. Verify all fixtures exist prior to transitioning roles
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_proj_a1_id)
       OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_proj_a2_id)
       OR NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = v_task_emp1_id)
       OR NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = v_task_emp2_id)
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_non_member_id) THEN
        RAISE EXCEPTION 'FIXTURE INTEGRITY FAILURE: Core test fixtures failed to create properly.';
    END IF;

    -- Store fixture parameters in transaction-local settings for subsequent DO blocks
    PERFORM set_config('test_suite.org_a_id',          v_org_a_id::text,          true);
    PERFORM set_config('test_suite.org_b_id',          v_org_b_id::text,          true);
    PERFORM set_config('test_suite.org_susp_id',       v_org_susp_id::text,       true);
    PERFORM set_config('test_suite.organizer_id',      v_organizer_id::text,      true);
    PERFORM set_config('test_suite.organizer_email',   v_organizer_email,         true);
    PERFORM set_config('test_suite.admin_1_id',        v_admin_1_id::text,        true);
    PERFORM set_config('test_suite.admin_1_email',     v_admin_1_email,           true);
    PERFORM set_config('test_suite.admin_2_id',        v_admin_2_id::text,        true);
    PERFORM set_config('test_suite.admin_2_email',     v_admin_2_email,           true);
    PERFORM set_config('test_suite.manager_id',        v_manager_id::text,        true);
    PERFORM set_config('test_suite.manager_email',     v_manager_email,           true);
    PERFORM set_config('test_suite.hr_id',             v_hr_id::text,             true);
    PERFORM set_config('test_suite.hr_email',          v_hr_email,                true);
    PERFORM set_config('test_suite.employee_1_id',     v_employee_1_id::text,     true);
    PERFORM set_config('test_suite.employee_1_email',  v_employee_1_email,        true);
    PERFORM set_config('test_suite.employee_2_id',     v_employee_2_id::text,     true);
    PERFORM set_config('test_suite.employee_2_email',  v_employee_2_email,        true);
    PERFORM set_config('test_suite.emp_del_id',        v_emp_del_id::text,        true);
    PERFORM set_config('test_suite.emp_del_email',     v_emp_del_email,           true);
    PERFORM set_config('test_suite.suspended_id',      v_suspended_id::text,      true);
    PERFORM set_config('test_suite.suspended_email',   v_suspended_email,         true);
    PERFORM set_config('test_suite.susp_creator_id',   v_susp_creator_id::text,   true);
    PERFORM set_config('test_suite.susp_creator_email',v_susp_creator_email,      true);
    PERFORM set_config('test_suite.org_b_admin_id',    v_org_b_admin_id::text,    true);
    PERFORM set_config('test_suite.org_b_admin_email', v_org_b_admin_email,       true);
    PERFORM set_config('test_suite.non_member_id',     v_non_member_id::text,     true);
    PERFORM set_config('test_suite.non_member_email',  v_non_member_email,        true);
    PERFORM set_config('test_suite.proj_a1_id',        v_proj_a1_id::text,        true);
    PERFORM set_config('test_suite.proj_a2_id',        v_proj_a2_id::text,        true);
    PERFORM set_config('test_suite.proj_b1_id',        v_proj_b1_id::text,        true);
    PERFORM set_config('test_suite.task_emp1_id',      v_task_emp1_id::text,      true);
    PERFORM set_config('test_suite.task_emp2_id',      v_task_emp2_id::text,      true);
    PERFORM set_config('test_suite.task_b1_id',        v_task_b1_id::text,        true);

    RAISE NOTICE 'Fixture setup completed successfully. All synthetic entities staged in transaction.';
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 2: RLS BEHAVIORAL VALIDATION (Executing under ROLE `authenticated`)
-- RLS policies are actively enforced because `authenticated` is not superuser.
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    -- Fixture references retrieved from transaction-local config
    v_org_a_id          UUID := current_setting('test_suite.org_a_id')::UUID;
    v_org_b_id          UUID := current_setting('test_suite.org_b_id')::UUID;
    v_org_susp_id       UUID := current_setting('test_suite.org_susp_id')::UUID;

    v_organizer_id      UUID := current_setting('test_suite.organizer_id')::UUID;
    v_organizer_email   text := current_setting('test_suite.organizer_email');
    v_admin_1_id        UUID := current_setting('test_suite.admin_1_id')::UUID;
    v_admin_1_email     text := current_setting('test_suite.admin_1_email');
    v_admin_2_id        UUID := current_setting('test_suite.admin_2_id')::UUID;
    v_admin_2_email     text := current_setting('test_suite.admin_2_email');
    v_manager_id        UUID := current_setting('test_suite.manager_id')::UUID;
    v_manager_email     text := current_setting('test_suite.manager_email');
    v_hr_id             UUID := current_setting('test_suite.hr_id')::UUID;
    v_hr_email          text := current_setting('test_suite.hr_email');
    v_employee_1_id     UUID := current_setting('test_suite.employee_1_id')::UUID;
    v_employee_1_email  text := current_setting('test_suite.employee_1_email');
    v_employee_2_id     UUID := current_setting('test_suite.employee_2_id')::UUID;
    v_employee_2_email  text := current_setting('test_suite.employee_2_email');
    v_emp_del_id        UUID := current_setting('test_suite.emp_del_id')::UUID;
    v_emp_del_email     text := current_setting('test_suite.emp_del_email');
    v_suspended_id      UUID := current_setting('test_suite.suspended_id')::UUID;
    v_suspended_email   text := current_setting('test_suite.suspended_email');
    v_susp_creator_id   UUID := current_setting('test_suite.susp_creator_id')::UUID;
    v_susp_creator_email text := current_setting('test_suite.susp_creator_email');
    v_org_b_admin_id    UUID := current_setting('test_suite.org_b_admin_id')::UUID;
    v_org_b_admin_email text := current_setting('test_suite.org_b_admin_email');

    v_proj_a1_id        UUID := current_setting('test_suite.proj_a1_id')::UUID;
    v_proj_a2_id        UUID := current_setting('test_suite.proj_a2_id')::UUID;
    v_proj_b1_id        UUID := current_setting('test_suite.proj_b1_id')::UUID;
    v_task_emp1_id      UUID := current_setting('test_suite.task_emp1_id')::UUID;
    v_task_emp2_id      UUID := current_setting('test_suite.task_emp2_id')::UUID;
    v_task_b1_id        UUID := current_setting('test_suite.task_b1_id')::UUID;

    -- Local test runner state
    v_passed int := 0;
    v_failed int := 0;
    v_count  int;
    v_rows   int;
    v_temp_id UUID;
    v_temp_task_id UUID;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' RUNNING RLS POLICIES AS ROLE: % (auth.role() = authenticated)  ', current_user;
    RAISE NOTICE '================================================================';

    -- Assert global role simulation integrity
    IF current_user <> 'authenticated' THEN
        RAISE EXCEPTION 'FATAL: Test suite not running under role authenticated (current_user=%)', current_user;
    END IF;

    -- =========================================================================
    -- SCENARIO 1: CROSS-TENANT ISOLATION (Tenant B Admin vs Tenant A Data)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_org_b_admin_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_org_b_admin_id::text, 'role', 'authenticated', 'email', v_org_b_admin_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_org_b_admin_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_org_b_admin_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Tenant B Admin simulation check failed.';
    END IF;

    -- 1.1: SELECT projects: Org B user must see 0 Org A projects
    SELECT count(*) INTO v_count FROM public.projects WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 1.1: Cross-Tenant Isolation: Org B user sees 0 projects in Org A.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 1.1: Cross-Tenant Isolation: Leaked % Org A projects to Org B user.', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 1.2: SELECT tasks: Org B user must see 0 Org A tasks
    SELECT count(*) INTO v_count FROM public.tasks WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 1.2: Cross-Tenant Isolation: Org B user sees 0 tasks in Org A.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 1.2: Cross-Tenant Isolation: Leaked % Org A tasks to Org B user.', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 1.3: SELECT memberships: Org B user must see 0 Org A memberships
    SELECT count(*) INTO v_count FROM public.organization_memberships WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 1.3: Cross-Tenant Isolation: Org B user sees 0 memberships in Org A.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 1.3: Cross-Tenant Isolation: Leaked % Org A memberships to Org B user.', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 1.4: SELECT audit logs: Org B user must see 0 Org A audit logs
    SELECT count(*) INTO v_count FROM public.organization_audit_logs WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 1.4: Cross-Tenant Isolation: Org B user sees 0 audit logs in Org A.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 1.4: Cross-Tenant Isolation: Leaked % Org A audit logs to Org B user.', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 1.5: INSERT project into Org A: Must fail with SQLSTATE 42501 (RLS check denial)
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Malicious Injected Project', 'planning');
        RAISE NOTICE '❌ [FAIL] 1.5: Cross-Tenant Insertion: Org B user illegally created project in Org A!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 1.5: Cross-Tenant Insertion: Denied with SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 1.5: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 1.6: UPDATE project in Org A: Must update 0 rows (RLS USING clause filters out rows)
    UPDATE public.projects SET name = 'Tampered Name' WHERE id = v_proj_a1_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 1.6: Cross-Tenant Update: 0 rows affected (RLS filtered).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 1.6: Cross-Tenant Update: Tampered with % rows in Org A!', v_rows;
        v_failed := v_failed + 1;
    END IF;

    -- 1.7: DELETE project in Org A: Must delete 0 rows (RLS USING clause filters out rows)
    DELETE FROM public.projects WHERE id = v_proj_a1_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 1.7: Cross-Tenant Delete: 0 rows affected (RLS filtered).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 1.7: Cross-Tenant Delete: Deleted % rows in Org A!', v_rows;
        v_failed := v_failed + 1;
    END IF;

    -- =========================================================================
    -- SCENARIO 2: ORGANIZER POWERS & INVARIANTS (Org A Organizer)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_organizer_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_organizer_id::text, 'role', 'authenticated', 'email', v_organizer_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_organizer_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_organizer_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Organizer simulation check failed.';
    END IF;

    -- 2.1: Organizer updates organization name: Must succeed (1 row affected)
    UPDATE public.organizations SET name = 'Renamed Alpha Org By Organizer' WHERE id = v_org_a_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 2.1: Organizer successfully updated organization name (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 2.1: Organizer failed to update organization name (0 rows affected).';
        v_failed := v_failed + 1;
    END IF;

    -- 2.2: Organizer views audit logs: Must see at least 1 log
    SELECT count(*) INTO v_count FROM public.organization_audit_logs WHERE organization_id = v_org_a_id;
    IF v_count >= 1 THEN
        RAISE NOTICE '✅ [PASS] 2.2: Organizer can view organization audit logs (% visible).', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 2.2: Organizer cannot view audit logs in own organization.';
        v_failed := v_failed + 1;
    END IF;

    -- 2.3: Organizer updates member role to manager directly via SQL: Must succeed
    UPDATE public.organization_memberships
    SET role = 'manager'::public.user_role
    WHERE organization_id = v_org_a_id AND user_id = v_employee_2_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 2.3: Organizer directly updated member role to manager (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 2.3: Organizer direct role update to manager failed.';
        v_failed := v_failed + 1;
    END IF;

    -- 2.4: Organizer direct update to admin via raw SQL: Must fail with 42501 (Policy WITH CHECK blocks direct admin elevation)
    BEGIN
        UPDATE public.organization_memberships
        SET role = 'admin'::public.user_role
        WHERE organization_id = v_org_a_id AND user_id = v_employee_2_id;
        RAISE NOTICE '❌ [FAIL] 2.4: Direct admin promotion succeeded via raw SQL (bypassed audited RPC)!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 2.4: Direct admin promotion via raw SQL denied with SQLSTATE 42501 (WITH CHECK enforced).';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 2.4: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 2.5: Organizer deletes project in own organization: Must succeed (1 row affected)
    BEGIN
        v_temp_id := gen_random_uuid();
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (v_temp_id, v_org_a_id, 'Organizer Project Deletion Test', 'planning');

        DELETE FROM public.projects WHERE id = v_temp_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 1 THEN
            RAISE NOTICE '✅ [PASS] 2.5: Organizer successfully deleted project in own org (1 row affected).';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 2.5: Organizer project deletion affected % rows.', v_rows;
            v_failed := v_failed + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 2.5: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 2.6: Suspended Creator Isolation: Creator is suspended; must lose all organizer privileges
    PERFORM set_config('request.jwt.claim.sub', v_susp_creator_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_susp_creator_id::text, 'role', 'authenticated', 'email', v_susp_creator_email, 'aud', 'authenticated'
    )::text, true);

    IF auth.uid() <> v_susp_creator_id OR auth.role() <> 'authenticated' THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Suspended Creator simulation check failed.';
    END IF;

    UPDATE public.organizations SET name = 'Suspended Creator Illegally Renamed' WHERE id = v_org_susp_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 AND NOT public.is_org_organizer(v_org_susp_id) THEN
        RAISE NOTICE '✅ [PASS] 2.6: Suspended Creator cannot update org; helper returns false (created_by bypass eliminated).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 2.6: Suspended Creator unexpectedly bypassed check (updated % rows).', v_rows;
        v_failed := v_failed + 1;
    END IF;

    -- =========================================================================
    -- SCENARIO 3: ADMIN POWERS & BOUNDARIES (Org A Admin)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_admin_1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_admin_1_id::text, 'role', 'authenticated', 'email', v_admin_1_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_admin_1_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_admin_1_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Admin simulation check failed.';
    END IF;

    -- 3.1: Admin creates new project in Org A: Must succeed
    BEGIN
        v_temp_id := gen_random_uuid();
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (v_temp_id, v_org_a_id, 'Project By Admin 1', 'planning');
        RAISE NOTICE '✅ [PASS] 3.1: Admin successfully created project in own organization.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 3.1: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 3.2: Admin updates project in Org A: Must succeed (1 row affected)
    UPDATE public.projects SET name = 'Updated Project By Admin 1' WHERE id = v_temp_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 3.2: Admin successfully updated project (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 3.2: Admin failed to update project.';
        v_failed := v_failed + 1;
    END IF;

    -- 3.3: Admin deletes project in Org A: Must succeed (1 row affected)
    DELETE FROM public.projects WHERE id = v_temp_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 3.3: Admin successfully deleted project (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 3.3: Admin failed to delete project.';
        v_failed := v_failed + 1;
    END IF;

    -- 3.4: Admin cannot update organization name: Target verified first; must update 0 rows
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_a_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 3.4: Target organization v_org_a_id not visible or missing!';
    END IF;

    UPDATE public.organizations SET name = 'Admin Tampered Org Name' WHERE id = v_org_a_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 3.4: Admin cannot update organization name (0 rows affected, RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 3.4: Admin illegally updated organization name!';
        v_failed := v_failed + 1;
    END IF;

    -- 3.5: Admin deletes dedicated non-admin member: Must succeed (1 row affected)
    IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = v_org_a_id AND user_id = v_emp_del_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 3.5: Target membership v_emp_del_id missing!';
    END IF;

    DELETE FROM public.organization_memberships
    WHERE organization_id = v_org_a_id AND user_id = v_emp_del_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 3.5: Admin successfully removed member from organization.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 3.5: Admin failed to remove member from organization.';
        v_failed := v_failed + 1;
    END IF;

    -- 3.6: Admin deletes peer admin (when another active admin exists): Must succeed
    IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = v_org_a_id AND user_id = v_admin_2_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 3.6: Peer admin v_admin_2_id missing!';
    END IF;

    DELETE FROM public.organization_memberships
    WHERE organization_id = v_org_a_id AND user_id = v_admin_2_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 3.6: Admin deleted peer admin when another active admin remained (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 3.6: Admin failed to delete peer admin.';
        v_failed := v_failed + 1;
    END IF;

    -- 3.7: Admin deletes sole remaining admin: Pre-check verifies count = 1; must fail with P0001
    SELECT count(*) INTO v_count
    FROM public.organization_memberships
    WHERE organization_id = v_org_a_id
      AND role = 'admin'::public.user_role
      AND status = 'active'::public.membership_status;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 3.7: Expected exactly 1 active admin before test, found %', v_count;
    END IF;

    BEGIN
        DELETE FROM public.organization_memberships
        WHERE organization_id = v_org_a_id AND user_id = v_admin_1_id;
        RAISE NOTICE '❌ [FAIL] 3.7: Last active admin was deleted (protect_last_active_admin failed)!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE '✅ [PASS] 3.7: Last active admin deletion blocked with SQLSTATE P0001 (Trigger enforced).';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 3.7: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- =========================================================================
    -- SCENARIO 4: MANAGER POWERS & BOUNDARIES (Org A Manager)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_manager_id::text, 'role', 'authenticated', 'email', v_manager_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_manager_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_manager_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Manager simulation check failed.';
    END IF;

    -- 4.1: Manager creates project: Must succeed
    BEGIN
        v_temp_id := gen_random_uuid();
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (v_temp_id, v_org_a_id, 'Project By Manager', 'planning');
        RAISE NOTICE '✅ [PASS] 4.1: Manager successfully created project.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 4.1: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 4.2: Manager updates project: Must succeed (1 row affected)
    UPDATE public.projects SET description = 'Manager added description' WHERE id = v_temp_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 4.2: Manager successfully updated project description (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 4.2: Manager failed to update project.';
        v_failed := v_failed + 1;
    END IF;

    -- 4.3: Manager deletes project: Target verified first; must delete 0 rows (RLS requires admin)
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_temp_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 4.3: Project v_temp_id missing!';
    END IF;

    DELETE FROM public.projects WHERE id = v_temp_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 4.3: Manager project deletion denied (0 rows affected, RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 4.3: Manager illegally deleted project (% rows deleted)!', v_rows;
        v_failed := v_failed + 1;
    END IF;

    -- 4.4: Manager creates task in project: Must succeed
    BEGIN
        v_temp_task_id := gen_random_uuid();
        INSERT INTO public.tasks (id, project_id, organization_id, title, status, priority)
        VALUES (v_temp_task_id, v_proj_a1_id, v_org_a_id, 'Task Created By Manager', 'todo', 'medium'::public.priority_level);
        RAISE NOTICE '✅ [PASS] 4.4: Manager successfully created task.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 4.4: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 4.5: Manager deletes temporary task: Must succeed (1 row affected, preserves core tasks)
    DELETE FROM public.tasks WHERE id = v_temp_task_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 4.5: Manager successfully deleted task (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 4.5: Manager failed to delete task.';
        v_failed := v_failed + 1;
    END IF;

    -- 4.6: Manager deletes organization membership: Target verified; must delete 0 rows (RLS requires admin)
    IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = v_org_a_id AND user_id = v_employee_1_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 4.6: Target membership v_employee_1_id missing!';
    END IF;

    DELETE FROM public.organization_memberships
    WHERE organization_id = v_org_a_id AND user_id = v_employee_1_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 4.6: Manager member deletion denied (0 rows affected, RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 4.6: Manager illegally deleted member!';
        v_failed := v_failed + 1;
    END IF;

    -- 4.7: Manager views audit logs: Must return 0 rows (RLS requires admin)
    SELECT count(*) INTO v_count FROM public.organization_audit_logs WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 4.7: Manager cannot view audit logs (0 rows returned, RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 4.7: Manager illegally viewed % audit log rows!', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- =========================================================================
    -- SCENARIO 5: HR ROLE GOVERNANCE & RESTRICTIONS (Org A HR)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_hr_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_hr_id::text, 'role', 'authenticated', 'email', v_hr_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_hr_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_hr_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: HR simulation check failed.';
    END IF;

    -- 5.1: HR direct membership insertion: Must fail with 42501 (No direct INSERT policy exists)
    BEGIN
        INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
        VALUES (v_org_a_id, gen_random_uuid(), 'employee', 'active');
        RAISE NOTICE '❌ [FAIL] 5.1: HR directly inserted membership via raw SQL (bypassed audited RPC)!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 5.1: HR direct membership insertion denied with SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 5.1: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 5.2: HR direct membership update: Target verified; must affect 0 rows (Requires Organizer)
    IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = v_org_a_id AND user_id = v_employee_1_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 5.2: Target membership v_employee_1_id missing!';
    END IF;

    UPDATE public.organization_memberships
    SET role = 'manager'::public.user_role
    WHERE organization_id = v_org_a_id AND user_id = v_employee_1_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 5.2: HR direct membership update denied (0 rows affected, RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 5.2: HR illegally updated membership role (% rows affected)!', v_rows;
        v_failed := v_failed + 1;
    END IF;

    -- 5.3: HR creates project: Must fail with 42501 (Requires Manager or Admin)
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project By HR', 'planning');
        RAISE NOTICE '❌ [FAIL] 5.3: HR illegally created project!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 5.3: HR project creation denied with SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 5.3: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 5.4: HR views members: Must succeed (HR can view member roster in own org)
    SELECT count(*) INTO v_count FROM public.organization_memberships WHERE organization_id = v_org_a_id;
    IF v_count >= 1 THEN
        RAISE NOTICE '✅ [PASS] 5.4: HR can view organization members (% members visible).', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 5.4: HR cannot view organization members.';
        v_failed := v_failed + 1;
    END IF;

    -- 5.5: HR views audit logs: Must return 0 rows (Requires Admin)
    SELECT count(*) INTO v_count FROM public.organization_audit_logs WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 5.5: HR cannot view audit logs (0 rows returned, RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 5.5: HR illegally viewed % audit log rows!', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- =========================================================================
    -- SCENARIO 6: EMPLOYEE BOUNDARIES & WORK ASSIGNMENT (Org A Employee)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_employee_1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_employee_1_id::text, 'role', 'authenticated', 'email', v_employee_1_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_employee_1_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_employee_1_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Employee simulation check failed.';
    END IF;

    -- 6.1: Employee creates project: Must fail with 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project By Employee', 'planning');
        RAISE NOTICE '❌ [FAIL] 6.1: Employee illegally created project!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 6.1: Employee project creation denied with SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 6.1: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 6.2: Employee deletes project: Target verified; must delete 0 rows
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_proj_a1_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 6.2: Project v_proj_a1_id missing!';
    END IF;

    DELETE FROM public.projects WHERE id = v_proj_a1_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 6.2: Employee project deletion denied (0 rows affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 6.2: Employee illegally deleted project!';
        v_failed := v_failed + 1;
    END IF;

    -- 6.3: Employee views audit logs: Must return 0 rows
    SELECT count(*) INTO v_count FROM public.organization_audit_logs WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 6.3: Employee cannot view audit logs (0 rows returned).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 6.3: Employee illegally viewed audit logs!';
        v_failed := v_failed + 1;
    END IF;

    -- 6.4: Employee updates own assigned task status: Must succeed (1 row affected)
    -- Enforces policy tasks_update_employee: USING (assigned_to = auth.uid())
    UPDATE public.tasks
    SET status = 'in_progress'::public.task_status
    WHERE id = v_task_emp1_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
        RAISE NOTICE '✅ [PASS] 6.4: Employee successfully updated own assigned task status (1 row affected).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 6.4: Employee failed to update own assigned task.';
        v_failed := v_failed + 1;
    END IF;

    -- 6.5: Employee updates peer's assigned task: Target verified; must update 0 rows
    IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = v_task_emp2_id) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILURE 6.5: Peer task v_task_emp2_id missing!';
    END IF;

    UPDATE public.tasks
    SET status = 'in_progress'::public.task_status
    WHERE id = v_task_emp2_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE NOTICE '✅ [PASS] 6.5: Employee updating peer task affects 0 rows (RLS enforced).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 6.5: Employee illegally updated peer task (% rows affected)!', v_rows;
        v_failed := v_failed + 1;
    END IF;

    -- =========================================================================
    -- SCENARIO 7: SUSPENDED MEMBER ISOLATION (Org A Suspended Member)
    -- =========================================================================
    PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_suspended_id::text, 'role', 'authenticated', 'email', v_suspended_email, 'aud', 'authenticated'
    )::text, true);

    -- Strict Identity Verification
    IF auth.uid() <> v_suspended_id OR auth.role() <> 'authenticated' OR (auth.jwt() ->> 'email') <> v_suspended_email THEN
        RAISE EXCEPTION 'IDENTITY SIMULATION FAILURE: Suspended member simulation check failed.';
    END IF;

    -- 7.1: Helper functions must all return FALSE for suspended member
    IF NOT public.is_org_member(v_org_a_id)
       AND NOT public.is_org_admin(v_org_a_id)
       AND NOT public.is_org_manager_or_admin(v_org_a_id)
       AND NOT public.is_org_organizer(v_org_a_id) THEN
        RAISE NOTICE '✅ [PASS] 7.1: All helper functions return FALSE for suspended member.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 7.1: Helper function granted active privileges to suspended member!';
        v_failed := v_failed + 1;
    END IF;

    -- 7.2: Suspended member SELECT on projects: Must return 0 rows
    SELECT count(*) INTO v_count FROM public.projects WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 7.2: Suspended member sees 0 projects in organization.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 7.2: Suspended member saw % projects in organization!', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 7.3: Suspended member SELECT on tasks: Must return 0 rows
    SELECT count(*) INTO v_count FROM public.tasks WHERE organization_id = v_org_a_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 7.3: Suspended member sees 0 tasks in organization.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 7.3: Suspended member saw % tasks in organization!', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 7.4a: Suspended member SELECT on own membership: Must return 1 row
    SELECT count(*) INTO v_count 
    FROM public.organization_memberships 
    WHERE organization_id = v_org_a_id 
      AND user_id = v_suspended_id;
    IF v_count = 1 THEN
        RAISE NOTICE '✅ [PASS] 7.4a: Suspended member can view their own membership status.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 7.4a: Suspended member cannot view their own membership record (saw % rows)!', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 7.4b: Suspended member SELECT on peer memberships: Must return 0 rows
    SELECT count(*) INTO v_count 
    FROM public.organization_memberships 
    WHERE organization_id = v_org_a_id 
      AND user_id <> v_suspended_id;
    IF v_count = 0 THEN
        RAISE NOTICE '✅ [PASS] 7.4b: Suspended member sees 0 peer memberships in organization.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 7.4b: Suspended member saw % peer memberships in organization!', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 7.5: Suspended member project creation: Must fail with 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project By Suspended', 'planning');
        RAISE NOTICE '❌ [FAIL] 7.5: Suspended member illegally created project!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 7.5: Suspended member project creation denied with SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 7.5: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- Record test counts into transaction-local variables
    PERFORM set_config('test_suite.rls_passed', v_passed::text, true);
    PERFORM set_config('test_suite.rls_failed', v_failed::text, true);

    RAISE NOTICE '================================================================';
    RAISE NOTICE ' RLS SCENARIO RESULTS: % passed, % failed                      ', v_passed, v_failed;
    RAISE NOTICE '================================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'RLS BEHAVIORAL SUITE FAILED: % test scenarios failed.', v_failed;
    END IF;
END $$;

RESET ROLE;

-- Clear simulated Supabase JWT GUCs to restore auth.uid() and auth.role() to NULL
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claims', '', true);

-- -----------------------------------------------------------------------------
-- SECTION 3: DETERMINISTIC TRIGGER INVARIANTS (Executing as postgres)
-- Verifying low-level database triggers, cascade unassignments, and invariants
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_org_a_id          UUID := current_setting('test_suite.org_a_id')::UUID;
    v_org_susp_id       UUID := current_setting('test_suite.org_susp_id')::UUID;
    v_organizer_id      UUID := current_setting('test_suite.organizer_id')::UUID;
    v_admin_1_id        UUID := current_setting('test_suite.admin_1_id')::UUID;
    v_admin_2_id        UUID := current_setting('test_suite.admin_2_id')::UUID;
    v_manager_id        UUID := current_setting('test_suite.manager_id')::UUID;
    v_hr_id             UUID := current_setting('test_suite.hr_id')::UUID;
    v_employee_1_id     UUID := current_setting('test_suite.employee_1_id')::UUID;
    v_employee_2_id     UUID := current_setting('test_suite.employee_2_id')::UUID;
    v_suspended_id      UUID := current_setting('test_suite.suspended_id')::UUID;
    v_susp_creator_id   UUID := current_setting('test_suite.susp_creator_id')::UUID;
    v_proj_a1_id        UUID := current_setting('test_suite.proj_a1_id')::UUID;
    v_task_emp2_id      UUID := current_setting('test_suite.task_emp2_id')::UUID;
    v_non_member_id     UUID := current_setting('test_suite.non_member_id')::UUID;

    v_proj_org_pm_id    UUID;
    v_proj_admin_pm_id  UUID;
    v_proj_mgr_pm_id    UUID;
    v_mgr_proj_id       UUID;
    v_task_id           UUID;
    v_mgr_task_id       UUID;
    v_tamper_task_id    UUID;
    v_manager_ref       UUID;
    v_assignee_ref      UUID;
    v_task_title_check  TEXT;
    v_rows_affected     INT;
    v_err_msg           TEXT;
    v_err_state         TEXT;

    v_passed int := current_setting('test_suite.rls_passed')::int;
    v_failed int := current_setting('test_suite.rls_failed')::int;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' VERIFYING DETERMINISTIC TRIGGERS & CASCADE INVARIANTS          ';
    RAISE NOTICE '================================================================';

    -- Strict Context Isolation Gate: Ensure no JWT claims leaked from Section 2
    IF auth.uid() IS NOT NULL OR auth.role() IS NOT NULL THEN
        RAISE EXCEPTION 'ISOLATION FAILURE: JWT simulation context leaked into Section 3 (uid=%, role=%)',
            auth.uid(), auth.role();
    END IF;

    -- Verify that core project v_proj_a1_id still exists (proves RLS deletes never destroyed fixtures)
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_proj_a1_id) THEN
        RAISE EXCEPTION 'INTEGRITY FAILURE: v_proj_a1_id was unexpectedly deleted during previous phases!';
    END IF;

    -- =========================================================================
    -- TRIGGER 1: enforce_project_manager_eligibility
    -- =========================================================================
    -- 8.1a: Designating Organizer as PM -> Must succeed
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager Organizer', v_organizer_id, 'planning')
        RETURNING id INTO v_proj_org_pm_id;
        RAISE NOTICE '✅ [PASS] 8.1a: Organizer successfully designated as Project Manager.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1a: %', SQLERRM;
    END;

    -- 8.1b: Designating Admin as PM -> Must succeed
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager Admin', v_admin_1_id, 'planning')
        RETURNING id INTO v_proj_admin_pm_id;
        RAISE NOTICE '✅ [PASS] 8.1b: Admin successfully designated as Project Manager.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1b: %', SQLERRM;
    END;

    -- 8.1c: Designating Manager as PM -> Must succeed
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager Manager', v_manager_id, 'planning')
        RETURNING id INTO v_proj_mgr_pm_id;
        RAISE NOTICE '✅ [PASS] 8.1c: Manager successfully designated as Project Manager.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1c: %', SQLERRM;
    END;

    -- 8.1d: Designating Employee as PM -> Must fail with 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager Employee', v_employee_1_id, 'planning');
        RAISE NOTICE '❌ [FAIL] 8.1d: Employee unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 8.1d: Employee PM designation rejected with expected SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1d: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.1e: Designating HR as PM -> Must fail with 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager HR', v_hr_id, 'planning');
        RAISE NOTICE '❌ [FAIL] 8.1e: HR unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 8.1e: HR PM designation rejected with expected SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1e: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.1f: Designating Suspended Member as PM -> Must fail with 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager Suspended', v_suspended_id, 'planning');
        RAISE NOTICE '❌ [FAIL] 8.1f: Suspended member unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 8.1f: Suspended member PM designation rejected with expected SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1f: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.1g: Designating Non-Member as PM -> Must fail with 23503 from enforce_project_manager_eligibility trigger
    -- v_non_member_id exists in auth.users, proving failure is NOT caused by missing auth.users FK
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Project Manager Non-Member', v_non_member_id, 'planning');
        RAISE NOTICE '❌ [FAIL] 8.1g: Non-member unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '23503' THEN
        IF SQLERRM = 'Project manager must be a member of the organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.1g: Non-member PM designation rejected by trigger (SQLSTATE 23503: %).', SQLERRM;
            v_passed := v_passed + 1;
        ELSE
            RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1g: Failed on raw foreign key instead of trigger: % (SQLSTATE %)', SQLERRM, SQLSTATE;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.1g: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- =========================================================================
    -- TRIGGER 2: enforce_task_assignee_membership
    -- =========================================================================
    -- 8.2a: Active member as Task Assignee -> Must succeed
    BEGIN
        INSERT INTO public.tasks (id, project_id, organization_id, title, assigned_to, status, priority)
        VALUES (gen_random_uuid(), v_proj_mgr_pm_id, v_org_a_id, 'Valid Task Assignee', v_employee_1_id, 'todo', 'low'::public.priority_level)
        RETURNING id INTO v_task_id;
        RAISE NOTICE '✅ [PASS] 8.2a: Active member successfully assigned to task.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.2a: %', SQLERRM;
    END;

    -- 8.2b: Suspended member as Task Assignee -> Must fail with 42501
    BEGIN
        INSERT INTO public.tasks (id, project_id, organization_id, title, assigned_to, status, priority)
        VALUES (gen_random_uuid(), v_proj_mgr_pm_id, v_org_a_id, 'Invalid Task Assignee Suspended', v_suspended_id, 'todo', 'low'::public.priority_level);
        RAISE NOTICE '❌ [FAIL] 8.2b: Suspended member unexpectedly allowed as task assignee.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] 8.2b: Suspended task assignee rejected with expected SQLSTATE 42501.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.2b: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- =========================================================================
    -- TRIGGER 3: cleanup_membership_references (Automatic Work Unassignment)
    -- =========================================================================
    -- 8.3a: Demoting assigned Project Manager automatically sets projects.manager_id = NULL
    UPDATE public.organization_memberships
    SET role = 'employee'::public.user_role
    WHERE organization_id = v_org_a_id AND user_id = v_manager_id;

    SELECT manager_id INTO v_manager_ref FROM public.projects WHERE id = v_proj_mgr_pm_id;
    IF v_manager_ref IS NULL THEN
        RAISE NOTICE '✅ [PASS] 8.3a: Demoted manager was automatically unassigned from project (manager_id set to NULL).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 8.3a: Demoted manager remained assigned to project (manager_id = %)!', v_manager_ref;
        v_failed := v_failed + 1;
    END IF;

    -- 8.3b: Suspending assigned task assignee automatically sets tasks.assigned_to = NULL
    UPDATE public.organization_memberships
    SET status = 'suspended'::public.membership_status
    WHERE organization_id = v_org_a_id AND user_id = v_employee_1_id;

    SELECT assigned_to INTO v_assignee_ref FROM public.tasks WHERE id = v_task_id;
    IF v_assignee_ref IS NULL THEN
        RAISE NOTICE '✅ [PASS] 8.3b: Suspended assignee was automatically unassigned from task (assigned_to set to NULL).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] 8.3b: Suspended assignee remained assigned to task (assigned_to = %)!', v_assignee_ref;
        v_failed := v_failed + 1;
    END IF;

    -- 8.3c [ELEVATED TRIGGER CASCADE]: Suspending assigned Project Manager with active tasks cleans up both manager_id and assigned_to
    -- Reinstate v_manager_id as active manager (previously demoted to employee in 8.3a)
    UPDATE public.organization_memberships
    SET role = 'manager'::public.user_role,
        status = 'active'::public.membership_status
    WHERE organization_id = v_org_a_id AND user_id = v_manager_id;

    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a_id, 'Manager Project For Suspension', v_manager_id, 'planning')
        RETURNING id INTO v_mgr_proj_id;

        INSERT INTO public.tasks (id, project_id, organization_id, title, assigned_to, status, priority)
        VALUES (gen_random_uuid(), v_mgr_proj_id, v_org_a_id, 'Manager Task For Suspension', v_manager_id, 'todo', 'medium'::public.priority_level)
        RETURNING id INTO v_mgr_task_id;

        -- Suspend the manager
        UPDATE public.organization_memberships
        SET status = 'suspended'::public.membership_status
        WHERE organization_id = v_org_a_id AND user_id = v_manager_id;

        -- Verify manager_id is NULL on project and assigned_to is NULL on task
        SELECT manager_id INTO v_manager_ref FROM public.projects WHERE id = v_mgr_proj_id;
        SELECT assigned_to INTO v_assignee_ref FROM public.tasks WHERE id = v_mgr_task_id;

        IF v_manager_ref IS NULL AND v_assignee_ref IS NULL THEN
            RAISE NOTICE '✅ [PASS] 8.3c [ELEVATED CASCADE]: Suspending manager automatically unassigned project manager_id and task assigned_to.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.3c: Suspending manager failed to clean up project or task (pm=%, task_assignee=%)!',
                v_manager_ref, v_assignee_ref;
            v_failed := v_failed + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.3c: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.3d [AUTHENTICATED RPC CASCADE]: Removing member via remove_organization_member RPC cleans up task assignment and membership
    -- Executes under authenticated role to validate:
    --   1. Authenticated EXECUTE permission on public.remove_organization_member
    --   2. RPC internal caller authorization (is_org_organizer)
    --   3. RPC task unassignment cascade (tasks.assigned_to = NULL)
    --   4. Membership deletion from organization_memberships
    BEGIN
        -- Set authenticated role and Organizer JWT claims
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_organizer_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_organizer_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        -- Remove employee 2 who has assigned task v_task_emp2_id
        PERFORM public.remove_organization_member(v_org_a_id, v_employee_2_id);

        -- Restore role to postgres to inspect results
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        -- Verify task was unassigned and membership deleted
        SELECT assigned_to INTO v_assignee_ref FROM public.tasks WHERE id = v_task_emp2_id;
        IF v_assignee_ref IS NULL AND NOT EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = v_org_a_id AND user_id = v_employee_2_id
        ) THEN
            RAISE NOTICE '✅ [PASS] 8.3d [AUTHENTICATED RPC]: Member removal via RPC cleanly unassigned task and removed membership (authenticated EXECUTE verified).';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.3d: Member removal via RPC failed to clean up task assignment (assignee=%)!', v_assignee_ref;
            v_failed := v_failed + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.3d: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- Clear JWT context back to superuser
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- =========================================================================
    -- TRIGGER 4: enforce_task_update_permissions Regression Invariants
    -- =========================================================================

    -- 8.4a [ELEVATED TRIGGER REGRESSION]: Unassigning an ACTIVE member's task via unauthorized caller must be DENIED (42501)
    BEGIN
        -- Setup: Set Admin JWT context so updating task assignment to active HR member v_hr_id succeeds under Context 2
        PERFORM set_config('request.jwt.claim.sub', v_admin_1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_admin_1_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        -- v_task_id exists; reassign it to active HR member v_hr_id
        UPDATE public.tasks SET assigned_to = v_hr_id WHERE id = v_task_id;

        -- Clear setup JWT context
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        -- Set simulated JWT claims as unauthorized / suspended caller (running under postgres session role to bypass table RLS)
        PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_suspended_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        -- Attempt to unassign the active member (trigger evaluates auth.uid() and raises 42501)
        UPDATE public.tasks SET assigned_to = NULL WHERE id = v_task_id;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        RAISE NOTICE '❌ [FAIL] 8.4a: Unauthorized caller unexpectedly allowed to unassign active member!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        GET STACKED DIAGNOSTICS
            v_err_state = RETURNED_SQLSTATE,
            v_err_msg   = MESSAGE_TEXT;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        IF v_err_msg = 'Not an active member of this organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.4a [ELEVATED TRIGGER]: Unassigning active member by unauthorized caller denied with SQLSTATE 42501 and expected message ("%").', v_err_msg;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4a: Expected message "Not an active member of this organization." but got "%" (SQLSTATE %)', v_err_msg, v_err_state;
            v_failed := v_failed + 1;
        END IF;
    WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4a: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- Setup for 8.4b-f: Create task assigned to active member v_hr_id (ensures insert passes assignee eligibility trigger)
    INSERT INTO public.tasks (id, project_id, organization_id, title, assigned_to, status, priority)
    VALUES (gen_random_uuid(), v_proj_a1_id, v_org_a_id, 'Original Title', v_hr_id, 'todo', 'low'::public.priority_level)
    RETURNING id INTO v_tamper_task_id;

    -- 8.4b [ELEVATED TRIGGER REGRESSION]: Unassigning inactive assignee while altering title must be REJECTED (42501)
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_suspended_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks SET assigned_to = NULL, title = 'Tampered Title' WHERE id = v_tamper_task_id;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        RAISE NOTICE '❌ [FAIL] 8.4b: Inactive unassignment with title tampering was unexpectedly allowed!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        GET STACKED DIAGNOSTICS
            v_err_state = RETURNED_SQLSTATE,
            v_err_msg   = MESSAGE_TEXT;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        IF v_err_msg = 'Not an active member of this organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.4b [ELEVATED TRIGGER]: Inactive unassignment with title tampering rejected with SQLSTATE 42501 and expected message ("%").', v_err_msg;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4b: Expected message "Not an active member of this organization." but got "%" (SQLSTATE %)', v_err_msg, v_err_state;
            v_failed := v_failed + 1;
        END IF;
    WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4b: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.4c [ELEVATED TRIGGER REGRESSION]: Unassigning inactive assignee while altering priority must be REJECTED (42501)
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_suspended_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks SET assigned_to = NULL, priority = 'critical'::public.priority_level WHERE id = v_tamper_task_id;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        RAISE NOTICE '❌ [FAIL] 8.4c: Inactive unassignment with priority tampering was unexpectedly allowed!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        GET STACKED DIAGNOSTICS
            v_err_state = RETURNED_SQLSTATE,
            v_err_msg   = MESSAGE_TEXT;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        IF v_err_msg = 'Not an active member of this organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.4c [ELEVATED TRIGGER]: Inactive unassignment with priority tampering rejected with SQLSTATE 42501 and expected message ("%").', v_err_msg;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4c: Expected message "Not an active member of this organization." but got "%" (SQLSTATE %)', v_err_msg, v_err_state;
            v_failed := v_failed + 1;
        END IF;
    WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4c: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.4d [ELEVATED TRIGGER REGRESSION]: Unassigning inactive assignee while altering project_id must be REJECTED (42501)
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_suspended_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks SET assigned_to = NULL, project_id = v_proj_mgr_pm_id WHERE id = v_tamper_task_id;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        RAISE NOTICE '❌ [FAIL] 8.4d: Inactive unassignment with project tampering was unexpectedly allowed!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        GET STACKED DIAGNOSTICS
            v_err_state = RETURNED_SQLSTATE,
            v_err_msg   = MESSAGE_TEXT;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        IF v_err_msg = 'Not an active member of this organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.4d [ELEVATED TRIGGER]: Inactive unassignment with project tampering rejected with SQLSTATE 42501 and expected message ("%").', v_err_msg;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4d: Expected message "Not an active member of this organization." but got "%" (SQLSTATE %)', v_err_msg, v_err_state;
            v_failed := v_failed + 1;
        END IF;
    WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4d: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.4e [ELEVATED TRIGGER REGRESSION]: Unassigning inactive assignee while altering organization_id must be REJECTED (42501)
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_suspended_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks SET assigned_to = NULL, organization_id = v_org_susp_id WHERE id = v_tamper_task_id;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        RAISE NOTICE '❌ [FAIL] 8.4e: Inactive unassignment with organization tampering was unexpectedly allowed!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        GET STACKED DIAGNOSTICS
            v_err_state = RETURNED_SQLSTATE,
            v_err_msg   = MESSAGE_TEXT;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        IF v_err_msg = 'Not an active member of this organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.4e [ELEVATED TRIGGER]: Inactive unassignment with organization tampering rejected with SQLSTATE 42501 and expected message ("%").', v_err_msg;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4e: Expected message "Not an active member of this organization." but got "%" (SQLSTATE %)', v_err_msg, v_err_state;
            v_failed := v_failed + 1;
        END IF;
    WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4e: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.4f [ELEVATED TRIGGER REGRESSION]: Unassigning inactive assignee while altering status must be REJECTED (42501)
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_suspended_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks SET assigned_to = NULL, status = 'in_progress'::public.task_status WHERE id = v_tamper_task_id;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        RAISE NOTICE '❌ [FAIL] 8.4f: Inactive unassignment with status tampering was unexpectedly allowed!';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        GET STACKED DIAGNOSTICS
            v_err_state = RETURNED_SQLSTATE,
            v_err_msg   = MESSAGE_TEXT;

        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        IF v_err_msg = 'Not an active member of this organization.' THEN
            RAISE NOTICE '✅ [PASS] 8.4f [ELEVATED TRIGGER]: Inactive unassignment with status tampering rejected with SQLSTATE 42501 and expected message ("%").', v_err_msg;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4f: Expected message "Not an active member of this organization." but got "%" (SQLSTATE %)', v_err_msg, v_err_state;
            v_failed := v_failed + 1;
        END IF;
    WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4f: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.4g [AUTHENTICATED RLS + TRIGGER]: Existing employee status-only update permissions still work
    BEGIN
        -- Re-activate employee 1 in organization_memberships
        UPDATE public.organization_memberships
        SET status = 'active'::public.membership_status
        WHERE organization_id = v_org_a_id AND user_id = v_employee_1_id;

        -- Set Admin JWT context so updating task setup succeeds under Context 2
        PERFORM set_config('request.jwt.claim.sub', v_admin_1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_admin_1_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks
        SET assigned_to = v_employee_1_id,
            title = 'Original Title',
            priority = 'low'::public.priority_level,
            project_id = v_proj_a1_id,
            organization_id = v_org_a_id
        WHERE id = v_tamper_task_id;

        -- Clear setup JWT context
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claims', '', true);

        -- Switch to authenticated role as employee 1
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_employee_1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_employee_1_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks SET status = 'in_progress'::public.task_status WHERE id = v_tamper_task_id;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        RESET ROLE;

        IF v_rows_affected = 1 THEN
            RAISE NOTICE '✅ [PASS] 8.4g [AUTHENTICATED RLS + TRIGGER]: Active employee successfully updated task status (Context 3 preserved).';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4g: Active employee status update affected % rows!', v_rows_affected;
            v_failed := v_failed + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4g: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- 8.4h [AUTHENTICATED RLS + TRIGGER]: Existing admin and manager task-update permissions remain unchanged
    BEGIN
        -- Switch to authenticated role as Admin 1
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_admin_1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_admin_1_id::text, 'role', 'authenticated', 'aud', 'authenticated'
        )::text, true);

        UPDATE public.tasks
        SET title = 'Admin Authorized Title', priority = 'high'::public.priority_level
        WHERE id = v_tamper_task_id;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        RESET ROLE;

        SELECT title INTO v_task_title_check FROM public.tasks WHERE id = v_tamper_task_id;

        IF v_rows_affected = 1 AND v_task_title_check = 'Admin Authorized Title' THEN
            RAISE NOTICE '✅ [PASS] 8.4h [AUTHENTICATED RLS + TRIGGER]: Admin successfully updated task metadata (Context 2 preserved).';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE '❌ [FAIL] 8.4h: Admin task metadata update failed (affected % rows)!', v_rows_affected;
            v_failed := v_failed + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        RAISE EXCEPTION 'UNEXPECTED ERROR in 8.4h: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END;

    -- Final cleanup of JWT simulation context
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- =========================================================================
    -- FINAL VERDICT OF EXECUTION
    -- =========================================================================
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' COMPLETE VALIDATION RESULTS: % passed, % failed               ', v_passed, v_failed;
    RAISE NOTICE '================================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'BEHAVIORAL VALIDATION SUITE FAILED: % failures detected.', v_failed;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- TEARDOWN: ROLLBACK EVERYTHING
-- Guarantees zero residual rows in staging catalog, auth schema, or data tables.
-- -----------------------------------------------------------------------------
ROLLBACK;
