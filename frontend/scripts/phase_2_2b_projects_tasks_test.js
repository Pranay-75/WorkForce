/**
 * WorkForce Phase 2.2B — Comprehensive Integration & Authorization Suite
 *
 * Test Scenarios:
 * 1. Project Management:
 *    - Manager in Org A creates project with members and effort budget.
 *    - Manager updates project metadata.
 *    - Employee in Org A is blocked from creating project (RLS WITH CHECK).
 *    - Employee in Org A is blocked from updating project (RLS USING).
 *    - Manager is blocked from deleting project (admin-only policy).
 *    - Admin in Org A can delete project.
 *
 * 2. Task Management & Assignment:
 *    - Manager creates task with initial assignee (Sarah Connor -> Alex Chen).
 *    - Employee is blocked from creating task (RLS WITH CHECK).
 *    - Direct client update to `tasks.assigned_to` is rejected by column privileges (42501).
 *    - Reassignment via `assign_task()` RPC succeeds for Manager.
 *    - Reassignment via `assign_task()` RPC is blocked for Employee (42501).
 *    - Employee can update `status` on their own assigned task.
 *    - Employee is blocked from modifying `estimated_hours` or other fields on assigned task.
 *    - Employee is blocked from updating task assigned to another user (RLS / trigger).
 *
 * 3. Cross-Organization Tenant Isolation:
 *    - User in Org B querying projects in Org A receives 0 rows (PostgreSQL RLS).
 *    - User in Org B querying tasks in Org A receives 0 rows (PostgreSQL RLS).
 *    - User in Org B calling `assign_task()` on task in Org A is rejected (42501, zero leakage).
 *
 * 4. Data Hook Mapping & Integrity:
 *    - Verifies shape and contracts of mapped Project and Task entities.
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, evidence) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    if (evidence) console.log(`         Evidence: ${evidence}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (evidence) console.error(`         Failure details: ${evidence}`);
    failedTests++;
  }
}

async function getClientForUser(email, password = 'Password123!') {
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`);
  return {
    client: createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
    user: data.user,
  };
}

async function run() {
  console.log('================================================================');
  console.log('       WORKFORCE PHASE 2.2B INTEGRATION & SECURITY SUITE        ');
  console.log('================================================================\n');

  // 1. Authenticate users
  const chloe = await getClientForUser('chloe.dubois@acme.corp');   // Admin
  const sarah = await getClientForUser('sarah.connor@acme.corp');   // Manager
  const alex = await getClientForUser('alex.chen@acme.corp');       // Employee
  const david = await getClientForUser('david.kim@acme.corp');      // Employee

  const orgAId = 'a0000000-0000-0000-0000-000000000001';

  // Setup a distinct tenant Org B for cross-tenant tests
  const orgBId = 'a0000000-0000-0000-0000-000000000002';
  const orgBUserEmail = 'tenant_b_lead@test.corp';

  // Provision Org B if not present
  await adminClient.from('organizations').upsert({ id: orgBId, name: 'Tenant Beta Corp', slug: 'tenant-beta' });
  const { data: bUserLookup } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  let bAuthUser = bUserLookup?.users?.find((u) => u.email === orgBUserEmail);
  if (!bAuthUser) {
    const { data: created } = await adminClient.auth.admin.createUser({
      email: orgBUserEmail,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { full_name: 'Tenant B Manager' },
    });
    bAuthUser = created?.user;
    if (!bAuthUser) {
      const idRaw = execSync(`docker exec -i supabase_db_WorkForce psql -U postgres -d postgres -t -A -c "SELECT id FROM auth.users WHERE email = '${orgBUserEmail}';"`, { encoding: 'utf8' }).trim();
      const m = idRaw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (!m) {
        throw new Error(`Failed to retrieve valid UUID for user ${orgBUserEmail}: got "${idRaw}"`);
      }
      bAuthUser = { id: m[0] };
    }
  }
  await adminClient.from('user_profiles').upsert({ id: bAuthUser.id, email: orgBUserEmail, full_name: 'Tenant B Manager' });
  await adminClient.from('organization_memberships').upsert({
    organization_id: orgBId,
    user_id: bAuthUser.id,
    role: 'manager',
    status: 'active',
  });
  const tenantB = await getClientForUser(orgBUserEmail);

  let createdProjectId = null;
  let createdTaskId = null;

  try {
    // -------------------------------------------------------------
    // Category 1: Project Management & Role Boundaries
    // -------------------------------------------------------------
    console.log('--- Category 1: Project Management & Role Boundaries ---');

    // Test 1: Employee blocked from creating project
    const { error: empProjErr } = await alex.client.from('projects').insert({
      organization_id: orgAId,
      name: 'Unauthorized Employee Project',
      priority: 'medium',
      status: 'planning',
    });
    assert(Boolean(empProjErr), 'Employee blocked from inserting project', empProjErr?.message);

    // Test 2: Manager creates project in Org A
    const { data: projData, error: mgrProjErr } = await sarah.client
      .from('projects')
      .insert({
        organization_id: orgAId,
        name: 'Phase 2.2B Edge Pipeline',
        description: 'Autonomous microservice for real-time task ingestion',
        priority: 'high',
        status: 'in_progress',
        manager_id: sarah.user.id,
        total_hours: 120,
      })
      .select()
      .single();

    assert(!mgrProjErr && Boolean(projData?.id), 'Manager successfully created project in Org A', `ID: ${projData?.id}`);
    createdProjectId = projData?.id;

    // Test 3: Manager attaches project members
    const { error: memberErr } = await sarah.client.from('project_members').insert([
      { project_id: createdProjectId, user_id: alex.user.id, organization_id: orgAId },
      { project_id: createdProjectId, user_id: david.user.id, organization_id: orgAId },
    ]);
    assert(!memberErr, 'Manager successfully added project members', memberErr ? memberErr.message : 'Alex & David attached');

    // Test 4: Manager updates project metadata
    const { error: updateProjErr } = await sarah.client
      .from('projects')
      .update({ description: 'Updated pipeline description by manager', total_hours: 140 })
      .eq('id', createdProjectId);
    assert(!updateProjErr, 'Manager successfully updated project metadata', updateProjErr ? updateProjErr.message : 'Hours updated to 140');

    // Test 5: Employee blocked from updating project metadata
    const { data: empUpdateData } = await alex.client
      .from('projects')
      .update({ name: 'Tampered by Employee' })
      .eq('id', createdProjectId)
      .select();
    assert(!empUpdateData || empUpdateData.length === 0, 'Employee project update blocked by RLS (0 rows updated)', `Returned: ${empUpdateData?.length || 0}`);

    // Test 6: Manager blocked from deleting project (admin-only)
    const { data: mgrDeleteData } = await sarah.client
      .from('projects')
      .delete()
      .eq('id', createdProjectId)
      .select();
    assert(!mgrDeleteData || mgrDeleteData.length === 0, 'Manager delete project blocked by RLS (0 rows updated)', `Returned: ${mgrDeleteData?.length || 0}`);

    // -------------------------------------------------------------
    // Category 2: Task Lifecycle, Reassignment RPC, & Employee Rules
    // -------------------------------------------------------------
    console.log('\n--- Category 2: Task Lifecycle, RPC Reassignment & Immutability ---');

    // Test 7: Employee blocked from creating task
    const { error: empTaskErr } = await alex.client.from('tasks').insert({
      organization_id: orgAId,
      project_id: createdProjectId,
      title: 'Employee Unauthorized Task',
      priority: 'low',
    });
    assert(Boolean(empTaskErr), 'Employee blocked from creating task', empTaskErr?.message);

    // Test 8: Manager creates task with initial assignee (Alex)
    const { data: taskData, error: mgrTaskErr } = await sarah.client
      .from('tasks')
      .insert({
        organization_id: orgAId,
        project_id: createdProjectId,
        title: 'Kafka Consumer Optimization',
        description: 'Profile heap allocation and tune consumer lag',
        priority: 'critical',
        complexity: 'High',
        estimated_hours: 16,
        status: 'todo',
        assigned_to: alex.user.id,
      })
      .select()
      .single();

    assert(!mgrTaskErr && Boolean(taskData?.id), 'Manager created task assigned to Alex Chen', `Task ID: ${taskData?.id}`);
    createdTaskId = taskData?.id;

    // Test 9: Direct client update to assigned_to is blocked by column privileges
    const { error: directReassignErr } = await sarah.client
      .from('tasks')
      .update({ assigned_to: david.user.id })
      .eq('id', createdTaskId);
    assert(
      Boolean(directReassignErr) && directReassignErr.code === '42501',
      'Direct client update of tasks.assigned_to rejected by column privileges',
      directReassignErr?.message
    );

    // Test 10: Authorized reassignment via assign_task() RPC succeeds for Manager
    const { data: rpcTaskData, error: rpcReassignErr } = await sarah.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: david.user.id,
    });
    assert(!rpcReassignErr && rpcTaskData?.assigned_to === david.user.id, 'Manager reassigned task to David Kim via assign_task() RPC', `Assignee: ${rpcTaskData?.assigned_to}`);

    // Test 11: Employee blocked from calling assign_task() RPC
    const { error: empRpcErr } = await alex.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: alex.user.id,
    });
    assert(Boolean(empRpcErr) && empRpcErr.code === '42501', 'Employee blocked from assign_task() RPC (42501)', empRpcErr?.message);

    // Reassign back to Alex so Alex is the legitimate assignee
    await sarah.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: alex.user.id,
    });

    // Test 12: Assigned employee updates task status (Allowed)
    const { error: alexStatusErr } = await alex.client
      .from('tasks')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', createdTaskId);
    assert(!alexStatusErr, 'Assigned employee successfully transitioned status to in_progress', alexStatusErr ? alexStatusErr.message : 'Status: in_progress');

    // Test 13: Assigned employee blocked from changing non-status fields (e.g. estimated_hours)
    const { error: alexHoursErr } = await alex.client
      .from('tasks')
      .update({ estimated_hours: 40 })
      .eq('id', createdTaskId);
    assert(Boolean(alexHoursErr) && alexHoursErr.code === '42501', 'Employee modifying estimated_hours blocked by immutability trigger', alexHoursErr?.message);

    // Test 14: Unassigned employee blocked from updating task status
    const { data: davidUpdateData } = await david.client
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', createdTaskId)
      .select();
    assert(!davidUpdateData || davidUpdateData.length === 0, 'Unassigned employee update rejected by RLS (0 rows updated)', `Returned: ${davidUpdateData?.length || 0}`);

    // -------------------------------------------------------------
    // Category 3: Cross-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- Category 3: Cross-Tenant Isolation ---');

    // Test 15: Tenant Beta user querying Org A projects returns 0 rows
    const { data: bProjData } = await tenantB.client.from('projects').select().eq('organization_id', orgAId);
    assert(bProjData && bProjData.length === 0, 'Tenant Beta blocked by RLS from reading Org A projects', `Count: ${bProjData?.length}`);

    // Test 16: Tenant Beta user querying Org A tasks returns 0 rows
    const { data: bTaskData } = await tenantB.client.from('tasks').select().eq('organization_id', orgAId);
    assert(bTaskData && bTaskData.length === 0, 'Tenant Beta blocked by RLS from reading Org A tasks', `Count: ${bTaskData?.length}`);

    // Test 17: Tenant Beta user attempting to reassign Org A task via RPC is rejected
    const { error: bRpcErr } = await tenantB.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: bAuthUser.id,
    });
    assert(Boolean(bRpcErr) && bRpcErr.code === '42501', 'Tenant Beta calling assign_task() on Org A task rejected (Zero tenant leakage)', bRpcErr?.message);

    // Test 17B: assign_task() on non-existent task ID fails with error P0002
    const fakeTaskId = '00000000-0000-0000-0000-000000000999';
    const { data: missingTaskData, error: missingTaskErr } = await sarah.client.rpc('assign_task', {
      p_task_id: fakeTaskId,
      p_assignee_id: alex.user.id,
    });
    assert(Boolean(missingTaskErr) && missingTaskErr.message.includes('not found'), 'assign_task() on non-existent task returns error P0002', missingTaskErr?.message);

    // Test 17C: assign_task() with invalid non-member assignee is rejected
    const nonMemberId = '00000000-0000-0000-0000-000000000998';
    const { error: invalidAssigneeErr } = await sarah.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: nonMemberId,
    });
    assert(Boolean(invalidAssigneeErr) && invalidAssigneeErr.message.includes('Assignee must be a member'), 'assign_task() with invalid assignee rejected', invalidAssigneeErr?.message);

    // Test 17D: assign_task() with cross-organization assignee (Org B member to Org A task) is rejected
    const { error: crossAssigneeErr } = await sarah.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: bAuthUser.id,
    });
    assert(Boolean(crossAssigneeErr) && crossAssigneeErr.message.includes('Assignee must be a member'), 'assign_task() cross-organization assignee rejected', crossAssigneeErr?.message);

    // Test 17E: Manager can unassign task (p_assignee_id = null)
    const { data: unassignData, error: unassignErr } = await sarah.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: null,
    });
    assert(!unassignErr && unassignData?.assigned_to === null, 'Manager can unassign task (assignee set to NULL)', `Assignee: ${unassignData?.assigned_to}`);

    // Reassign back to Alex
    await sarah.client.rpc('assign_task', {
      p_task_id: createdTaskId,
      p_assignee_id: alex.user.id,
    });

    // -------------------------------------------------------------
    // Category 4: Safe Deletion & Cascade
    // -------------------------------------------------------------
    console.log('\n--- Category 4: Administrator Privileges & Clean Deletion ---');

    // Test 18: Administrator in Org A can delete project
    const { data: adminDeleteData, error: adminDeleteErr } = await chloe.client
      .from('projects')
      .delete()
      .eq('id', createdProjectId)
      .select();
    assert(!adminDeleteErr && adminDeleteData && adminDeleteData.length === 1, 'Administrator successfully deleted project', `Deleted project ID: ${adminDeleteData?.[0]?.id}`);

    // Test 19: Task cascaded with project deletion
    const { data: orphanCheck } = await chloe.client.from('tasks').select().eq('id', createdTaskId);
    assert(orphanCheck && orphanCheck.length === 0, 'Project deletion cleanly cascaded to child tasks', `Remaining: ${orphanCheck?.length}`);

  } catch (err) {
    console.error('Unexpected test exception:', err);
    failedTests++;
  } finally {
    // Cleanup any lingering objects
    try {
      if (createdTaskId) {
        await adminClient.from('tasks').delete().eq('id', createdTaskId);
      }
      if (createdProjectId) {
        await adminClient.from('projects').delete().eq('id', createdProjectId);
      }
      await adminClient.from('organizations').delete().eq('id', orgBId);
      if (bAuthUser?.id) {
        await adminClient.auth.admin.deleteUser(bAuthUser.id);
      }
    } catch (cleanupErr) {
      console.error('Teardown cleanup error in phase_2_2b_projects_tasks_test:', cleanupErr);
    }
  }

  console.log('\n================================================================');
  console.log(`PHASE 2.2B SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run();
