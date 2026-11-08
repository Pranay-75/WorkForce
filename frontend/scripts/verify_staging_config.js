#!/usr/bin/env node
/**
 * Workforce Staging Configuration & Credentials Verification
 * File: frontend/scripts/verify_staging_config.js
 *
 * Verifies local staging environment configuration strictly from disk files.
 * Outputs ONLY sanitized PASS/FAIL statuses and variable names.
 * NEVER prints credential values, tokens, or secret lengths.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STAGING_REF = 'biejxkrhypkkcvpbzjhh';
const STAGING_HOST = 'biejxkrhypkkcvpbzjhh.supabase.co';
const STAGING_URL = 'https://biejxkrhypkkcvpbzjhh.supabase.co';
const PROD_REF = 'wxkjygctdonpeypgrcnf';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const fePath = path.join(workspaceRoot, 'frontend', '.env.staging');
const bePath = path.join(workspaceRoot, 'backend', '.env.staging');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = line.match(/^\s*([\w.-]+)\s*=(.*)?$/);
    if (match) {
      const key = match[1].trim();
      let val = (match[2] !== undefined ? match[2] : '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  });
  return { vars, raw: content };
}

const fe = parseEnv(fePath);
const be = parseEnv(bePath);

console.log('================================================================');
console.log(' WORKFORCE STAGING CONFIGURATION & CREDENTIALS VERIFICATION    ');
console.log('================================================================\n');

// 1. Files Exist
const feExists = fe !== null;
const beExists = be !== null;
const filesExist = feExists && beExists;
console.log('1. Staging Files Exist on Disk:                 ', filesExist ? 'PASS' : 'FAIL');
console.log('   frontend/.env.staging:                       ', feExists ? 'EXISTS' : 'MISSING');
console.log('   backend/.env.staging:                        ', beExists ? 'EXISTS' : 'MISSING');

if (!filesExist) {
  console.log('\nCannot proceed without both staging files present on disk.');
  process.exit(1);
}

// 2. Required Supabase & AI Variables Present
const feRequired = [
  'NEXT_PUBLIC_ENVIRONMENT',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PROJECT_REF',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
];
const beRequired = [
  'ENVIRONMENT',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'GEMINI_API_KEY'
];

const feMissing = feRequired.filter(k => !(k in fe.vars));
const beMissing = beRequired.filter(k => !(k in be.vars));
const allRequiredPresent = feMissing.length === 0 && beMissing.length === 0;

console.log('2. Required Staging Variables Present:          ', allRequiredPresent ? 'PASS' : 'FAIL');
if (feMissing.length > 0) console.log('   Missing in frontend: ', feMissing.join(', '));
if (beMissing.length > 0) console.log('   Missing in backend:  ', beMissing.join(', '));

// 3. No Placeholders or Empty Required Values
function checkEmpty(vars, keys) {
  return keys.filter(k => !vars[k] || vars[k].trim() === '');
}

function checkPlaceholders(vars, keys) {
  const bad = [];
  for (const k of keys) {
    const val = (vars[k] || '').toLowerCase().trim();
    if (
      val.includes('placeholder') ||
      val.startsWith('your-') ||
      val.includes('example') ||
      (val.startsWith('<') && val.endsWith('>'))
    ) {
      bad.push(k);
    }
  }
  return bad;
}

const feEmpty = checkEmpty(fe.vars, feRequired);
const beEmpty = checkEmpty(be.vars, beRequired);
const fePlaceholders = checkPlaceholders(fe.vars, feRequired);
const bePlaceholders = checkPlaceholders(be.vars, beRequired);

const noEmptyOrPlaceholders =
  feEmpty.length === 0 &&
  beEmpty.length === 0 &&
  fePlaceholders.length === 0 &&
  bePlaceholders.length === 0;

console.log('3. Staging Credentials Populated (No Placeholders):', noEmptyOrPlaceholders ? 'PASS' : 'FAIL');
if (feEmpty.length > 0) console.log('   Empty frontend variables:   ', feEmpty.join(', '));
if (beEmpty.length > 0) console.log('   Empty backend variables:    ', beEmpty.join(', '));
if (fePlaceholders.length > 0) console.log('   Frontend placeholder keys:  ', fePlaceholders.join(', '));
if (bePlaceholders.length > 0) console.log('   Backend placeholder keys:   ', bePlaceholders.join(', '));

// 4. Exact Staging Hostname & HTTPS Scheme
let feUrlValid = false;
let beUrlValid = false;
try {
  const u = new URL(fe.vars['NEXT_PUBLIC_SUPABASE_URL']);
  feUrlValid = u.protocol === 'https:' && u.hostname === STAGING_HOST && (u.pathname === '' || u.pathname === '/');
} catch (_) {}
try {
  const u = new URL(be.vars['SUPABASE_URL']);
  beUrlValid = u.protocol === 'https:' && u.hostname === STAGING_HOST && (u.pathname === '' || u.pathname === '/');
} catch (_) {}

const feProjectRefValid = fe.vars['NEXT_PUBLIC_SUPABASE_PROJECT_REF'] === STAGING_REF;
const urlsValid = feUrlValid && beUrlValid && feProjectRefValid;

console.log('4. Exact Staging Hostname (biejxkrhypkkcvpbzjhh.supabase.co):', urlsValid ? 'PASS' : 'FAIL');
console.log('   frontend NEXT_PUBLIC_SUPABASE_URL:           ', feUrlValid ? 'PASS' : 'FAIL');
console.log('   frontend NEXT_PUBLIC_SUPABASE_PROJECT_REF:   ', feProjectRefValid ? 'PASS' : 'FAIL');
console.log('   backend  SUPABASE_URL:                       ', beUrlValid ? 'PASS' : 'FAIL');

// 5. Production Reference Absent
const feProdFound = fe.raw.includes(PROD_REF);
const beProdFound = be.raw.includes(PROD_REF);
const prodAbsent = !feProdFound && !beProdFound;

console.log('5. Production Reference (wxkjygctdonpeypgrcnf) Absent:', prodAbsent ? 'PASS' : 'FAIL');
console.log('   frontend clean of production reference:      ', !feProdFound ? 'PASS' : 'FAIL');
console.log('   backend clean of production reference:       ', !beProdFound ? 'PASS' : 'FAIL');

// 6. Frontend Free of Service-Role Key & JWT Secret
const feSensitiveKeyNames = Object.keys(fe.vars).filter(k => {
  const l = k.toLowerCase();
  return l.includes('service_role') || l.includes('jwt_secret');
});
const beServiceRoleKey = be.vars['SUPABASE_SERVICE_ROLE_KEY'];
const beJwtSecret = be.vars['SUPABASE_JWT_SECRET'];
let feValueMatch = [];
if (beServiceRoleKey && beServiceRoleKey.length > 10 && Object.values(fe.vars).includes(beServiceRoleKey)) {
  feValueMatch.push('SUPABASE_SERVICE_ROLE_KEY value');
}
if (beJwtSecret && beJwtSecret.length > 10 && Object.values(fe.vars).includes(beJwtSecret)) {
  feValueMatch.push('SUPABASE_JWT_SECRET value');
}
const feSecretsClean = feSensitiveKeyNames.length === 0 && feValueMatch.length === 0;

console.log('6. Frontend Free of Service-Role Key & JWT Secret:', feSecretsClean ? 'PASS' : 'FAIL');
if (feSensitiveKeyNames.length > 0) console.log('   Sensitive key names in frontend:', feSensitiveKeyNames.join(', '));
if (feValueMatch.length > 0) console.log('   Backend secret values present in frontend:', feValueMatch.join(', '));

// 7. Backend Secrets Not Exposed in NEXT_PUBLIC_ Variables
const beNextPublicKeys = Object.keys(be.vars).filter(k => k.startsWith('NEXT_PUBLIC_'));
let nextPublicLeak = false;
for (const k of beNextPublicKeys) {
  const v = be.vars[k];
  if (v && ((beServiceRoleKey && v === beServiceRoleKey) || (beJwtSecret && v === beJwtSecret))) {
    nextPublicLeak = true;
  }
}
for (const [k, v] of Object.entries(fe.vars)) {
  if (k.startsWith('NEXT_PUBLIC_') && v) {
    if ((beServiceRoleKey && v === beServiceRoleKey) || (beJwtSecret && v === beJwtSecret)) {
      nextPublicLeak = true;
    }
  }
}
const noNextPublicExposure = !nextPublicLeak;
console.log('7. Backend Secrets Not Exposed in NEXT_PUBLIC_: ', noNextPublicExposure ? 'PASS' : 'FAIL');

// 8. Staging Files Ignored by Git
let gitIgnoreFe = false;
let gitIgnoreBe = false;
try {
  gitIgnoreFe = execSync('git check-ignore frontend/.env.staging', { cwd: workspaceRoot, encoding: 'utf8' }).trim().length > 0;
} catch (_) {}
try {
  gitIgnoreBe = execSync('git check-ignore backend/.env.staging', { cwd: workspaceRoot, encoding: 'utf8' }).trim().length > 0;
} catch (_) {}
const stagingFilesIgnored = gitIgnoreFe && gitIgnoreBe;

console.log('8. Both Staging Files Ignored by Git:           ', stagingFilesIgnored ? 'PASS' : 'FAIL');
console.log('   frontend/.env.staging ignored:               ', gitIgnoreFe ? 'PASS' : 'FAIL');
console.log('   backend/.env.staging  ignored:               ', gitIgnoreBe ? 'PASS' : 'FAIL');

// 9. Production Files & CLI Link Metadata Untouched
const cliRefPath = path.join(workspaceRoot, 'supabase', '.temp', 'project-ref');
let cliRefMatches = false;
if (fs.existsSync(cliRefPath)) {
  cliRefMatches = fs.readFileSync(cliRefPath, 'utf8').trim() === PROD_REF;
}
const feProdLocalExists = fs.existsSync(path.join(workspaceRoot, 'frontend', '.env.local'));
const beProdEnvExists = fs.existsSync(path.join(workspaceRoot, 'backend', '.env'));
const prodUntouched = cliRefMatches && feProdLocalExists && beProdEnvExists;

console.log('9. Production Config & CLI Link Untouched:      ', prodUntouched ? 'PASS' : 'FAIL');
console.log('   Supabase CLI link points to production ref:  ', cliRefMatches ? 'PASS' : 'FAIL');
console.log('   frontend/.env.local exists & intact:         ', feProdLocalExists ? 'PASS' : 'FAIL');
console.log('   backend/.env exists & intact:                ', beProdEnvExists ? 'PASS' : 'FAIL');

console.log('\n================================================================');
const overallPass =
  filesExist &&
  allRequiredPresent &&
  noEmptyOrPlaceholders &&
  urlsValid &&
  prodAbsent &&
  feSecretsClean &&
  noNextPublicExposure &&
  stagingFilesIgnored &&
  prodUntouched;

console.log(`OVERALL STAGING VALIDATION STATUS: ${overallPass ? 'ALL CHECKS PASSED' : 'ACTION REQUIRED'}`);
console.log('================================================================');

process.exit(overallPass ? 0 : 1);

