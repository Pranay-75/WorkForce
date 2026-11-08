import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // In staging runtime, strictly forbid production reference and require staging reference
  const isStaging =
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging' ||
    process.env.APP_ENV === 'staging';
  if (isStaging) {
    if (supabaseUrl?.includes('wxkjygctdonpeypgrcnf')) {
      throw new Error(
        'CRITICAL SAFETY VIOLATION: Staging runtime attempted to connect to PRODUCTION Supabase project (wxkjygctdonpeypgrcnf)!'
      );
    }
    if (supabaseUrl && !supabaseUrl.includes('biejxkrhypkkcvpbzjhh')) {
      throw new Error(
        `STAGING MISCONFIGURATION: Staging runtime must target project 'biejxkrhypkkcvpbzjhh'. Current URL: ${supabaseUrl}`
      );
    }
  }

  // In production runtime in the browser, missing configuration must fail clearly
  // instead of silently attempting to connect to a local development instance.
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'WorkForce Supabase Client Error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in production runtime. Please configure these environment variables in your deployment.'
      );
    }
  }

  // In local development, warn if credentials are missing while falling back to local Supabase
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(
        'WorkForce Supabase Configuration Warning: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Falling back to local development instance at http://127.0.0.1:54321.'
      );
    }
  }

  return createBrowserClient(
    supabaseUrl || 'http://127.0.0.1:54321',
    supabaseAnonKey || 'dummy-anon-key-for-build'
  );
}

export const getSupabaseBrowserClient = createClient;
