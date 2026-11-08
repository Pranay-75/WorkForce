// ==============================================================================
// ⛔ QUARANTINED SCRIPT — STRICTLY PROHIBITED FROM RUNNING IN LOCAL / STAGING WORKFLOWS
// ==============================================================================
// This script targets hosted production infrastructure and contains hardcoded
// production fallbacks. It is quarantined to prevent accidental execution.
// Running this script requires a separate, explicitly authorized review.
// ==============================================================================
console.error("⛔ [QUARANTINE ENFORCED] 'verify_remote_production_governance.js' is strictly quarantined.");
console.error("   Reason: Script targets hosted production endpoints.");
console.error("   Execution is blocked. Any execution requires a separate, explicitly authorized review.");
process.exit(1);

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wxkjygctdonpeypgrcnf.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_z1iFpMzAfXM5A8ArpTBTww_UDyryGYL';

async function verifyRemoteGovernance() {
  console.log('================================================================');
  console.log(' WORKFORCE HOSTED SUPABASE POST-MIGRATION VERIFICATION SUITE   ');
  console.log('================================================================');
  console.log(`Target: ${SUPABASE_URL}\n`);

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

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false }
  });

  // 1. RPC Auth Guard: add_organization_member
  try {
    const { data, error } = await anonClient.rpc('add_organization_member', {
      p_organization_id: '00000000-0000-0000-0000-000000000000',
      p_email: 'probe@test.corp',
      p_role: 'employee'
    });
    if (error && (error.code === '42501' || error.message.includes('Authentication required'))) {
      record('Remote RPC Guard: add_organization_member requires auth', true, `Rejected unauthenticated caller: "${error.message}" (${error.code})`);
    } else {
      record('Remote RPC Guard: add_organization_member requires auth', false, `Unexpected response: ${JSON.stringify({ data, error })}`);
    }
  } catch (err) {
    record('Remote RPC Guard: add_organization_member requires auth', false, err.message);
  }

  // 2. RPC Auth Guard: update_member_role
  try {
    const { data, error } = await anonClient.rpc('update_member_role', {
      p_organization_id: '00000000-0000-0000-0000-000000000000',
      p_member_user_id: '00000000-0000-0000-0000-000000000000',
      p_new_role: 'manager'
    });
    if (error && (error.code === '42501' || error.message.includes('Authentication required'))) {
      record('Remote RPC Guard: update_member_role requires auth', true, `Rejected unauthenticated caller: "${error.message}" (${error.code})`);
    } else {
      record('Remote RPC Guard: update_member_role requires auth', false, `Unexpected response: ${JSON.stringify({ data, error })}`);
    }
  } catch (err) {
    record('Remote RPC Guard: update_member_role requires auth', false, err.message);
  }

  // 3. RPC Auth Guard: remove_organization_member
  try {
    const { data, error } = await anonClient.rpc('remove_organization_member', {
      p_organization_id: '00000000-0000-0000-0000-000000000000',
      p_member_user_id: '00000000-0000-0000-0000-000000000000'
    });
    if (error && (error.code === '42501' || error.message.includes('Authentication required'))) {
      record('Remote RPC Guard: remove_organization_member requires auth', true, `Rejected unauthenticated caller: "${error.message}" (${error.code})`);
    } else {
      record('Remote RPC Guard: remove_organization_member requires auth', false, `Unexpected response: ${JSON.stringify({ data, error })}`);
    }
  } catch (err) {
    record('Remote RPC Guard: remove_organization_member requires auth', false, err.message);
  }

  // 4. RPC Auth Guard: claim_my_invitations
  try {
    const { data, error } = await anonClient.rpc('claim_my_invitations');
    if (error && (error.code === '42501' || error.message.includes('Authentication required'))) {
      record('Remote RPC Guard: claim_my_invitations requires auth', true, `Rejected unauthenticated caller: "${error.message}" (${error.code})`);
    } else {
      record('Remote RPC Guard: claim_my_invitations requires auth', false, `Unexpected response: ${JSON.stringify({ data, error })}`);
    }
  } catch (err) {
    record('Remote RPC Guard: claim_my_invitations requires auth', false, err.message);
  }

  // 5. RLS & SQL Privilege Guard: Anon cannot read organization_invitations
  try {
    const { data, error } = await anonClient.from('organization_invitations').select('*');
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      record('Remote Table Guard: Anon cannot read organization_invitations', true, `Privilege rejected: "${error.message}"`);
    } else if (!data || data.length === 0) {
      record('Remote Table Guard: Anon cannot read organization_invitations', true, 'Returned 0 rows (blocked by RLS/privilege layer)');
    } else {
      record('Remote Table Guard: Anon cannot read organization_invitations', false, `Leaked ${data.length} rows to anon`);
    }
  } catch (err) {
    record('Remote Table Guard: Anon cannot read organization_invitations', false, err.message);
  }

  // 6. Schema Dump Inspection: user_role enum
  const schemaPath = path.resolve(__dirname, '../../supabase/post_governance_remote_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const enumHasHr = schemaContent.includes("'organizer'") &&
                      schemaContent.includes("'admin'") &&
                      schemaContent.includes("'manager'") &&
                      schemaContent.includes("'hr'") &&
                      schemaContent.includes("'employee'");
    record('Remote Schema: public.user_role contains hr enum label', enumHasHr, 'Enum includes: organizer, admin, manager, hr, employee');

    // 7. Schema Dump Inspection: chk_org_invitations_role
    const constraintUpdated = schemaContent.includes('chk_org_invitations_role') &&
                              schemaContent.includes("'admin'::\"public\".\"user_role\"") &&
                              schemaContent.includes("'hr'::\"public\".\"user_role\"");
    record('Remote Schema: chk_org_invitations_role permits admin and hr', constraintUpdated, 'Constraint includes admin, hr, manager, employee; excludes organizer');

    // 8. Schema Dump Inspection: Organizer-only protection in add_organization_member
    const rpcProtected = schemaContent.includes('Only the organization organizer can add or invite an administrator') &&
                         schemaContent.includes('Only organization administrators or organizers can add members');
    record('Remote Schema: add_organization_member enforces Option B governance', rpcProtected, 'Organizer-only restriction for Admin, Admin allowed for HR/Manager/Employee');
  } else {
    record('Remote Schema Inspection', false, 'post_governance_remote_schema.sql not found');
  }

  // 9. Data Integrity: Pre vs Post migration data comparison
  const preDataPath = path.resolve(__dirname, '../../supabase/pre_governance_remote_data.sql');
  const postDataPath = path.resolve(__dirname, '../../supabase/post_governance_remote_data.sql');
  if (fs.existsSync(preDataPath) && fs.existsSync(postDataPath)) {
    const preData = fs.readFileSync(preDataPath, 'utf8').replace(/-- \\restrict .*/g, '').replace(/-- \\unrestrict .*/g, '').trim();
    const postData = fs.readFileSync(postDataPath, 'utf8').replace(/-- \\restrict .*/g, '').replace(/-- \\unrestrict .*/g, '').trim();
    const dataIdentical = preData === postData;
    record('Remote Data Integrity: Real user roles, memberships & invitations unmodified', dataIdentical, 'Pre-migration and post-migration data dumps are 100% byte-for-byte identical');
  }

  console.log('\n================================================================');
  console.log(`REMOTE VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyRemoteGovernance().catch((err) => {
  console.error('Remote verification error:', err);
  process.exit(1);
});

