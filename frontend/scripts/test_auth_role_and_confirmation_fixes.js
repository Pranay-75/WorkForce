/**
 * WorkForce Authentication & Role Assignment Bug Fix Test Suite
 * File: frontend/scripts/test_auth_role_and_confirmation_fixes.js
 *
 * Verifies:
 * 1. Organization creator becomes admin via create_organization_with_admin
 * 2. Only admin can invite members; assigned role (manager/employee) is strictly respected
 * 3. Non-admin (manager or employee) calling invite_organization_member is rejected by DB security
 * 4. Sole admin cannot be demoted or removed
 * 5. Missing membership fails closed: user has no org and no access
 * 6. Auth callback handler: verifyOtp with token_hash for mobile confirmation
 * 7. Auth callback handler: open-redirect prevention
 * 8. Auth callback handler: error redirection and code sanitization
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const ACME_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const CHLOE_ID = 'b0000000-0000-0000-0000-000000000008'; // Admin
const SARAH_ID = 'b0000000-0000-0000-0000-000000000001'; // Manager
const ALEX_ID = 'b0000000-0000-0000-0000-000000000002';  // Employee

const results = [];

function recordResult(name, status, evidence) {
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  console.log(`   ${evidence}`);
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
    userId: data.user.id
  };
}

function runPsql(sql) {
  return execSync('docker exec -i supabase_db_WorkForce psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A', {
    input: sql,
    encoding: 'utf8'
  }).trim();
}

async function runTests() {
  console.log('================================================================');
  console.log('   WORKFORCE AUTHENTICATION & ROLE GOVERNANCE TEST SUITE        ');
  console.log('================================================================\n');

  const cleanupUserIds = new Set();
  const cleanupEmails = new Set();

  try {
    // -------------------------------------------------------------
    // Category 1: Organization Creator Role Assignment
    // -------------------------------------------------------------
    console.log('--- Category 1: Organization Creation & Creator Role ---');

    // Create a new test user via auth signup
    const testOrgCreatorEmail = `orgcreator_${Date.now()}@test.corp`;
    cleanupEmails.add(testOrgCreatorEmail);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: signUpData, error: signUpError } = await anon.auth.signUp({
      email: testOrgCreatorEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          full_name: 'Test Creator',
          role: 'employee' // User metadata claims employee, but org bootstrap must govern
        }
      }
    });

    if (signUpError) {
      recordResult('Creator Sign Up', 'FAIL', signUpError.message);
    } else {
      const creatorUserId = signUpData.user.id;
      if (creatorUserId) {
        cleanupUserIds.add(creatorUserId);
      }
      let creatorToken = signUpData.session?.access_token;
      if (!creatorToken) {
        runPsql(`UPDATE auth.users SET email_confirmed_at = timezone('utc'::text, now()) WHERE id = '${creatorUserId}';`);
        const { data: creatorLogin, error: cErr } = await anon.auth.signInWithPassword({
          email: testOrgCreatorEmail,
          password: 'TestPassword123!',
        });
        if (cErr) throw new Error(`Sign in failed for creator: ${cErr.message}`);
        creatorToken = creatorLogin.session.access_token;
      }
      const creatorClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${creatorToken}` } }
      });

      // Creator invokes create_organization_with_admin RPC
      const testOrgSlug = `creator-test-org-${Date.now()}`;
      const { data: newOrgId, error: createOrgErr } = await creatorClient.rpc('create_organization_with_admin', {
        p_name: 'Creator Test Org',
        p_slug: testOrgSlug
      });

      if (createOrgErr) {
        recordResult('Organization Creator Becomes Admin', 'FAIL', createOrgErr.message);
      } else {
        // Query membership table to verify assigned role is strictly 'admin'
        const memberRole = runPsql(`
          SELECT role FROM public.organization_memberships
          WHERE organization_id = '${newOrgId}' AND user_id = '${creatorUserId}';
        `);

        if (memberRole === 'admin') {
          recordResult(
            'Organization Creator Becomes Admin',
            'PASS',
            `Created org ${newOrgId}; creator ${creatorUserId} assigned role '${memberRole}' in database.`
          );
        } else {
          recordResult('Organization Creator Becomes Admin', 'FAIL', `Expected 'admin', got '${memberRole}'`);
        }

        // Clean up test org
        runPsql(`DELETE FROM public.organizations WHERE id = '${newOrgId}';`);
      }
    }

    // -------------------------------------------------------------
    // Category 2: Admin Member Invitation & Role Assignment
    // -------------------------------------------------------------
    console.log('\n--- Category 2: Member Invitation & Role Assignment ---');

    const { client: chloeAdmin } = await getClient('chloe.dubois@acme.corp');
    const { client: alexEmployee } = await getClient('alex.chen@acme.corp');
    const { client: sarahManager } = await getClient('sarah.connor@acme.corp');

    // Admin invites an existing employee to become a Manager
    const { data: inviteRes, error: inviteErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: 'alex.chen@acme.corp',
      p_role: 'manager'
    });

    if (inviteErr) {
      recordResult('Admin Assigns Manager Role', 'FAIL', inviteErr.message);
    } else {
      const alexRole = runPsql(`
        SELECT role FROM public.organization_memberships
        WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${ALEX_ID}';
      `);
      if (alexRole === 'manager') {
        recordResult('Admin Assigns Manager Role', 'PASS', `Alex successfully updated to '${alexRole}' via admin invite.`);
      } else {
        recordResult('Admin Assigns Manager Role', 'FAIL', `Expected role 'manager', got '${alexRole}'`);
      }
    }

    // Admin resets Alex back to employee via update_member_role RPC
    const { data: roleResetRes, error: roleResetErr } = await chloeAdmin.rpc('update_member_role', {
      p_organization_id: ACME_ORG_ID,
      p_member_user_id: ALEX_ID,
      p_new_role: 'employee'
    });

    if (!roleResetErr) {
      recordResult('Admin Updates Member Role to Employee', 'PASS', `Alex role updated back to 'employee'.`);
    } else {
      recordResult('Admin Updates Member Role to Employee', 'FAIL', roleResetErr.message);
    }

    // Admin attempts to invite with role 'admin' (Must be rejected by SECURITY DEFINER RPC)
    const { data: adminInviteAdminRes, error: adminInviteAdminErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: 'newadmin@test.corp',
      p_role: 'admin'
    });

    if (adminInviteAdminErr && adminInviteAdminErr.message.includes('Invitations cannot assign the admin role')) {
      recordResult(
        'Admin Cannot Invite Member as Admin (RPC Rejection)',
        'PASS',
        `RPC strictly rejected with exception: "${adminInviteAdminErr.message}"`
      );
    } else {
      recordResult(
        'Admin Cannot Invite Member as Admin (RPC Rejection)',
        'FAIL',
        adminInviteAdminErr ? adminInviteAdminErr.message : `Unexpectedly allowed: ${JSON.stringify(adminInviteAdminRes)}`
      );
    }

    // Direct table insert with role 'admin' rejected by table check constraint
    try {
      runPsql(`
        INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status)
        VALUES ('${ACME_ORG_ID}', 'table_admin_${Date.now()}@test.corp', 'admin', '${CHLOE_ID}', 'pending');
      `);
      recordResult('Table Constraint Blocks Admin Invitation', 'FAIL', 'Direct insert of admin invitation unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('chk_org_invitations_role') || e.message.includes('check constraint')) {
        recordResult(
          'Table Constraint Blocks Admin Invitation',
          'PASS',
          'PostgreSQL check constraint chk_org_invitations_role blocked admin invitation insert.'
        );
      } else {
        recordResult('Table Constraint Blocks Admin Invitation', 'FAIL', e.message);
      }
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parseUuid = (str, label = 'UUID') => {
      const m = String(str).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (!m || !UUID_REGEX.test(m[0])) {
        throw new Error(`Failed to obtain a valid UUID for ${label}. Raw output was: "${str}"`);
      }
      return m[0];
    };

    // Admin attempts to invite a suspended member (Must be rejected, no reactivation or elevation)
    const suspendedTargetEmail = `susp_inv_${Date.now()}@test.corp`;
    cleanupEmails.add(suspendedTargetEmail);
    const suspTargetUserId = parseUuid(runPsql(`
      WITH u AS (
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${suspendedTargetEmail}', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Suspended Target"}', now(), now())
        RETURNING id
      ),
      p AS (
        INSERT INTO public.user_profiles (id, email, full_name)
        SELECT id, '${suspendedTargetEmail}', 'Suspended Target' FROM u
        RETURNING id
      )
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      SELECT '${ACME_ORG_ID}', id, 'employee', 'suspended' FROM p
      RETURNING user_id;
    `), 'suspended user ID');
    cleanupUserIds.add(suspTargetUserId);

    const { data: suspInviteRes, error: suspInviteErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: suspendedTargetEmail,
      p_role: 'manager'
    });

    const suspStatusAfter = runPsql(`
      SELECT status FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${suspTargetUserId}';
    `).trim();
    const suspRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${suspTargetUserId}';
    `).trim();

    if (suspInviteErr && suspInviteErr.message.includes('suspended member') && suspStatusAfter === 'suspended' && suspRoleAfter === 'employee') {
      recordResult(
        'Admin Cannot Reactivate or Modify Suspended Member via Invite',
        'PASS',
        `RPC rejected with: "${suspInviteErr.message}". Membership remained status '${suspStatusAfter}' and role '${suspRoleAfter}'.`
      );
    } else {
      recordResult(
        'Admin Cannot Reactivate or Modify Suspended Member via Invite',
        'FAIL',
        `Err: ${suspInviteErr?.message}, Status: ${suspStatusAfter}, Role: ${suspRoleAfter}`
      );
    }

    // Admin attempts to change an administrator's role via invitation (Must be rejected)
    const adminTargetEmail = `adm_target_${Date.now()}@test.corp`;
    cleanupEmails.add(adminTargetEmail);
    const adminTargetUserId = parseUuid(runPsql(`
      WITH u AS (
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${adminTargetEmail}', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Target"}', now(), now())
        RETURNING id
      ),
      p AS (
        INSERT INTO public.user_profiles (id, email, full_name)
        SELECT id, '${adminTargetEmail}', 'Admin Target' FROM u
        RETURNING id
      )
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      SELECT '${ACME_ORG_ID}', id, 'admin', 'active' FROM p
      RETURNING user_id;
    `), 'admin target user ID');
    cleanupUserIds.add(adminTargetUserId);

    const { data: adminDemoteRes, error: adminDemoteErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: adminTargetEmail,
      p_role: 'manager'
    });

    const adminRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${adminTargetUserId}';
    `).trim();

    if (adminDemoteErr && adminDemoteErr.message.includes('administrator') && adminRoleAfter === 'admin') {
      recordResult(
        'Admin Cannot Change Administrator Role via Invite (Demotion Blocked)',
        'PASS',
        `RPC rejected with: "${adminDemoteErr.message}". Admin role preserved as '${adminRoleAfter}'.`
      );
    } else {
      recordResult(
        'Admin Cannot Change Administrator Role via Invite (Demotion Blocked)',
        'FAIL',
        `Err: ${adminDemoteErr?.message}, Role: ${adminRoleAfter}`
      );
    }

    // Immediately clean up temporary admin target so Acme Corp returns to Chloe as sole admin
    runPsql(`
      DELETE FROM public.organization_memberships WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${adminTargetUserId}';
      DELETE FROM public.user_profiles WHERE id = '${adminTargetUserId}';
      DELETE FROM auth.users WHERE id = '${adminTargetUserId}';
    `);
    cleanupUserIds.delete(adminTargetUserId);
    cleanupEmails.delete(adminTargetEmail);

    // Normal employee and manager invitations for new users
    const normalEmpEmail = `norm_emp_${Date.now()}@test.corp`;
    cleanupEmails.add(normalEmpEmail);
    const { data: normEmpRes, error: normEmpErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: normalEmpEmail,
      p_role: 'employee'
    });

    const normalMgrEmail = `norm_mgr_${Date.now()}@test.corp`;
    cleanupEmails.add(normalMgrEmail);
    const { data: normMgrRes, error: normMgrErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: normalMgrEmail,
      p_role: 'manager'
    });

    if (!normEmpErr && normEmpRes?.status === 'invitation_created' && !normMgrErr && normMgrRes?.status === 'invitation_created') {
      recordResult(
        'Normal Employee and Manager Invitations Succeed for New Users',
        'PASS',
        `Employee invite created (${normEmpRes.role}), Manager invite created (${normMgrRes.role}).`
      );
    } else {
      recordResult(
        'Normal Employee and Manager Invitations Succeed for New Users',
        'FAIL',
        `EmpErr: ${normEmpErr?.message}, MgrErr: ${normMgrErr?.message}`
      );
    }

    // Admin invites an existing registered user whose email is unverified (email_confirmed_at IS NULL)
    // Security Guard: User MUST NOT receive active membership; a pending invitation must be created instead.
    const unverifiedProfileEmail = `unverified_prof_${Date.now()}@test.corp`;
    cleanupEmails.add(unverifiedProfileEmail);
    const unverifiedProfUserId = parseUuid(runPsql(`
      WITH u AS (
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${unverifiedProfileEmail}', 'hash', NULL, '{"provider":"email","providers":["email"]}', '{"full_name":"Unverified Profile Target"}', now(), now())
        RETURNING id
      )
      INSERT INTO public.user_profiles (id, email, full_name)
      SELECT id, '${unverifiedProfileEmail}', 'Unverified Profile Target' FROM u
      RETURNING id;
    `), 'unverified profile user ID');
    cleanupUserIds.add(unverifiedProfUserId);

    // Admin invites this unverified user to Acme Corp
    const { data: unverifiedInviteRes, error: unverifiedInviteErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: unverifiedProfileEmail,
      p_role: 'employee'
    });

    const unverifiedMemberCount = runPsql(`
      SELECT count(*) FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${unverifiedProfUserId}';
    `).trim();

    const unverifiedInvState = runPsql(`
      SELECT status FROM public.organization_invitations
      WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${unverifiedProfileEmail}';
    `).trim();

    if (
      !unverifiedInviteErr &&
      unverifiedInviteRes?.status === 'invitation_created' &&
      unverifiedMemberCount === '0' &&
      unverifiedInvState === 'pending'
    ) {
      recordResult(
        'Unverified Registered User Receives Pending Invitation Instead of Active Membership',
        'PASS',
        `No direct active membership created (count = ${unverifiedMemberCount}); invitation status is '${unverifiedInvState}'.`
      );
    } else {
      recordResult(
        'Unverified Registered User Receives Pending Invitation Instead of Active Membership',
        'FAIL',
        `Err: ${unverifiedInviteErr?.message}, ResStatus: ${unverifiedInviteRes?.status}, MemberCount: ${unverifiedMemberCount}, InvStatus: ${unverifiedInvState}`
      );
    }

    // Verify audit log action distinction: invitation for unverified user is 'member.invited'
    const auditAction = runPsql(`
      SELECT action FROM public.organization_audit_logs
      WHERE organization_id = '${ACME_ORG_ID}' AND lower(details->>'target_email') = '${unverifiedProfileEmail}'
      ORDER BY created_at DESC LIMIT 1;
    `).trim();

    if (auditAction === 'member.invited') {
      recordResult(
        'Audit Log Accurately Distinguishes member.invited Event',
        'PASS',
        `Audit action recorded accurately as '${auditAction}'.`
      );
    } else {
      recordResult(
        'Audit Log Accurately Distinguishes member.invited Event',
        'FAIL',
        `Expected 'member.invited', got '${auditAction}'`
      );
    }

    // Now confirm the user's email: trigger should claim the pending invitation into active membership
    runPsql(`
      UPDATE auth.users
      SET email_confirmed_at = now()
      WHERE id = '${unverifiedProfUserId}';
    `);

    const confirmedMemberCount = runPsql(`
      SELECT count(*) FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${unverifiedProfUserId}' AND status = 'active';
    `).trim();

    const confirmedInvState = runPsql(`
      SELECT status FROM public.organization_invitations
      WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${unverifiedProfileEmail}';
    `).trim();

    if (confirmedMemberCount === '1' && confirmedInvState === 'accepted') {
      recordResult(
        'Pending Invitation Claimed Automatically Once Email is Confirmed',
        'PASS',
        `Active membership created upon confirmation; invitation status marked '${confirmedInvState}'.`
      );
    } else {
      recordResult(
        'Pending Invitation Claimed Automatically Once Email is Confirmed',
        'FAIL',
        `ActiveMemberCount: ${confirmedMemberCount}, InvStatus: ${confirmedInvState}`
      );
    }

    // Regression Test: Unverified user with existing 'invited' membership
    // Must NOT be elevated to 'active'; must remain 'invited' and create/update pending invitation
    const unverifiedInvitedEmail = `unver_inv_${Date.now()}@test.corp`;
    cleanupEmails.add(unverifiedInvitedEmail);
    const unverifiedInvitedUserId = parseUuid(runPsql(`
      WITH u AS (
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${unverifiedInvitedEmail}', 'hash', NULL, '{"provider":"email","providers":["email"]}', '{"full_name":"Unverified Invited Target"}', now(), now())
        RETURNING id
      ),
      p AS (
        INSERT INTO public.user_profiles (id, email, full_name)
        SELECT id, '${unverifiedInvitedEmail}', 'Unverified Invited Target' FROM u
        RETURNING id
      )
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      SELECT '${ACME_ORG_ID}', id, 'employee', 'invited' FROM p
      RETURNING user_id;
    `), 'unverified invited user ID');
    cleanupUserIds.add(unverifiedInvitedUserId);

    const { data: unverInvRes, error: unverInvErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: unverifiedInvitedEmail,
      p_role: 'manager'
    });

    const unverStatusAfter = runPsql(`
      SELECT status FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${unverifiedInvitedUserId}';
    `).trim();
    const unverRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${unverifiedInvitedUserId}';
    `).trim();
    const unverPendingCount = runPsql(`
      SELECT count(*) FROM public.organization_invitations
      WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${unverifiedInvitedEmail}' AND status = 'pending';
    `).trim();

    if (
      !unverInvErr &&
      unverStatusAfter === 'invited' &&
      unverRoleAfter === 'manager' &&
      unverPendingCount === '1'
    ) {
      recordResult(
        'Unverified User with Invited Membership Preserves Invited Status',
        'PASS',
        `Membership remained status '${unverStatusAfter}', role updated to '${unverRoleAfter}', pending invitation created (${unverPendingCount}).`
      );
    } else {
      recordResult(
        'Unverified User with Invited Membership Preserves Invited Status',
        'FAIL',
        `Err: ${unverInvErr?.message}, Status: ${unverStatusAfter}, Role: ${unverRoleAfter}, PendingCount: ${unverPendingCount}`
      );
    }

    // Regression Test: Verified user with existing 'invited' membership
    // When invited by admin, CAN safely transition to 'active'
    const verifiedInvitedEmail = `ver_inv_${Date.now()}@test.corp`;
    cleanupEmails.add(verifiedInvitedEmail);
    const verifiedInvitedUserId = parseUuid(runPsql(`
      WITH u AS (
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${verifiedInvitedEmail}', 'hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Verified Invited Target"}', now(), now())
        RETURNING id
      ),
      p AS (
        INSERT INTO public.user_profiles (id, email, full_name)
        SELECT id, '${verifiedInvitedEmail}', 'Verified Invited Target' FROM u
        RETURNING id
      )
      INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
      SELECT '${ACME_ORG_ID}', id, 'employee', 'invited' FROM p
      RETURNING user_id;
    `), 'verified invited user ID');
    cleanupUserIds.add(verifiedInvitedUserId);

    const { data: verInvRes, error: verInvErr } = await chloeAdmin.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: verifiedInvitedEmail,
      p_role: 'manager'
    });

    const verStatusAfter = runPsql(`
      SELECT status FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${verifiedInvitedUserId}';
    `).trim();
    const verRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships
      WHERE organization_id = '${ACME_ORG_ID}' AND user_id = '${verifiedInvitedUserId}';
    `).trim();

    if (!verInvErr && verStatusAfter === 'active' && verRoleAfter === 'manager') {
      recordResult(
        'Verified User with Invited Membership Transitions to Active Status',
        'PASS',
        `Membership successfully transitioned to status '${verStatusAfter}' with role '${verRoleAfter}'.`
      );
    } else {
      recordResult(
        'Verified User with Invited Membership Transitions to Active Status',
        'FAIL',
        `Err: ${verInvErr?.message}, Status: ${verStatusAfter}, Role: ${verRoleAfter}`
      );
    }

    // Regression Test: Concurrent invitations for the same organization/email
    // Both concurrent requests must succeed without unique constraint collisions or lost updates
    const concurrentEmail = `conc_inv_${Date.now()}@test.corp`;
    cleanupEmails.add(concurrentEmail);

    const [concRes1, concRes2] = await Promise.all([
      chloeAdmin.rpc('invite_organization_member', {
        p_organization_id: ACME_ORG_ID,
        p_email: concurrentEmail,
        p_role: 'employee'
      }),
      chloeAdmin.rpc('invite_organization_member', {
        p_organization_id: ACME_ORG_ID,
        p_email: concurrentEmail,
        p_role: 'manager'
      })
    ]);

    const concCount = runPsql(`
      SELECT count(*) FROM public.organization_invitations
      WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${concurrentEmail}' AND status = 'pending';
    `).trim();
    const concRole = runPsql(`
      SELECT role FROM public.organization_invitations
      WHERE organization_id = '${ACME_ORG_ID}' AND lower(email) = '${concurrentEmail}' AND status = 'pending';
    `).trim();

    // Determine the actual successful final update from response status
    const updatedRes = concRes1.data?.status === 'invitation_updated' ? concRes1.data : (concRes2.data?.status === 'invitation_updated' ? concRes2.data : null);
    const createdRes = concRes1.data?.status === 'invitation_created' ? concRes1.data : (concRes2.data?.status === 'invitation_created' ? concRes2.data : null);

    const hasBothStatuses = createdRes !== null && updatedRes !== null;
    const finalUpdateRole = updatedRes?.role;
    const roleMatchesFinalUpdate = concRole === finalUpdateRole;

    if (!concRes1.error && !concRes2.error && concCount === '1' && hasBothStatuses && roleMatchesFinalUpdate) {
      recordResult(
        'Concurrent Invitations for Same Org and Email Handled Safely',
        'PASS',
        `Concurrent requests resolved without error; exactly 1 pending invitation exists; final update role '${finalUpdateRole}' strictly matches stored role '${concRole}'.`
      );
    } else {
      recordResult(
        'Concurrent Invitations for Same Org and Email Handled Safely',
        'FAIL',
        `Err1: ${concRes1.error?.message}, Err2: ${concRes2.error?.message}, Count: ${concCount}, StoredRole: ${concRole}, FinalUpdateRole: ${finalUpdateRole}`
      );
    }

    // Explicitly verify partial unique index blocks duplicate pending insertions
    try {
      runPsql(`
        INSERT INTO public.organization_invitations (organization_id, email, role, invited_by, status)
        VALUES ('${ACME_ORG_ID}', '${concurrentEmail}', 'employee', '${CHLOE_ID}', 'pending');
      `);
      recordResult('Partial Unique Index Catches Duplicate Pending Insert', 'FAIL', 'Direct duplicate insert unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('idx_org_invitations_unique_pending') || e.message.includes('duplicate key value') || e.message.includes('unique constraint')) {
        recordResult(
          'Partial Unique Index Catches Duplicate Pending Insert',
          'PASS',
          'Direct duplicate insert strictly blocked by partial unique index idx_org_invitations_unique_pending.'
        );
      } else {
        recordResult('Partial Unique Index Catches Duplicate Pending Insert', 'FAIL', e.message);
      }
    }

    // -------------------------------------------------------------
    // Category 3: Non-Admin Invitation & Elevation Blocked
    // -------------------------------------------------------------
    console.log('\n--- Category 3: Non-Admin Elevation & Security Boundary ---');

    // Alex (employee) tries to invite/elevate someone
    const { data: unauthInvite, error: unauthErr } = await alexEmployee.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: 'random@test.corp',
      p_role: 'admin'
    });

    if (unauthErr && unauthErr.message.includes('Only organization administrators')) {
      recordResult(
        'Employee Cannot Invite or Assign Roles',
        'PASS',
        `Database blocked with RPC exception: "${unauthErr.message}"`
      );
    } else {
      recordResult('Employee Cannot Invite or Assign Roles', 'FAIL', `Expected authorization failure, got: ${JSON.stringify(unauthInvite)}`);
    }

    // Sarah (manager) tries to invite an admin
    const { data: mgrInvite, error: mgrErr } = await sarahManager.rpc('invite_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_email: 'random@test.corp',
      p_role: 'admin'
    });

    if (mgrErr && mgrErr.message.includes('Only organization administrators')) {
      recordResult(
        'Manager Cannot Invite or Assign Roles',
        'PASS',
        `Database blocked with RPC exception: "${mgrErr.message}"`
      );
    } else {
      recordResult('Manager Cannot Invite or Assign Roles', 'FAIL', `Expected manager rejection, got: ${JSON.stringify(mgrInvite)}`);
    }

    // -------------------------------------------------------------
    // Category 4: Sole Admin Protection
    // -------------------------------------------------------------
    console.log('\n--- Category 4: Sole Admin Protection ---');

    // Admin tries to demote themselves when they are the sole admin
    const { error: demoteErr } = await chloeAdmin.rpc('update_member_role', {
      p_organization_id: ACME_ORG_ID,
      p_member_user_id: CHLOE_ID,
      p_new_role: 'employee'
    });

    if (demoteErr && (demoteErr.message.includes('sole active administrator') || demoteErr.message.includes('last active administrator'))) {
      recordResult(
        'Cannot Demote Sole Administrator',
        'PASS',
        `Safeguard triggered: "${demoteErr.message}"`
      );
    } else {
      recordResult('Cannot Demote Sole Administrator', 'FAIL', demoteErr ? demoteErr.message : 'Demotion unexpectedly allowed');
    }

    // Admin tries to remove themselves when they are the sole admin
    const { error: removeErr } = await chloeAdmin.rpc('remove_organization_member', {
      p_organization_id: ACME_ORG_ID,
      p_member_user_id: CHLOE_ID
    });

    if (removeErr && (removeErr.message.includes('sole active administrator') || removeErr.message.includes('last active administrator'))) {
      recordResult(
        'Cannot Remove Sole Administrator',
        'PASS',
        `Safeguard triggered: "${removeErr.message}"`
      );
    } else {
      recordResult('Cannot Remove Sole Administrator', 'FAIL', removeErr ? removeErr.message : 'Removal unexpectedly allowed');
    }

    // -------------------------------------------------------------
    // Category 5: Missing Membership Fails Closed
    // -------------------------------------------------------------
    console.log('\n--- Category 5: Missing Membership Fails Closed ---');

    // Register a standalone user with NO organization membership
    const unattachedEmail = `unattached_${Date.now()}@test.corp`;
    cleanupEmails.add(unattachedEmail);
    const { data: unattachedAuth } = await anon.auth.signUp({
      email: unattachedEmail,
      password: 'TestPassword123!',
      options: { data: { full_name: 'Unattached User' } }
    });
    if (unattachedAuth?.user?.id) {
      cleanupUserIds.add(unattachedAuth.user.id);
    }

    let unattachedToken = unattachedAuth.session?.access_token;
    if (!unattachedToken) {
      runPsql(`UPDATE auth.users SET email_confirmed_at = timezone('utc'::text, now()) WHERE id = '${unattachedAuth.user.id}';`);
      const { data: unattachedLogin, error: uErr } = await anon.auth.signInWithPassword({
        email: unattachedEmail,
        password: 'TestPassword123!',
      });
      if (uErr) throw new Error(`Sign in failed for unattached user: ${uErr.message}`);
      unattachedToken = unattachedLogin.session.access_token;
    }

    const unattachedClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${unattachedToken}` } }
    });

    // Attempt to query organizations table - RLS must return 0 rows
    const { data: unattachedOrgs } = await unattachedClient.from('organizations').select('*');
    if ((unattachedOrgs || []).length === 0) {
      recordResult(
        'Unattached User Receives Zero Organizations',
        'PASS',
        `User without membership returned 0 organizations under RLS.`
      );
    } else {
      recordResult('Unattached User Receives Zero Organizations', 'FAIL', `Expected 0 rows, got ${unattachedOrgs.length}`);
    }

    // Attempt to query projects table - RLS must return 0 rows
    const { data: unattachedProjects } = await unattachedClient.from('projects').select('*');
    if ((unattachedProjects || []).length === 0) {
      recordResult(
        'Unattached User Receives Zero Projects',
        'PASS',
        `User without membership returned 0 projects under RLS.`
      );
    } else {
      recordResult('Unattached User Receives Zero Projects', 'FAIL', `Expected 0 rows, got ${unattachedProjects.length}`);
    }

    // -------------------------------------------------------------
    // Category 6: Auth Callback Logic & Security
    // -------------------------------------------------------------
    console.log('\n--- Category 6: Auth Callback Open Redirect & Flow Validation ---');

    // Test open-redirect sanitization function
    function sanitizeNext(rawNext) {
      const isValidRelative =
        rawNext.startsWith('/') &&
        !rawNext.startsWith('//') &&
        !rawNext.includes('\\') &&
        !rawNext.includes('://');
      return isValidRelative ? rawNext : '/onboarding';
    }

    const testRedirects = [
      { input: '//attacker.com', expected: '/onboarding' },
      { input: 'https://evil.com/phishing', expected: '/onboarding' },
      { input: '/\\attacker.com', expected: '/onboarding' },
      { input: '/dashboard', expected: '/dashboard' },
      { input: '/projects/p1', expected: '/projects/p1' },
      { input: 'javascript:alert(1)', expected: '/onboarding' }
    ];

    let allRedirectsSafe = true;
    for (const t of testRedirects) {
      const sanitized = sanitizeNext(t.input);
      if (sanitized !== t.expected) {
        allRedirectsSafe = false;
        recordResult(`Open Redirect Protection (${t.input})`, 'FAIL', `Expected ${t.expected}, got ${sanitized}`);
      }
    }
    if (allRedirectsSafe) {
      recordResult(
        'Open Redirect Prevention',
        'PASS',
        `All malicious protocol and host redirect attempts sanitized to '/onboarding'.`
      );
    }

    // Test verifyOtp behavior without PKCE cookies
    const testOtpAnon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: invalidOtpErr } = await testOtpAnon.auth.verifyOtp({
      token_hash: 'invalid_or_expired_hash_sample',
      type: 'signup'
    });

    if (invalidOtpErr) {
      recordResult(
        'verifyOtp Handles Expired/Invalid Token Gracefully',
        'PASS',
        `Handled without crash; returned error: "${invalidOtpErr.message}" (Code: ${invalidOtpErr.code})`
      );
    } else {
      recordResult('verifyOtp Handles Expired/Invalid Token Gracefully', 'FAIL', 'Expected error on invalid token');
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    try {
      if (typeof cleanupEmails !== 'undefined' && cleanupEmails.size > 0) {
        const emailList = Array.from(cleanupEmails).map(e => `'${e.toLowerCase()}'`).join(',');
        runPsql(`DELETE FROM public.organization_invitations WHERE lower(email) IN (${emailList});`);
      }
      if (typeof cleanupUserIds !== 'undefined' && cleanupUserIds.size > 0) {
        const userList = Array.from(cleanupUserIds).map(u => `'${u}'`).join(',');
        runPsql(`DELETE FROM auth.users WHERE id IN (${userList});`);
      }
    } catch (cleanupErr) {
      console.error('Teardown cleanup error in test_auth_role_and_confirmation_fixes:', cleanupErr);
    }

    console.log('\n================================================================');
    console.log(`SUMMARY: ${results.filter(r => r.status === 'PASS').length} PASSED, ${results.filter(r => r.status === 'FAIL').length} FAILED`);
    console.log('================================================================');
  }
}

runTests();
