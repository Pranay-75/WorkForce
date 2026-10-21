'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePassword, signOut } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Recovery session validation states
  const [isValidating, setIsValidating] = React.useState(true);
  const [isSessionValid, setIsSessionValid] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function validateRecoverySession() {
      // 1. Check for error parameters in query string
      const urlError = searchParams.get('error');
      const urlDesc = searchParams.get('error_description');
      const urlErrorCode = searchParams.get('error_code');

      if (urlError || urlErrorCode) {
        if (isMounted) {
          setSessionError(
            urlDesc ||
              'The password reset link is invalid or has expired. Please request a fresh reset link.'
          );
          setIsValidating(false);
          setIsSessionValid(false);
        }
        return;
      }

      // 2. Check for error parameters in URL hash fragment
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashError = hashParams.get('error');
        const hashDesc = hashParams.get('error_description');
        if (hashError) {
          if (isMounted) {
            setSessionError(
              hashDesc ||
                'The password reset link is invalid or has expired. Please request a fresh reset link.'
            );
            setIsValidating(false);
            setIsSessionValid(false);
          }
          return;
        }

        // If tokens are present in hash fragment, establish session explicitly
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          } catch (_) {
            // handled by getSession below
          }
        }
      }

      // 3. Check for PKCE authorization code
      const code = searchParams.get('code');
      if (code) {
        try {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (codeErr) {
            if (isMounted) {
              setSessionError(codeErr.message || 'Authorization code could not be verified.');
              setIsValidating(false);
              setIsSessionValid(false);
            }
            return;
          }
        } catch (_) {
          // handled below
        }
      }

      // 4. Verify that an authenticated recovery session exists
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session) {
          if (isMounted) {
            setSessionError(
              'No active password reset session found. The link may have expired or was already used.'
            );
            setIsValidating(false);
            setIsSessionValid(false);
          }
          return;
        }

        if (isMounted) {
          setIsSessionValid(true);
          setIsValidating(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setSessionError(err?.message || 'Unable to verify reset authorization.');
          setIsValidating(false);
          setIsSessionValid(false);
        }
      }
    }

    validateRecoverySession();

    // Listen for auth state changes (e.g. PASSWORD_RECOVERY event)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setIsSessionValid(true);
        setSessionError(null);
        setIsValidating(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setErrorMessage(error);
        setIsSubmitting(false);
      } else {
        setIsSuccess(true);
        setIsSubmitting(false);
        // Clear recovery session so user logs in cleanly with new credentials
        try {
          await signOut();
        } catch (_) {}
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update password.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow highlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-glow mb-2">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Reset Password
        </h1>
        <p className="text-sm text-slate-400">
          Create a new password for your WorkForce account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Card className="border-slate-800 bg-navy-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {isValidating ? (
            <div className="text-center py-8 space-y-4">
              <div className="h-9 w-9 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Verifying reset authorization...</p>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Password Updated Successfully</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your password has been changed. You can now sign in with your new credentials.
              </p>
              <div className="pt-2">
                <Link href="/login" className="block w-full">
                  <Button variant="primary" className="w-full justify-center text-xs">
                    Proceed to Sign In <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : !isSessionValid || sessionError ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Invalid or Expired Reset Link</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sessionError ||
                  'This password reset link is invalid, has expired, or has already been used. Please request a fresh reset link.'}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link href="/forgot-password" className="flex-1">
                  <Button variant="primary" className="w-full justify-center text-xs">
                    Request New Link
                  </Button>
                </Link>
                <Link href="/login" className="flex-1">
                  <Button variant="secondary" className="w-full justify-center text-xs">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                className="w-full mt-2 justify-center"
              >
                {isSubmitting ? 'Updating Password...' : 'Update Password'}
              </Button>

              <div className="mt-4 text-center text-xs text-slate-400">
                <Link
                  href="/login"
                  className="inline-flex items-center text-violet-400 hover:text-violet-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-navy-950 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </React.Suspense>
  );
}
