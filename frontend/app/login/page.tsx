'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { createClient } from '@/lib/supabase/client';
import { useMockStore, SYNTHETIC_DEMO_METRICS } from '@/lib/mockStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { UserRole } from '@/lib/types';
import {
  Sparkles,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Briefcase,
  Users,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { validateEmail, validateLoginPassword } from '@/lib/validation';

const LOGIN_ROLES: {
  id: UserRole;
  demoId: string;
  demoEmail: string;
  title: string;
  badge: string;
  personName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  activeBorder: string;
  activeBg: string;
  iconBg: string;
}[] = [
  {
    id: 'organizer',
    demoId: 'emp-org',
    demoEmail: 'aris.thorne@acme.corp',
    title: 'Organizer',
    badge: 'Founder / Root',
    personName: 'Dr. Thorne',
    description: 'Root workspace governance, multi-tenant security policies & full visibility',
    icon: ShieldCheck,
    accentColor: 'text-amber-400',
    activeBorder: 'border-amber-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.35)]',
    activeBg: 'bg-amber-950/40',
    iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'admin',
    demoId: 'emp-8',
    demoEmail: 'chloe.dubois@acme.corp',
    title: 'Admin',
    badge: 'VP Ops / Admin',
    personName: 'Chloe D.',
    description: 'Full workspace authority, member access & immutable compliance audit trail',
    icon: ShieldCheck,
    accentColor: 'text-violet-400',
    activeBorder: 'border-violet-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.35)]',
    activeBg: 'bg-violet-950/40',
    iconBg: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  },
  {
    id: 'manager',
    demoId: 'emp-1',
    demoEmail: 'sarah.connor@acme.corp',
    title: 'Manager',
    badge: 'Lead / PM',
    personName: 'Sarah C.',
    description: 'Team planning, task assignments & AI candidate recommendations approval',
    icon: Briefcase,
    accentColor: 'text-cyan-400',
    activeBorder: 'border-cyan-500 shadow-[0_0_15px_-3px_rgba(6,182,212,0.35)]',
    activeBg: 'bg-cyan-950/40',
    iconBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'hr',
    demoId: 'emp-hr',
    demoEmail: 'elena.rostova@acme.corp',
    title: 'HR',
    badge: 'Talent & Ops',
    personName: 'Elena R.',
    description: 'People operations, talent capacity planning & workforce burnout analytics',
    icon: Users,
    accentColor: 'text-emerald-400',
    activeBorder: 'border-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.35)]',
    activeBg: 'bg-emerald-950/40',
    iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'employee',
    demoId: 'emp-2',
    demoEmail: 'alex.chen@acme.corp',
    title: 'Employee',
    badge: 'Contributor',
    personName: 'Alex C.',
    description: 'Direct task delivery, task status updates & personal sprint workload',
    icon: User,
    accentColor: 'text-blue-400',
    activeBorder: 'border-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.35)]',
    activeBg: 'bg-blue-950/40',
    iconBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithPassword, signUpWithPassword, isAuthenticated, organization, isLoading: isAuthLoading } = useAuth();
  const { enterDemoMode, isDemoMode, exitDemoMode } = useMockStore();
  const isEnteringDemoRef = React.useRef(false);

  // Clear stale demo mode only on initial mount of the login page for unauthenticated visitors
  React.useEffect(() => {
    if (!isAuthenticated && !isEnteringDemoRef.current) {
      exitDemoMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDev = process.env.NODE_ENV === 'development';
  const supabase = React.useMemo(() => createClient(), []);
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('admin');

  // Quick-fill credentials for demo testing and active role selection (development only)
  const fillRoleAccount = (opt: typeof LOGIN_ROLES[number]) => {
    setSelectedRole(opt.id);
    if (isDev) {
      setEmail(opt.demoEmail);
      setPassword('Password123!');
      setFieldErrors({});
      setTouched({});
      setErrorMessage(null);
    }
  };

  const handleExploreDemo = (roleId: UserRole) => {
    isEnteringDemoRef.current = true;
    enterDemoMode(roleId);
    router.push('/dashboard');
  };

  // Mode: Sign In vs First-Time Member Setup
  const initialTab = searchParams.get('tab') === 'setup' || searchParams.get('setup') === 'true' ? 'setup' : 'signin';
  const [activeTab, setActiveTab] = React.useState<'signin' | 'setup'>(initialTab);

  // First-Time Member Setup States
  const [setupStep, setSetupStep] = React.useState<1 | 2 | 3>(1); // 1: Verify Email, 2: Set Password, 3: Email Sent
  const [setupEmail, setSetupEmail] = React.useState('');
  const [setupFullName, setSetupFullName] = React.useState('');
  const [setupDepartment, setSetupDepartment] = React.useState('Engineering');
  const [setupPassword, setSetupPassword] = React.useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = React.useState('');
  const [showSetupPassword, setShowSetupPassword] = React.useState(false);
  const [verifiedRole, setVerifiedRole] = React.useState<string | null>(null);
  const [verifiedOrgName, setVerifiedOrgName] = React.useState<string | null>(null);
  const [setupLoading, setSetupLoading] = React.useState(false);
  const [setupError, setSetupError] = React.useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = React.useState<{ email?: boolean; password?: boolean }>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const urlError = searchParams.get('error');
  const urlReason = searchParams.get('reason');

  const callbackNotice = React.useMemo(() => {
    if (!urlError) return null;
    if (urlError === 'token_expired') {
      return {
        title: 'Confirmation Link Expired or Already Verified',
        message:
          urlReason ||
          'The email confirmation link has expired or has already been used. If your account is confirmed, please sign in below with your password.',
        tip: 'If your account is not yet confirmed, request a fresh confirmation link or sign up again.',
      };
    }
    if (urlError === 'auth_code_error') {
      return {
        title: 'Cross-Device or Browser Code Mismatch',
        message:
          urlReason ||
          'The authorization code could not be exchanged. This occurs when opening confirmation links across different devices or browsers.',
        tip: 'Please sign in directly below using your email and password.',
      };
    }
    if (urlError === 'invalid_link') {
      return {
        title: 'Invalid Verification Link',
        message:
          urlReason ||
          'The verification link followed is missing essential authorization parameters.',
        tip: 'Check your email for the complete link or sign in below.',
      };
    }
    return {
      title: 'Authentication Notification',
      message: urlReason || `Authentication code: ${urlError}`,
      tip: 'Please sign in with your email and password.',
    };
  }, [urlError, urlReason]);

  // If already authenticated and session load finished, redirect to dashboard or onboarding
  // Guard: do NOT auto-redirect if an error parameter is present in the URL (e.g. failed/expired confirmation callback)
  React.useEffect(() => {
    if (!isAuthLoading && isAuthenticated && !urlError) {
      if (organization) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    }
  }, [isAuthenticated, organization, isAuthLoading, router, urlError]);

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') {
      const err = validateEmail(email);
      setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
    } else if (field === 'password') {
      const err = validateLoginPassword(password);
      setFieldErrors((prev) => ({ ...prev, password: err || undefined }));
    }
  };

  const handleChangeEmail = (val: string) => {
    setEmail(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.email) {
      const err = validateEmail(val);
      setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
    }
  };

  const handleChangePassword = (val: string) => {
    setPassword(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.password) {
      const err = validateLoginPassword(val);
      setFieldErrors((prev) => ({ ...prev, password: err || undefined }));
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Run deterministic client-side validation
    const emailErr = validateEmail(email);
    const passwordErr = validateLoginPassword(password);

    setTouched({ email: true, password: true });
    setFieldErrors({
      email: emailErr || undefined,
      password: passwordErr || undefined,
    });

    if (emailErr || passwordErr) {
      if (emailErr) {
        document.getElementById('login-email-input')?.focus();
      } else if (passwordErr) {
        document.getElementById('login-password-input')?.focus();
      }
      return;
    }

    setIsLoading(true);

    const { error } = await signInWithPassword(email.trim(), password);

    if (error) {
      setErrorMessage(error);
      setIsLoading(false);
    } else {
      exitDemoMode();
    }
  };

  
  // Verify if email has a pending organization membership
  const handleVerifyMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = setupEmail.trim().toLowerCase();
    setSetupError(null);
    setSetupSuccess(null);

    const emailErr = validateEmail(cleanEmail);
    if (emailErr) {
      setSetupError(emailErr);
      return;
    }

    setSetupLoading(true);

    // Check if a pending department was set when this user was invited
    if (typeof window !== 'undefined') {
      const savedDept = localStorage.getItem('workforce_pending_dept_' + cleanEmail);
      if (savedDept) {
        setSetupDepartment(savedDept);
      }
    }

    // DEMO MODE: Check synthetic mock employees or pending demo members
    if (isDemoMode) {
      setVerifiedRole('employee');
      setVerifiedOrgName('Acme Systems Engineering');
      setSetupStep(2);
      setSetupLoading(false);
      return;
    }

    // LIVE MODE: Call protected check_pending_setup RPC (generic non-disclosing response)
    // Never reveals whether email exists in pending invitations or active memberships
    try {
      await supabase.rpc('check_pending_setup', {
        p_email: cleanEmail,
      });
      // Advance to step 2 for password creation without leaking membership status
      setVerifiedRole(null);
      setVerifiedOrgName(null);
      setSetupStep(2);
    } catch (err: any) {
      // Advance to step 2 so unauthenticated callers cannot infer existence from error state
      setVerifiedRole(null);
      setVerifiedOrgName(null);
      setSetupStep(2);
    } finally {
      setSetupLoading(false);
    }
  };

  // Complete account setup: creates password and links auth.users to membership
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    setSetupSuccess(null);

    const cleanEmail = setupEmail.trim().toLowerCase();
    if (setupPassword.length < 8) {
      setSetupError('Password must be at least 8 characters long.');
      return;
    }

    if (setupPassword !== setupConfirmPassword) {
      setSetupError('Passwords do not match. Please re-enter.');
      return;
    }

    setSetupLoading(true);

    if (isDemoMode) {
      enterDemoMode((verifiedRole as UserRole) || 'employee');
      router.push('/dashboard');
      return;
    }

    const nameToUse = setupFullName.trim() || cleanEmail.split('@')[0];
    const { error: signUpErr, requiresConfirmation } = await signUpWithPassword(
      cleanEmail,
      setupPassword,
      nameToUse,
      undefined,
      undefined,
      setupDepartment
    );

    setSetupLoading(false);

    if (signUpErr) {
      const lowerErr = signUpErr.toLowerCase();
      if (lowerErr.includes('already registered') || lowerErr.includes('already taken')) {
        setSetupError(
          'An account with this email is already registered. Please switch to the Sign In tab and log in with your existing password.'
        );
      } else {
        setSetupError(signUpErr);
      }
      return;
    }

    if (requiresConfirmation) {
      setSetupStep(3);
    } else {
      exitDemoMode();
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow highlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-glow mb-2">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          WorkForce
        </h1>
        <p className="text-sm text-slate-400">
          AI-Powered Capacity Management & Task Balancing Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10">
        <Card className="border-slate-800 bg-navy-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-4">
          {/* Mode Switcher: Sign In vs First-Time Member Setup */}
          <div className="flex rounded-xl bg-navy-950 p-1 border border-slate-800 mb-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setErrorMessage(null);
              }}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center',
                activeTab === 'signin'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('setup');
                setErrorMessage(null);
              }}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center',
                activeTab === 'setup'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              First-Time Member Setup
            </button>
          </div>
          
          {callbackNotice && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3.5 text-xs text-amber-200 space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>{callbackNotice.title}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">{callbackNotice.message}</p>
              {callbackNotice.tip && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 font-medium pt-0.5">
                  <HelpCircle className="h-3 w-3 shrink-0" />
                  <span>{callbackNotice.tip}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{errorMessage}</span>
                </div>
                {errorMessage.toLowerCase().includes('not confirmed') && (
                  <p className="text-[11px] text-slate-300 pl-6 leading-relaxed">
                    Your email address has not been confirmed yet. Please click the verification link in your email
                    {isDev ? (
                      <>
                        , or check your local Mailpit inbox at{' '}
                        <a
                          href="http://127.0.0.1:54324"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 underline hover:text-cyan-300 font-medium"
                        >
                          http://127.0.0.1:54324
                        </a>.
                      </>
                    ) : (
                      '.'
                    )}
                  </p>
                )}
              </div>
            )}

            
            <div className="space-y-1.5 pt-1">
              <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className={cn(
                    'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                    touched.email && fieldErrors.email ? 'text-rose-400' : 'text-slate-500'
                  )}
                />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => handleChangeEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!(touched.email && fieldErrors.email)}
                  className={cn(
                    'w-full rounded-xl border bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all',
                    touched.email && fieldErrors.email
                      ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-slate-700/80 focus:border-violet-500'
                  )}
                />
              </div>
              {touched.email && fieldErrors.email && (
                <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in pt-0.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className={cn(
                    'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                    touched.password && fieldErrors.password ? 'text-rose-400' : 'text-slate-500'
                  )}
                />
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => handleChangePassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  aria-invalid={!!(touched.password && fieldErrors.password)}
                  className={cn(
                    'w-full rounded-xl border bg-navy-950/80 pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all',
                    touched.password && fieldErrors.password
                      ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-slate-700/80 focus:border-violet-500'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {touched.password && fieldErrors.password && (
                <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in pt-0.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full mt-2 justify-center"
            >
              {isLoading ? 'Signing In...' : 'Sign In to Workspace'}
            </Button>

            <div className="pt-2 text-center text-xs text-slate-400">
              Added by an Organizer?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('setup');
                  if (email) setSetupEmail(email);
                }}
                className="font-semibold text-violet-400 hover:text-violet-300 underline"
              >
                Set up your member account
              </button>
            </div>
          </form>
        ) : (
          /* First-Time Member Setup Workflow */
          <div className="space-y-4">
            <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 space-y-1">
              <span className="text-xs font-bold text-white block">
                First-Time Member Setup
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                If your organization Organizer has added your email address, verify your membership below and set your account password.
              </p>
            </div>

            {setupError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            {setupSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{setupSuccess}</span>
              </div>
            )}

            {setupStep === 1 && (
              <form onSubmit={handleVerifyMembership} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Your Work Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enter the exact email address your Organizer used when adding you to WorkForce.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={setupLoading || !setupEmail.trim()}
                  className="w-full justify-center"
                >
                  {setupLoading ? 'Validating Membership...' : 'Verify Workspace Membership'}
                </Button>
              </form>
            )}

            {setupStep === 2 && (
              <form onSubmit={handleCompleteSetup} className="space-y-4 animate-in fade-in">
                <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-violet-300 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Member Account Setup</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Set up your account password for <strong>{setupEmail}</strong>. If your email was added by a workspace Organizer, your organization access will be activated upon email verification.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Chen"
                      value={setupFullName}
                      onChange={(e) => setSetupFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Department
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. Engineering, Marketing, Product"
                      value={setupDepartment}
                      onChange={(e) => setSetupDepartment(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Assigned department for your workspace profile. Confirm or adjust if needed.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 8 characters"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword(!showSetupPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showSetupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setSetupStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={setupLoading || !setupPassword || !setupConfirmPassword}
                    className="flex-1 justify-center"
                  >
                    {setupLoading ? 'Activating Account...' : 'Activate Account & Sign In'}
                  </Button>
                </div>
              </form>
            )}

            {setupStep === 3 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3 text-center animate-in fade-in">
                <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Verification Link Sent</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    A confirmation link has been sent to <strong>{setupEmail}</strong>. Please check your inbox and click the link to confirm your email address.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActiveTab('signin');
                      setEmail(setupEmail);
                      setSetupStep(1);
                    }}
                    className="w-full justify-center"
                  >
                    Return to Sign In
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

          {/* Explore Interactive Demo Showcase */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Explore Interactive Demo
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {SYNTHETIC_DEMO_METRICS.organizationName} • {SYNTHETIC_DEMO_METRICS.totalEmployees} team members, {SYNTHETIC_DEMO_METRICS.totalProjects} projects ({SYNTHETIC_DEMO_METRICS.activeProjects} active), {SYNTHETIC_DEMO_METRICS.totalTasks} tasks
                  </span>
                </div>
              </div>
              <Badge variant="violet" size="sm" className="text-[10px]">
                Instant Access
              </Badge>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Test-drive WorkForce with an isolated synthetic company dataset. Select any role below to experience capacity monitoring, simulated AI matching, and role-based permissions without registering.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LOGIN_ROLES.map((roleOpt) => {
                const Icon = roleOpt.icon;
                return (
                  <button
                    key={roleOpt.id}
                    type="button"
                    onClick={() => handleExploreDemo(roleOpt.id)}
                    className="flex flex-col text-left p-3 rounded-xl border border-slate-800 bg-navy-950/70 hover:bg-navy-900/90 hover:border-violet-500/50 transition-all group focus:outline-none relative"
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            'p-1.5 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
                            roleOpt.iconBg
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block">
                            {roleOpt.title}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block truncate">
                            {roleOpt.personName} • {roleOpt.badge}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-violet-400 font-semibold group-hover:text-violet-300 transition-colors shrink-0">
                        <span>Demo</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                      {roleOpt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Demo Credentials Assistant (Development only) */}
          {isDev && (
            <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Local Dev Credentials Quick-Fill
                </span>
                <Badge variant="cyan" size="sm">
                  Dev Only
                </Badge>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {LOGIN_ROLES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => fillRoleAccount(opt)}
                    className={cn(
                      'rounded-lg border bg-navy-950 p-1.5 text-center transition-all group',
                      selectedRole === opt.id
                        ? 'border-violet-500 bg-violet-950/30'
                        : 'border-slate-800 hover:border-slate-700'
                    )}
                  >
                    <span className={cn('text-[9px] font-bold block truncate', opt.accentColor)}>
                      {opt.title.toUpperCase()}
                    </span>
                    <span className="text-[8px] text-slate-400 block truncate">{opt.personName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have an account yet?{' '}
            <Link
              href="/register"
              className="font-semibold text-violet-400 hover:text-violet-300"
            >
              Create an organization
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-navy-950 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}
