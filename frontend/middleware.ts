import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const CANONICAL_HOST = 'workforce-platform.vercel.app';

export async function middleware(request: NextRequest) {
  // 1. Canonical production host enforcement
  // Only enforce in production environment; never redirect localhost, loopback, or preview deployments.
  const isVercelProduction = process.env.VERCEL_ENV === 'production';
  const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase() || '';

  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost');

  if (isVercelProduction && !isLocalhost && hostname && hostname !== CANONICAL_HOST) {
    // Preserve path and query parameters by cloning nextUrl
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = 'https';
    redirectUrl.host = CANONICAL_HOST;
    redirectUrl.port = '';

    return NextResponse.redirect(redirectUrl, 308);
  }

  // 2. Supabase session update
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images / svg / public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

