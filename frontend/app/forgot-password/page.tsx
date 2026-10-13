'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sparkles, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();

  const [email, setEmail] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const { error } = await resetPasswordForEmail(email);

    if (error) {
      setErrorMessage(error);
      setIsLoading(false);
    } else {
      setSuccessMessage('Password reset instructions sent! Check your inbox.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-glow mb-2">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Reset Password
        </h1>
        <p className="text-sm text-slate-400">
          Enter your email to receive password reset instructions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Card className="border-slate-800 bg-navy-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          <form onSubmit={handleReset} className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full mt-2 justify-center"
            >
              {isLoading ? 'Sending Link...' : 'Send Reset Instructions'}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            <Link
              href="/login"
              className="inline-flex items-center text-violet-400 hover:text-violet-300"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
