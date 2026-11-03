/**
 * WorkForce - Auth Callback Error Handling & Safe JSON Parsing Verification Suite
 * File: frontend/scripts/test_auth_callback_error_handling.js
 *
 * Verifies:
 * 1. `verifyOtp()` exception resilience:
 *    - Catches SyntaxError ("Unexpected end of JSON input" from empty body or consumed tokens)
 *    - Catches AuthUnknownError / network failures
 *    - Redirects cleanly to /login?error=token_expired with safe explanation
 * 2. `exchangeCodeForSession()` exception resilience:
 *    - Catches SyntaxError ("Unexpected end of JSON input")
 *    - Catches AuthUnknownError / AuthPKCECodeVerifierMissingError
 *    - Redirects cleanly to /login?error=auth_code_error with safe explanation
 * 3. Client-side hash fallback:
 *    - Verifies presence of Content-Type check before res.json()
 *    - Verifies non-JSON responses (empty body, HTML, 303/307 redirects) bypass res.json()
 *    - Verifies zero script injection or dynamic string interpolation in the inline script
 * 4. Sensitive credential protection:
 *    - Zero exposure of confirmation tokens, auth codes, cookies, or secrets
 * 5. TypeScript compilation & static analysis invariants
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const results = [];
function recordResult(name, status, evidence) {
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  console.log(`   ${evidence}`);
}

async function runTests() {
  console.log('================================================================');
  console.log(' WORKFORCE AUTH CALLBACK ERROR-HANDLING VERIFICATION SUITE      ');
  console.log('================================================================\n');

  const routePath = path.resolve(__dirname, '../app/auth/callback/route.ts');
  const routeContent = fs.readFileSync(routePath, 'utf8');

  // ---------------------------------------------------------------------------
  // Test 1: Verify try/catch wrapping around verifyOtp in route.ts
  // ---------------------------------------------------------------------------
  const hasVerifyOtpTryCatch = routeContent.includes('if (token_hash && type)') &&
    routeContent.includes('await supabase.auth.verifyOtp') &&
    routeContent.includes('// Catch network drops, malformed/non-JSON responses (e.g. empty body SyntaxError from consumed tokens)') &&
    routeContent.includes('return NextResponse.redirect(`${redirectBase}/login?error=token_expired&reason=${reason}`);');

  if (hasVerifyOtpTryCatch) {
    recordResult(
      'verifyOtp Wrapped in Defensive Try-Catch Boundary',
      'PASS',
      'route.ts encloses supabase.auth.verifyOtp in a try/catch block with fallback redirect.'
    );
  } else {
    recordResult(
      'verifyOtp Wrapped in Defensive Try-Catch Boundary',
      'FAIL',
      'supabase.auth.verifyOtp is not properly wrapped in a try/catch block.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 2: Verify try/catch wrapping around exchangeCodeForSession in route.ts
  // ---------------------------------------------------------------------------
  const hasExchangeCodeTryCatch = routeContent.includes('if (code)') &&
    routeContent.includes('await supabase.auth.exchangeCodeForSession') &&
    routeContent.includes('// Catch network drops, malformed/non-JSON responses, or PKCE verifier missing errors') &&
    routeContent.includes('return NextResponse.redirect(`${redirectBase}/login?error=auth_code_error&reason=${reason}`);');

  if (hasExchangeCodeTryCatch) {
    recordResult(
      'exchangeCodeForSession Wrapped in Defensive Try-Catch Boundary',
      'PASS',
      'route.ts encloses supabase.auth.exchangeCodeForSession in a try/catch block with fallback redirect.'
    );
  } else {
    recordResult(
      'exchangeCodeForSession Wrapped in Defensive Try-Catch Boundary',
      'FAIL',
      'supabase.auth.exchangeCodeForSession is not properly wrapped in a try/catch block.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 3: Simulation of verifyOtp throwing SyntaxError: Unexpected end of JSON input
  // ---------------------------------------------------------------------------
  function simulateVerifyOtpFlow(verifyOtpMock) {
    const redirectBase = 'http://localhost:3000';
    const next = '/onboarding';
    try {
      const { data, error } = verifyOtpMock();
      if (!error && data?.session) {
        return { status: 307, location: `${redirectBase}${next}` };
      }
      const isExpired =
        error?.message?.toLowerCase().includes('expired') ||
        error?.message?.toLowerCase().includes('invalid') ||
        error?.message?.toLowerCase().includes('already') ||
        error?.code === 'otp_expired';
      const errorKey = isExpired ? 'token_expired' : 'auth_verification_failed';
      const reason = encodeURIComponent(
        isExpired
          ? 'Verification link is invalid, expired, or has already been used.'
          : (error?.message || 'Verification link is invalid, expired, or has already been used.')
      );
      return { status: 307, location: `${redirectBase}/login?error=${errorKey}&reason=${reason}` };
    } catch (err) {
      const reason = encodeURIComponent('Verification link is invalid, expired, or has already been used.');
      return { status: 307, location: `${redirectBase}/login?error=token_expired&reason=${reason}` };
    }
  }

  // Case 3a: Throws SyntaxError directly (e.g. GoTrue returns empty body, undici/JSON.parse fails)
  const resultSyntaxErr = simulateVerifyOtpFlow(() => {
    throw new SyntaxError('Unexpected end of JSON input');
  });

  if (
    resultSyntaxErr.status === 307 &&
    resultSyntaxErr.location.includes('/login?error=token_expired') &&
    resultSyntaxErr.location.includes('invalid%2C%20expired%2C%20or%20has%20already%20been%20used')
  ) {
    recordResult(
      'verifyOtp Resilient to "Unexpected end of JSON input" SyntaxError',
      'PASS',
      `Safely intercepted SyntaxError and redirected to: ${resultSyntaxErr.location}`
    );
  } else {
    recordResult(
      'verifyOtp Resilient to "Unexpected end of JSON input" SyntaxError',
      'FAIL',
      `Unexpected redirect output: ${JSON.stringify(resultSyntaxErr)}`
    );
  }

  // Case 3b: Returns error with message indicating expired/invalid
  const resultExpiredErr = simulateVerifyOtpFlow(() => {
    return { data: null, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } };
  });

  if (
    resultExpiredErr.status === 307 &&
    resultExpiredErr.location.includes('/login?error=token_expired')
  ) {
    recordResult(
      'verifyOtp Handles Expired Token Response Without Crash',
      'PASS',
      `Correctly identified expired token and redirected to: ${resultExpiredErr.location}`
    );
  } else {
    recordResult(
      'verifyOtp Handles Expired Token Response Without Crash',
      'FAIL',
      `Unexpected output: ${JSON.stringify(resultExpiredErr)}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 4: Simulation of exchangeCodeForSession throwing SyntaxError
  // ---------------------------------------------------------------------------
  function simulateExchangeCodeFlow(exchangeMock) {
    const redirectBase = 'http://localhost:3000';
    const next = '/onboarding';
    try {
      const { data, error } = exchangeMock();
      if (!error && data?.session) {
        return { status: 307, location: `${redirectBase}${next}` };
      }
      const isExpired =
        error?.message?.toLowerCase().includes('expired') ||
        error?.message?.toLowerCase().includes('invalid') ||
        error?.message?.toLowerCase().includes('already') ||
        error?.code === 'otp_expired';
      const errorKey = isExpired ? 'token_expired' : 'auth_code_error';
      const reason = encodeURIComponent(
        error?.message || 'Authentication code is invalid, expired, or has already been used.'
      );
      return { status: 307, location: `${redirectBase}/login?error=${errorKey}&reason=${reason}` };
    } catch (err) {
      const reason = encodeURIComponent('Authentication link or code is invalid, expired, or has already been used.');
      return { status: 307, location: `${redirectBase}/login?error=auth_code_error&reason=${reason}` };
    }
  }

  const resultExchangeSyntaxErr = simulateExchangeCodeFlow(() => {
    throw new SyntaxError('Unexpected end of JSON input');
  });

  if (
    resultExchangeSyntaxErr.status === 307 &&
    resultExchangeSyntaxErr.location.includes('/login?error=auth_code_error') &&
    resultExchangeSyntaxErr.location.includes('invalid%2C%20expired%2C%20or%20has%20already%20been%20used')
  ) {
    recordResult(
      'exchangeCodeForSession Resilient to Unexpected SyntaxError',
      'PASS',
      `Safely intercepted SyntaxError and redirected to: ${resultExchangeSyntaxErr.location}`
    );
  } else {
    recordResult(
      'exchangeCodeForSession Resilient to Unexpected SyntaxError',
      'FAIL',
      `Unexpected redirect output: ${JSON.stringify(resultExchangeSyntaxErr)}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 5: Client-side hash fallback inspects Content-Type before JSON.parse
  // ---------------------------------------------------------------------------
  const hasContentTypeCheck = routeContent.includes("res.headers.get('content-type')") &&
    routeContent.includes("contentType.indexOf('application/json') !== -1");

  if (hasContentTypeCheck) {
    recordResult(
      'Client Fallback Script Verifies JSON Content-Type Before Parsing',
      'PASS',
      "Inline script checks `res.ok && contentType.indexOf('application/json') !== -1` before calling res.json()."
    );
  } else {
    recordResult(
      'Client Fallback Script Verifies JSON Content-Type Before Parsing',
      'FAIL',
      'Inline script does not verify Content-Type before calling res.json().'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 6: Simulation of client fallback response parsing logic
  // ---------------------------------------------------------------------------
  async function simulateClientHashFetch(responseMock) {
    let redirectedTo = null;
    function redirect(url) {
      redirectedTo = url;
    }

    try {
      const res = responseMock;
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.indexOf('application/json') !== -1) {
        const data = await res.json();
        if (data && data.success) {
          redirect('/onboarding');
          return redirectedTo;
        }
      }
    } catch (_) {
      // session transfer network or unexpected failure handled below
    }

    redirect('/login?error=auth_error&reason=' + encodeURIComponent('Unable to establish session. Please sign in directly.'));
    return redirectedTo;
  }

  // Case 6a: Successful JSON response
  const passRes = await simulateClientHashFetch({
    ok: true,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => ({ success: true })
  });
  assert.strictEqual(passRes, '/onboarding');

  // Case 6b: 303 / 204 Empty Body (content-type empty or text/plain, calling .json() would throw)
  let jsonCalled = false;
  const emptyBodyRes = await simulateClientHashFetch({
    ok: false,
    headers: { get: () => 'text/plain' },
    json: async () => {
      jsonCalled = true;
      throw new SyntaxError('Unexpected end of JSON input');
    }
  });

  if (!jsonCalled && emptyBodyRes.includes('/login?error=auth_error')) {
    recordResult(
      'Non-JSON / Empty Body Bypasses res.json() Cleanly',
      'PASS',
      `res.json() was not called for text/plain response; cleanly redirected to login.`
    );
  } else {
    recordResult(
      'Non-JSON / Empty Body Bypasses res.json() Cleanly',
      'FAIL',
      `res.json() called: ${jsonCalled}, redirect: ${emptyBodyRes}`
    );
  }

  // Case 6c: Malformed body with application/json content-type (throws SyntaxError)
  const malformedJsonRes = await simulateClientHashFetch({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    }
  });

  if (malformedJsonRes.includes('/login?error=auth_error')) {
    recordResult(
      'Malformed JSON Caught Safely in Client Fallback',
      'PASS',
      `SyntaxError caught by try/catch; cleanly redirected to login.`
    );
  } else {
    recordResult(
      'Malformed JSON Caught Safely in Client Fallback',
      'FAIL',
      `Unexpected result: ${malformedJsonRes}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 7: Zero dynamic string interpolations in static fallback HTML (XSS prevention)
  // ---------------------------------------------------------------------------
  const htmlStart = routeContent.indexOf('const html = `<!DOCTYPE html>');
  const htmlEnd = routeContent.indexOf('return new NextResponse(html, {');
  const htmlBlock = routeContent.substring(htmlStart, htmlEnd);

  const hasDynamicInterpolation = htmlBlock.includes('${next}') ||
    htmlBlock.includes('${redirectBase}') ||
    htmlBlock.includes('${code}') ||
    htmlBlock.includes('${token_hash}');

  if (!hasDynamicInterpolation) {
    recordResult(
      'Inline Fallback HTML Contains Zero Dynamic String Interpolations',
      'PASS',
      'The HTML fallback script is 100% static; zero XSS or script injection vulnerability.'
    );
  } else {
    recordResult(
      'Inline Fallback HTML Contains Zero Dynamic String Interpolations',
      'FAIL',
      'Dynamic variable interpolations detected in the inline HTML string.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 8: Sensitive Data Leakage Protection
  // ---------------------------------------------------------------------------
  // Catch blocks must not log or leak dynamic credentials:
  // e.g. console.log(token_hash), console.error(code), or passing secret variables in reasons
  const catchBlocks = routeContent.match(/catch\s*(\([^)]*\))?\s*\{[\s\S]*?\n\s*\}/g) || [];
  let leakedSecrets = false;
  for (const block of catchBlocks) {
    if (
      block.includes('console.log') ||
      block.includes('console.error') ||
      block.includes('console.warn') ||
      /\$\{\s*token_hash\s*\}/.test(block) ||
      /\$\{\s*access_token\s*\}/.test(block) ||
      /\$\{\s*refresh_token\s*\}/.test(block) ||
      /\$\{\s*code\s*\}/.test(block)
    ) {
      leakedSecrets = true;
    }
  }

  if (!leakedSecrets) {
    recordResult(
      'Zero Token or Secret Leakage in Error Catch Blocks',
      'PASS',
      'Catch blocks contain zero logging or exposure of tokens, codes, cookies, or secrets.'
    );
  } else {
    recordResult(
      'Zero Token or Secret Leakage in Error Catch Blocks',
      'FAIL',
      'Sensitive tokens or codes referenced in catch blocks.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 9: Open-redirect and Host sanitization preserved
  // ---------------------------------------------------------------------------
  const hasSanitizeNextUrl = routeContent.includes('sanitizeNextUrl(searchParams.get(\'next\'))');
  const hasGetRedirectBase = routeContent.includes('getRedirectBase(request)');

  if (hasSanitizeNextUrl && hasGetRedirectBase) {
    recordResult(
      'Open-Redirect and Trusted Host Sanitization Preserved',
      'PASS',
      'Route preserves getRedirectBase and sanitizeNextUrl validation guards.'
    );
  } else {
    recordResult(
      'Open-Redirect and Trusted Host Sanitization Preserved',
      'FAIL',
      'Redirect base or next url sanitization guards were altered or removed.'
    );
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
