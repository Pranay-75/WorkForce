/**
 * WorkForce - Active Member Removal Database Verification Test Suite
 * File: frontend/scripts/test_active_member_removal_db.js
 *
 * Verifies that active member removal strictly enforces authorization, deletes the
 * database record in public.organization_memberships, logs an audit entry,
 * and asserts that database rows are truly deleted (not just UI changes).
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

async function runActiveMemberRemovalTests() {
  console.log('================================================================');
  console.log(' WORKFORCE ACTIVE MEMBER REMOVAL DATABASE VERIFICATION SUITE    ');
  console.log('================================================================\n');

  // Synthetic disposable test IDs
  const TEST_ORG_ID = 'e1000000-0000-0000-0000-000000000001';
  const ORGANIZER_ID = 'f1000000-0000-0000-0000-000000000001';
  const ADMIN_1_ID = 'f1000000-0000-0000-0000-000000000002';
  const ADMIN_2_ID = 'f1000000-0000-0000-0000-000000000003';
  const EMP_1_ID = 'f1000000-0000-0000-0000-000000000004';
  const EMP_2_ID = 'f1000000-0000-0000-0000-000000000005';
  const EMP_3_ID = 'f1000000-0000-0000-0000-000000000006';

  try {
    // -------------------------------------------------------------------------
    // Setup: Create synthetic organization, users, profiles, and memberships
    // -------------------------------------------------------------------------
    console.log('--- Setting up synthetic organization and active memberships ---');
    runPsql(`
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_memberships WHERE organization_id = '${TEST_ORG_ID}';
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_audit_logs WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_invitations WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organizations WHERE id = '${TEST_ORG_ID}';
      DELETE FROM public.user_profiles WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${EMP_1_ID}', '${EMP_2_ID}', '${EMP_3_ID}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${EMP_1_ID}', '${EMP_2_ID}', '${EMP_3_ID}'
      );

      -- Synthetic users
      INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
        ('${ORGANIZER_ID}', 'authenticated', 'authenticated', 'removal_org@test.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Organizer"}', now(), now()),
        ('${ADMIN_1_ID}', 'authenticated', 'authenticated', 'removal_admin1@test.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin 1"}', now(), now()),
        ('${ADMIN_2_ID}', 'authenticated', 'authenticated', 'removal_admin2@test.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin 2"}', now(), now()),
        ('${EMP_1_ID}', 'authenticated', 'authenticated', 'removal_emp1@test.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Employee 1"}', now(), now()),
        ('${EMP_2_ID}', 'authenticated', 'authenticated', 'removal_emp2@test.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Employee 2"}', now(), now()),
        ('${EMP_3_ID}', 'authenticated', 'authenticated', 'removal_emp3@test.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Employee 3"}', now(), now())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.user_profiles (id, email, full_name, department, job_title) VALUES
        ('${ORGANIZER_ID}', 'removal_org@test.corp', 'Test Organizer', 'Exec', 'Founder'),
        ('${ADMIN_1_ID}', 'removal_admin1@test.corp', 'Test Admin 1', 'Ops', 'Director'),
        ('${ADMIN_2_ID}', 'removal_admin2@test.corp', 'Test Admin 2', 'Ops', 'Director'),
        ('${EMP_1_ID}', 'removal_emp1@test.corp', 'Test Employee 1', 'Eng', 'Developer'),
        ('${EMP_2_ID}', 'removal_emp2@test.corp', 'Test Employee 2', 'Eng', 'Developer'),
        ('${EMP_3_ID}', 'removal_emp3@test.corp', 'Test Employee 3', 'Eng', 'Developer')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

      INSERT INTO public.organizations (id, name, slug, created_by)
      VALUES ('${TEST_ORG_ID}', 'Active Removal Test Org', 'active-removal-test-org', '${ORGANIZER_ID}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES
        ('${TEST_ORG_ID}', '${ORGANIZER_ID}', 'organizer', 'active'),
        ('${TEST_ORG_ID}', '${ADMIN_1_ID}', 'admin', 'active'),
        ('${TEST_ORG_ID}', '${ADMIN_2_ID}', 'admin', 'active'),
        ('${TEST_ORG_ID}', '${EMP_1_ID}', 'employee', 'active'),
        ('${TEST_ORG_ID}', '${EMP_2_ID}', 'employee', 'active'),
        ('${TEST_ORG_ID}', '${EMP_3_ID}', 'employee', 'active')
      ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
    `);

    // Verify initial active membership counts in DB
    const initialCount = parseInt(runPsql(`
      SELECT count(*) FROM public.organization_memberships
      WHERE organization_id = '${TEST_ORG_ID}' AND status = 'active';
    `), 10);

    if (initialCount === 6) {
      recordResult('Setup Active Memberships', 'PASS', `Created 6 active memberships in test organization.`);
    } else {
      recordResult('Setup Active Memberships', 'FAIL', `Expected 6 active memberships, found ${initialCount}`);
    }

    // -------------------------------------------------------------------------
    // Test 1: Organizer successfully removes Active Employee (Asserts DB deletion)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Organizer Removal of Active Member & Database Deletion ---');
    const orgRemoveEmpRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${EMP_1_ID}');
    `);

    if (orgRemoveEmpRes.success && orgRemoveEmpRes.result.includes('member_removed')) {
      // Re-read from database directly to verify deletion
      const remainingEmp1 = runPsql(`
        SELECT count(*) FROM public.organization_memberships
        WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${EMP_1_ID}';
      `);

      // Verify audit log
      const auditLogEmp1 = runPsql(`
        SELECT count(*) FROM public.organization_audit_logs
        WHERE organization_id = '${TEST_ORG_ID}'
          AND target_user_id = '${EMP_1_ID}'
          AND action = 'member.removed';
      `);

      if (parseInt(remainingEmp1, 10) === 0 && parseInt(auditLogEmp1, 10) >= 1) {
        recordResult(
          'Organizer Removes Active Member: Row Deleted in DB',
          'PASS',
          'RPC returned member_removed, database count confirmed 0 rows, and audit log recorded.'
        );
      } else {
        recordResult(
          'Organizer Removes Active Member: Row Deleted in DB',
          'FAIL',
          `RPC succeeded but database record still exists (count: ${remainingEmp1}) or audit log missing (${auditLogEmp1})`
        );
      }
    } else {
      recordResult('Organizer Removes Active Member: Row Deleted in DB', 'FAIL', `RPC failed: ${JSON.stringify(orgRemoveEmpRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 2: Admin successfully removes Active Employee (Asserts DB deletion)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Admin Removal of Active Member & Database Deletion ---');
    const adminRemoveEmpRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${EMP_2_ID}');
    `);

    if (adminRemoveEmpRes.success && adminRemoveEmpRes.result.includes('member_removed')) {
      const remainingEmp2 = runPsql(`
        SELECT count(*) FROM public.organization_memberships
        WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${EMP_2_ID}';
      `);

      if (parseInt(remainingEmp2, 10) === 0) {
        recordResult(
          'Admin Removes Active Member: Row Deleted in DB',
          'PASS',
          'Admin removed Employee 2; verified membership is completely deleted from database.'
        );
      } else {
        recordResult(
          'Admin Removes Active Member: Row Deleted in DB',
          'FAIL',
          `Employee 2 record still exists in database: count = ${remainingEmp2}`
        );
      }
    } else {
      recordResult('Admin Removes Active Member: Row Deleted in DB', 'FAIL', `RPC failed: ${JSON.stringify(adminRemoveEmpRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 3: Admin CANNOT remove Organizer (Protected)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Admin Attempt to Remove Organizer ---');
    const adminRemoveOrgRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${ORGANIZER_ID}');
    `);

    if (!adminRemoveOrgRes.success && adminRemoveOrgRes.error.includes('Cannot remove the organization organizer')) {
      const orgStillExists = runPsql(`
        SELECT count(*) FROM public.organization_memberships
        WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${ORGANIZER_ID}' AND status = 'active';
      `);
      if (parseInt(orgStillExists, 10) === 1) {
        recordResult(
          'Admin Forbidden From Removing Organizer',
          'PASS',
          'Rejected with 42501 and Organizer membership remains active in DB.'
        );
      } else {
        recordResult('Admin Forbidden From Removing Organizer', 'FAIL', 'Organizer membership was deleted!');
      }
    } else {
      recordResult('Admin Forbidden From Removing Organizer', 'FAIL', `Expected 42501, got: ${JSON.stringify(adminRemoveOrgRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 4: Admin CANNOT remove another Admin (Only Organizer can remove Admin)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Admin Attempt to Remove Another Admin ---');
    const adminRemoveAdminRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${ADMIN_2_ID}');
    `);

    if (!adminRemoveAdminRes.success && adminRemoveAdminRes.error.includes('Only the organization organizer can remove an administrator')) {
      const admin2StillExists = runPsql(`
        SELECT count(*) FROM public.organization_memberships
        WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${ADMIN_2_ID}' AND status = 'active';
      `);
      if (parseInt(admin2StillExists, 10) === 1) {
        recordResult(
          'Admin Forbidden From Removing Admin',
          'PASS',
          'Rejected with 42501 and Admin 2 membership remains intact.'
        );
      } else {
        recordResult('Admin Forbidden From Removing Admin', 'FAIL', 'Admin 2 membership was deleted!');
      }
    } else {
      recordResult('Admin Forbidden From Removing Admin', 'FAIL', `Expected 42501, got: ${JSON.stringify(adminRemoveAdminRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 5: Organizer CAN remove an Admin (Privilege boundary)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Organizer Removal of Administrator ---');
    const orgRemoveAdminRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${ADMIN_2_ID}');
    `);

    if (orgRemoveAdminRes.success && orgRemoveAdminRes.result.includes('member_removed')) {
      const remainingAdmin2 = runPsql(`
        SELECT count(*) FROM public.organization_memberships
        WHERE organization_id = '${TEST_ORG_ID}' AND user_id = '${ADMIN_2_ID}';
      `);
      if (parseInt(remainingAdmin2, 10) === 0) {
        recordResult(
          'Organizer Successfully Removes Administrator',
          'PASS',
          'Organizer removed Admin 2; database confirmed 0 rows remaining.'
        );
      } else {
        recordResult(
          'Organizer Successfully Removes Administrator',
          'FAIL',
          `Admin 2 still present in DB: count = ${remainingAdmin2}`
        );
      }
    } else {
      recordResult('Organizer Successfully Removes Administrator', 'FAIL', `RPC failed: ${JSON.stringify(orgRemoveAdminRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 6: Non-Admin (Employee) CANNOT remove Active Member
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Non-Admin (Employee) Attempt to Remove Member ---');
    const empRemoveEmpRes = runPsqlAsUser(EMP_3_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${ORGANIZER_ID}');
    `);

    if (!empRemoveEmpRes.success && empRemoveEmpRes.error.includes('Only organization administrators or organizers can remove members')) {
      recordResult(
        'Employee Forbidden From Removing Members',
        'PASS',
        'Rejected with 42501: Only organization administrators or organizers can remove members.'
      );
    } else {
      recordResult('Employee Forbidden From Removing Members', 'FAIL', `Expected 42501, got: ${JSON.stringify(empRemoveEmpRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 7: Mismatched ID or Non-Existent Member Fails Cleanly
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Removal With Non-Existent Member User ID ---');
    const randomUserId = '00000000-0000-0000-0000-000000000999';
    const nonExistentRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${randomUserId}');
    `);

    if (!nonExistentRes.success && nonExistentRes.error.includes('Active member not found in this organization')) {
      recordResult(
        'Non-Existent Member Rejection',
        'PASS',
        'Correctly threw 42501: Active member not found in this organization.'
      );
    } else {
      recordResult('Non-Existent Member Rejection', 'FAIL', `Expected Active member not found, got: ${JSON.stringify(nonExistentRes)}`);
    }

  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up synthetic test records
    // -------------------------------------------------------------------------
    console.log('\n--- Teardown: Cleaning up synthetic test data ---');
    runPsql(`
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_memberships WHERE organization_id = '${TEST_ORG_ID}';
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_audit_logs WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_invitations WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organizations WHERE id = '${TEST_ORG_ID}';
      DELETE FROM public.user_profiles WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${EMP_1_ID}', '${EMP_2_ID}', '${EMP_3_ID}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${EMP_1_ID}', '${EMP_2_ID}', '${EMP_3_ID}'
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
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runActiveMemberRemovalTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
