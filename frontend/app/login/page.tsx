'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useMockStore } from '@/lib/mockStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Sparkles,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithPassword, isAuthenticated, organization, isLoading: isAuthLoading } = useAuth();
  const { switchDemoRole } = useMockStore();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // If already authenticated and session load finished, redirect to dashboard or onboarding
  React.useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      if (organization) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    }
  }, [isAuthenticated, organization, isAuthLoading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const { error } = await signInWithPassword(email, password);

    if (error) {
      setErrorMessage(error);
      setIsLoading(false);
    }
  };

  // Quick-fill credentials for demo testing
  const fillDemoAccount = (roleId: string, demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('WorkForceDemo2026!');
    switchDemoRole(roleId);
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
          WorkForce
        </h1>
        <p className="text-sm text-slate-400">
          AI-Powered Capacity Management & Task Balancing Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Card className="border-slate-800 bg-navy-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          <form onSubmit={handleSignIn} className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Email Address
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
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
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
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

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Quick Demo Sign-In
              </span>
              <Badge variant="cyan" size="sm">
                Instant Fill
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('emp-1', 'sarah.connor@acme.corp')}
                className="rounded-lg border border-slate-800 bg-navy-950 p-2 text-center hover:border-violet-500 transition-all group"
              >
                <span className="text-[10px] font-bold text-violet-400 block group-hover:text-white">
                  MANAGER
                </span>
                <span className="text-[9px] text-slate-400 block truncate">Sarah C.</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('emp-8', 'chloe.dubois@acme.corp')}
                className="rounded-lg border border-slate-800 bg-navy-950 p-2 text-center hover:border-cyan-500 transition-all group"
              >
                <span className="text-[10px] font-bold text-cyan-400 block group-hover:text-white">
                  ADMIN / HR
                </span>
                <span className="text-[9px] text-slate-400 block truncate">Chloe D.</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('emp-2', 'alex.chen@acme.corp')}
                className="rounded-lg border border-slate-800 bg-navy-950 p-2 text-center hover:border-emerald-500 transition-all group"
              >
                <span className="text-[10px] font-bold text-emerald-400 block group-hover:text-white">
                  EMPLOYEE
                </span>
                <span className="text-[9px] text-slate-400 block truncate">Alex C.</span>
              </button>
            </div>
          </div>

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
