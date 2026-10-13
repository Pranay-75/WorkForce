const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function runPsql(sql) {
  return execSync('docker exec -i supabase_db_WorkForce psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A', {
    input: sql,
    encoding: 'utf8'
  }).trim();
}

async function runRealAuthSmokeTest() {
  console.log('================================================================');
  console.log('    REAL LOCAL AUTH SIGNUP & DISPOSABLE ORG SMOKE TEST SUITE    ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testAdminEmail = `smoke.admin.${timestamp}@workforce.test`;
  const testMemberEmail = `smoke.member.${timestamp}@workforce.test`;
  const testPassword = 'Password123!';
  const disposableSlug = `disp-org-${timestamp}`;

  let adminUserId = null;
  let memberUserId = null;
  let disposableOrgId = null;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Real Auth Signup via Supabase GoTrue Auth API
    // -------------------------------------------------------------------------
    console.log(`1. Signing up real user via GoTrue Auth API: ${testAdminEmail}`);
    const { data: adminAuth, error: adminSignupErr } = await anonClient.auth.signUp({
      email: testAdminEmail,
      password: testPassword,
      options: {
        data: { full_name: 'Real Smoke Admin' }
      }
    });
    if (adminSignupErr || !adminAuth.user) {
      throw new Error(`Admin signup failed: ${adminSignupErr?.message || 'No user returned'}`);
    }
    adminUserId = adminAuth.user.id;
    console.log(`   ✅ Admin signed up with real Auth UID: ${adminUserId}`);

    console.log(`2. Signing up second real user via GoTrue Auth API: ${testMemberEmail}`);
    const { data: memberAuth, error: memberSignupErr } = await anonClient.auth.signUp({
      email: testMemberEmail,
      password: testPassword,
      options: {
        data: { full_name: 'Real Smoke Member' }
      }
    });
    if (memberSignupErr || !memberAuth.user) {
      throw new Error(`Member signup failed: ${memberSignupErr?.message || 'No user returned'}`);
    }
    memberUserId = memberAuth.user.id;
    console.log(`   ✅ Member signed up with real Auth UID: ${memberUserId}`);

    // -------------------------------------------------------------------------
    // Step 2: Verify handle_new_user() Trigger Created User Profiles
    // -------------------------------------------------------------------------
    console.log('\n3. Verifying handle_new_user() automatically created profile records...');
    const adminProfile = runPsql(`SELECT full_name FROM public.user_profiles WHERE id = '${adminUserId}'`);
    const memberProfile = runPsql(`SELECT full_name FROM public.user_profiles WHERE id = '${memberUserId}'`);
    if (adminProfile !== 'Real Smoke Admin' || memberProfile !== 'Real Smoke Member') {
      throw new Error(`Trigger failed! Admin profile: "${adminProfile}", Member profile: "${memberProfile}"`);
    }
    console.log(`   ✅ handle_new_user() verified: Admin="${adminProfile}", Member="${memberProfile}"`);

    // -------------------------------------------------------------------------
    // Step 3: Login to get real authenticated JWT sessions
    // -------------------------------------------------------------------------
    console.log('\n4. Logging in to acquire verified JWT session tokens...');
    const { data: adminSession, error: adminLoginErr } = await anonClient.auth.signInWithPassword({
      email: testAdminEmail,
      password: testPassword
    });
    if (adminLoginErr || !adminSession.session) throw new Error(`Admin login failed: ${adminLoginErr?.message}`);

    const { data: memberSession, error: memberLoginErr } = await anonClient.auth.signInWithPassword({
      email: testMemberEmail,
      password: testPassword
    });
    if (memberLoginErr || !memberSession.session) throw new Error(`Member login failed: ${memberLoginErr?.message}`);

    const authenticatedAdminClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${adminSession.session.access_token}` } }
    });

    const authenticatedMemberClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${memberSession.session.access_token}` } }
    });
    console.log('   ✅ Real JWT access tokens acquired for both users.');

    // -------------------------------------------------------------------------
    // Step 4: Workspace Creation via create_organization_with_admin RPC
    // -------------------------------------------------------------------------
    console.log('\n5. Creating disposable organization via real JWT RPC create_organization_with_admin...');
    const { data: orgId, error: createOrgErr } = await authenticatedAdminClient.rpc('create_organization_with_admin', {
      p_name: `Disposable Org ${timestamp}`,
      p_slug: disposableSlug
    });
    if (createOrgErr || !orgId) throw new Error(`create_organization_with_admin RPC failed: ${JSON.stringify(createOrgErr)}`);
    disposableOrgId = orgId;
    console.log(`   ✅ Disposable workspace created atomically with ID: ${disposableOrgId}`);

    // Verify Admin membership
    const creatorRole = runPsql(`SELECT role FROM public.organization_memberships WHERE organization_id = '${disposableOrgId}' AND user_id = '${adminUserId}'`);
    if (creatorRole !== 'admin') throw new Error(`Creator was not assigned admin role! Found: ${creatorRole}`);
    console.log(`   ✅ Creator confirmed as active admin.`);

    // -------------------------------------------------------------------------
    // Step 5: Add Member and Promote via promote_member_to_admin RPC
    // -------------------------------------------------------------------------
    console.log('\n6. Adding member as manager and elevating via promote_member_to_admin RPC...');
    const { error: insertMemErr } = await authenticatedAdminClient.from('organization_memberships').insert({
      organization_id: disposableOrgId,
      user_id: memberUserId,
      role: 'manager',
      status: 'active'
    });
    if (insertMemErr) throw new Error(`Failed to add manager: ${insertMemErr.message}`);

    const { error: promoteErr } = await authenticatedAdminClient.rpc('promote_member_to_admin', {
      p_organization_id: disposableOrgId,
      p_user_id: memberUserId
    });
    if (promoteErr) throw new Error(`promote_member_to_admin failed: ${JSON.stringify(promoteErr)}`);

    const promotedRole = runPsql(`SELECT role FROM public.organization_memberships WHERE organization_id = '${disposableOrgId}' AND user_id = '${memberUserId}'`);
    if (promotedRole !== 'admin') throw new Error(`Promoted member role is not admin: ${promotedRole}`);
    console.log(`   ✅ Member successfully promoted to Admin with real JWT.`);

    // Verify immutable audit log
    const auditCount = runPsql(`SELECT count(*) FROM public.organization_audit_logs WHERE organization_id = '${disposableOrgId}' AND action = 'PROMOTE_TO_ADMIN'`);
    if (auditCount !== '1') throw new Error(`Audit log missing! Found: ${auditCount}`);
    console.log(`   ✅ Immutable audit entry verified in organization_audit_logs.`);

    // -------------------------------------------------------------------------
    // Step 6: Destructive Last-Admin Test in Disposable Workspace
    // -------------------------------------------------------------------------
    console.log('\n7. Executing destructive last-admin test in disposable workspace...');
    // Delete Admin 1 (Leaves Admin 2)
    const { error: delAdmin1Err } = await authenticatedAdminClient
      .from('organization_memberships')
      .delete()
      .eq('organization_id', disposableOrgId)
      .eq('user_id', adminUserId);
    if (delAdmin1Err) throw new Error(`Deleting first of two admins failed: ${delAdmin1Err.message}`);
    console.log('   ✅ First of two admins deleted successfully (1 active admin remains).');

    // Attempt to delete Admin 2 (Must be blocked by protect_last_active_admin trigger)
    const { error: delAdmin2Err } = await authenticatedMemberClient
      .from('organization_memberships')
      .delete()
      .eq('organization_id', disposableOrgId)
      .eq('user_id', memberUserId);

    if (delAdmin2Err && delAdmin2Err.message.includes('Cannot remove, demote, or suspend the last active administrator')) {
      console.log(`   ✅ Deleting last remaining admin was BLOCKED by trigger: "${delAdmin2Err.message}"`);
    } else {
      throw new Error(`Expected last-admin block, but got: ${JSON.stringify(delAdmin2Err)}`);
    }

    console.log('\n>>> ALL REAL AUTH & DISPOSABLE SMOKE TESTS PASSED! <<<');
  } finally {
    // -------------------------------------------------------------------------
    // Step 7: Reliable Teardown & Verification of Zero Dangling Data
    // -------------------------------------------------------------------------
    console.log('\n8. Performing strict test cleanup...');
    let cleanupErrors = [];

    if (disposableOrgId) {
      try {
        runPsql(`DELETE FROM public.organizations WHERE id = '${disposableOrgId}'`);
        const orgCheck = runPsql(`SELECT count(*) FROM public.organizations WHERE id = '${disposableOrgId}'`);
        if (orgCheck !== '0') cleanupErrors.push(`Failed to delete disposable org ${disposableOrgId}`);
      } catch (e) {
        cleanupErrors.push(`Error deleting org: ${e.message}`);
      }
    }

    if (adminUserId) {
      try {
        const { error } = await adminClient.auth.admin.deleteUser(adminUserId);
        if (error) cleanupErrors.push(`Failed to delete admin user: ${error.message}`);
      } catch (e) {
        cleanupErrors.push(`Error deleting admin user: ${e.message}`);
      }
    }

    if (memberUserId) {
      try {
        const { error } = await adminClient.auth.admin.deleteUser(memberUserId);
        if (error) cleanupErrors.push(`Failed to delete member user: ${error.message}`);
      } catch (e) {
        cleanupErrors.push(`Error deleting member user: ${e.message}`);
      }
    }

    if (cleanupErrors.length > 0) {
      console.error('❌ CLEANUP FAILED:', cleanupErrors);
      throw new Error(`Cleanup failed: ${cleanupErrors.join(', ')}`);
    } else {
      console.log('   ✅ All disposable test organizations, users, and memberships cleaned up cleanly.');
    }
  }
}

runRealAuthSmokeTest().catch(err => {
  console.error('\n❌ SMOKE TEST FAILED:', err);
  process.exit(1);
});
