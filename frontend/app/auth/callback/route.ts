import { NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Validates and sanitizes the `next` redirect path.
 * Guarantees:
 * - Must start with exactly one '/'
 * - Cannot start with '//' (prevents scheme-relative open redirects)
 * - Cannot contain backslashes '\' (prevents browser path confusion open redirects)
 * - Cannot contain '://' or control characters
 * - Cannot contain quotes (', ", `), angle brackets (<, >), semicolons, or whitespace (prevents script injection)
 * - Must match safe relative URL path pattern: /path?query#hash
 * - Fallback is always '/onboarding'
 */
const SAFE_RELATIVE_PATH_REGEX = /^\/[a-zA-Z0-9_\-.~/]*(\?[a-zA-Z0-9_\-.~=&%]*)?(#[a-zA-Z0-9_\-.~%]*)?$/;

function sanitizeNextUrl(rawNext: string | null): string {
  if (!rawNext) {
    return '/onboarding';
  }
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

/**
 * Retrieves the set of explicitly trusted origins according to environment policy.
 * - In production: localhost is strictly forbidden; origins MUST be explicitly configured
 *   via NEXT_PUBLIC_SITE_URL or TRUSTED_ORIGINS.
 * - In development: standard local loopback addresses (localhost:3000, 127.0.0.1:3000, [::1]:3000)
 *   are permitted.
 */
function getTrustedOrigins(request: Request): Set<string> {
  const trusted = new Set<string>();
  const isDev = process.env.NODE_ENV === 'development';

  // Configured site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      trusted.add(new URL(siteUrl).origin);
    } catch {
      // ignore invalid URL
    }
  }

  // Explicitly configured trusted origins list (comma-separated)
  const trustedList = process.env.TRUSTED_ORIGINS;
  if (trustedList) {
    for (const item of trustedList.split(',')) {
      const trimmed = item.trim();
      if (trimmed) {
        try {
          trusted.add(new URL(trimmed).origin);
        } catch {
          // ignore invalid URL
        }
      }
    }
  }

  // Localhost origins are strictly allowed ONLY in development
  if (isDev) {
    trusted.add('http://localhost:3000');
    trusted.add('http://127.0.0.1:3000');
    trusted.add('http://[::1]:3000');
    try {
      const reqUrl = new URL(request.url);
      if (
        reqUrl.hostname === 'localhost' ||
        reqUrl.hostname === '127.0.0.1' ||
        reqUrl.hostname === '[::1]'
      ) {
        trusted.add(reqUrl.origin);
      }
    } catch {
      // ignore invalid request URL
    }
  }

  return trusted;
}

/**
 * Validates whether the incoming POST request originates from a trusted origin.
 * Reverse-proxy headers (X-Forwarded-Host) are NEVER blindly trusted as proof of origin.
 */
function isAllowedOrigin(request: Request): boolean {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  let sourceOrigin: string | null = null;
  if (originHeader) {
    try {
      sourceOrigin = new URL(originHeader).origin;
    } catch {
      return false;
    }
  } else if (refererHeader) {
    try {
      sourceOrigin = new URL(refererHeader).origin;
    } catch {
      return false;
    }
  }

  // Browser-only endpoint: reject if neither Origin nor Referer is provided
  if (!sourceOrigin) {
    return false;
  }

  const isDev = process.env.NODE_ENV === 'development';
  let parsedSource: URL;
  try {
    parsedSource = new URL(sourceOrigin);
  } catch {
    return false;
  }

  // In production, loopback / localhost origins are strictly forbidden
  if (!isDev) {
    const isLoopback =
      parsedSource.hostname === 'localhost' ||
      parsedSource.hostname === '127.0.0.1' ||
      parsedSource.hostname === '[::1]';
    if (isLoopback) {
      return false;
    }
  }

  // Check against the policy-defined trusted origins
  const trustedOrigins = getTrustedOrigins(request);
  if (trustedOrigins.has(sourceOrigin)) {
    return true;
  }

  // In development, also allow any local loopback origin on any port
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

/**
 * Derives a verified redirect base origin.
 * Does NOT blindly trust X-Forwarded-Host: in production, candidate forwarded hosts
 * must match an explicitly configured trusted origin.
 */
function getRedirectBase(request: Request): string {
  const isDev = process.env.NODE_ENV === 'development';
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = 'http://localhost:3000';
  }

  // In development, use the local request origin
  if (isDev) {
    return requestOrigin;
  }

  // In production, prioritize configured site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      // ignore
    }
  }

  // In production, only trust X-Forwarded-Host if it matches an explicitly configured trusted origin
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const candidate = `${forwardedProto}://${forwardedHost}`;
    const trusted = getTrustedOrigins(request);
    if (trusted.has(candidate)) {
      return candidate;
    }
  }

  return requestOrigin;
}

export async function POST(request: Request) {
  // Validate Origin / same-origin for browser-only POST endpoint
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const { access_token, refresh_token } = body as Record<string, unknown>;

  if (
    typeof access_token !== 'string' ||
    typeof refresh_token !== 'string' ||
    access_token.trim().length === 0 ||
    refresh_token.trim().length === 0
  ) {
    return NextResponse.json(
      { error: 'Invalid or missing authentication tokens.' },
      { status: 400 }
    );
  }

  try {
    const response = NextResponse.json({ success: true });
    const supabase = await createClient(response);
    const { data, error } = await supabase.auth.setSession({
      access_token: access_token.trim(),
      refresh_token: refresh_token.trim(),
    });

    if (error || !data?.session) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while establishing the session.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  // Direct error params forwarded by Supabase Auth (e.g., expired token before redirect)
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDesc = searchParams.get('error_description');

  // Sanitize next parameter against open redirects and script injection
  const next = sanitizeNextUrl(searchParams.get('next'));

  // Determine verified base host without trusting arbitrary reverse-proxy headers
  const redirectBase = getRedirectBase(request);

  // If Supabase forwarded an error directly in the query parameters
  if (errorParam || errorCode) {
    const errorType = errorCode === 'otp_expired' ? 'token_expired' : (errorCode || errorParam || 'auth_error');
    const reason = encodeURIComponent(errorDesc || 'Email link is invalid or has expired.');
    return NextResponse.redirect(`${redirectBase}/login?error=${errorType}&reason=${reason}`);
  }

  // 1. Mobile & Cross-device email confirmation flow: token_hash + type
  // This does NOT require PKCE session cookies from the originating browser,
  // making it 100% reliable when clicking confirmation links on mobile devices.
  if (token_hash && type) {
    const redirectResponse = NextResponse.redirect(`${redirectBase}${next}`);
    const supabase = await createClient(redirectResponse);
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data?.session) {
      return redirectResponse;
    }

    const isExpired = error?.message?.toLowerCase().includes('expired') || error?.code === 'otp_expired';
    const errorKey = isExpired ? 'token_expired' : 'auth_verification_failed';
    const reason = encodeURIComponent(error?.message || 'Verification token is invalid or expired.');
    return NextResponse.redirect(`${redirectBase}/login?error=${errorKey}&reason=${reason}`);
  }

  // 2. PKCE code exchange flow: single browser context
  if (code) {
    const redirectResponse = NextResponse.redirect(`${redirectBase}${next}`);
    const supabase = await createClient(redirectResponse);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session) {
      return redirectResponse;
    }

    const reason = encodeURIComponent(
      error?.message || 'Authentication code exchange failed. Please sign in directly or request a fresh link.'
    );
    return NextResponse.redirect(`${redirectBase}/login?error=auth_code_error&reason=${reason}`);
  }

  // 3. Client-side fallback for implicit hash flow (#access_token=...):
  // When Supabase Auth redirects from /auth/v1/verify, tokens are passed in the URL hash fragment
  // which is never sent to the server. We serve a lightweight, completely static client page that
  // transfers the session into Supabase client cookies and forwards to the target destination.
  // CRITICAL: The inline script contains ZERO dynamic string interpolations to prevent XSS / script injection.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verifying Authentication...</title>
  <style>
    body { background: #030712; color: #f9fafb; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #8b5cf6; border-radius: 50%; width: 36px; height: 36px; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <div style="font-size: 14px; color: #94a3b8;">Verifying your account session...</div>
  </div>
  <script>
    function getSafeNextPath() {
      try {
        var searchParams = new URLSearchParams(window.location.search);
        var rawNext = searchParams.get('next');
        if (
          rawNext &&
          rawNext.charAt(0) === '/' &&
          rawNext.indexOf('//') !== 0 &&
          rawNext.indexOf('\\\\') === -1 &&
          rawNext.indexOf('://') === -1 &&
          /^\\/[a-zA-Z0-9_\\-.~/]*(\\?[a-zA-Z0-9_\\-.~=&%]*)?(#[a-zA-Z0-9_\\-.~%]*)?$/.test(rawNext)
        ) {
          return rawNext;
        }
      } catch (_) {}
      return '/onboarding';
    }

    async function handleHash() {
      var hash = window.location.hash ? window.location.hash.substring(1) : '';
      if (!hash) {
        window.location.replace('/login?error=invalid_link&reason=' + encodeURIComponent('No valid verification token or authorization code found.'));
        return;
      }

      var params = new URLSearchParams(hash);
      var accessToken = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var errorParam = params.get('error');
      var errorDesc = params.get('error_description');

      if (errorParam) {
        window.location.replace('/login?error=' + encodeURIComponent(errorParam) + '&reason=' + encodeURIComponent(errorDesc || ''));
        return;
      }

      if (accessToken && refreshToken) {
        try {
          var res = await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
          });
          var data = await res.json();
          if (res.ok && data.success) {
            window.location.replace(getSafeNextPath());
            return;
          }
        } catch (_) {
          // session transfer network or unexpected failure handled below
        }
      }

      window.location.replace('/login?error=auth_error&reason=' + encodeURIComponent('Unable to establish session. Please sign in directly.'));
    }
    handleHash();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
