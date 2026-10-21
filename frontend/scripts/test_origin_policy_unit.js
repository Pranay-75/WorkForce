/**
 * Unit Test Suite for Policy Enforcement:
 * 1. Localhost allowed ONLY in development; strictly prohibited in production.
 * 2. Production requires explicitly configured trusted origins.
 * 3. X-Forwarded-Host is NEVER blindly trusted.
 * 4. Next path sanitization prevents XSS and open redirects.
 */

const assert = require('assert');

// Path sanitization logic matching route.ts
const SAFE_RELATIVE_PATH_REGEX = /^\/[a-zA-Z0-9_\-.~/]*(\?[a-zA-Z0-9_\-.~=&%]*)?(#[a-zA-Z0-9_\-.~%]*)?$/;

function sanitizeNextUrl(rawNext) {
  if (!rawNext) return '/onboarding';
  const trimmed = rawNext.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    trimmed.includes('://') ||
    !SAFE_RELATIVE_PATH_REGEX.test(trimmed)
  ) {
    return '/onboarding';
  }
  return trimmed;
}

function getTrustedOrigins(siteUrl, trustedOriginsEnv, isDev) {
  const trusted = new Set();
  if (siteUrl) {
    try {
      trusted.add(new URL(siteUrl).origin);
    } catch (_) {}
  }
  if (trustedOriginsEnv) {
    for (const item of trustedOriginsEnv.split(',')) {
      const trimmed = item.trim();
      if (trimmed) {
        try {
          trusted.add(new URL(trimmed).origin);
        } catch (_) {}
      }
    }
  }
  if (isDev) {
    trusted.add('http://localhost:3000');
    trusted.add('http://127.0.0.1:3000');
    trusted.add('http://[::1]:3000');
  }
  return trusted;
}

function isOriginAllowed(originHeader, refererHeader, siteUrl, trustedOriginsEnv, isDev) {
  let sourceOrigin = null;
  if (originHeader) {
    try {
      sourceOrigin = new URL(originHeader).origin;
    } catch (_) {
      return false;
    }
  } else if (refererHeader) {
    try {
      sourceOrigin = new URL(refererHeader).origin;
    } catch (_) {
      return false;
    }
  }
  if (!sourceOrigin) return false;

  let parsedSource;
  try {
    parsedSource = new URL(sourceOrigin);
  } catch (_) {
    return false;
  }

  // In production, loopback/localhost origins are strictly forbidden
  if (!isDev) {
    const isLoopback =
      parsedSource.hostname === 'localhost' ||
      parsedSource.hostname === '127.0.0.1' ||
      parsedSource.hostname === '[::1]';
    if (isLoopback) return false;
  }

  const trusted = getTrustedOrigins(siteUrl, trustedOriginsEnv, isDev);
  if (trusted.has(sourceOrigin)) return true;

  if (isDev) {
    const isLoopback =
      parsedSource.hostname === 'localhost' ||
      parsedSource.hostname === '127.0.0.1' ||
      parsedSource.hostname === '[::1]';
    if (isLoopback && (parsedSource.protocol === 'http:' || parsedSource.protocol === 'https:')) {
      return true;
    }
  }
  return false;
}

const tests = [];
function record(name, status, evidence) {
  tests.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  console.log(`   ${evidence}`);
}

console.log('================================================================');
console.log(' TRUSTED ORIGIN POLICY & NEXT SANITIZATION UNIT TESTS           ');
console.log('================================================================\n');

// 1. Development: Localhost is allowed
const devLocal = isOriginAllowed('http://localhost:3000', null, null, null, true);
assert.strictEqual(devLocal, true);
record('Development Allows Localhost', 'PASS', 'http://localhost:3000 allowed in dev');

// 2. Production: Localhost is STRICTLY REJECTED
const prodLocal = isOriginAllowed('http://localhost:3000', null, 'https://workforce.company.corp', null, false);
assert.strictEqual(prodLocal, false);
record('Production Rejects Localhost', 'PASS', 'http://localhost:3000 rejected in production');

// 3. Production: 127.0.0.1 is STRICTLY REJECTED
const prodIp = isOriginAllowed('http://127.0.0.1:3000', null, 'https://workforce.company.corp', null, false);
assert.strictEqual(prodIp, false);
record('Production Rejects 127.0.0.1', 'PASS', 'http://127.0.0.1:3000 rejected in production');

// 4. Production: Explicitly configured site URL is allowed
const prodSite = isOriginAllowed('https://workforce.company.corp', null, 'https://workforce.company.corp', null, false);
assert.strictEqual(prodSite, true);
record('Production Allows Configured Site URL', 'PASS', 'https://workforce.company.corp allowed in production');

// 5. Production: Explicitly configured TRUSTED_ORIGINS is allowed
const prodTrusted = isOriginAllowed('https://auth.company.corp', null, 'https://workforce.company.corp', 'https://auth.company.corp,https://app.company.corp', false);
assert.strictEqual(prodTrusted, true);
record('Production Allows Configured TRUSTED_ORIGINS', 'PASS', 'https://auth.company.corp allowed in production');

// 6. Production: Unconfigured origin is rejected
const prodEvil = isOriginAllowed('https://evil.com', null, 'https://workforce.company.corp', null, false);
assert.strictEqual(prodEvil, false);
record('Production Rejects Unconfigured Origin', 'PASS', 'https://evil.com rejected in production');

// 7. Sanitizer: Quotes and script injection neutralized
assert.strictEqual(sanitizeNextUrl("/onboarding'-(alert(1))-'"), '/onboarding');
assert.strictEqual(sanitizeNextUrl('/onboarding"</script><script>alert(1)</script>'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('/onboarding`${alert(1)}`'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('/foo;alert(1)'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('/foo<svg/onload=alert(1)>'), '/onboarding');
record('Sanitizer Neutralizes Quotes, Backticks & Script Characters', 'PASS', 'All XSS vectors sanitized to /onboarding');

// 8. Sanitizer: Open redirects neutralized
assert.strictEqual(sanitizeNextUrl('//evil.com/phish'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('/\\evil.com/phish'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('https://evil.com'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('javascript:alert(1)'), '/onboarding');
record('Sanitizer Neutralizes Open Redirects', 'PASS', 'Scheme-relative, backslash, protocol redirects sanitized to /onboarding');

// 9. Sanitizer: Valid paths preserved
assert.strictEqual(sanitizeNextUrl('/onboarding'), '/onboarding');
assert.strictEqual(sanitizeNextUrl('/dashboard'), '/dashboard');
assert.strictEqual(sanitizeNextUrl('/projects?status=active'), '/projects?status=active');
assert.strictEqual(sanitizeNextUrl('/tasks/123-abc'), '/tasks/123-abc');
record('Sanitizer Preserves Valid Paths', 'PASS', 'Valid relative paths preserved correctly');

console.log('\n================================================================');
console.log(`UNIT POLICY SUMMARY: ${tests.filter(t => t.status === 'PASS').length} PASSED, ${tests.filter(t => t.status === 'FAIL').length} FAILED`);
console.log('================================================================\n');
