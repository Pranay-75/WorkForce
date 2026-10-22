'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { generateSlug, isValidSlug } from '@/lib/slug';
import { cn } from '@/lib/utils';
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
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import {
  validateEmail,
  validateFullName,
  validateOrgName,
  validateWorkspaceSlug,
  validateRegisterPassword,
  validateConfirmPassword,
  evaluatePasswordStrength,
} from '@/lib/validation';

type FormField = 'fullName' | 'orgName' | 'slug' | 'email' | 'password' | 'confirmPassword';

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
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FormField, string>>>({});
  const [touched, setTouched] = React.useState<Partial<Record<FormField, boolean>>>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const isDev = process.env.NODE_ENV === 'development';

  // Auto-generate slug from organization name unless customized
  const effectiveSlug = React.useMemo(() => {
    if (isCustomizingSlug && customSlug) {
      return generateSlug(customSlug);
    }
    return generateSlug(orgName);
  }, [orgName, customSlug, isCustomizingSlug]);

  const passwordStrength = React.useMemo(() => {
    return evaluatePasswordStrength(password);
  }, [password]);

  React.useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      if (organization) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    }
  }, [isAuthenticated, organization, isAuthLoading, router]);

  const handleBlur = (field: FormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let err: string | null = null;
    switch (field) {
      case 'fullName':
        err = validateFullName(fullName);
        break;
      case 'orgName':
        err = validateOrgName(orgName);
        break;
      case 'slug':
        err = validateWorkspaceSlug(effectiveSlug);
        break;
      case 'email':
        err = validateEmail(email);
        break;
      case 'password':
        err = validateRegisterPassword(password);
        break;
      case 'confirmPassword':
        err = validateConfirmPassword(password, confirmPassword);
        break;
    }
    setFieldErrors((prev) => ({ ...prev, [field]: err || undefined }));
  };

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.fullName) {
      const err = validateFullName(val);
      setFieldErrors((prev) => ({ ...prev, fullName: err || undefined }));
    }
  };

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.orgName) {
      const err = validateOrgName(val);
      setFieldErrors((prev) => ({ ...prev, orgName: err || undefined }));
    }
    if (touched.slug && !isCustomizingSlug) {
      const slugVal = generateSlug(val);
      const slugErr = validateWorkspaceSlug(slugVal);
      setFieldErrors((prev) => ({ ...prev, slug: slugErr || undefined }));
    }
  };

  const handleCustomSlugChange = (val: string) => {
    const slugified = generateSlug(val);
    setCustomSlug(slugified);
    if (errorMessage) setErrorMessage(null);
    if (touched.slug) {
      const err = validateWorkspaceSlug(slugified);
      setFieldErrors((prev) => ({ ...prev, slug: err || undefined }));
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.email) {
      const err = validateEmail(val);
      setFieldErrors((prev) => ({ ...prev, email: err || undefined }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.password) {
      const err = validateRegisterPassword(val);
      setFieldErrors((prev) => ({ ...prev, password: err || undefined }));
    }
    if (touched.confirmPassword && confirmPassword) {
      const confirmErr = validateConfirmPassword(val, confirmPassword);
      setFieldErrors((prev) => ({ ...prev, confirmPassword: confirmErr || undefined }));
    }
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (errorMessage) setErrorMessage(null);
    if (touched.confirmPassword) {
      const err = validateConfirmPassword(password, val);
      setFieldErrors((prev) => ({ ...prev, confirmPassword: err || undefined }));
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Run complete deterministic client-side validations
    const fnErr = validateFullName(fullName);
    const orgErr = validateOrgName(orgName);
    const slugErr = validateWorkspaceSlug(effectiveSlug);
    const emailErr = validateEmail(email);
    const passErr = validateRegisterPassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);

    const newErrors: Partial<Record<FormField, string>> = {};
    if (fnErr) newErrors.fullName = fnErr;
    if (orgErr) newErrors.orgName = orgErr;
    if (slugErr) newErrors.slug = slugErr;
    if (emailErr) newErrors.email = emailErr;
    if (passErr) newErrors.password = passErr;
    if (confirmErr) newErrors.confirmPassword = confirmErr;

    setTouched({
      fullName: true,
      orgName: true,
      slug: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Auto-focus the first invalid field
      if (fnErr) {
        document.getElementById('register-fullname-input')?.focus();
      } else if (orgErr) {
        document.getElementById('register-orgname-input')?.focus();
      } else if (slugErr) {
        document.getElementById('register-slug-input')?.focus();
      } else if (emailErr) {
        document.getElementById('register-email-input')?.focus();
      } else if (passErr) {
        document.getElementById('register-password-input')?.focus();
      } else if (confirmErr) {
        document.getElementById('register-confirm-password-input')?.focus();
      }
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

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center space-y-3 z-10">
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

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10">
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
              <div className="rounded-xl border border-slate-700/60 bg-navy-950/60 p-3.5 text-xs text-slate-400 text-left space-y-2">
                <div className="font-semibold text-slate-300">Next Steps:</div>
                <ul className="list-disc pl-4 space-y-1.5 text-[11px]">
                  <li>Click the link in your email to verify your email address.</li>
                  {isDev && (
                    <li>In local development, all outgoing emails are captured in the Mailpit inbox.</li>
                  )}
                  <li>Once verified, your account and workspace authority will be active.</li>
                </ul>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                {isDev && (
                  <a
                    href="http://127.0.0.1:54324"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="secondary" className="w-full justify-center text-xs">
                      Open Local Mailpit <Globe className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
                <Link href="/login" className="flex-1">
                  <Button variant="primary" className="w-full justify-center text-xs">
                    Proceed to Sign In <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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

              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="register-fullname-input" className="block text-xs font-semibold text-slate-300">
                  Your Full Name
                </label>
                <div className="relative">
                  <User
                    className={cn(
                      'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                      touched.fullName && fieldErrors.fullName ? 'text-rose-400' : 'text-slate-500'
                    )}
                  />
                  <input
                    id="register-fullname-input"
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    value={fullName}
                    onChange={(e) => handleFullNameChange(e.target.value)}
                    onBlur={() => handleBlur('fullName')}
                    aria-invalid={!!(touched.fullName && fieldErrors.fullName)}
                    className={cn(
                      'w-full rounded-xl border bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all',
                      touched.fullName && fieldErrors.fullName
                        ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700/80 focus:border-violet-500'
                    )}
                  />
                </div>
                {touched.fullName && fieldErrors.fullName && (
                  <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in pt-0.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{fieldErrors.fullName}</span>
                  </p>
                )}
              </div>

              {/* Organization Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="register-orgname-input" className="block text-xs font-semibold text-slate-300">
                    Organization Name
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomizingSlug(!isCustomizingSlug);
                      if (!isCustomizingSlug) {
                        setCustomSlug(effectiveSlug);
                      }
                    }}
                    className="text-[10px] text-violet-400 hover:text-violet-300 focus:outline-none font-medium"
                  >
                    {isCustomizingSlug ? 'Use Auto Slug' : 'Customize Workspace URL'}
                  </button>
                </div>
                <div className="relative">
                  <Building
                    className={cn(
                      'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                      touched.orgName && fieldErrors.orgName ? 'text-rose-400' : 'text-slate-500'
                    )}
                  />
                  <input
                    id="register-orgname-input"
                    type="text"
                    required
                    placeholder="e.g. Acme Engineering Corp"
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    onBlur={() => handleBlur('orgName')}
                    aria-invalid={!!(touched.orgName && fieldErrors.orgName)}
                    className={cn(
                      'w-full rounded-xl border bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all',
                      touched.orgName && fieldErrors.orgName
                        ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700/80 focus:border-violet-500'
                    )}
                  />
                </div>
                {touched.orgName && fieldErrors.orgName && (
                  <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in pt-0.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{fieldErrors.orgName}</span>
                  </p>
                )}

                {/* Custom Slug Input */}
                {isCustomizingSlug && (
                  <div className="space-y-1 pt-1">
                    <label htmlFor="register-slug-input" className="block text-[11px] font-medium text-slate-400">
                      Custom Workspace URL Slug
                    </label>
                    <div className="relative">
                      <Globe
                        className={cn(
                          'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                          touched.slug && fieldErrors.slug ? 'text-rose-400' : 'text-slate-500'
                        )}
                      />
                      <input
                        id="register-slug-input"
                        type="text"
                        placeholder="custom-slug"
                        value={customSlug || effectiveSlug}
                        onChange={(e) => handleCustomSlugChange(e.target.value)}
                        onBlur={() => handleBlur('slug')}
                        aria-invalid={!!(touched.slug && fieldErrors.slug)}
                        className={cn(
                          'w-full rounded-xl border bg-navy-950/90 pl-9 pr-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none transition-all',
                          touched.slug && fieldErrors.slug
                            ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/30'
                            : 'border-violet-500/50 focus:border-violet-400'
                        )}
                      />
                    </div>
                    {touched.slug && fieldErrors.slug && (
                      <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in pt-0.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{fieldErrors.slug}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Live Slug URL Preview */}
                {effectiveSlug && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-1 pt-0.5">
                    {isValidSlug(effectiveSlug) ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                    )}
                    <span>
                      Workspace URL:{' '}
                      <strong className="text-cyan-400 font-mono font-medium">
                        app.workforce.io/{effectiveSlug}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Work Email Address */}
              <div className="space-y-1.5">
                <label htmlFor="register-email-input" className="block text-xs font-semibold text-slate-300">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail
                    className={cn(
                      'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                      touched.email && fieldErrors.email ? 'text-rose-400' : 'text-slate-500'
                    )}
                  />
                  <input
                    id="register-email-input"
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
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

              {/* Creator Workspace Authorization Notice */}
              <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Organization Creator Authority
                    </span>
                    <span className="text-[10px] text-violet-300 font-mono">
                      Role: Workspace Administrator
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  As the organization creator, you will receive workspace administrative permissions. Once registered, you can securely invite Managers, HR, and Employees from the Talent Directory.
                </p>
              </div>

              {/* Passwords Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="register-password-input" className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className={cn(
                        'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                        touched.password && fieldErrors.password ? 'text-rose-400' : 'text-slate-500'
                      )}
                    />
                    <input
                      id="register-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 8 chars"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
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

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="register-confirm-password-input" className="block text-xs font-semibold text-slate-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className={cn(
                        'absolute left-3 top-2.5 h-4 w-4 transition-colors',
                        touched.confirmPassword && fieldErrors.confirmPassword ? 'text-rose-400' : 'text-slate-500'
                      )}
                    />
                    <input
                      id="register-confirm-password-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                      onBlur={() => handleBlur('confirmPassword')}
                      aria-invalid={!!(touched.confirmPassword && fieldErrors.confirmPassword)}
                      className={cn(
                        'w-full rounded-xl border bg-navy-950/80 pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all',
                        touched.confirmPassword && fieldErrors.confirmPassword
                          ? 'border-rose-500/80 focus:border-rose-500 ring-1 ring-rose-500/30'
                          : confirmPassword && password === confirmPassword
                          ? 'border-emerald-500/60 focus:border-emerald-500'
                          : 'border-slate-700/80 focus:border-violet-500'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {touched.confirmPassword && fieldErrors.confirmPassword && (
                    <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in pt-0.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{fieldErrors.confirmPassword}</span>
                    </p>
                  )}
                  {confirmPassword && password === confirmPassword && !fieldErrors.confirmPassword && (
                    <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in pt-0.5">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Passwords match</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Password Strength Meter & Helper */}
              {password && (
                <div className="rounded-xl border border-slate-800 bg-navy-950/60 p-3 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Password Strength:</span>
                    <span
                      className={cn(
                        'font-bold text-[11px]',
                        passwordStrength.score <= 1
                          ? 'text-rose-400'
                          : passwordStrength.score === 2
                          ? 'text-amber-400'
                          : passwordStrength.score === 3
                          ? 'text-cyan-400'
                          : 'text-emerald-400'
                      )}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>

                  {/* 4-bar progress indicator */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-300',
                          passwordStrength.score >= step
                            ? passwordStrength.color
                            : 'bg-slate-800'
                        )}
                      />
                    ))}
                  </div>

                  {/* Requirements checklist */}
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
                    <div
                      className={cn(
                        'flex items-center gap-1',
                        passwordStrength.hasLength ? 'text-emerald-400' : 'text-slate-500'
                      )}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                      <span>8+ chars</span>
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-1',
                        passwordStrength.hasMixedCase ? 'text-emerald-400' : 'text-slate-500'
                      )}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                      <span>Upper & lower</span>
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-1',
                        passwordStrength.hasNumber || passwordStrength.hasSpecial
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                      )}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                      <span>Number/symbol</span>
                    </div>
                  </div>
                </div>
              )}

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
