import { NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  // Direct error params forwarded by Supabase Auth (e.g., expired token before redirect)
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDesc = searchParams.get('error_description');

  // Prevent open redirect vulnerabilities:
  // Must be a relative path starting with a single '/' and not '//', '\\', or contain schema '://'
  const rawNext = searchParams.get('next') ?? '/onboarding';
  const isValidRelativePath =
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.includes('\\') &&
    !rawNext.includes('://');
  const next = isValidRelativePath ? rawNext : '/onboarding';

  // Determine correct base host (support load balancers and reverse proxies)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const redirectBase = isLocalEnv || !forwardedHost ? origin : `https://${forwardedHost}`;

  // If Supabase forwarded an error directly in the query parameters
  if (errorParam || errorCode) {
    const errorType = errorCode === 'otp_expired' ? 'token_expired' : (errorCode || errorParam || 'auth_error');
    const reason = encodeURIComponent(errorDesc || 'Email link is invalid or has expired.');
    return NextResponse.redirect(`${redirectBase}/login?error=${errorType}&reason=${reason}`);
  }

  const supabase = await createClient();

  // 1. Mobile & Cross-device email confirmation flow: token_hash + type
  // This does NOT require PKCE session cookies from the originating browser,
  // making it 100% reliable when clicking confirmation links on mobile devices.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    }

    const isExpired = error.message?.toLowerCase().includes('expired') || error.code === 'otp_expired';
    const errorKey = isExpired ? 'token_expired' : 'auth_verification_failed';
    const reason = encodeURIComponent(error.message || 'Verification token is invalid or expired.');
    return NextResponse.redirect(`${redirectBase}/login?error=${errorKey}&reason=${reason}`);
  }

  // 2. PKCE code exchange flow: single browser context
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    }

    const reason = encodeURIComponent(
      error.message || 'Authentication code exchange failed. Please sign in directly or request a fresh link.'
    );
    return NextResponse.redirect(`${redirectBase}/login?error=auth_code_error&reason=${reason}`);
  }

  // 3. Fallback: Neither valid token_hash nor code provided
  return NextResponse.redirect(
    `${redirectBase}/login?error=invalid_link&reason=${encodeURIComponent('No valid verification token or authorization code found.')}`
  );
}
