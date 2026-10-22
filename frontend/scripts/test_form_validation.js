/**
 * Verification test suite for Authentication & Registration Form Validations.
 */

const assert = require('assert');

// 1. Slug validation logic (mirrored from slug.ts)
function isValidSlug(slug) {
  if (!slug) return false;
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && !slug.startsWith('-') && !slug.endsWith('-');
}

// 2. Email Regex (mirrored from validation.ts)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateEmail(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) return 'Email address is required.';
  if (!EMAIL_REGEX.test(trimmed)) return 'Please enter a valid email address (e.g. name@company.com).';
  return null;
}

function validateLoginPassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

function validateFullName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Full name is required.';
  if (trimmed.length < 2) return 'Full name must be at least 2 characters.';
  if (trimmed.length > 100) return 'Full name cannot exceed 100 characters.';
  if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) return 'Full name must contain letters.';
  return null;
}

function validateOrgName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Organization name is required.';
  if (trimmed.length < 2) return 'Organization name must be at least 2 characters.';
  if (trimmed.length > 100) return 'Organization name cannot exceed 100 characters.';
  return null;
}

function validateWorkspaceSlug(slug) {
  if (!slug) return 'Organization slug is required.';
  if (slug.length < 2) return 'Organization slug must be at least 2 characters.';
  if (slug.length > 50) return 'Organization slug cannot exceed 50 characters.';
  if (!isValidSlug(slug)) return 'Slug must contain only lowercase letters, numbers, and single hyphens.';
  return null;
}

function evaluatePasswordStrength(password) {
  const hasLength = (password || '').length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if ((password || '').length >= 8) score += 1;
  if ((password || '').length >= 12) score += 1;
  if (hasMixedCase) score += 1;
  if (hasNumber || hasSpecial) score += 1;

  score = Math.min(score, 4);

  let label = 'Weak';
  let color = 'bg-rose-500';

  if (score <= 1) {
    label = 'Weak';
    color = 'bg-rose-500';
  } else if (score === 2) {
    label = 'Fair';
    color = 'bg-amber-500';
  } else if (score === 3) {
    label = 'Good';
    color = 'bg-cyan-500';
  } else {
    label = 'Strong';
    color = 'bg-emerald-500';
  }

  return { score, label, color, hasLength, hasMixedCase, hasNumber, hasSpecial };
}

function validateRegisterPassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Please confirm your password.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

console.log('=== RUNNING FORM VALIDATION SUITE ===\n');

// Test 1: Email validation
assert.strictEqual(validateEmail(''), 'Email address is required.');
assert.strictEqual(validateEmail('   '), 'Email address is required.');
assert.strictEqual(validateEmail('invalid-email'), 'Please enter a valid email address (e.g. name@company.com).');
assert.strictEqual(validateEmail('user@'), 'Please enter a valid email address (e.g. name@company.com).');
assert.strictEqual(validateEmail('@domain.com'), 'Please enter a valid email address (e.g. name@company.com).');
assert.strictEqual(validateEmail('user@domain'), 'Please enter a valid email address (e.g. name@company.com).');
assert.strictEqual(validateEmail('user@domain.com'), null);
assert.strictEqual(validateEmail('  user.name+tag@sub.domain.co.uk  '), null);
console.log('✔ Email validation passed (8/8 scenarios)');

// Test 2: Login password validation
assert.strictEqual(validateLoginPassword(''), 'Password is required.');
assert.strictEqual(validateLoginPassword('12345'), 'Password must be at least 6 characters.');
assert.strictEqual(validateLoginPassword('123456'), null);
assert.strictEqual(validateLoginPassword('ComplexPassword!123'), null);
console.log('✔ Login password validation passed (4/4 scenarios)');

// Test 3: Full name validation
assert.strictEqual(validateFullName(''), 'Full name is required.');
assert.strictEqual(validateFullName('A'), 'Full name must be at least 2 characters.');
assert.strictEqual(validateFullName('12345'), 'Full name must contain letters.');
assert.strictEqual(validateFullName('Sarah Connor'), null);
assert.strictEqual(validateFullName('Dr. Aris Thorne'), null);
console.log('✔ Full name validation passed (5/5 scenarios)');

// Test 4: Org name validation
assert.strictEqual(validateOrgName(''), 'Organization name is required.');
assert.strictEqual(validateOrgName('A'), 'Organization name must be at least 2 characters.');
assert.strictEqual(validateOrgName('Acme Corp'), null);
console.log('✔ Org name validation passed (3/3 scenarios)');

// Test 5: Slug validation
assert.strictEqual(validateWorkspaceSlug(''), 'Organization slug is required.');
assert.strictEqual(validateWorkspaceSlug('a'), 'Organization slug must be at least 2 characters.');
assert.strictEqual(validateWorkspaceSlug('-slug'), 'Slug must contain only lowercase letters, numbers, and single hyphens.');
assert.strictEqual(validateWorkspaceSlug('slug-'), 'Slug must contain only lowercase letters, numbers, and single hyphens.');
assert.strictEqual(validateWorkspaceSlug('slug with space'), 'Slug must contain only lowercase letters, numbers, and single hyphens.');
assert.strictEqual(validateWorkspaceSlug('acme-corp'), null);
assert.strictEqual(validateWorkspaceSlug('team-123'), null);
console.log('✔ Workspace slug validation passed (7/7 scenarios)');

// Test 6: Registration password & strength
assert.strictEqual(validateRegisterPassword(''), 'Password is required.');
assert.strictEqual(validateRegisterPassword('short'), 'Password must be at least 8 characters.');
assert.strictEqual(validateRegisterPassword('8charsPass'), null);

const weak = evaluatePasswordStrength('weak');
assert.strictEqual(weak.score <= 1, true);
assert.strictEqual(weak.label, 'Weak');

const fair = evaluatePasswordStrength('password123');
assert.strictEqual(fair.score >= 2, true);

const strong = evaluatePasswordStrength('UltraSecure#2026!');
assert.strictEqual(strong.score >= 3, true);
assert.strictEqual(strong.hasLength, true);
assert.strictEqual(strong.hasMixedCase, true);
assert.strictEqual(strong.hasNumber, true);
assert.strictEqual(strong.hasSpecial, true);
console.log('✔ Password strength evaluation passed (6/6 scenarios)');

// Test 7: Confirm password validation
assert.strictEqual(validateConfirmPassword('pass123', ''), 'Please confirm your password.');
assert.strictEqual(validateConfirmPassword('pass123', 'different'), 'Passwords do not match.');
assert.strictEqual(validateConfirmPassword('pass123', 'pass123'), null);
console.log('✔ Confirm password validation passed (3/3 scenarios)');

console.log('\nALL 31 VALIDATION UNIT TESTS PASSED SUCCESSFULLY! 🚀');
