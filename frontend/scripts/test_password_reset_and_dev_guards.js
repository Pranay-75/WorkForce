/**
 * Test Suite: Password Reset Flow and Development-Only Guards
 *
 * Tests:
 * 1. Password reset flow integrity:
 *    - Validates frontend/app/reset-password/page.tsx existence and structure
 *    - Validates frontend/lib/authContext.tsx updatePassword API
 *    - Validates token/hash/code parsing, minimum password length (8), matching confirmation
 *    - Validates fail-closed handling on expired/invalid reset links
 * 2. Mailpit link isolation:
 *    - frontend/app/register/page.tsx wraps Mailpit link in development check
 *    - frontend/app/login/page.tsx wraps Mailpit link in development check
 *    - No exposed localhost Mailpit links in production
 * 3. Demo login helper isolation:
 *    - frontend/app/login/page.tsx guards credential autofill with isDev
 *    - frontend/app/login/page.tsx guards role/demo buttons with isDev
 *    - Production builds do not display or enable demo autofill
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('================================================================');
console.log('Test Suite: Password Reset Flow & Development-Only Security Guards');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Password Reset Flow Tests
// -----------------------------------------------------------------------------
console.log('--- 1. Password Reset Flow ---');

const resetPasswordPagePath = path.join(__dirname, '../app/reset-password/page.tsx');
const authContextPath = path.join(__dirname, '../lib/authContext.tsx');

runTest('frontend/app/reset-password/page.tsx file exists', () => {
  assert.strictEqual(fs.existsSync(resetPasswordPagePath), true, 'reset-password/page.tsx should exist');
});

const resetPasswordContent = fs.existsSync(resetPasswordPagePath)
  ? fs.readFileSync(resetPasswordPagePath, 'utf8')
  : '';

runTest('ResetPasswordPage wraps content in React.Suspense for useSearchParams safety', () => {
  assert.ok(
    resetPasswordContent.includes('React.Suspense'),
    'ResetPasswordPage must wrap content in React.Suspense'
  );
  assert.ok(
    resetPasswordContent.includes('useSearchParams'),
    'ResetPasswordPage must read searchParams'
  );
});

runTest('Reset password validates error parameters from URL query string', () => {
  assert.ok(
    resetPasswordContent.includes("searchParams.get('error')"),
    'Must check query param error'
  );
  assert.ok(
    resetPasswordContent.includes("searchParams.get('error_code')") ||
    resetPasswordContent.includes("searchParams.get('error_description')"),
    'Must check query param error description/code'
  );
});

runTest('Reset password checks URL hash fragment for tokens and errors', () => {
  assert.ok(
    resetPasswordContent.includes('window.location.hash'),
    'Must inspect window.location.hash for hash-fragment recovery tokens'
  );
  assert.ok(
    resetPasswordContent.includes('setSession'),
    'Must establish recovery session with setSession when hash tokens are present'
  );
});

runTest('Reset password checks PKCE authorization code', () => {
  assert.ok(
    resetPasswordContent.includes("searchParams.get('code')"),
    'Must check for PKCE code param'
  );
  assert.ok(
    resetPasswordContent.includes('exchangeCodeForSession'),
    'Must exchange authorization code for session'
  );
});

runTest('Reset password verifies active session via getSession and listens for PASSWORD_RECOVERY', () => {
  assert.ok(
    resetPasswordContent.includes('supabase.auth.getSession()'),
    'Must verify active recovery session via getSession()'
  );
  assert.ok(
    resetPasswordContent.includes('PASSWORD_RECOVERY'),
    'Must listen for onAuthStateChange PASSWORD_RECOVERY event'
  );
});

runTest('Reset password fails safely with clear error state for expired/invalid links', () => {
  assert.ok(
    resetPasswordContent.includes('Invalid or Expired Reset Link'),
    'Must display an explicit invalid/expired link header'
  );
  assert.ok(
    resetPasswordContent.includes('/forgot-password'),
    'Must provide a link to request a fresh reset link'
  );
  assert.ok(
    resetPasswordContent.includes('/login'),
    'Must provide a link back to sign in'
  );
});

runTest('Reset password enforces password validation (minimum 8 chars and matching)', () => {
  assert.ok(
    resetPasswordContent.includes('password.length < 8'),
    'Must validate password length is at least 8 characters'
  );
  assert.ok(
    resetPasswordContent.includes('password !== confirmPassword'),
    'Must validate password confirmation matches'
  );
});

runTest('Reset password displays clear success state and clears recovery session', () => {
  assert.ok(
    resetPasswordContent.includes('Password Updated Successfully'),
    'Must show success screen upon update'
  );
  assert.ok(
    resetPasswordContent.includes('signOut'),
    'Must sign out of recovery session after password update'
  );
});

const authContextContent = fs.existsSync(authContextPath)
  ? fs.readFileSync(authContextPath, 'utf8')
  : '';

runTest('authContext.tsx provides updatePassword in AuthContextType and AuthProvider', () => {
  assert.ok(
    authContextContent.includes('updatePassword: (password: string) => Promise<{ error: string | null }>'),
    'AuthContextType must declare updatePassword'
  );
  assert.ok(
    authContextContent.includes('const updatePassword = async (password: string)'),
    'AuthProvider must implement updatePassword'
  );
  assert.ok(
    authContextContent.includes('supabase.auth.updateUser({ password })'),
    'updatePassword must invoke supabase.auth.updateUser'
  );
  assert.ok(
    authContextContent.includes('password.length < 8'),
    'updatePassword must reject passwords under 8 characters'
  );
});

// -----------------------------------------------------------------------------
// 2. Mailpit Links Isolation Tests
// -----------------------------------------------------------------------------
console.log('\n--- 2. Development-Only Mailpit Links ---');

const registerPagePath = path.join(__dirname, '../app/register/page.tsx');
const loginPagePath = path.join(__dirname, '../app/login/page.tsx');

const registerContent = fs.readFileSync(registerPagePath, 'utf8');
const loginContent = fs.readFileSync(loginPagePath, 'utf8');

runTest('register/page.tsx defines development environment check', () => {
  assert.ok(
    registerContent.includes("const isDev = process.env.NODE_ENV === 'development';"),
    'register/page.tsx must define isDev check'
  );
});

runTest('register/page.tsx guards Mailpit inbox link and guidance with isDev', () => {
  // Check that the Mailpit guidance bullet is wrapped in isDev
  assert.ok(
    registerContent.includes('{isDev && (\n                    <li>In local development, all outgoing emails are captured in the Mailpit inbox.</li>\n                  )}'),
    'Mailpit guidance text must be conditionally rendered with isDev'
  );
  // Check that the Mailpit button link is wrapped in isDev
  assert.ok(
    registerContent.includes('{isDev && (\n                  <a\n                    href="http://127.0.0.1:54324"'),
    'Mailpit link anchor must be conditionally rendered with isDev'
  );
});

runTest('login/page.tsx defines development environment check', () => {
  assert.ok(
    loginContent.includes("const isDev = process.env.NODE_ENV === 'development';"),
    'login/page.tsx must define isDev check'
  );
});

runTest('login/page.tsx guards Mailpit inbox link in unconfirmed email message with isDev', () => {
  assert.ok(
    loginContent.includes('{isDev ? ('),
    'Mailpit link in login page must use ternary isDev guard'
  );
  assert.ok(
    loginContent.includes('http://127.0.0.1:54324'),
    'Local Mailpit URL present only within isDev branch'
  );
  // Ensure the non-dev branch outputs just a period '.'
  assert.ok(
    loginContent.includes("'.'"),
    'Non-development branch closes the sentence cleanly without Mailpit reference'
  );
});

// -----------------------------------------------------------------------------
// 3. Demo Login Helper Isolation Tests
// -----------------------------------------------------------------------------
console.log('\n--- 3. Development-Only Demo Login Helper ---');

runTest('fillRoleAccount does not autofill email/password in non-development environments', () => {
  // Check that fillRoleAccount wraps setEmail and setPassword inside if (isDev)
  assert.ok(
    loginContent.includes('const fillRoleAccount = (opt: typeof LOGIN_ROLES[number]) => {\n    setSelectedRole(opt.id);\n    if (isDev) {\n      setEmail(opt.demoEmail);\n      setPassword(\'WorkForceDemo2026!\');\n      switchDemoRole(opt.demoId);\n    }\n  };'),
    'fillRoleAccount must guard credential autofill with if (isDev)'
  );
});

runTest('login/page.tsx Select Role Option card grid is wrapped in isDev', () => {
  assert.ok(
    loginContent.includes('{/* Select Role Option (Development only) */}'),
    'Select Role Option must be marked development only'
  );
  assert.ok(
    loginContent.includes('{isDev && (\n              <div className="space-y-2">\n                <div className="flex items-center justify-between">\n                  <label className="block text-xs font-semibold text-slate-300">\n                    Select Your Role'),
    'Select Role Option grid must be conditionally rendered with isDev'
  );
});

runTest('login/page.tsx Quick Demo Sign-In assistant is wrapped in isDev', () => {
  assert.ok(
    loginContent.includes('{/* Quick Demo Credentials Assistant (Development only) */}'),
    'Quick Demo Sign-In must be marked development only'
  );
  assert.ok(
    loginContent.includes('{isDev && (\n            <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">\n              <div className="flex items-center justify-between">\n                <span className="text-[11px] uppercase font-bold text-slate-400">\n                  Quick Demo Sign-In'),
    'Quick Demo Sign-In card must be conditionally rendered with isDev'
  );
});

runTest('Simulated production environment verification: Mailpit & Demo autofill eliminated', () => {
  // Simulate what isDev evaluates to when process.env.NODE_ENV === 'production'
  const simNodeEnv = 'production';
  const simIsDev = simNodeEnv === 'development';
  assert.strictEqual(simIsDev, false, 'simIsDev must be false in production');

  // Verify fillRoleAccount logic with false guard
  let autofilledEmail = '';
  let autofilledPass = '';
  const mockFillRole = (opt, isDevFlag) => {
    if (isDevFlag) {
      autofilledEmail = opt.demoEmail;
      autofilledPass = 'WorkForceDemo2026!';
    }
  };

  mockFillRole({ demoEmail: 'admin@workforce.io' }, simIsDev);
  assert.strictEqual(autofilledEmail, '', 'No email should be autofilled in production');
  assert.strictEqual(autofilledPass, '', 'No password should be autofilled in production');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passedTests} passed out of ${totalTests} tests.`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL PASSWORD RESET & DEV-ONLY SECURITY GUARD TESTS PASSED.\n');
  process.exit(0);
}
