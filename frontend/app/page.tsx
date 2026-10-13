'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, organization, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!organization) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, organization, router]);

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <span className="text-xs text-slate-400 font-mono">Routing to WorkForce workspace...</span>
      </div>
    </div>
  );
}
