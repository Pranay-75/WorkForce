#!/usr/bin/env node
/**
 * Workforce Safe Staging Environment Loader
 * Usage:
 *   node scripts/run_with_env.js [envFilePath] <command> [args...]
 * Examples:
 *   node scripts/run_with_env.js .env.staging next dev
 *   node scripts/run_with_env.js .env.staging next build
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envFileArg = process.argv[2] || '.env.staging';
const command = process.argv[3];
const commandArgs = process.argv.slice(4);

if (!command) {
  console.error('Usage: node scripts/run_with_env.js [envFilePath] <command> [args...]');
  process.exit(1);
}

const envFilePath = path.isAbsolute(envFileArg)
  ? envFileArg
  : path.resolve(process.cwd(), envFileArg);

if (!fs.existsSync(envFilePath)) {
  console.error(`❌ [ERROR] Environment file not found: ${envFilePath}`);
  process.exit(1);
}

// Parse env file into key-value map
const content = fs.readFileSync(envFilePath, 'utf8');
const envVars = {};
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
});

// Guard: If staging mode, enforce strict isolation and prerequisite validation
const isStaging =
  envFileArg.includes('staging') ||
  envVars.ENVIRONMENT === 'staging' ||
  envVars.NEXT_PUBLIC_ENVIRONMENT === 'staging';

if (isStaging) {
  const prodRef = 'wxkjygctdonpeypgrcnf';
  const stagingRef = 'biejxkrhypkkcvpbzjhh';
  const stagingHost = 'biejxkrhypkkcvpbzjhh.supabase.co';

  // 1. Production Reference Rejection: verify NO variable contains the production project ref
  for (const [key, val] of Object.entries(envVars)) {
    if (typeof val === 'string' && val.toLowerCase().includes(prodRef)) {
      console.error(`⛔ [CRITICAL SAFETY VIOLATION] Staging variable '${key}' contains PRODUCTION project reference: ${prodRef}`);
      process.exit(1);
    }
  }

  // 2. Required staging variable presence & placeholder check
  const REQUIRED_STAGING_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PROJECT_REF',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_ENVIRONMENT'
  ];

  const missingVars = [];
  const placeholderVars = [];

  for (const varName of REQUIRED_STAGING_VARS) {
    const val = envVars[varName];
    if (!val || val.trim() === '') {
      missingVars.push(varName);
    } else if (val.toLowerCase().includes('placeholder')) {
      placeholderVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.error(`❌ [STAGING CONFIGURATION ERROR] Missing required staging variable(s): ${missingVars.join(', ')}`);
    process.exit(1);
  }

  if (placeholderVars.length > 0) {
    console.error(`❌ [STAGING CONFIGURATION ERROR] Required staging variable(s) contain unconfigured placeholders: ${placeholderVars.join(', ')}`);
    process.exit(1);
  }

  // 3. Exact Staging Project Reference Verification
  if (envVars.NEXT_PUBLIC_SUPABASE_PROJECT_REF !== stagingRef) {
    console.error(`⛔ [STAGING MISCONFIGURATION] NEXT_PUBLIC_SUPABASE_PROJECT_REF must be '${stagingRef}'. Found: '${envVars.NEXT_PUBLIC_SUPABASE_PROJECT_REF}'`);
    process.exit(1);
  }

  // 4. Exact Staging URL Parsing & Verification
  let parsedUrl;
  try {
    parsedUrl = new URL(envVars.NEXT_PUBLIC_SUPABASE_URL);
  } catch (err) {
    console.error(`⛔ [MALFORMED SUPABASE_URL] Invalid URL format for NEXT_PUBLIC_SUPABASE_URL: '${envVars.NEXT_PUBLIC_SUPABASE_URL}'`);
    process.exit(1);
  }

  if (parsedUrl.protocol !== 'https:') {
    console.error(`⛔ [STAGING MISCONFIGURATION] NEXT_PUBLIC_SUPABASE_URL must use HTTPS protocol. Found: '${parsedUrl.protocol}'`);
    process.exit(1);
  }

  if (parsedUrl.username || parsedUrl.password) {
    console.error(`⛔ [SECURITY VIOLATION] Userinfo embedded in NEXT_PUBLIC_SUPABASE_URL is prohibited: '${envVars.NEXT_PUBLIC_SUPABASE_URL}'`);
    process.exit(1);
  }

  if (parsedUrl.hostname !== stagingHost) {
    console.error(`⛔ [STAGING MISCONFIGURATION] NEXT_PUBLIC_SUPABASE_URL hostname must be '${stagingHost}'. Found: '${parsedUrl.hostname}'`);
    process.exit(1);
  }

  if (parsedUrl.search) {
    console.error(`⛔ [SECURITY VIOLATION] Query parameters in NEXT_PUBLIC_SUPABASE_URL are prohibited: '${envVars.NEXT_PUBLIC_SUPABASE_URL}'`);
    process.exit(1);
  }

  if (parsedUrl.pathname !== '' && parsedUrl.pathname !== '/') {
    console.error(`⛔ [SECURITY VIOLATION] Non-root path in NEXT_PUBLIC_SUPABASE_URL is prohibited: '${parsedUrl.pathname}'`);
    process.exit(1);
  }

  // Safe logging: log status and length, never print secret keys or tokens
  console.log(`🛡️  [STAGING RUNTIME GUARD] Isolated staging configuration verified:`);
  console.log(`   - Project Reference: ${stagingRef}`);
  console.log(`   - Target URL:        ${envVars.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`   - Environment:       ${envVars.NEXT_PUBLIC_ENVIRONMENT}`);
  console.log(`   - Anon Key:          Configured (${envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)`);
  console.log(`   - Publishable Key:   Configured (${envVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length} chars)`);
}

const isWin = process.platform === 'win32';
let execPath = command;

if (command === 'next') {
  const localNext = path.resolve(__dirname, '..', 'node_modules', '.bin', isWin ? 'next.cmd' : 'next');
  if (fs.existsSync(localNext)) {
    execPath = localNext;
  }
}

// Guarantee: Export parsed staging variables into process.env before Next.js initializes
// This prevents Next.js @next/env from falling back to frontend/.env.local for Supabase credentials
const mergedEnv = { ...process.env, ...envVars };

const child = spawn(execPath, commandArgs, {
  stdio: 'inherit',
  shell: isWin,
  env: mergedEnv
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});
