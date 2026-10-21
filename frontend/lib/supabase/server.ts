import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextResponse } from 'next/server';

export async function createClient(customResponse?: NextResponse) {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // In production server runtime, missing configuration must fail clearly
  // instead of silently attempting to connect to localhost.
  if (process.env.NODE_ENV === 'production') {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'WorkForce Supabase Server Configuration Error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in production server runtime. Please configure these environment variables in your deployment.'
      );
    }
  }

  // In local development, warn if credentials are missing while falling back to local Supabase
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'WorkForce Supabase Server Configuration Warning: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Falling back to local development instance at http://127.0.0.1:54321.'
      );
    }
  }

  return createServerClient(
    supabaseUrl || 'http://127.0.0.1:54321',
    supabaseAnonKey || 'dummy-anon-key-for-build',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              if (customResponse) {
                customResponse.cookies.set(name, value, options);
              }
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
