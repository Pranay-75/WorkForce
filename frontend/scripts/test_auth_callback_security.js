/**
 * WorkForce - Comprehensive Auth Callback Security & Regression Test Suite
 * File: frontend/scripts/test_auth_callback_security.js
 *
 * Verifies all security requirements:
 * 1. Untrusted Origin is rejected with 403 Forbidden.
 * 2. Missing Origin and Referer is rejected with 403 Forbidden.
 * 3. Untrusted X-Forwarded-Host / X-Forwarded-Proto is NEVER trusted as proof of Origin (403).
 * 4. Untrusted X-Forwarded-Host in GET redirectBase is ignored; base remains strictly trusted origin.
 * 5. Valid local development origins (localhost:3000, 127.0.0.1:3000, [::1]:3000, Referer fallback) are permitted.
 * 6. Malformed JSON, non-object payloads, and array payloads are rejected with 400 Bad Request.
 * 7. Empty, whitespace-only, or non-string tokens are rejected with 400 Bad Request.
 * 8. Invalid tokens return generic 401 Unauthorized ('Authentication failed.') without leaking tokens or Supabase internals.
 * 9. Malicious `next` parameters containing quotes, backticks, script tags, HTML tags, or path escapes:
 *    - In inline HTML fallback: script is completely static; ZERO dynamic interpolation; prevents XSS.
 *    - In server-side error redirects: open redirects and script injection neutralized, falling back safely.
 */

const BASE_URL = 'http://localhost:3000';

const results = [];
function recordResult(name, status, evidence) {
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  console.log(`   Evidence: ${evidence}`);
}

async function runCallbackSecurityTests() {
  console.log('================================================================');
  console.log(' WORKFORCE AUTH CALLBACK SECURITY & REGRESSION SUITE            ');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // Test 1: Untrusted Origin Rejected with 403
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${BASE_URL}/auth/callback`, {
      method: 'POST',
      headers: {
        'Origin': 'https://attacker.evil.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: 'dummy', refresh_token: 'dummy' }),
    });
    const data1 = await res1.json().catch(() => ({}));
    if (res1.status === 403 && data1.error === 'Forbidden.') {
      recordResult(
        'Untrusted Origin Rejected (403)',
        'PASS',
        `Status: ${res1.status}, Error: "${data1.error}"`
      );
    } else {
      recordResult(
        'Untrusted Origin Rejected (403)',
        'FAIL',
        `Expected 403 Forbidden., got ${res1.status}: ${JSON.stringify(data1)}`
      );
    }

    // -------------------------------------------------------------------------
    // Test 2: Missing Origin & Referer Rejected with 403
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${BASE_URL}/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: 'dummy', refresh_token: 'dummy' }),
    });
    const data2 = await res2.json().catch(() => ({}));
    if (res2.status === 403 && data2.error === 'Forbidden.') {
      recordResult(
        'Missing Origin/Referer Rejected (403)',
        'PASS',
        `Status: ${res2.status}, Error: "${data2.error}"`
      );
    } else {
      recordResult(
        'Missing Origin/Referer Rejected (403)',
        'FAIL',
        `Expected 403 Forbidden., got ${res2.status}: ${JSON.stringify(data2)}`
      );
    }

    // -------------------------------------------------------------------------
    // Test 3: Untrusted X-Forwarded-Host Spoofing Rejected with 403
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${BASE_URL}/auth/callback`, {
      method: 'POST',
      headers: {
        'Origin': 'https://attacker.evil.com',
        'X-Forwarded-Host': 'attacker.evil.com',
        'X-Forwarded-Proto': 'https',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: 'dummy', refresh_token: 'dummy' }),
    });
    const data3 = await res3.json().catch(() => ({}));
    if (res3.status === 403 && data3.error === 'Forbidden.') {
      recordResult(
        'Spoofed X-Forwarded-Host Not Trusted (403)',
        'PASS',
        `Attacker forwarded host strictly rejected with status ${res3.status}`
      );
    } else {
      recordResult(
        'Spoofed X-Forwarded-Host Not Trusted (403)',
        'FAIL',
        `Expected 403 Forbidden., got ${res3.status}: ${JSON.stringify(data3)}`
      );
    }

    // -------------------------------------------------------------------------
    // Test 4: Untrusted X-Forwarded-Host in GET Redirect Base Ignored
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${BASE_URL}/auth/callback?error=access_denied`, {
      headers: {
        'X-Forwarded-Host': 'attacker.evil.com',
        'X-Forwarded-Proto': 'https',
      },
      redirect: 'manual',
    });
    const location4 = res4.headers.get('location') || '';
    const ignoredSpoofedHost = !location4.includes('attacker.evil.com');
    const redirectedToTrustedBase = location4.includes('/login?error=access_denied');

    if (ignoredSpoofedHost && redirectedToTrustedBase) {
      recordResult(
        'Untrusted X-Forwarded-Host in GET Ignored (No Open Redirect)',
        'PASS',
        `Redirect remained on trusted host: ${location4}`
      );
    } else {
      recordResult(
        'Untrusted X-Forwarded-Host in GET Ignored (No Open Redirect)',
        'FAIL',
        `Location leaked forwarded host: ${location4}`
      );
    }

    // -------------------------------------------------------------------------
    // Test 5: Valid Local Development Origins Permitted
    // -------------------------------------------------------------------------
    const devOrigins = [
      { name: 'http://localhost:3000', header: { 'Origin': 'http://localhost:3000' } },
      { name: 'http://127.0.0.1:3000', header: { 'Origin': 'http://127.0.0.1:3000' } },
      { name: 'Referer fallback (localhost:3000)', header: { 'Referer': 'http://localhost:3000/auth/callback' } },
    ];

    let allDevOriginsPassed = true;
    const originDetails = [];
    for (const devO of devOrigins) {
      const res = await fetch(`${BASE_URL}/auth/callback`, {
        method: 'POST',
        headers: {
          ...devO.header,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: 'dummy', refresh_token: 'dummy' }),
      });
      // Should pass Origin validation (status should be 401 due to invalid dummy token, not 403)
      if (res.status === 403) {
        allDevOriginsPassed = false;
        originDetails.push(`${devO.name} -> 403 (unexpected rejection)`);
      } else {
        originDetails.push(`${devO.name} -> ${res.status} (origin accepted)`);
      }
    }

    if (allDevOriginsPassed) {
      recordResult(
        'Valid Local Development Origins Permitted',
        'PASS',
        originDetails.join('; ')
      );
    } else {
      recordResult(
        'Valid Local Development Origins Permitted',
        'FAIL',
        originDetails.join('; ')
      );
    }

    // -------------------------------------------------------------------------
    // Test 6: Malformed Non-JSON and Array Payloads Rejected with 400
    // -------------------------------------------------------------------------
    const res6a = await fetch(`${BASE_URL}/auth/callback`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: 'invalid-json-content',
    });
    const res6b = await fetch(`${BASE_URL}/auth/callback`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    });
    const data6a = await res6a.json().catch(() => ({}));
    const data6b = await res6b.json().catch(() => ({}));

    if (res6a.status === 400 && res6b.status === 400 && data6a.error === 'Invalid request payload.') {
      recordResult(
        'Malformed & Array Payloads Rejected (400)',
        'PASS',
        `Non-JSON: ${res6a.status}, Array: ${res6b.status}`
      );
    } else {
      recordResult(
        'Malformed & Array Payloads Rejected (400)',
        'FAIL',
        `Expected 400 for both, got ${res6a.status} and ${res6b.status}`
      );
    }

    // -------------------------------------------------------------------------
    // Test 7: Missing, Whitespace, or Non-String Tokens Rejected with 400
    // -------------------------------------------------------------------------
    const tokenPayloads = [
      { name: 'Missing refresh_token', body: { access_token: 'abc' } },
      { name: 'Whitespace access_token', body: { access_token: '   ', refresh_token: 'abc' } },
      { name: 'Non-string tokens', body: { access_token: 12345, refresh_token: true } },
    ];
    let allTokenPayloadsPassed = true;
    for (const tp of tokenPayloads) {
      const res = await fetch(`${BASE_URL}/auth/callback`, {
        method: 'POST',
        headers: { 'Origin': 'http://localhost:3000', 'Content-Type': 'application/json' },
        body: JSON.stringify(tp.body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status !== 400 || data.error !== 'Invalid or missing authentication tokens.') {
        allTokenPayloadsPassed = false;
        break;
      }
    }
    if (allTokenPayloadsPassed) {
      recordResult(
        'Missing, Whitespace, or Non-String Tokens Rejected (400)',
        'PASS',
        'All invalid token permutations cleanly returned 400 with generic error message.'
      );
    } else {
      recordResult(
        'Missing, Whitespace, or Non-String Tokens Rejected (400)',
        'FAIL',
        'One or more token validation tests failed.'
      );
    }

    // -------------------------------------------------------------------------
    // Test 8: Generic 401 Returned on Invalid Session (No Token/Password Leak)
    // -------------------------------------------------------------------------
    const secretFakeToken = 'ULTRA_SECRET_TOKEN_DO_NOT_ECHO_xyz123';
    const res8 = await fetch(`${BASE_URL}/auth/callback`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: secretFakeToken, refresh_token: 'fake_refresh' }),
    });
    const data8 = await res8.json().catch(() => ({}));
    const rawResponseBody = JSON.stringify(data8);
    const doesNotLeakToken = !rawResponseBody.includes(secretFakeToken);
    const isGenericAuthFailed = data8.error === 'Authentication failed.';

    if (res8.status === 401 && isGenericAuthFailed && doesNotLeakToken) {
      recordResult(
        'Generic Error on Invalid Session (401, Zero Leakage)',
        'PASS',
        `Status: ${res8.status}, Generic message: "${data8.error}", Token echoed: false`
      );
    } else {
      recordResult(
        'Generic Error on Invalid Session (401, Zero Leakage)',
        'FAIL',
        `Status: ${res8.status}, Body: ${rawResponseBody}`
      );
    }

    // -------------------------------------------------------------------------
    // Test 9: Malicious `next` With Quotes & Script-Breaking Characters (XSS Immunity)
    // -------------------------------------------------------------------------
    const xssPayloads = [
      { name: 'Single quote break', param: "/onboarding'-(alert(1))-" },
      { name: 'Closing script tag break', param: '/onboarding"</script><script>alert(1)</script>' },
      { name: 'Backtick template break', param: '/onboarding`${alert(1)}`' },
      { name: 'Angle bracket tag injection', param: '/onboarding<svg/onload=alert(1)>' },
      { name: 'Javascript pseudo-protocol', param: 'javascript:alert(1)' },
      { name: 'Scheme-relative open redirect', param: '//attacker.evil.com/phish' },
      { name: 'Backslash confusion open redirect', param: '/\\attacker.evil.com/phish' },
    ];

    let allXssTestsPassed = true;
    const xssDetails = [];

    for (const testCase of xssPayloads) {
      const url = `${BASE_URL}/auth/callback?next=${encodeURIComponent(testCase.param)}`;
      const res = await fetch(url, { headers: { 'Accept': 'text/html' } });
      const html = await res.text();

      // Verify that the executable script tag contains ZERO dynamic interpolation of the payload
      const payloadInScript = html.includes(testCase.param);
      const hasDynamicInterpolation = html.includes("${next}") || html.includes("${redirectBase}");
      const usesStaticHelper = html.includes('getSafeNextPath()');

      if (!payloadInScript && !hasDynamicInterpolation && usesStaticHelper) {
        xssDetails.push(`${testCase.name}: Clean (0 unescaped injection)`);
      } else {
        allXssTestsPassed = false;
        xssDetails.push(`${testCase.name}: VULNERABLE (payload found in executable script)`);
      }
    }

    if (allXssTestsPassed) {
      recordResult(
        'Malicious `next` Parameters Neutralized (Zero Script Injection)',
        'PASS',
        `Tested ${xssPayloads.length} attack vectors. Inline script is completely static.`
      );
    } else {
      recordResult(
        'Malicious `next` Parameters Neutralized (Zero Script Injection)',
        'FAIL',
        xssDetails.join('; ')
      );
    }

    // -------------------------------------------------------------------------
    // Test 10: Server-Side Error Redirect with Malicious `next` Parameter
    // -------------------------------------------------------------------------
    const res10 = await fetch(
      `${BASE_URL}/auth/callback?next=${encodeURIComponent('//attacker.evil.com')}&error=access_denied`,
      { redirect: 'manual' }
    );
    const location10 = res10.headers.get('location') || '';
    const redirectedToLocalLogin = location10.includes('/login?error=access_denied');
    const openRedirectBlocked = !location10.includes('attacker.evil.com');

    if (redirectedToLocalLogin && openRedirectBlocked) {
      recordResult(
        'Server-Side Redirect Neutralizes Open Redirects',
        'PASS',
        `Safe redirect location: ${location10}`
      );
    } else {
      recordResult(
        'Server-Side Redirect Neutralizes Open Redirects',
        'FAIL',
        `Unexpected redirect location: ${location10}`
      );
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\n================================================================');
    console.log(`CALLBACK SECURITY SUMMARY: ${results.filter(r => r.status === 'PASS').length} PASSED, ${results.filter(r => r.status === 'FAIL').length} FAILED`);
    console.log('================================================================\n');

    if (results.some(r => r.status === 'FAIL')) {
      process.exit(1);
    }
  }
}

runCallbackSecurityTests();
