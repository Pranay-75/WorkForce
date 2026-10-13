'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { generateSlug, isValidSlug } from '@/lib/slug';
import {
  Sparkles,
  Lock,
  Mail,
  Building,
  User,
  AlertCircle,
  CheckCircle2,
  Globe,
  ArrowRight,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithPassword, isAuthenticated, organization, isLoading: isAuthLoading } = useAuth();

  const [fullName, setFullName] = React.useState('');
  const [orgName, setOrgName] = React.useState('');
  const [customSlug, setCustomSlug] = React.useState('');
  const [isCustomizingSlug, setIsCustomizingSlug] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Auto-generate slug from organization name unless customized
  const effectiveSlug = React.useMemo(() => {
    if (isCustomizingSlug && customSlug) {
      return generateSlug(customSlug);
    }
    return generateSlug(orgName);
  }, [orgName, customSlug, isCustomizingSlug]);

  React.useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      if (organization) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    }
  }, [isAuthenticated, organization, isAuthLoading, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (fullName.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }

    if (orgName.trim().length < 2) {
      setErrorMessage('Organization name must be at least 2 characters.');
      return;
    }

    if (!isValidSlug(effectiveSlug)) {
      setErrorMessage('Organization slug must be at least 2 alphanumeric characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    const result = await signUpWithPassword(
      email.trim(),
      password,
      fullName.trim(),
      orgName.trim(),
      effectiveSlug
    );

    if (result.error) {
      setErrorMessage(result.error);
      setIsLoading(false);
    } else if (result.requiresConfirmation) {
      setPendingConfirmationEmail(email.trim());
      setIsLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-glow mb-2">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Create Organization Workspace
        </h1>
        <p className="text-sm text-slate-400">
          Set up your organization and bootstrap your team workspace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Card className="border-slate-800 bg-navy-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {pendingConfirmationEmail ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Check your email</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                We sent a confirmation link to{' '}
                <span className="font-semibold text-cyan-300">{pendingConfirmationEmail}</span>.
              </p>
              <div className="rounded-xl border border-slate-700/60 bg-navy-950/60 p-3 text-xs text-slate-400 text-left space-y-1.5">
                <div className="font-semibold text-slate-300">Next Steps:</div>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Click the link in your email to verify your address.</li>
                  <li>Your organization workspace will be initialized automatically on first sign-in.</li>
                </ul>
              </div>
              <div className="pt-2">
                <Link href="/login">
                  <Button variant="primary" className="w-full justify-center">
                    Proceed to Sign In <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              {errorMessage && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Your Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Organization Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomizingSlug(!isCustomizingSlug)}
                    className="text-[10px] text-violet-400 hover:text-violet-300 focus:outline-none"
                  >
                    {isCustomizingSlug ? 'Auto Slug' : 'Edit URL Slug'}
                  </button>
                </div>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Engineering Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                {isCustomizingSlug && (
                  <div className="relative mt-2">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="custom-slug"
                      value={customSlug || effectiveSlug}
                      onChange={(e) => setCustomSlug(generateSlug(e.target.value))}
                      className="w-full rounded-xl border border-violet-500/50 bg-navy-950/90 pl-9 pr-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none"
                    />
                  </div>
                )}

                {effectiveSlug && (
                  <p className="text-[10px] text-slate-400 pl-1 font-mono">
                    Workspace URL: <span className="text-cyan-400">app.workforce.io/{effectiveSlug}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="Min 8 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoading}
                className="w-full mt-2 justify-center"
              >
                {isLoading ? 'Setting up Workspace...' : 'Create Account & Organization'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-violet-400 hover:text-violet-300"
            >
              Sign in to your workspace
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

