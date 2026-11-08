/**
 * Workforce Frontend Staging Runtime Isolation Test Suite
 * File: frontend/scripts/test_staging_runtime_isolation.js
 *
 * Verifies runtime isolation guards in frontend/scripts/run_with_env.js:
 * 1. Startup succeeds with complete staging variables and dummy credentials.
 * 2. Startup rejected when required staging variables are missing.
 * 3. Startup rejected when staging variables contain unconfigured placeholders.
 * 4. Startup rejected when Supabase URL or any variable references production project (wxkjygctdonpeypgrcnf).
 * 5. Startup rejected when project reference does not match staging (biejxkrhypkkcvpbzjhh).
 *
 * Safety: Uses dummy keys only. Never connects to remote endpoints.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let passed = 0;
let failed = 0;

function record(name, condition, detail) {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    if (detail) console.log(`   ${detail}`);
    passed++;
  } else {
    console.log(`❌ [FAIL] ${name}`);
    if (detail) console.log(`   ${detail}`);
    failed++;
  }
}

const runnerScript = path.resolve(__dirname, 'run_with_env.js');
const tempDir = path.resolve(__dirname, '..', '.test_staging_temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function runTest(envContent, args = ['node', '-e', 'process.exit(0)']) {
  const tempEnvPath = path.resolve(tempDir, `test_${Date.now()}_${Math.random().toString(36).substring(7)}.staging`);
  fs.writeFileSync(tempEnvPath, envContent, 'utf8');

  try {
    const result = spawnSync('node', [runnerScript, tempEnvPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    return {
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  } finally {
    if (fs.existsSync(tempEnvPath)) {
      fs.unlinkSync(tempEnvPath);
    }
  }
}

console.log('================================================================');
console.log(' WORKFORCE FRONTEND STAGING RUNTIME ISOLATION SUITE             ');
console.log('================================================================\n');

try {
  // Test 1: Complete staging variables with dummy credentials -> Must Succeed
  const validStagingContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-staging-anon-key-1234567890
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-staging-anon-key-1234567890
NEXT_PUBLIC_API_URL=http://localhost:8000
`;
  const res1 = runTest(validStagingContent);
  const pass1 = res1.status === 0 && res1.stdout.includes('Isolated staging configuration verified');
  record(
    'Frontend staging startup with complete staging variables',
    pass1,
    pass1 ? 'Staging runtime guard validated project biejxkrhypkkcvpbzjhh' : `Unexpected result: code ${res1.status}, stderr: ${res1.stderr}`
  );

  // Test 2: Missing required staging variable -> Must Fail
  const missingVarContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
# Missing NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-staging-key
`;
  const res2 = runTest(missingVarContent);
  const pass2 = res2.status !== 0 && res2.stderr.includes('Missing required staging variable(s): NEXT_PUBLIC_SUPABASE_ANON_KEY');
  record(
    'Frontend startup rejection when required staging variable is missing',
    pass2,
    pass2 ? 'Properly halted with exit code 1 and missing variable notice' : `Unexpected result: code ${res2.status}, stderr: ${res2.stderr}`
  );

  // Test 3: Unconfigured placeholder rejection -> Must Fail
  const placeholderContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key-placeholder
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-staging-anon-key-placeholder
`;
  const res3 = runTest(placeholderContent);
  const pass3 = res3.status !== 0 && res3.stderr.includes('contain unconfigured placeholders');
  record(
    'Frontend startup rejection when variables contain unconfigured placeholders',
    pass3,
    pass3 ? 'Properly halted on placeholder detection' : `Unexpected result: code ${res3.status}, stderr: ${res3.stderr}`
  );

  // Test 4: Production project reference leak rejection -> Must Fail
  const prodLeakContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://wxkjygctdonpeypgrcnf.supabase.co
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res4 = runTest(prodLeakContent);
  const pass4 = res4.status !== 0 && res4.stderr.includes('CRITICAL SAFETY VIOLATION') && res4.stderr.includes('wxkjygctdonpeypgrcnf');
  record(
    'Frontend rejection of production project reference (wxkjygctdonpeypgrcnf)',
    pass4,
    pass4 ? 'Production leak caught and blocked with CRITICAL SAFETY VIOLATION' : `Unexpected result: code ${res4.status}, stderr: ${res4.stderr}`
  );

  // Test 5: Incorrect staging project reference -> Must Fail
  const wrongRefContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co
NEXT_PUBLIC_SUPABASE_PROJECT_REF=incorrect-project-ref-123
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res5 = runTest(wrongRefContent);
  const pass5 = res5.status !== 0 && res5.stderr.includes('STAGING MISCONFIGURATION') && res5.stderr.includes('must be \'biejxkrhypkkcvpbzjhh\'');
  record(
    'Frontend rejection of incorrect staging project reference',
    pass5,
    pass5 ? 'Mismatched project reference caught and blocked' : `Unexpected result: code ${res5.status}, stderr: ${res5.stderr}`
  );

  // Test 6: Hostname spoofing via path -> Must Fail
  const pathSpoofContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://attacker.com/biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res6 = runTest(pathSpoofContent);
  const pass6 = res6.status !== 0 && res6.stderr.includes('hostname must be \'biejxkrhypkkcvpbzjhh.supabase.co\'');
  record(
    'Frontend rejection of hostname spoofing via URL path',
    pass6,
    pass6 ? 'Attacker host with staging ref in path blocked' : `Unexpected result: code ${res6.status}, stderr: ${res6.stderr}`
  );

  // Test 7: Userinfo spoofing -> Must Fail
  const userinfoSpoofContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh@attacker.com
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res7 = runTest(userinfoSpoofContent);
  const pass7 = res7.status !== 0 && res7.stderr.includes('Userinfo embedded in NEXT_PUBLIC_SUPABASE_URL is prohibited');
  record(
    'Frontend rejection of userinfo spoofing in URL',
    pass7,
    pass7 ? 'URL with embedded userinfo blocked' : `Unexpected result: code ${res7.status}, stderr: ${res7.stderr}`
  );

  // Test 8: Query parameter spoofing -> Must Fail
  const querySpoofContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co?token=secret
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res8 = runTest(querySpoofContent);
  const pass8 = res8.status !== 0 && res8.stderr.includes('Query parameters in NEXT_PUBLIC_SUPABASE_URL are prohibited');
  record(
    'Frontend rejection of query parameters in URL',
    pass8,
    pass8 ? 'URL with embedded query parameters blocked' : `Unexpected result: code ${res8.status}, stderr: ${res8.stderr}`
  );

  // Test 9: Non-root path spoofing -> Must Fail
  const nonRootPathContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://biejxkrhypkkcvpbzjhh.supabase.co/extra/path
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res9 = runTest(nonRootPathContent);
  const pass9 = res9.status !== 0 && res9.stderr.includes('Non-root path in NEXT_PUBLIC_SUPABASE_URL is prohibited');
  record(
    'Frontend rejection of non-root path in URL',
    pass9,
    pass9 ? 'URL with non-root path blocked' : `Unexpected result: code ${res9.status}, stderr: ${res9.stderr}`
  );

  // Test 10: Insecure HTTP protocol -> Must Fail
  const httpContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=http://biejxkrhypkkcvpbzjhh.supabase.co
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res10 = runTest(httpContent);
  const pass10 = res10.status !== 0 && res10.stderr.includes('must use HTTPS protocol');
  record(
    'Frontend rejection of insecure HTTP protocol in staging',
    pass10,
    pass10 ? 'Insecure HTTP URL blocked' : `Unexpected result: code ${res10.status}, stderr: ${res10.stderr}`
  );

  // Test 11: Malformed URL -> Must Fail
  const malformedContent = `
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=not_a_valid_url
NEXT_PUBLIC_SUPABASE_PROJECT_REF=biejxkrhypkkcvpbzjhh
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy-key
`;
  const res11 = runTest(malformedContent);
  const pass11 = res11.status !== 0 && res11.stderr.includes('Invalid URL format for NEXT_PUBLIC_SUPABASE_URL');
  record(
    'Frontend rejection of malformed URL',
    pass11,
    pass11 ? 'Malformed URL caught and rejected' : `Unexpected result: code ${res11.status}, stderr: ${res11.stderr}`
  );

} finally {
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

console.log('\n================================================================');
console.log(`FRONTEND STAGING ISOLATION RESULTS: ${passed} passed, ${failed} failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}

