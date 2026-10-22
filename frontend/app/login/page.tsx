'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
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
  Briefcase,
  Users,
  User,
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
  const { signInWithPassword, isAuthenticated, organization, isLoading: isAuthLoading } = useAuth();
  const { switchDemoRole, enterDemoMode, isDemoMode, currentUser, exitDemoMode } = useMockStore();

  const isDev = process.env.NODE_ENV === 'development';

  const [selectedRole, setSelectedRole] = React.useState<UserRole>('admin');
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

  // Quick-fill credentials for demo testing and active role selection (development only)
  const fillRoleAccount = (opt: typeof LOGIN_ROLES[number]) => {
    setSelectedRole(opt.id);
    setEmail(opt.demoEmail);
    setPassword('Password123!');
    setFieldErrors({});
    setTouched({});
    setErrorMessage(null);
    switchDemoRole(opt.demoId);
  };

  const handleExploreDemo = (roleId: UserRole) => {
    enterDemoMode(roleId);
    router.push('/dashboard');
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
          {/* Active Demo Session Banner */}
          {isDemoMode && !isAuthenticated && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-950/40 p-3 text-xs text-violet-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
                <span>
                  Demo session active as <strong className="text-white">{currentUser.name}</strong> ({currentUser.role.toUpperCase()}).
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/dashboard')}
                  className="text-xs h-7 py-0 px-2.5"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
                <button
                  type="button"
                  onClick={() => exitDemoMode()}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors"
                >
                  Exit Demo
                </button>
              </div>
            </div>
          )}

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

            {/* Select Role Option (Development only) */}
            {isDev && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Select Your Role
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Admin • Manager • HR • Employee
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {LOGIN_ROLES.map((opt) => {
                    const isSelected = selectedRole === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => fillRoleAccount(opt)}
                        className={cn(
                          'flex flex-col text-left p-3 rounded-xl border transition-all relative overflow-hidden group focus:outline-none',
                          isSelected
                            ? `${opt.activeBorder} ${opt.activeBg}`
                            : 'border-slate-800 bg-navy-950/70 hover:border-slate-700 hover:bg-navy-900/60'
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div
                            className={cn(
                              'p-1.5 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? opt.iconBg
                                : 'border-slate-800 bg-slate-900/80 text-slate-400 group-hover:text-slate-300'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div
                            className={cn(
                              'h-4 w-4 rounded-full border flex items-center justify-center transition-colors',
                              isSelected
                                ? 'border-violet-500 bg-violet-600'
                                : 'border-slate-700 bg-navy-950 group-hover:border-slate-600'
                            )}
                          >
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-white">
                            {opt.title}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            ({opt.badge})
                          </span>
                        </div>

                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mt-1">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
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
          </form>

          {/* Polished Interactive Demo Showcase Section */}
          <div className="mt-6 pt-5 border-t border-slate-800/90 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white tracking-wide block">
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
