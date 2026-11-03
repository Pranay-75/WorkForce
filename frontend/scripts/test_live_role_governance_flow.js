/**
 * WorkForce - Live Local Database Role Governance & Invariants Test Suite
 * File: frontend/scripts/test_live_role_governance_flow.js
 *
 * Verifies Option B role governance directly against local Supabase PostgreSQL:
 * 1. Organizer can add/assign Admin, HR, Manager, and Employee.
 * 2. Admin can add/assign HR, Manager, and Employee.
 * 3. Admin CANNOT add or invite an Admin (42501).
 * 4. Admin CANNOT modify or demote an Admin (42501).
 * 5. Admin CANNOT remove an Admin (42501).
 * 6. Non-admin (HR, Manager, Employee) CANNOT add members or assign roles (42501).
 * 7. Organizer CANNOT be demoted or removed (42501).
 * 8. Organization boundaries are strictly enforced.
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

async function runLiveTests() {
  console.log('================================================================');
  console.log(' WORKFORCE LIVE LOCAL ROLE-GOVERNANCE DATABASE FLOW TEST SUITE  ');
  console.log('================================================================\n');

  // Synthetic disposable test IDs
  const TEST_ORG_ID = 'e0000000-0000-0000-0000-000000000099';
  const ORGANIZER_ID = 'f0000000-0000-0000-0000-000000000001';
  const ADMIN_1_ID = 'f0000000-0000-0000-0000-000000000002';
  const ADMIN_2_ID = 'f0000000-0000-0000-0000-000000000003';
  const HR_1_ID = 'f0000000-0000-0000-0000-000000000004';
  const MGR_1_ID = 'f0000000-0000-0000-0000-000000000005';
  const EMP_1_ID = 'f0000000-0000-0000-0000-000000000006';

  try {
    // -------------------------------------------------------------------------
    // Setup: Initialize disposable test organization and user profiles
    // -------------------------------------------------------------------------
    console.log('--- Setting up synthetic disposable test organization & users ---');
    runPsql(`
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_memberships WHERE organization_id = '${TEST_ORG_ID}';
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_invitations WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_audit_logs WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organizations WHERE id = '${TEST_ORG_ID}';
      DELETE FROM public.user_profiles WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${HR_1_ID}', '${MGR_1_ID}', '${EMP_1_ID}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${HR_1_ID}', '${MGR_1_ID}', '${EMP_1_ID}'
      );

      -- Insert into auth.users (trigger handle_new_user auto-creates public.user_profiles)
      INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
        ('${ORGANIZER_ID}', 'authenticated', 'authenticated', 'synthetic.org.owner@acme.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Organizer"}', now(), now()),
        ('${ADMIN_1_ID}', 'authenticated', 'authenticated', 'synthetic.admin1@acme.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Admin 1"}', now(), now()),
        ('${ADMIN_2_ID}', 'authenticated', 'authenticated', 'synthetic.admin2@acme.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Admin 2"}', now(), now()),
        ('${HR_1_ID}', 'authenticated', 'authenticated', 'synthetic.hr1@acme.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic HR"}', now(), now()),
        ('${MGR_1_ID}', 'authenticated', 'authenticated', 'synthetic.mgr1@acme.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Manager"}', now(), now()),
        ('${EMP_1_ID}', 'authenticated', 'authenticated', 'synthetic.emp1@acme.corp', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Employee"}', now(), now());

      -- Ensure user_profiles exist with proper email/full_name
      INSERT INTO public.user_profiles (id, email, full_name, department, job_title) VALUES
        ('${ORGANIZER_ID}', 'synthetic.org.owner@acme.corp', 'Synthetic Organizer', 'Exec', 'Founder'),
        ('${ADMIN_1_ID}', 'synthetic.admin1@acme.corp', 'Synthetic Admin 1', 'Ops', 'Director'),
        ('${ADMIN_2_ID}', 'synthetic.admin2@acme.corp', 'Synthetic Admin 2', 'Ops', 'Director'),
        ('${HR_1_ID}', 'synthetic.hr1@acme.corp', 'Synthetic HR', 'Talent', 'Lead'),
        ('${MGR_1_ID}', 'synthetic.mgr1@acme.corp', 'Synthetic Manager', 'Eng', 'Manager'),
        ('${EMP_1_ID}', 'synthetic.emp1@acme.corp', 'Synthetic Employee', 'Eng', 'Developer')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

      -- Create synthetic organization with designated owner
      INSERT INTO public.organizations (id, name, slug, created_by)
      VALUES ('${TEST_ORG_ID}', 'Synthetic Governance Test Org', 'syn-gov-org', '${ORGANIZER_ID}');

      -- Establish active Organizer membership
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES ('${TEST_ORG_ID}', '${ORGANIZER_ID}', 'organizer', 'active');
    `);

    // -------------------------------------------------------------------------
    // Test 1: Organizer can add/assign Admin, HR, Manager, and Employee
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Organizer Member Addition Capabilities ---');
    
    // Organizer adds Admin 1
    const orgAddAdminRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'synthetic.admin1@acme.corp', 'admin'::public.user_role);
    `);
    if (orgAddAdminRes.success) {
      recordResult('Organizer Can Add Administrator', 'PASS', 'Organizer successfully added Admin.');
    } else {
      recordResult('Organizer Can Add Administrator', 'FAIL', orgAddAdminRes.error);
    }

    // Organizer adds HR 1
    const orgAddHrRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'synthetic.hr1@acme.corp', 'hr'::public.user_role);
    `);
    if (orgAddHrRes.success) {
      recordResult('Organizer Can Add HR Member', 'PASS', 'Organizer successfully added HR.');
    } else {
      recordResult('Organizer Can Add HR Member', 'FAIL', orgAddHrRes.error);
    }

    // Organizer adds Manager 1
    const orgAddMgrRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'synthetic.mgr1@acme.corp', 'manager'::public.user_role);
    `);
    if (orgAddMgrRes.success) {
      recordResult('Organizer Can Add Manager', 'PASS', 'Organizer successfully added Manager.');
    } else {
      recordResult('Organizer Can Add Manager', 'FAIL', orgAddMgrRes.error);
    }

    // Organizer adds Employee 1
    const orgAddEmpRes = runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'synthetic.emp1@acme.corp', 'employee'::public.user_role);
    `);
    if (orgAddEmpRes.success) {
      recordResult('Organizer Can Add Employee', 'PASS', 'Organizer successfully added Employee.');
    } else {
      recordResult('Organizer Can Add Employee', 'FAIL', orgAddEmpRes.error);
    }

    // -------------------------------------------------------------------------
    // Test 2: Admin can add HR, Manager, and Employee
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Admin Member Addition Capabilities ---');
    
    // Add Admin 2 as Organizer first so we have a target
    runPsqlAsUser(ORGANIZER_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'synthetic.admin2@acme.corp', 'admin'::public.user_role);
    `);

    // Admin 1 updates/adds HR member
    const adminAddHrRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.update_member_role('${TEST_ORG_ID}', '${HR_1_ID}', 'hr'::public.user_role);
    `);
    if (adminAddHrRes.success) {
      recordResult('Admin Can Assign HR Role', 'PASS', 'Admin 1 updated HR role.');
    } else {
      recordResult('Admin Can Assign HR Role', 'FAIL', adminAddHrRes.error);
    }

    // Admin 1 updates Employee to Manager
    const adminAddMgrRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.update_member_role('${TEST_ORG_ID}', '${EMP_1_ID}', 'manager'::public.user_role);
    `);
    if (adminAddMgrRes.success) {
      recordResult('Admin Can Promote to Manager', 'PASS', 'Admin 1 promoted member to Manager.');
    } else {
      recordResult('Admin Can Promote to Manager', 'FAIL', adminAddMgrRes.error);
    }

    // -------------------------------------------------------------------------
    // Test 3: Admin CANNOT add or invite an Admin
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Admin Privilege Boundary (Cannot Add Admin) ---');
    const adminAddAdminRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'new.subadmin@acme.corp', 'admin'::public.user_role);
    `);
    if (!adminAddAdminRes.success && adminAddAdminRes.error.includes('Only the organization organizer can add or invite an administrator')) {
      recordResult('Admin Forbidden From Adding Administrator', 'PASS', 'Threw 42501: Only the organization organizer can add or invite an administrator.');
    } else {
      recordResult('Admin Forbidden From Adding Administrator', 'FAIL', `Expected 42501 error, got: ${JSON.stringify(adminAddAdminRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 4: Admin CANNOT modify or demote an existing Admin
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Admin Protection (Admin Cannot Modify Admin) ---');
    const adminDemoteAdminRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.update_member_role('${TEST_ORG_ID}', '${ADMIN_2_ID}', 'employee'::public.user_role);
    `);
    if (!adminDemoteAdminRes.success && adminDemoteAdminRes.error.includes('Only the organization organizer can modify an administrator role')) {
      recordResult('Admin Forbidden From Modifying Another Admin', 'PASS', 'Threw 42501: Only the organization organizer can modify an administrator role.');
    } else {
      recordResult('Admin Forbidden From Modifying Another Admin', 'FAIL', `Expected 42501 error, got: ${JSON.stringify(adminDemoteAdminRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 5: Admin CANNOT remove an Admin
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Admin Removal (Admin Cannot Remove Admin) ---');
    const adminRemoveAdminRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${ADMIN_2_ID}');
    `);
    if (!adminRemoveAdminRes.success && adminRemoveAdminRes.error.includes('Only the organization organizer can remove an administrator')) {
      recordResult('Admin Forbidden From Removing Another Admin', 'PASS', 'Threw 42501: Only the organization organizer can remove an administrator.');
    } else {
      recordResult('Admin Forbidden From Removing Another Admin', 'FAIL', `Expected 42501 error, got: ${JSON.stringify(adminRemoveAdminRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 6: Non-admin (HR, Manager, Employee) CANNOT add members or assign roles
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Non-Admin Inability to Assign Roles ---');
    const hrAddRes = runPsqlAsUser(HR_1_ID, `
      SELECT public.add_organization_member('${TEST_ORG_ID}', 'stranger@acme.corp', 'employee'::public.user_role);
    `);
    if (!hrAddRes.success && hrAddRes.error.includes('Only organization administrators or organizers can add members')) {
      recordResult('HR Forbidden From Adding Members', 'PASS', 'HR rejected with 42501.');
    } else {
      recordResult('HR Forbidden From Adding Members', 'FAIL', `Expected 42501, got: ${JSON.stringify(hrAddRes)}`);
    }

    const mgrRoleRes = runPsqlAsUser(MGR_1_ID, `
      SELECT public.update_member_role('${TEST_ORG_ID}', '${EMP_1_ID}', 'hr'::public.user_role);
    `);
    if (!mgrRoleRes.success && mgrRoleRes.error.includes('Only organization administrators or organizers can update member roles')) {
      recordResult('Manager Forbidden From Updating Roles', 'PASS', 'Manager rejected with 42501.');
    } else {
      recordResult('Manager Forbidden From Updating Roles', 'FAIL', `Expected 42501, got: ${JSON.stringify(mgrRoleRes)}`);
    }

    const empRoleRes = runPsqlAsUser(EMP_1_ID, `
      SELECT public.update_member_role('${TEST_ORG_ID}', '${MGR_1_ID}', 'employee'::public.user_role);
    `);
    if (!empRoleRes.success && empRoleRes.error.includes('Only organization administrators or organizers can update member roles')) {
      recordResult('Employee Forbidden From Updating Roles', 'PASS', 'Employee rejected with 42501.');
    } else {
      recordResult('Employee Forbidden From Updating Roles', 'FAIL', `Expected 42501, got: ${JSON.stringify(empRoleRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 7: Organizer CANNOT be demoted or removed through these flows
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Organizer Invariant Protection ---');
    const demoteOrgRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.update_member_role('${TEST_ORG_ID}', '${ORGANIZER_ID}', 'admin'::public.user_role);
    `);
    if (!demoteOrgRes.success && demoteOrgRes.error.includes('Cannot demote the organization organizer')) {
      recordResult('Organizer Demotion Forbidden in update_member_role', 'PASS', 'Threw 42501: Cannot demote the organization organizer.');
    } else {
      recordResult('Organizer Demotion Forbidden in update_member_role', 'FAIL', `Expected 42501, got: ${JSON.stringify(demoteOrgRes)}`);
    }

    const removeOrgRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.remove_organization_member('${TEST_ORG_ID}', '${ORGANIZER_ID}');
    `);
    if (!removeOrgRes.success && removeOrgRes.error.includes('Cannot remove the organization organizer')) {
      recordResult('Organizer Removal Forbidden in remove_organization_member', 'PASS', 'Threw 42501: Cannot remove the organization organizer.');
    } else {
      recordResult('Organizer Removal Forbidden in remove_organization_member', 'FAIL', `Expected 42501, got: ${JSON.stringify(removeOrgRes)}`);
    }

    // -------------------------------------------------------------------------
    // Test 8: Cross-Tenant Organization Isolation Boundary
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Organization Isolation Boundary ---');
    const OTHER_ORG_ID = 'a0000000-0000-0000-0000-000000000001'; // Acme Systems
    const crossOrgRes = runPsqlAsUser(ADMIN_1_ID, `
      SELECT public.add_organization_member('${OTHER_ORG_ID}', 'cross.org@acme.corp', 'employee'::public.user_role);
    `);
    if (!crossOrgRes.success && crossOrgRes.error.includes('Only organization administrators or organizers can add members')) {
      recordResult('Cross-Tenant Action Blocked', 'PASS', 'Admin from Org A cannot add members to Org B (42501).');
    } else {
      recordResult('Cross-Tenant Action Blocked', 'FAIL', `Expected 42501, got: ${JSON.stringify(crossOrgRes)}`);
    }

  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up all synthetic test data
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up synthetic test organization & memberships ---');
    runPsql(`
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_memberships WHERE organization_id = '${TEST_ORG_ID}';
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      DELETE FROM public.organization_invitations WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organization_audit_logs WHERE organization_id = '${TEST_ORG_ID}';
      DELETE FROM public.organizations WHERE id = '${TEST_ORG_ID}';
      DELETE FROM public.user_profiles WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${HR_1_ID}', '${MGR_1_ID}', '${EMP_1_ID}'
      );
      DELETE FROM auth.users WHERE id IN (
        '${ORGANIZER_ID}', '${ADMIN_1_ID}', '${ADMIN_2_ID}', '${HR_1_ID}', '${MGR_1_ID}', '${EMP_1_ID}'
      );
    `);
    console.log('Cleanup completed cleanly.');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`LIVE DATABASE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
