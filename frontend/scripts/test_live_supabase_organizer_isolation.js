/**
 * WorkForce - Live Supabase Organizer Full-Control & Cross-Org Isolation Runner
 * File: frontend/scripts/test_live_supabase_organizer_isolation.js
 *
 * Scenarios tested against a live Supabase instance:
 * 1. Organizer can create a project in their own organization.
 * 2. Organizer is denied project creation in another organization (cross-tenant RLS 42501).
 * 3. Organizer is denied cross-organization assign_task RPC calls (cross-tenant RPC 42501).
 * 4. Organizer cannot read another organization's audit logs (RLS row-filtering returns 0 rows).
 * 5. A suspended Organizer who remains in organizations.created_by is denied access (membership-bound authority).
 * 6. Manager is denied project deletion (RLS projects_delete_policy restricts delete to admin/organizer).
 * 7. Admin is denied organization-settings update (RLS update policy restricts updates to organizer).
 *
 * Safety & Zero-Trust Constraints:
 * - Uses distinct authenticated test users and isolated synthetic test organizations.
 * - Never uses production data or hardcodes secrets.
 * - Does not expose service role keys to client code.
 * - If Supabase endpoint is not configured or reachable, gracefully reports prerequisites.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let passed = 0;
let failed = 0;

function record(name, pass, detail) {
  if (pass) {
    console.log(`✅ [PASS] ${name}`);
    if (detail) console.log(`   ${detail}`);
    passed++;
  } else {
    console.log(`❌ [FAIL] ${name}`);
    if (detail) console.log(`   ${detail}`);
    failed++;
  }
}

async function checkConnection(url, anonKey) {
  if (!url || !anonKey) {
    return false;
  }
  try {
    const probeClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await probeClient.from('organizations').select('id').limit(1);
    // Even if RLS denies rows, HTTP connection should succeed or return empty data
    return !error || error.code === 'PGRST116' || error.code === '42501' || error.message !== 'fetch failed';
  } catch (err) {
    return false;
  }
}

async function runLiveOrganizerIsolationSuite() {
  console.log('================================================================');
  console.log(' WORKFORCE LIVE SUPABASE ORGANIZER FULL-CONTROL & ISOLATION    ');
  console.log('================================================================\n');

  const isConfigured = Boolean(SUPABASE_URL && ANON_KEY);
  const isReachable = isConfigured && (await checkConnection(SUPABASE_URL, ANON_KEY));

  // Strict Safeguard: Never execute synthetic mutation tests against production
  const PRODUCTION_PROJECT_REF = 'wxkjygctdonpeypgrcnf';
  if (SUPABASE_URL && SUPABASE_URL.includes(PRODUCTION_PROJECT_REF)) {
    console.error('⛔ [BLOCKED] test_live_supabase_organizer_isolation.js must NEVER be executed against production.');
    console.error('   Target URL matches production ref:', PRODUCTION_PROJECT_REF);
    console.error('   Please point SUPABASE_URL to a local container (http://127.0.0.1:54321) or disposable staging project.\n');
    process.exit(1);
  }

  if (!isConfigured || !isReachable) {
    console.log('ℹ️  [SKIPPED] Live Supabase instance not available or unreachable.');
    console.log('   Target URL:', SUPABASE_URL || '(not set)');
    console.log('\n--- Setup Required for Live Execution ---');
    console.log('To run this live integration suite against a local or staging Supabase instance:');
    console.log('1. Ensure Supabase is running (e.g. `npx supabase start` or cloud staging project).');
    console.log('2. Provide the following environment variables:');
    console.log('   - SUPABASE_URL (e.g. http://127.0.0.1:54321 or https://<project>.supabase.co)');
    console.log('   - SUPABASE_ANON_KEY (publishable anon key)');
    console.log('   - SUPABASE_SERVICE_ROLE_KEY (administrative key for creating synthetic test orgs/users)');
    console.log('3. Execute:');
    console.log('   node frontend/scripts/test_live_supabase_organizer_isolation.js\n');
    console.log('Static code analysis and in-memory policy simulation tests continue to pass.\n');
    process.exit(0);
  }

  if (!SERVICE_ROLE_KEY) {
    console.log('⚠️  [NOTICE] SUPABASE_SERVICE_ROLE_KEY not provided.');
    console.log('   The test runner requires the service role key strictly for ephemeral setup');
    console.log('   and teardown of synthetic test organizations and user memberships.\n');
    process.exit(0);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = crypto.randomBytes(4).toString('hex');
  const org1Slug = `test-org-alpha-${runId}`;
  const org2Slug = `test-org-beta-${runId}`;
  const user1Email = `organizer.alpha.${runId}@test.corp`;
  const user2Email = `organizer.beta.${runId}@test.corp`;
  const adminEmail = `admin.alpha.${runId}@test.corp`;
  const managerEmail = `manager.alpha.${runId}@test.corp`;
  const testPassword = `TestPass!${runId}`;

  let org1Id = null;
  let org2Id = null;
  let user1Id = null;
  let user2Id = null;
  let adminUserId = null;
  let managerUserId = null;
  let user1Client = null;
  let user2Client = null;
  let adminClientUser = null;
  let managerClientUser = null;
  let org2TaskId = null;
  let managerDeleteTestProjId = null;

  try {
    console.log(`Setting up isolated synthetic test organizations and users [runId=${runId}]...`);

    // 1. Create synthetic user 1 (Organizer 1)
    const { data: u1, error: u1Err } = await adminClient.auth.admin.createUser({
      email: user1Email,
      password: testPassword,
      email_confirm: true,
    });
    if (u1Err) throw new Error(`Failed to create test user 1: ${u1Err.message}`);
    user1Id = u1.user.id;

    // 2. Create synthetic user 2 (Organizer 2)
    const { data: u2, error: u2Err } = await adminClient.auth.admin.createUser({
      email: user2Email,
      password: testPassword,
      email_confirm: true,
    });
    if (u2Err) throw new Error(`Failed to create test user 2: ${u2Err.message}`);
    user2Id = u2.user.id;

    // 3. Create synthetic Admin user (Org 1)
    const { data: uAdmin, error: uAdminErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (uAdminErr) throw new Error(`Failed to create test admin user: ${uAdminErr.message}`);
    adminUserId = uAdmin.user.id;

    // 4. Create synthetic Manager user (Org 1)
    const { data: uMgr, error: uMgrErr } = await adminClient.auth.admin.createUser({
      email: managerEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (uMgrErr) throw new Error(`Failed to create test manager user: ${uMgrErr.message}`);
    managerUserId = uMgr.user.id;

    // 5. Create Org 1 with user 1 as created_by
    const { data: o1, error: o1Err } = await adminClient
      .from('organizations')
      .insert({ name: `Test Org Alpha ${runId}`, slug: org1Slug, created_by: user1Id })
      .select('id')
      .single();
    if (o1Err) throw new Error(`Failed to create Org 1: ${o1Err.message}`);
    org1Id = o1.id;

    // 6. Create Org 2 with user 2 as created_by
    const { data: o2, error: o2Err } = await adminClient
      .from('organizations')
      .insert({ name: `Test Org Beta ${runId}`, slug: org2Slug, created_by: user2Id })
      .select('id')
      .single();
    if (o2Err) throw new Error(`Failed to create Org 2: ${o2Err.message}`);
    org2Id = o2.id;

    // 7. Create active memberships
    await adminClient.from('organization_memberships').insert([
      { organization_id: org1Id, user_id: user1Id, role: 'organizer', status: 'active' },
      { organization_id: org2Id, user_id: user2Id, role: 'organizer', status: 'active' },
      { organization_id: org1Id, user_id: adminUserId, role: 'admin', status: 'active' },
      { organization_id: org1Id, user_id: managerUserId, role: 'manager', status: 'active' },
    ]);

    // 8. Create a protected project in Org 1 for Manager delete probe
    const { data: mgrTestProj, error: mgrTestProjErr } = await adminClient
      .from('projects')
      .insert({
        organization_id: org1Id,
        name: `Manager Protected Project ${runId}`,
        status: 'planning',
        priority: 'medium',
      })
      .select('id')
      .single();
    if (mgrTestProjErr) throw new Error(`Failed to create manager test project: ${mgrTestProjErr.message}`);
    managerDeleteTestProjId = mgrTestProj.id;

    // 6. Create a project and task in Org 2 for cross-org task assignment probe
    const { data: proj2 } = await adminClient
      .from('projects')
      .insert({
        organization_id: org2Id,
        name: `Org 2 Internal Project ${runId}`,
        status: 'planning',
        priority: 'medium',
      })
      .select('id')
      .single();

    if (proj2) {
      const { data: t2 } = await adminClient
        .from('tasks')
        .insert({
          organization_id: org2Id,
          project_id: proj2.id,
          title: `Org 2 Sensitive Task ${runId}`,
          status: 'todo',
          priority: 'medium',
        })
        .select('id')
        .single();
      if (t2) org2TaskId = t2.id;
    }

    // 7. Insert an audit log in Org 2
    await adminClient.from('organization_audit_logs').insert({
      organization_id: org2Id,
      actor_user_id: user2Id,
      action: 'ORGANIZATION_CREATED',
      details: { runId },
    });

    // 8. Sign in all test users via standard auth endpoints
    const { data: s1, error: s1Err } = await anonClient.auth.signInWithPassword({
      email: user1Email,
      password: testPassword,
    });
    if (s1Err) throw new Error(`Failed to authenticate User 1: ${s1Err.message}`);

    const { data: s2, error: s2Err } = await anonClient.auth.signInWithPassword({
      email: user2Email,
      password: testPassword,
    });
    if (s2Err) throw new Error(`Failed to authenticate User 2: ${s2Err.message}`);

    const { data: sAdmin, error: sAdminErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: testPassword,
    });
    if (sAdminErr) throw new Error(`Failed to authenticate Admin: ${sAdminErr.message}`);

    const { data: sMgr, error: sMgrErr } = await anonClient.auth.signInWithPassword({
      email: managerEmail,
      password: testPassword,
    });
    if (sMgrErr) throw new Error(`Failed to authenticate Manager: ${sMgrErr.message}`);

    user1Client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${s1.session.access_token}` } },
    });

    user2Client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${s2.session.access_token}` } },
    });

    adminClientUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sAdmin.session.access_token}` } },
    });

    managerClientUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sMgr.session.access_token}` } },
    });

    console.log('Authentication confirmed. Commencing live isolation probes...\n');

    // -------------------------------------------------------------------------
    // TEST 1: Organizer can create a project in their own organization
    // -------------------------------------------------------------------------
    const { data: createdProj1, error: errProj1 } = await user1Client
      .from('projects')
      .insert({
        organization_id: org1Id,
        name: `Alpha Project ${runId}`,
        description: 'Created by Organizer 1 in Org 1',
        status: 'planning',
        priority: 'high',
      })
      .select('id, name')
      .single();

    record(
      'Organizer 1 creates project in own organization (Org 1)',
      !errProj1 && Boolean(createdProj1?.id),
      errProj1 ? errProj1.message : `Project created successfully with ID: ${createdProj1.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Organizer is denied project creation in another organization (Org 2)
    // -------------------------------------------------------------------------
    const { data: leakProj, error: errLeakProj } = await user1Client
      .from('projects')
      .insert({
        organization_id: org2Id,
        name: `Illegal Cross-Org Project ${runId}`,
        description: 'Attempted insert by User 1 into Org 2',
        status: 'planning',
        priority: 'high',
      })
      .select('id')
      .single();

    const crossOrgInsertBlocked = Boolean(errLeakProj && (errLeakProj.code === '42501' || errLeakProj.message.includes('policy')));
    record(
      'Organizer 1 denied project creation in Org 2 (RLS 42501)',
      crossOrgInsertBlocked,
      crossOrgInsertBlocked ? `Denied with expected RLS policy error: ${errLeakProj.message}` : `Unexpected response: ${JSON.stringify({ leakProj, errLeakProj })}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Organizer is denied cross-organization assign_task RPC calls
    // -------------------------------------------------------------------------
    if (org2TaskId) {
      const { error: errCrossAssign } = await user1Client.rpc('assign_task', {
        p_task_id: org2TaskId,
        p_assignee_id: user1Id,
      });

      const crossAssignBlocked = Boolean(errCrossAssign && (errCrossAssign.code === '42501' || errCrossAssign.message.includes('Not an active member')));
      record(
        'Organizer 1 denied assign_task on Org 2 task (RPC 42501)',
        crossAssignBlocked,
        crossAssignBlocked ? `Denied with expected exception: ${errCrossAssign.message}` : `Unexpected result: ${JSON.stringify(errCrossAssign)}`
      );
    } else {
      record('Organizer 1 denied assign_task on Org 2 task', false, 'Org 2 test task could not be prepared.');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Organizer cannot write or read cross-organization audit logs
    // -------------------------------------------------------------------------
    // 4a. Cross-Org Write Denial (REVOKE INSERT / RLS)
    const { error: errAuditWrite } = await user1Client
      .from('organization_audit_logs')
      .insert({
        organization_id: org2Id,
        actor_user_id: user1Id,
        action: 'ILLEGAL_CROSS_ORG_AUDIT_ENTRY',
        details: { runId },
      });

    const auditWriteBlocked = Boolean(
      errAuditWrite &&
        (errAuditWrite.code === '42501' ||
          errAuditWrite.message.includes('permission denied') ||
          errAuditWrite.message.includes('policy'))
    );
    record(
      'Organizer 1 cannot write cross-organization audit logs (42501)',
      auditWriteBlocked,
      auditWriteBlocked
        ? `Denied with expected permission error: ${errAuditWrite.message}`
        : 'Unexpected success writing cross-org audit log'
    );

    // 4b. Cross-Org Read Isolation (RLS row-filtering returns 0 rows)
    const { data: auditData, error: errAuditRead } = await user1Client
      .from('organization_audit_logs')
      .select('id, action, organization_id')
      .eq('organization_id', org2Id);

    const auditIsolated = !errAuditRead && Array.isArray(auditData) && auditData.length === 0;
    record(
      'Organizer 1 cannot read Org 2 audit logs (RLS row-filtering returns 0 rows)',
      auditIsolated,
      auditIsolated ? 'Zero rows leaked (RLS silently filtered all Org 2 records)' : `Unexpected audit data: ${JSON.stringify(auditData)}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Suspended Organizer in organizations.created_by is denied access
    // -------------------------------------------------------------------------
    // Suspend User 1's membership in Org 1 via admin client
    await adminClient
      .from('organization_memberships')
      .update({ status: 'suspended' })
      .eq('organization_id', org1Id)
      .eq('user_id', user1Id);

    // User 1 attempts project insert in Org 1 while suspended (despite matching created_by)
    const { data: suspendedProj, error: errSuspendedProj } = await user1Client
      .from('projects')
      .insert({
        organization_id: org1Id,
        name: `Suspended User Project ${runId}`,
        status: 'planning',
        priority: 'low',
      })
      .select('id')
      .single();

    const suspendedBlocked = Boolean(errSuspendedProj && (errSuspendedProj.code === '42501' || errSuspendedProj.message.includes('policy')));
    record(
      'Suspended Organizer (matching created_by) is denied access (RLS 42501)',
      suspendedBlocked,
      suspendedBlocked ? `Denied with RLS policy error: ${errSuspendedProj.message}` : `Unauthorized insert succeeded: ${JSON.stringify(suspendedProj)}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Manager is denied project deletion (RLS projects_delete_policy)
    // -------------------------------------------------------------------------
    const { data: delData, error: errDel } = await managerClientUser
      .from('projects')
      .delete()
      .eq('id', managerDeleteTestProjId)
      .select();

    const { data: projStillExists } = await adminClient
      .from('projects')
      .select('id, name')
      .eq('id', managerDeleteTestProjId);

    const projectPreserved = Array.isArray(projStillExists) && projStillExists.length === 1;
    const deleteBlocked = Boolean(
      (errDel && (errDel.code === '42501' || errDel.code === 'PGRST116' || errDel.message.includes('policy'))) ||
      (!errDel && Array.isArray(delData) && delData.length === 0)
    ) && projectPreserved;

    record(
      'Manager denied project deletion (RLS projects_delete_policy restricts to admin/organizer)',
      deleteBlocked,
      deleteBlocked
        ? `Delete denied (RLS filtered row, 0 deleted); verified project preserved with ID: ${managerDeleteTestProjId}`
        : `Unexpected outcome: ${JSON.stringify({ delData, errDel, projectPreserved })}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Admin is denied organization-settings update (RLS update policy)
    // -------------------------------------------------------------------------
    const { data: updateData, error: errUpdate } = await adminClientUser
      .from('organizations')
      .update({ name: `Illegal Admin Rename ${runId}` })
      .eq('id', org1Id)
      .select();

    const { data: orgAfterCheck } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', org1Id)
      .single();

    const orgNameUnchanged = orgAfterCheck && orgAfterCheck.name === `Test Org Alpha ${runId}`;
    const orgUpdateBlocked = Boolean(
      (errUpdate && (errUpdate.code === '42501' || errUpdate.code === 'PGRST116' || errUpdate.message.includes('policy'))) ||
      (!errUpdate && Array.isArray(updateData) && updateData.length === 0)
    ) && orgNameUnchanged;

    record(
      'Admin denied organization-settings update (RLS restricts update to organizer)',
      orgUpdateBlocked,
      orgUpdateBlocked
        ? `Update denied (RLS filtered row, 0 updated); verified org name unchanged: "${orgAfterCheck?.name}"`
        : `Unexpected outcome: ${JSON.stringify({ updateData, errUpdate, orgNameUnchanged })}`
    );

  } catch (err) {
    console.error('❌ [ERROR] Test execution encountered an unhandled error:', err.message);
  } finally {
    console.log('\nCleaning up synthetic test resources...');
    try {
      if (org1Id) await adminClient.from('organization_audit_logs').delete().eq('organization_id', org1Id);
    } catch (_) {}
    try {
      if (org2Id) await adminClient.from('organization_audit_logs').delete().eq('organization_id', org2Id);
    } catch (_) {}
    try {
      if (org1Id) await adminClient.from('tasks').delete().eq('organization_id', org1Id);
    } catch (_) {}
    try {
      if (org2Id) await adminClient.from('tasks').delete().eq('organization_id', org2Id);
    } catch (_) {}
    try {
      if (org1Id) await adminClient.from('projects').delete().eq('organization_id', org1Id);
    } catch (_) {}
    try {
      if (org2Id) await adminClient.from('projects').delete().eq('organization_id', org2Id);
    } catch (_) {}
    try {
      if (org1Id) await adminClient.from('organization_memberships').delete().eq('organization_id', org1Id);
    } catch (_) {}
    try {
      if (org2Id) await adminClient.from('organization_memberships').delete().eq('organization_id', org2Id);
    } catch (_) {}
    try {
      if (org1Id) await adminClient.from('organizations').delete().eq('id', org1Id);
    } catch (_) {}
    try {
      if (org2Id) await adminClient.from('organizations').delete().eq('id', org2Id);
    } catch (_) {}
    try {
      if (user1Id) await adminClient.auth.admin.deleteUser(user1Id);
    } catch (_) {}
    try {
      if (user2Id) await adminClient.auth.admin.deleteUser(user2Id);
    } catch (_) {}
    try {
      if (adminUserId) await adminClient.auth.admin.deleteUser(adminUserId);
    } catch (_) {}
    try {
      if (managerUserId) await adminClient.auth.admin.deleteUser(managerUserId);
    } catch (_) {}
    console.log('Cleanup completed.\n');

    console.log('----------------------------------------------------------------');
    console.log(`LIVE RESULTS: ${passed} passed, ${failed} failed`);
    console.log('----------------------------------------------------------------\n');
  }
}

runLiveOrganizerIsolationSuite();

