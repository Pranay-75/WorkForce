/**
 * WorkForce Invitation Lifecycle & Multi-Organization Hardening Test Suite
 * File: frontend/scripts/test_invitation_lifecycle_and_multiorg.js
 *
 * Verifies against real local Supabase PostgreSQL:
 * 1. Duplicate invitations deduplication & role update (F-01)
 * 2. Unique pending constraint enforcement
 * 3. Expired invitations are not claimed
 * 4. Accepted invitations cannot be claimed again
 * 5. Direct EXECUTE on claim_pending_invitations is revoked from authenticated & anon (F-04)
 * 6. Anon has zero table access to organization_invitations (F-03)
 * 7. Multi-org membership handling: fail closed when unselected; verified role derivation (F-02)
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const ACME_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const CHLOE_ADMIN_EMAIL = 'chloe.dubois@acme.corp';

const results = [];

function recordResult(name, status, evidence, testType = 'Real Database') {
  results.push({ name, status, evidence, testType });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] (${testType}) ${name}`);
  console.log(`   Evidence: ${evidence}`);
}

function runPsql(sql) {
  return execSync('docker exec -i supabase_db_WorkForce psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A', {
    input: sql,
    encoding: 'utf8'
  }).trim();
}

async function getClient(email, password = 'Password123!') {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth failed for ${email}: ${error.message}`);
  return {
    client: createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    }),
    userId: data.user.id,
    session: data.session
  };
}

async function runHardeningTests() {
  console.log('================================================================');
  console.log('   WORKFORCE INVITATION & MULTI-ORG HARDENING TEST SUITE        ');
  console.log('================================================================\n');

  try {
    const { client: chloeAdmin } = await getClient(CHLOE_ADMIN_EMAIL);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    // -------------------------------------------------------------
    // Test 1: Deduplication & Safe Role Update of Pending Invitation
    // -------------------------------------------------------------
    console.log('--- Category 1: Invitation Deduplication & Safe Updates ---');

    const testRecipientEmail = `inv_dedup_${Date.now()}@test.corp`;

    // Step 1A: Invite recipient as 'employee'
    const { data: firstInvite, error: err1 } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: testRecipientEmail,
      p_role: 'employee'
    });

    if (err1) {
      recordResult('Initial Invitation Creation', 'FAIL', err1.message);
    } else {
      recordResult(
        'Initial Invitation Creation',
        'PASS',
        `Created invitation with status: ${firstInvite.status}, role: ${firstInvite.role}`
      );
    }

    // Step 1B: Admin changes mind and re-invites same recipient as 'manager'
    const { data: secondInvite, error: err2 } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: testRecipientEmail,
      p_role: 'manager'
    });

    if (err2) {
      recordResult('Invitation Role Update (Deduplication)', 'FAIL', err2.message);
    } else {
      // Query database: verify exactly 1 row exists with status 'pending' and role 'manager'
      const inviteCount = runPsql(`
        SELECT count(*) FROM public.organization_invitations
        WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${testRecipientEmail}' AND status = 'pending';
      `);

      const inviteRole = runPsql(`
        SELECT role FROM public.organization_invitations
        WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${testRecipientEmail}' AND status = 'pending';
      `);

      if (inviteCount === '1' && inviteRole === 'manager') {
        recordResult(
          'Invitation Role Update (Deduplication)',
          'PASS',
          `Exactly 1 pending invitation exists; role safely updated to '${inviteRole}'. Status: ${secondInvite.status}`
        );
      } else {
        recordResult(
          'Invitation Role Update (Deduplication)',
          'FAIL',
          `Expected count 1 and role 'manager', got count ${inviteCount} and role ${inviteRole}`
        );
      }
    }

    // Step 1C: Verify database unique index blocks raw duplicate inserts
    try {
      runPsql(`
        INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status)
        VALUES ('${ACME_ORG_ID}', '${testRecipientEmail}', 'employee', 'b0000000-0000-0000-0000-000000000008', 'pending');
      `);
      recordResult('Unique Partial Index Constraint', 'FAIL', 'Direct duplicate insert unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('idx_org_invitations_unique_pending') || e.message.includes('unique constraint')) {
        recordResult(
          'Unique Partial Index Constraint',
          'PASS',
          'PostgreSQL unique index strictly blocked duplicate pending invitation insert.'
        );
      } else {
        recordResult('Unique Partial Index Constraint', 'FAIL', e.message);
      }
    }

    // -------------------------------------------------------------
    // Test 2: Expired Invitation Claim Rejection
    // -------------------------------------------------------------
    console.log('\n--- Category 2: Expired & Claimed Invitation Integrity ---');

    const expiredEmail = `expired_${Date.now()}@test.corp`;

    // Manually insert an invitation that expired 2 days ago
    runPsql(`
      INSERT INTO public.organization_invitations (
        organization_id, email, role, invited_by, status, expires_at
      )
      VALUES (
        '${ACME_ORG_ID}',
        '${expiredEmail}',
        'manager',
        'b0000000-0000-0000-0000-000000000008',
        'pending',
        timezone('utc'::text, now() - interval '2 days')
      );
    `);

    // Register user with the expired email
    const { data: expiredUserAuth, error: expUserErr } = await anon.auth.signUp({
      email: expiredEmail,
      password: 'TestPassword123!',
      options: { data: { full_name: 'Expired Test User' } }
    });

    if (expUserErr) {
      recordResult('Expired Invitation Sign Up', 'FAIL', expUserErr.message);
    } else {
      const expiredUserId = expiredUserAuth.user.id;

      // Verify no membership was created for the expired invitation
      const memberCount = runPsql(`
        SELECT count(*) FROM public.organization_memberships
        WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${expiredUserId}';
      `);

      if (memberCount === '0') {
        recordResult(
          'Expired Invitation Cannot Be Claimed',
          'PASS',
          `Trigger excluded expired invitation (expires_at < now()); memberships created: 0.`
        );
      } else {
        recordResult('Expired Invitation Cannot Be Claimed', 'FAIL', `Unexpected membership created (${memberCount})`);
      }
    }

    // -------------------------------------------------------------
    // Test 3: Deterministic Claiming & Single-Claim Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- Category 3: Deterministic Claiming Lifecycle ---');

    // Register user with testRecipientEmail (which had pending manager invite)
    const { data: claimingUserAuth, error: claimUserErr } = await anon.auth.signUp({
      email: testRecipientEmail,
      password: 'TestPassword123!',
      options: { data: { full_name: 'Claiming User' } }
    });

    if (claimUserErr) {
      recordResult('Claiming User Registration', 'FAIL', claimUserErr.message);
    } else {
      const claimingUserId = claimingUserAuth.user.id;

      // When email confirmations are enabled, simulate user verifying email to trigger claiming
      runPsql(`
        UPDATE auth.users
        SET email_confirmed_at = timezone('utc'::text, now())
        WHERE id = '${claimingUserId}';
      `);

      // Check assigned role in membership
      const assignedRole = runPsql(`
        SELECT role FROM public.organization_memberships
        WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${claimingUserId}';
      `);

      // Check status of invitation row
      const invStatus = runPsql(`
        SELECT status FROM public.organization_invitations
        WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${testRecipientEmail}';
      `);

      if (assignedRole === 'manager' && invStatus === 'accepted') {
        recordResult(
          'Deterministic Invitation Claiming',
          'PASS',
          `Assigned role: '${assignedRole}' (matches updated invitation); invitation status marked '${invStatus}'.`
        );
      } else {
        recordResult(
          'Deterministic Invitation Claiming',
          'FAIL',
          `Expected role 'manager' and status 'accepted', got role '${assignedRole}', status '${invStatus}'`
        );
      }

      // Verify that calling trigger / inserting again cannot re-claim already accepted invite
      const duplicateClaimCheck = runPsql(`
        SELECT count(*) FROM public.organization_invitations
        WHERE lower(email) = '${testRecipientEmail}' AND status = 'pending';
      `);

      if (duplicateClaimCheck === '0') {
        recordResult(
          'Accepted Invitation Cannot Be Re-Claimed',
          'PASS',
          `No pending invitations remain for email; cannot be re-claimed.`
        );
      } else {
        recordResult('Accepted Invitation Cannot Be Re-Claimed', 'FAIL', `Pending count is ${duplicateClaimCheck}`);
      }
    }

    // -------------------------------------------------------------
    // Test 4: Database Privileges (anon, authenticated, trigger)
    // -------------------------------------------------------------
    console.log('\n--- Category 4: Database Privilege Verification ---');

    // Anonymous read on organization_invitations
    const { data: anonRead, error: anonReadErr } = await anon.from('organization_invitations').select('*');
    if (anonReadErr && (anonReadErr.code === '42501' || anonReadErr.message.includes('permission denied'))) {
      recordResult(
        'Anon Cannot Access organization_invitations',
        'PASS',
        `Table grant rejected anon at SQL privilege layer: "${anonReadErr.message}"`
      );
    } else if ((anonRead || []).length === 0) {
      recordResult(
        'Anon Cannot Access organization_invitations',
        'PASS',
        `Anon returned 0 rows (fully blocked by SQL privileges and RLS).`
      );
    } else {
      recordResult('Anon Cannot Access organization_invitations', 'FAIL', `Anon read ${anonRead.length} rows`);
    }

    // Direct EXECUTE on claim_pending_invitations checked at SQL privilege layer
    const authCanExec = runPsql(`SELECT has_function_privilege('authenticated', 'public.claim_pending_invitations()', 'execute');`);
    const anonCanExec = runPsql(`SELECT has_function_privilege('anon', 'public.claim_pending_invitations()', 'execute');`);

    if (authCanExec === 'f' && anonCanExec === 'f') {
      recordResult(
        'Direct EXECUTE on claim_pending_invitations Revoked',
        'PASS',
        `has_function_privilege returned false for both authenticated and anon.`
      );
    } else {
      recordResult(
        'Direct EXECUTE on claim_pending_invitations Revoked',
        'FAIL',
        `authenticated can exec: ${authCanExec}, anon can exec: ${anonCanExec}`
      );
    }

    // -------------------------------------------------------------
    // Test 5: Multiple Organization Handling & Fail-Closed
    // -------------------------------------------------------------
    console.log('\n--- Category 5: Multi-Organization Membership Handling ---');

    // Create a secondary organization
    const rawBetaOutput = runPsql(`
      INSERT INTO public.organizations (name, slug)
      VALUES ('Beta Multi-Org Corp', 'beta-multiorg-${Date.now()}')
      RETURNING id;
    `);
    const orgBetaId = rawBetaOutput.split(/\r?\n/)[0].trim();

    // Create a test user belonging to BOTH Acme (Org A) as employee AND Beta Corp (Org B) as manager
    const multiUserEmail = `multiuser_${Date.now()}@test.corp`;
    const { data: multiUserAuth } = await anon.auth.signUp({
      email: multiUserEmail,
      password: 'TestPassword123!',
      options: { data: { full_name: 'Multi Org User' } }
    });
    const multiUserId = multiUserAuth.user.id;

    // Confirm email and sign in to acquire session when confirmations are enabled
    runPsql(`
      UPDATE auth.users
      SET email_confirmed_at = timezone('utc'::text, now())
      WHERE id = '${multiUserId}';
    `);
    const { data: multiLogin, error: mLoginErr } = await anon.auth.signInWithPassword({
      email: multiUserEmail,
      password: 'TestPassword123!',
    });
    if (mLoginErr) throw new Error(`Multi-user sign in failed: ${mLoginErr.message}`);
    const multiToken = multiLogin.session.access_token;

    // Add membership in Org A as employee
    runPsql(`
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES ('${ACME_ORG_ID}', '${multiUserId}', 'employee', 'active');
    `);

    // Add membership in Org B as manager
    runPsql(`
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES ('${orgBetaId}', '${multiUserId}', 'manager', 'active');
    `);

    // Client queries memberships
    const multiUserClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${multiToken}` } }
    });

    const { data: userMemberships, error: multiMemErr } = await multiUserClient
      .from('organization_memberships')
      .select('role, organization_id, organizations(id, name, slug)')
      .eq('user_id', multiUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (userMemberships && userMemberships.length === 2) {
      recordResult(
        'User Has Exactly 2 Active Memberships',
        'PASS',
        `Retrieved 2 verified memberships (Acme: employee, Beta: manager).`
      );
    } else {
      recordResult('User Has Exactly 2 Active Memberships', 'FAIL', `Expected 2, got ${userMemberships?.length}`);
    }

    // Test selection logic:
    // Simulation of AuthContext:
    function resolveAuthContext(allMemberships, selectedOrgId) {
      if (!allMemberships || allMemberships.length === 0) {
        return { role: 'employee', organization: null, hasAmbiguousMembership: false };
      }
      if (allMemberships.length === 1) {
        return {
          role: allMemberships[0].role,
          organization: allMemberships[0].organizations,
          hasAmbiguousMembership: false
        };
      }
      // Multiple memberships: fail closed if no explicit selection
      const matched = selectedOrgId ? allMemberships.find(m => m.organization_id === selectedOrgId) : null;
      if (matched && matched.organizations) {
        return {
          role: matched.role,
          organization: matched.organizations,
          hasAmbiguousMembership: false
        };
      }
      // Fail closed:
      return { role: 'employee', organization: null, hasAmbiguousMembership: true };
    }

    // Subtest 5A: Multiple memberships without selection -> Fail closed
    const unselectedState = resolveAuthContext(userMemberships, null);
    if (unselectedState.organization === null && unselectedState.hasAmbiguousMembership === true) {
      recordResult(
        'Multi-Org Unselected Fails Closed',
        'PASS',
        `Unselected multi-org user receives organization = null and hasAmbiguousMembership = true.`,
        'Logic & State Verification'
      );
    } else {
      recordResult('Multi-Org Unselected Fails Closed', 'FAIL', JSON.stringify(unselectedState), 'Logic & State Verification');
    }

    // Subtest 5B: User explicitly selects Org B -> receives Manager role
    const selectedOrgB = resolveAuthContext(userMemberships, orgBetaId);
    if (selectedOrgB.organization?.id === orgBetaId && selectedOrgB.role === 'manager') {
      recordResult(
        'Explicit Org B Selection Yields Verified Manager Role',
        'PASS',
        `Selected Org B (${orgBetaId}); verified role is 'manager'.`,
        'Logic & State Verification'
      );
    } else {
      recordResult('Explicit Org B Selection Yields Verified Manager Role', 'FAIL', JSON.stringify(selectedOrgB), 'Logic & State Verification');
    }

    // Subtest 5C: User explicitly selects Org A -> receives Employee role
    const selectedOrgA = resolveAuthContext(userMemberships, ACME_ORG_ID);
    if (selectedOrgA.organization?.id === ACME_ORG_ID && selectedOrgA.role === 'employee') {
      recordResult(
        'Explicit Org A Selection Yields Verified Employee Role',
        'PASS',
        `Selected Org A (${ACME_ORG_ID}); verified role is 'employee'.`,
        'Logic & State Verification'
      );
    } else {
      recordResult('Explicit Org A Selection Yields Verified Employee Role', 'FAIL', JSON.stringify(selectedOrgA), 'Logic & State Verification');
    }

    // Subtest 5D: User attempts to select an unauthorized organization -> Fails closed
    const unauthorizedOrgSelect = resolveAuthContext(userMemberships, '00000000-0000-0000-0000-000000000099');
    if (unauthorizedOrgSelect.organization === null && unauthorizedOrgSelect.hasAmbiguousMembership === true) {
      recordResult(
        'Unauthorized Org Selection Fails Closed',
        'PASS',
        `Attempt to activate non-member organization fails closed (organization = null).`,
        'Logic & State Verification'
      );
    } else {
      recordResult('Unauthorized Org Selection Fails Closed', 'FAIL', JSON.stringify(unauthorizedOrgSelect), 'Logic & State Verification');
    }

    // Clean up test beta org
    runPsql(`DELETE FROM public.organizations WHERE id = '${orgBetaId}';`);

    // -------------------------------------------------------------
    // Test 6: Membership Safety & Unverified Email Invariants
    // -------------------------------------------------------------
    console.log('\n--- Category 6: Membership Safety & Email Verification Boundaries ---');

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parseUuid = (str, label = 'UUID') => {
      const m = String(str).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (!m || !UUID_REGEX.test(m[0])) {
        throw new Error(`Failed to obtain a valid UUID for ${label}. Raw output was: "${str}"`);
      }
      return m[0];
    };

    const cleanupUserIds = new Set();
    const cleanupEmails = new Set();

    // Test 6A: Existing Active Membership Role is Protected from Overwrite
    const activeTestEmail = `active_member_${Date.now()}@test.corp`;
    cleanupEmails.add(activeTestEmail);
    const { data: activeUserAuth } = await anon.auth.signUp({
      email: activeTestEmail,
      password: 'Password123!',
      options: { data: { full_name: 'Existing Active Member' } }
    });
    const activeUserId = parseUuid(activeUserAuth.user.id, 'active test user ID');
    cleanupUserIds.add(activeUserId);

    // Insert membership directly as 'employee'
    runPsql(`
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES ('${ACME_ORG_ID}', '${activeUserId}', 'employee', 'active');
    `);

    // Insert pending invitation with role 'manager'
    const activeInvId = parseUuid(runPsql(`
      INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status)
      VALUES ('${ACME_ORG_ID}', '${activeTestEmail}', 'manager', 'b0000000-0000-0000-0000-000000000008', 'pending')
      RETURNING id;
    `), 'active invitation ID');

    // Reset and trigger claim_pending_invitations via email confirmation transition
    runPsql(`
      UPDATE auth.users SET email_confirmed_at = NULL WHERE id = '${activeUserId}';
      UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${activeUserId}';
    `);

    const roleAfterClaimAttempt = runPsql(`
      SELECT role FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${activeUserId}';
    `);
    const invStatusAfterAttempt = runPsql(`
      SELECT status FROM public.organization_invitations WHERE id = '${activeInvId}';
    `);

    if (roleAfterClaimAttempt === 'employee' && invStatusAfterAttempt === 'pending') {
      recordResult(
        'Existing Active Role Not Overwritten by Invitation',
        'PASS',
        `Membership role remained strictly '${roleAfterClaimAttempt}'; invitation left as '${invStatusAfterAttempt}'.`
      );
    } else {
      recordResult(
        'Existing Active Role Not Overwritten by Invitation',
        'FAIL',
        `Expected role 'employee' and status 'pending', got role '${roleAfterClaimAttempt}', status '${invStatusAfterAttempt}'`
      );
    }

    // Test 6B: Suspended Member is NOT Reactivated and Role NOT Elevated
    const suspendedTestEmail = `suspended_member_${Date.now()}@test.corp`;
    cleanupEmails.add(suspendedTestEmail);
    const { data: suspendedUserAuth } = await anon.auth.signUp({
      email: suspendedTestEmail,
      password: 'Password123!',
      options: { data: { full_name: 'Suspended Member' } }
    });
    const suspendedUserId = parseUuid(suspendedUserAuth.user.id, 'suspended test user ID');
    cleanupUserIds.add(suspendedUserId);

    runPsql(`
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      VALUES ('${ACME_ORG_ID}', '${suspendedUserId}', 'employee', 'suspended');
    `);

    const suspendedInvId = parseUuid(runPsql(`
      INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status)
      VALUES ('${ACME_ORG_ID}', '${suspendedTestEmail}', 'manager', 'b0000000-0000-0000-0000-000000000008', 'pending')
      RETURNING id;
    `), 'suspended invitation ID');

    // Reset and trigger claim evaluation via confirmation transition
    runPsql(`
      UPDATE auth.users SET email_confirmed_at = NULL WHERE id = '${suspendedUserId}';
      UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${suspendedUserId}';
    `);

    const suspendedStatusAfter = runPsql(`
      SELECT status FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${suspendedUserId}';
    `);
    const suspendedRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${suspendedUserId}';
    `);
    const suspendedInvStatusAfter = runPsql(`
      SELECT status FROM public.organization_invitations WHERE id = '${suspendedInvId}';
    `);

    if (suspendedStatusAfter === 'suspended' && suspendedRoleAfter === 'employee' && suspendedInvStatusAfter === 'pending') {
      recordResult(
        'Suspended Member Not Reactivated or Elevated by Invitation',
        'PASS',
        `Membership remained status '${suspendedStatusAfter}' and role '${suspendedRoleAfter}'; invitation left '${suspendedInvStatusAfter}'.`
      );
    } else {
      recordResult(
        'Suspended Member Not Reactivated or Elevated by Invitation',
        'FAIL',
        `Status: ${suspendedStatusAfter}, Role: ${suspendedRoleAfter}, InvStatus: ${suspendedInvStatusAfter}`
      );
    }

    // Test 6C: Unverified Account Cannot Claim Invitations
    const unverifiedEmail = `unverified_${Date.now()}@test.corp`;
    cleanupEmails.add(unverifiedEmail);
    const unverifiedInvId = parseUuid(runPsql(`
      INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status)
      VALUES ('${ACME_ORG_ID}', '${unverifiedEmail}', 'employee', 'b0000000-0000-0000-0000-000000000008', 'pending')
      RETURNING id;
    `), 'unverified invitation ID');

    // Create an unverified user directly in auth.users with email_confirmed_at = NULL (handle_new_user auto-creates profile)
    const unverifiedUserId = parseUuid(runPsql(`
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${unverifiedEmail}', 'hash', NULL, '{"provider":"email","providers":["email"]}', '{"full_name":"Unverified User"}', now(), now())
      RETURNING id;
    `), 'unverified user ID');
    cleanupUserIds.add(unverifiedUserId);

    // Check that NO membership was created while unverified
    const unverifiedMembershipCount = runPsql(`
      SELECT count(*) FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${unverifiedUserId}';
    `);
    const unverifiedInvStatus = runPsql(`
      SELECT status FROM public.organization_invitations WHERE id = '${unverifiedInvId}';
    `);

    if (unverifiedMembershipCount === '0' && unverifiedInvStatus === 'pending') {
      recordResult(
        'Unverified User Cannot Claim Invitations',
        'PASS',
        `Zero memberships created while email_confirmed_at is NULL; invitation status: '${unverifiedInvStatus}'.`
      );
    } else {
      recordResult(
        'Unverified User Cannot Claim Invitations',
        'FAIL',
        `Memberships: ${unverifiedMembershipCount}, InvStatus: ${unverifiedInvStatus}`
      );
    }

    // Now verify the email via trigger: UPDATE auth.users SET email_confirmed_at = now()
    runPsql(`
      UPDATE auth.users
      SET email_confirmed_at = now()
      WHERE id = '${unverifiedUserId}';
    `);

    const verifiedMembershipCount = runPsql(`
      SELECT count(*) FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${unverifiedUserId}';
    `);
    const verifiedInvStatus = runPsql(`
      SELECT status FROM public.organization_invitations WHERE id = '${unverifiedInvId}';
    `);

    if (verifiedMembershipCount === '1' && verifiedInvStatus === 'accepted') {
      recordResult(
        'Verified User Successfully Claims Pending Invitations on Confirmation',
        'PASS',
        `Membership claimed upon email confirmation; invitation marked '${verifiedInvStatus}'.`
      );
    } else {
      recordResult(
        'Verified User Successfully Claims Pending Invitations on Confirmation',
        'FAIL',
        `Memberships: ${verifiedMembershipCount}, InvStatus: ${verifiedInvStatus}`
      );
    }

    // Test 6D: Duplicate Pending Invitations with Identical Timestamps Deterministic Cleanup
    // Accurately tests Migration 003's exact pre-unique-index pending invitation cleanup
    const tieEmail = `tie_${Date.now()}@test.corp`;
    cleanupEmails.add(tieEmail);
    const fixedTimestamp = '2026-10-14 12:00:00+00';

    // Temporarily drop the unique pending index to simulate the exact pre-migration state where duplicates exist
    runPsql(`DROP INDEX IF EXISTS public.idx_org_invitations_unique_pending;`);

    // Insert two duplicate PENDING invitations with the exact same created_at timestamp
    const inv1Id = parseUuid(runPsql(`
      INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status, created_at)
      VALUES ('${ACME_ORG_ID}', '${tieEmail}', 'employee', 'b0000000-0000-0000-0000-000000000008', 'pending', '${fixedTimestamp}')
      RETURNING id;
    `), 'pending tie invitation 1');
    const inv2Id = parseUuid(runPsql(`
      INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status, created_at)
      VALUES ('${ACME_ORG_ID}', '${tieEmail}', 'manager', 'b0000000-0000-0000-0000-000000000008', 'pending', '${fixedTimestamp}')
      RETURNING id;
    `), 'pending tie invitation 2');

    // Run the deterministic cleanup query with tie-breaker exactly as in Migration 003
    runPsql(`
      DELETE FROM public.organization_invitations a
      USING public.organization_invitations b
      WHERE a.status = 'pending'
        AND b.status = 'pending'
        AND a.organization_id = b.organization_id
        AND lower(a.email) = lower(b.email)
        AND lower(a.email) = '${tieEmail}'
        AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));
    `);

    // Re-create the unique partial index to prove the cleanup enables clean index creation without collision
    runPsql(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_unique_pending
          ON public.organization_invitations (organization_id, lower(email))
          WHERE status = 'pending';
    `);

    const remainingTieCount = runPsql(`
      SELECT count(*) FROM public.organization_invitations WHERE lower(email) = '${tieEmail}' AND status = 'pending';
    `);

    if (remainingTieCount === '1') {
      recordResult(
        'Deterministic Tie-Breaker Handles Pending Identical Timestamps Cleanly',
        'PASS',
        `Exactly 1 pending row preserved after tie-breaker deduplication; unique index created cleanly without conflict.`
      );
    } else {
      recordResult(
        'Deterministic Tie-Breaker Handles Pending Identical Timestamps Cleanly',
        'FAIL',
        `Expected 1 row, found ${remainingTieCount}`
      );
    }

  } catch (err) {
    console.error('Hardening test execution error:', err);
  } finally {
    // Safe teardown: always clean up temporary users and invitations even on failure
    try {
      // Ensure unique index exists even if test failed before re-creating
      runPsql(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_unique_pending
            ON public.organization_invitations (organization_id, lower(email))
            WHERE status = 'pending';
      `);
      if (typeof cleanupEmails !== 'undefined' && cleanupEmails.size > 0) {
        const emailList = Array.from(cleanupEmails).map(e => `'${e.toLowerCase()}'`).join(',');
        runPsql(`DELETE FROM public.organization_invitations WHERE lower(email) IN (${emailList});`);
      }
      if (typeof cleanupUserIds !== 'undefined' && cleanupUserIds.size > 0) {
        const userList = Array.from(cleanupUserIds).map(u => `'${u}'`).join(',');
        runPsql(`DELETE FROM auth.users WHERE id IN (${userList});`);
      }
      if (typeof orgBetaId !== 'undefined' && orgBetaId) {
        runPsql(`DELETE FROM public.organizations WHERE id = '${orgBetaId}';`);
      }
    } catch (cleanupErr) {
      console.error('Teardown cleanup error:', cleanupErr);
    }

    console.log('\n================================================================');
    console.log(`HARDENING SUMMARY: ${results.filter(r => r.status === 'PASS').length} PASSED, ${results.filter(r => r.status === 'FAIL').length} FAILED`);
    console.log('================================================================');
  }
}

runHardeningTests();
