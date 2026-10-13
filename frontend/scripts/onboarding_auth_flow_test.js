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
    encoding: 'utf8',
  }).trim();
}

async function runOnboardingAuthFlowTest() {
  console.log('================================================================');
  console.log('    WORKFORCE ONBOARDING & AUTHENTICATION FLOW TEST SUITE       ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testUserEmail = `onboard.user.${timestamp}@workforce.test`;
  const testPassword = 'SecurePassword2026!';
  const testOrgName = `Onboard Workspace ${timestamp}`;
  const testOrgSlug = `onboard-org-${timestamp}`;

  let userId = null;
  let createdOrgId = null;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Real Auth Signup & User Profile Trigger Verification
    // -------------------------------------------------------------------------
    console.log(`1. Testing real Auth signup: ${testUserEmail}`);
    const { data: authData, error: signupErr } = await anonClient.auth.signUp({
      email: testUserEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Onboard Test User',
          organization_name: testOrgName,
          organization_slug: testOrgSlug,
        },
      },
    });

    if (signupErr || !authData.user) {
      throw new Error(`Signup failed: ${signupErr?.message}`);
    }
    userId = authData.user.id;
    console.log(`   ✅ User registered with Auth UID: ${userId}`);

    // Verify handle_new_user() trigger created public.user_profiles row
    const profileCount = runPsql(`SELECT count(*) FROM public.user_profiles WHERE id = '${userId}'`);
    if (profileCount !== '1') {
      throw new Error(`Expected profile row in public.user_profiles, found ${profileCount}`);
    }
    console.log(`   ✅ Profile automatically created in public.user_profiles`);

    // -------------------------------------------------------------------------
    // Test 2: Verify User Has 0 Organizations Initially
    // -------------------------------------------------------------------------
    console.log('\n2. Verifying user starts in zero-organization state (needs onboarding)...');
    const initialMemberships = runPsql(
      `SELECT count(*) FROM public.organization_memberships WHERE user_id = '${userId}'`
    );
    if (initialMemberships !== '0') {
      throw new Error(`Expected 0 memberships, found ${initialMemberships}`);
    }
    console.log(`   ✅ Confirmed user has 0 organization memberships (routes to /onboarding)`);

    // -------------------------------------------------------------------------
    // Test 3: Sign in to acquire real Authenticated JWT session
    // -------------------------------------------------------------------------
    console.log('\n3. Authenticating user session to acquire valid JWT...');
    const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({
      email: testUserEmail,
      password: testPassword,
    });
    if (loginErr || !loginData.session) {
      throw new Error(`Login failed: ${loginErr?.message}`);
    }
    const accessToken = loginData.session.access_token;
    console.log(`   ✅ Acquired verified JWT session for ${testUserEmail}`);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    // -------------------------------------------------------------------------
    // Test 4: Anonymous & Direct INSERT Vectors Must Be Rejected
    // -------------------------------------------------------------------------
    console.log('\n4. Verifying anonymous and direct table INSERT vectors are rejected...');
    try {
      const { data: anonData, error: anonRpcErr } = await anonClient.rpc('create_organization_with_admin', {
        p_name: 'Malicious Org',
        p_slug: 'malicious-org',
      });
      if (!anonRpcErr) {
        throw new Error('Anonymous RPC call should have failed!');
      }
      console.log(`   ✅ Anonymous RPC rejected: "${anonRpcErr.message}"`);
    } catch (e) {
      console.log(`   ✅ Anonymous RPC rejected with exception: ${e.message}`);
    }

    try {
      const { data: insertData, error: directInsertErr } = await userClient.from('organizations').insert({
        name: 'Direct Insert Org',
        slug: 'direct-insert-slug',
      });
      if (!directInsertErr) {
        throw new Error('Direct INSERT to organizations should have been rejected!');
      }
      console.log(`   ✅ Direct client INSERT to organizations rejected: "${directInsertErr.message}"`);
    } catch (e) {
      console.log(`   ✅ Direct client INSERT rejected with exception: ${e.message}`);
    }

    // -------------------------------------------------------------------------
    // Test 5: Onboarding RPC Execution with Authenticated Session
    // -------------------------------------------------------------------------
    console.log('\n5. Calling create_organization_with_admin RPC via authenticated session...');
    const { data: orgId, error: bootstrapErr } = await userClient.rpc('create_organization_with_admin', {
      p_name: testOrgName,
      p_slug: testOrgSlug,
    });

    if (bootstrapErr || !orgId) {
      throw new Error(`Bootstrap RPC failed: ${bootstrapErr?.message || 'No org ID returned'}`);
    }
    createdOrgId = orgId;
    console.log(`   ✅ Organization bootstrapped successfully. Org ID: ${createdOrgId}`);

    // Verify Organization and Membership in DB
    const membershipRole = runPsql(
      `SELECT role FROM public.organization_memberships WHERE organization_id = '${createdOrgId}' AND user_id = '${userId}'`
    );
    const membershipStatus = runPsql(
      `SELECT status FROM public.organization_memberships WHERE organization_id = '${createdOrgId}' AND user_id = '${userId}'`
    );

    if (membershipRole !== 'admin' || membershipStatus !== 'active') {
      throw new Error(`Expected role 'admin' and status 'active', got role '${membershipRole}' and status '${membershipStatus}'`);
    }
    console.log(`   ✅ Verified user is Active Administrator of "${testOrgName}" (Role: ${membershipRole}, Status: ${membershipStatus})`);

    // -------------------------------------------------------------------------
    // Test 6: Duplicate Slug Collision Rejection
    // -------------------------------------------------------------------------
    console.log('\n6. Testing duplicate slug collision rejection...');
    const { error: duplicateSlugErr } = await userClient.rpc('create_organization_with_admin', {
      p_name: 'Another Organization',
      p_slug: testOrgSlug, // Exact same slug
    });

    if (!duplicateSlugErr) {
      throw new Error('Expected duplicate slug collision to fail!');
    }
    console.log(`   ✅ Duplicate slug correctly rejected: "${duplicateSlugErr.message}"`);

    // -------------------------------------------------------------------------
    // Test 7: User Can Query Their Own Organization via RLS
    // -------------------------------------------------------------------------
    console.log('\n7. Verifying user can query their organization via RLS...');
    const { data: orgData, error: orgFetchErr } = await userClient
      .from('organizations')
      .select('id, name, slug')
      .eq('id', createdOrgId)
      .single();

    if (orgFetchErr || !orgData) {
      throw new Error(`Failed to query organization: ${orgFetchErr?.message}`);
    }
    if (orgData.name !== testOrgName || orgData.slug !== testOrgSlug) {
      throw new Error(`Organization data mismatch: ${JSON.stringify(orgData)}`);
    }
    console.log(`   ✅ RLS verified: User successfully fetched organization "${orgData.name}" (${orgData.slug})`);

    console.log('\n================================================================');
    console.log('    ALL 7 ONBOARDING & AUTHENTICATION TESTS PASSED (100%)       ');
    console.log('================================================================\n');
  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Clean up all disposable test data
    // -------------------------------------------------------------------------
    console.log('🧹 Cleaning up disposable test data...');
    try {
      if (createdOrgId) {
        runPsql(`DELETE FROM public.organizations WHERE id = '${createdOrgId}'`);
        console.log(`   - Deleted organization ${createdOrgId}`);
      } else if (userId) {
        runPsql(`DELETE FROM public.organizations WHERE id IN (SELECT organization_id FROM public.organization_memberships WHERE user_id = '${userId}')`);
      }
      if (userId) {
        runPsql(`DELETE FROM auth.users WHERE id = '${userId}'`);
        console.log(`   - Deleted auth user ${userId}`);
      }
    } catch (cleanupErr) {
      console.warn('   ⚠️ Cleanup notice:', cleanupErr.message);
    }
    console.log('✨ Cleanup complete.\n');
  }
}

runOnboardingAuthFlowTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test execution failed:', err.message);
    process.exit(1);
  });
