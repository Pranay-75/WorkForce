'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
    <div className="min-h-screen bg-wf-canvas text-wf-text-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20"><ThemeToggle variant="compact" /></div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-wf-brand-burgundy text-white shadow-sm mb-2">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-wf-text-primary tracking-tight">
          Reset Password
        </h1>
        <p className="text-sm text-wf-text-secondary">
          Enter your email to receive password reset instructions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Card className="border-wf-border-default bg-wf-surface-card shadow-elevated p-6 sm:p-8 backdrop-blur-xl">
          <form onSubmit={handleReset} className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3 text-xs text-wf-semantic-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-wf-semantic-danger shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3 text-xs text-wf-semantic-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-wf-semantic-success shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-wf-text-secondary">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-wf-text-tertiary" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle pl-9 pr-3 py-2 text-sm text-wf-text-primary placeholder:text-wf-text-tertiary focus:border-wf-border-focus focus:outline-none"
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

          <div className="mt-6 text-center text-xs text-wf-text-secondary">
            <Link
              href="/login"
              className="inline-flex items-center text-wf-brand-burgundy dark:text-wf-cream hover:underline font-medium"
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
