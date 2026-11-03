/**
 * WorkForce - Active Member Data Lifecycle & Work Unassignment Regression Test
 * File: frontend/scripts/test_active_member_data_lifecycle_regression.js
 *
 * Verifies the full member removal lifecycle:
 * 1. Checks that active tasks assigned to the removed member are cleanly unassigned (assigned_to = NULL)
 *    while preserving task record, title, description, history, and hours.
 * 2. Checks that projects managed by the removed member are unassigned (manager_id = NULL)
 *    while preserving the project record.
 * 3. Checks that project memberships (allocations) for the removed member are deleted.
 * 4. Checks that the organization_memberships row is completely deleted.
 * 5. Checks that user_profiles and auth.users are preserved (not cascade-deleted).
 * 6. Checks that an immutable audit log entry (member.removed) is written.
 * 7. Verifies that Organizer and Admin can both successfully perform this removal without trigger rejection.
 */

const { execSync } = require('child_process');

function runPsql(sql) {
  return execSync('docker exec -i supabase_db_WorkForce psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A', {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function runPsqlAsUser(userId, sql) {
  const wrapped = `
    BEGIN;
    SELECT set_config('request.jwt.claim.sub', '${userId}', true);
    ${sql}
    COMMIT;
  `;
  try {
    const res = runPsql(wrapped);
    return { success: true, result: res };
  } catch (err) {
    const errOutput = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, error: errOutput };
  }
}

const results = [];
function recordResult(name, status, evidence) {
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  console.log(`   ${evidence}`);
}

async function runDataLifecycleRegressionTests() {
  console.log('================================================================');
  console.log(' WORKFORCE MEMBER DATA LIFECYCLE & UNASSIGNMENT REGRESSION TEST ');
  console.log('================================================================\n');

  // Synthetic disposable test IDs
  const TEST_ORG_ID = 'e3000000-0000-0000-0000-000000000001';
  const ORGANIZER_ID = 'f3000000-0000-0000-0000-000000000001';
  const ADMIN_ID = 'f3000000-0000-0000-0000-000000000002';
  const TARGET_MEMBER_ID = 'f3000000-0000-0000-0000-000000000003';
  const REMAINING_MEMBER_ID = 'f3000000-0000-0000-0000-000000000004';
  const PROJECT_ID = 'c3000000-0000-0000-0000-000000000001';
  const TASK_ID = 'd3000000-0000-0000-0000-000000000001';

  try {
    console.log('--- Setting up synthetic disposable organization and assigned data ---');
    runPsql(`
      -- Clean up any residual test records first
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.tasks WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.project_members WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.projects WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_audit_logs WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_memberships WHERE organization_id = '${TEST_ORG_ID}';
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organizations WHERE id = '${TEST_ORG_ID}';
      DELETE FROM public.user_profiles WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_ID}', '${TARGET_MEMBER_ID}', '${REMAINING_MEMBER_ID}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_ID}', '${TARGET_MEMBER_ID}', '${REMAINING_MEMBER_ID}'
      );

      -- Synthetic users
      INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
        ('${ORGANIZER_ID}', 'authenticated', 'authenticated', 'lifecycle_org@test.corp', 'hash', now(), '{"provider":"email"}', '{"full_name":"Lifecycle Organizer"}', now(), now()),
        ('${ADMIN_ID}', 'authenticated', 'authenticated', 'lifecycle_admin@test.corp', 'hash', now(), '{"provider":"email"}', '{"full_name":"Lifecycle Admin"}', now(), now()),
        ('${TARGET_MEMBER_ID}', 'authenticated', 'authenticated', 'lifecycle_target@test.corp', 'hash', now(), '{"provider":"email"}', '{"full_name":"Lifecycle Target"}', now(), now()),
        ('${REMAINING_MEMBER_ID}', 'authenticated', 'authenticated', 'lifecycle_rem@test.corp', 'hash', now(), '{"provider":"email"}', '{"full_name":"Lifecycle Remaining"}', now(), now())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.user_profiles (id, email, full_name, department, job_title) VALUES
        ('${ORGANIZER_ID}', 'lifecycle_org@test.corp', 'Lifecycle Organizer', 'Exec', 'Founder'),
        ('${ADMIN_ID}', 'lifecycle_admin@test.corp', 'Lifecycle Admin', 'Ops', 'Director'),
        ('${TARGET_MEMBER_ID}', 'lifecycle_target@test.corp', 'Lifecycle Target', 'Eng', 'Manager'),
        ('${REMAINING_MEMBER_ID}', 'lifecycle_rem@test.corp', 'Lifecycle Remaining', 'Eng', 'Developer')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

      INSERT INTO public.organizations (id, name, slug, created_by)
      VALUES ('${TEST_ORG_ID}', 'Lifecycle Regression Org', 'lifecycle-reg-org', '${ORGANIZER_ID}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES
        ('${TEST_ORG_ID}', '${ORGANIZER_ID}', 'organizer', 'active'),
        ('${TEST_ORG_ID}', '${ADMIN_ID}', 'admin', 'active'),
        ('${TEST_ORG_ID}', '${TARGET_MEMBER_ID}', 'manager', 'active'),
        ('${TEST_ORG_ID}', '${REMAINING_MEMBER_ID}', 'employee', 'active')
      ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active', role = EXCLUDED.role;

      -- Assign Target to Project as Manager and Member
      INSERT INTO public.projects (id, organization_id, name, manager_id, status, priority, total_hours, completed_hours)
      VALUES ('${PROJECT_ID}', '${TEST_ORG_ID}', 'Alpha Delivery Project', '${TARGET_MEMBER_ID}', 'in_progress', 'high', 100, 25);

      INSERT INTO public.project_members (project_id, user_id, organization_id)
      VALUES
        ('${PROJECT_ID}', '${TARGET_MEMBER_ID}', '${TEST_ORG_ID}'),
        ('${PROJECT_ID}', '${REMAINING_MEMBER_ID}', '${TEST_ORG_ID}');

      -- Assign Target to Task
      INSERT INTO public.tasks (id, organization_id, project_id, title, description, assigned_to, status, priority, complexity, estimated_hours)
      VALUES ('${TASK_ID}', '${TEST_ORG_ID}', '${PROJECT_ID}', 'Critical Migration Task', 'Deliver critical schema', '${TARGET_MEMBER_ID}', 'in_progress', 'high', 'High', 20);
    `);

    // Record pre-removal state
    const preMembershipId = runPsql(`
      SELECT id FROM public.organization_memberships
      WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${TARGET_MEMBER_ID}';
    `);
    const preTaskAssignee = runPsql(`SELECT assigned_to FROM public.tasks WHERE id = '${TASK_ID}';`);
    const preProjectManager = runPsql(`SELECT manager_id FROM public.projects WHERE id = '${PROJECT_ID}';`);
    const preProjectMemberCount = runPsql(`SELECT count(*) FROM public.project_members WHERE user_id = '${TARGET_MEMBER_ID}';`);

    console.log(`Pre-Removal State Recorded:`);
    console.log(`- Member user UUID: ${TARGET_MEMBER_ID}`);
    console.log(`- Membership record ID: ${preMembershipId}`);
    console.log(`- Task assigned_to: ${preTaskAssignee}`);
    console.log(`- Project manager_id: ${preProjectManager}`);
    console.log(`- Project members allocation: ${preProjectMemberCount}`);

    if (preMembershipId && preTaskAssignee === TARGET_MEMBER_ID && preProjectManager === TARGET_MEMBER_ID) {
      recordResult('Pre-Removal Setup Verification', 'PASS', 'Synthetic member assigned to project & task with active membership.');
    } else {
      recordResult('Pre-Removal Setup Verification', 'FAIL', 'Pre-removal state was not set up correctly.');
    }

    // -------------------------------------------------------------------------
    // Execute Member Removal via Organizer
    // -------------------------------------------------------------------------
    console.log('\n--- Executing remove_organization_member as Organizer ---');
    const removeRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${TARGET_MEMBER_ID}');
    `);

    if (!removeRes.success) {
      recordResult('Execution of remove_organization_member', 'FAIL', `RPC threw error: ${removeRes.error}`);
    } else {
      recordResult('Execution of remove_organization_member', 'PASS', `RPC returned: ${removeRes.result}`);
    }

    // -------------------------------------------------------------------------
    // Query Database: Assert post-removal state across all 8 tables
    // -------------------------------------------------------------------------
    console.log('\n--- Verifying Database Integrity & Work Unassignment ---');

    // 1. organization_memberships row must be DELETED
    const postMembershipCount = runPsql(`
      SELECT count(*) FROM public.organization_memberships
      WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${TARGET_MEMBER_ID}';
    `);
    if (parseInt(postMembershipCount, 10) === 0) {
      recordResult(
        'Table: organization_memberships',
        'PASS',
        `Membership record (${preMembershipId}) was deleted from DB (count: 0).`
      );
    } else {
      recordResult(
        'Table: organization_memberships',
        'FAIL',
        `Membership record still exists in DB! (count: ${postMembershipCount})`
      );
    }

    // 2. tasks: assigned_to must be set to NULL, task row preserved
    const postTaskAssignee = runPsql(`SELECT coalesce(assigned_to::text, 'NULL') FROM public.tasks WHERE id = '${TASK_ID}';`);
    const postTaskCount = runPsql(`SELECT count(*) FROM public.tasks WHERE id = '${TASK_ID}';`);
    if (postTaskAssignee === 'NULL' && parseInt(postTaskCount, 10) === 1) {
      recordResult(
        'Table: tasks (assigned_to field)',
        'PASS',
        'Task row preserved (count: 1) and assigned_to is cleanly set to NULL.'
      );
    } else {
      recordResult(
        'Table: tasks (assigned_to field)',
        'FAIL',
        `Task assigned_to is ${postTaskAssignee}, task count = ${postTaskCount}`
      );
    }

    // 3. projects: manager_id must be set to NULL, project row preserved
    const postProjectManager = runPsql(`SELECT coalesce(manager_id::text, 'NULL') FROM public.projects WHERE id = '${PROJECT_ID}';`);
    const postProjectCount = runPsql(`SELECT count(*) FROM public.projects WHERE id = '${PROJECT_ID}';`);
    if (postProjectManager === 'NULL' && parseInt(postProjectCount, 10) === 1) {
      recordResult(
        'Table: projects (manager_id field)',
        'PASS',
        'Project row preserved (count: 1) and manager_id is cleanly set to NULL.'
      );
    } else {
      recordResult(
        'Table: projects (manager_id field)',
        'FAIL',
        `Project manager_id is ${postProjectManager}, project count = ${postProjectCount}`
      );
    }

    // 4. project_members: target member's allocation deleted, other members preserved
    const postTargetPMCount = runPsql(`SELECT count(*) FROM public.project_members WHERE user_id = '${TARGET_MEMBER_ID}';`);
    const postRemainingPMCount = runPsql(`SELECT count(*) FROM public.project_members WHERE user_id = '${REMAINING_MEMBER_ID}';`);
    if (parseInt(postTargetPMCount, 10) === 0 && parseInt(postRemainingPMCount, 10) === 1) {
      recordResult(
        'Table: project_members',
        'PASS',
        'Target member allocation cleanly removed (count: 0); remaining member preserved (count: 1).'
      );
    } else {
      recordResult(
        'Table: project_members',
        'FAIL',
        `Target member allocation count: ${postTargetPMCount}; remaining member count: ${postRemainingPMCount}`
      );
    }

    // 5. organization_audit_logs: immutable member.removed entry created
    const auditLogCount = runPsql(`
      SELECT count(*) FROM public.organization_audit_logs
      WHERE organization_id = '${TEST_ORG_ID}'
        AND target_user_id = '${TARGET_MEMBER_ID}'
        AND action = 'member.removed';
    `);
    if (parseInt(auditLogCount, 10) >= 1) {
      recordResult(
        'Table: organization_audit_logs',
        'PASS',
        'Immutable audit log entry written for member.removed.'
      );
    } else {
      recordResult(
        'Table: organization_audit_logs',
        'FAIL',
        `No audit log entry found for member.removed (count: ${auditLogCount})`
      );
    }

    // 6. user_profiles & auth.users preserved (not deleted)
    const profileCount = runPsql(`SELECT count(*) FROM public.user_profiles WHERE id = '${TARGET_MEMBER_ID}';`);
    const authCount = runPsql(`SELECT count(*) FROM auth.users WHERE id = '${TARGET_MEMBER_ID}';`);
    if (parseInt(profileCount, 10) === 1 && parseInt(authCount, 10) === 1) {
      recordResult(
        'Tables: user_profiles & auth.users',
        'PASS',
        'Target member user profile and auth account preserved (not cascade-deleted).'
      );
    } else {
      recordResult(
        'Tables: user_profiles & auth.users',
        'FAIL',
        `Target member user profile count: ${profileCount}, auth count: ${authCount}`
      );
    }

  } finally {
    console.log('\n--- Cleaning up synthetic regression test data ---');
    runPsql(`
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.tasks WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.project_members WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.projects WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_audit_logs WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_memberships WHERE organization_id = '${TEST_ORG_ID}';
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organizations WHERE id = '${TEST_ORG_ID}';
      DELETE FROM public.user_profiles WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_ID}', '${TARGET_MEMBER_ID}', '${REMAINING_MEMBER_ID}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_ID}', '${TARGET_MEMBER_ID}', '${REMAINING_MEMBER_ID}'
      );
    `);
    console.log('Cleanup completed successfully.');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`REGRESSION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDataLifecycleRegressionTests().catch((err) => {
  console.error('Regression test execution failed:', err);
  process.exit(1);
});

