import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  // Demo mode detection (via cookie or query param)
  const isDemoCookie = request.cookies.get('workforce_demo_mode')?.value === 'true';
  const isDemoParam = request.nextUrl.searchParams.get('demo') === 'true';
  const isDemo = isDemoCookie || isDemoParam;

  if (isDemoParam) {
    supabaseResponse.cookies.set('workforce_demo_mode', 'true', {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
  }

  // If Supabase credentials are not configured, pass through gracefully
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Helper to copy refreshed auth cookies onto redirect responses
  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  };

  // Publicly accessible routes that never require an authenticated session
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/presentation') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api');

  // Authenticated user trying to access login/register -> redirect to dashboard or next destination
  if (user && (pathname === '/login' || pathname === '/register')) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const isSafeDestination =
      nextParam &&
      typeof nextParam === 'string' &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !nextParam.includes('\\') &&
      !/[\r\n\t\s]/.test(nextParam);
    const destination = isSafeDestination ? nextParam : '/dashboard';
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination;
    redirectUrl.search = '';
    return redirectWithCookies(redirectUrl);
  }

  // Unauthenticated user trying to access protected routes (and not in demo mode) -> redirect to /login?next=...
  if (!user && !isDemo && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    const fullTarget = pathname + (request.nextUrl.search || '');
    redirectUrl.searchParams.set('next', fullTarget);
    return redirectWithCookies(redirectUrl);
  }

  return supabaseResponse;
}
