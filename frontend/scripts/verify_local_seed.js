const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function main() {
  console.log('--- Verifying Local Seed & Schema State ---');

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // 1. Verify User Profiles Count
  const { data: profiles, error: profileErr } = await adminClient
    .from('user_profiles')
    .select('id, email, full_name, role:organization_memberships(role, organization_id)');
  if (profileErr) throw profileErr;
  console.log(`[OK] user_profiles count: ${profiles.length}`);

  // 2. Verify Organizations Count
  const { data: orgs, error: orgErr } = await adminClient
    .from('organizations')
    .select('id, name, slug');
  if (orgErr) throw orgErr;
  console.log(`[OK] organizations count: ${orgs.length} (${orgs.map(o => o.name).join(', ')})`);

  // 3. Verify Memberships Count
  const { data: memberships, error: memErr } = await adminClient
    .from('organization_memberships')
    .select('id, organization_id, user_id, role, status');
  if (memErr) throw memErr;
  console.log(`[OK] organization_memberships count: ${memberships.length}`);

  // 4. Test User Login for all 5 Seeded Users
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false }
  });

  const testUsers = [
    'chloe.dubois@acme.corp',
    'sarah.connor@acme.corp',
    'alex.chen@acme.corp',
    'david.kim@acme.corp',
    'priya.patel@acme.corp'
  ];

  for (const email of testUsers) {
    const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
      email,
      password: 'Password123!'
    });
    if (authErr) {
      console.error(`[FAIL] Login failed for ${email}:`, authErr.message);
      throw authErr;
    }
    console.log(`[OK] Logged in successfully as ${email} (User ID: ${authData.user.id})`);
  }

  // 5. Test RPC create_organization_with_admin as Chloe Dubois
  const { data: chloeAuth } = await anonClient.auth.signInWithPassword({
    email: 'chloe.dubois@acme.corp',
    password: 'Password123!'
  });

  const chloeClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${chloeAuth.session.access_token}` } }
  });

  const testOrgSlug = `test-org-${Date.now()}`;
  const { data: newOrgId, error: rpcOrgErr } = await chloeClient.rpc('create_organization_with_admin', {
    p_name: 'Test Org Chloe',
    p_slug: testOrgSlug
  });

  if (rpcOrgErr) {
    console.error('[FAIL] create_organization_with_admin RPC error:', rpcOrgErr);
    throw rpcOrgErr;
  }
  console.log(`[OK] create_organization_with_admin RPC succeeded, newOrgId: ${newOrgId}`);

  // 6. Test RPC promote_member_to_admin on Acme Systems Engineering
  // Chloe promotes Sarah Connor to admin in Acme Systems
  const acmeOrgId = 'a0000000-0000-0000-0000-000000000001';
  const sarahUserId = 'b0000000-0000-0000-0000-000000000001';

  const { data: promoteRes, error: promoteErr } = await chloeClient.rpc('promote_member_to_admin', {
    p_organization_id: acmeOrgId,
    p_user_id: sarahUserId
  });

  if (promoteErr) {
    console.error('[FAIL] promote_member_to_admin RPC error:', promoteErr);
    throw promoteErr;
  }
  console.log(`[OK] promote_member_to_admin RPC succeeded, result:`, promoteRes);

  // 7. Check Audit Logs
  const { data: auditLogs, error: auditErr } = await chloeClient
    .from('organization_audit_logs')
    .select('*')
    .eq('organization_id', acmeOrgId);
  if (auditErr) {
    console.error('[FAIL] Query audit logs error:', auditErr);
    throw auditErr;
  }
  console.log(`[OK] organization_audit_logs count for Acme: ${auditLogs.length}`);
  console.log(`[OK] Latest audit log entry:`, auditLogs[0]);

  console.log('\n>>> ALL LOCAL SEED AND WORKSPACE VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<');
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
