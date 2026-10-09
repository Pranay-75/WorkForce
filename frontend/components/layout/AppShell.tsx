'use client';

import * as React from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useMockStore } from '@/lib/mockStore';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const { feedbackMessage } = useMockStore();

  return (
    <div className="min-h-screen bg-background-base text-slate-100 flex">
      {/* Sidebar (Desktop fixed + Mobile drawer) */}
      <AppSidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-64">
        {/* Sticky Header */}
        <AppHeader onMobileMenuToggle={() => setIsMobileOpen(true)} />

        {/* Global Floating Feedback Toast */}
        {feedbackMessage && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-3 rounded-xl border border-violet-500/50 bg-navy-900/95 px-4 py-3 text-sm text-slate-200 shadow-elevated backdrop-blur-md animate-in slide-in-from-top-4 duration-200">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/30 text-violet-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-white">{feedbackMessage}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                Simulated frontend state • Not persisted to backend
              </span>
            </div>
            <Badge variant="cyan" size="sm" className="ml-2">
              <Sparkles className="h-2.5 w-2.5" />
              Live Demo
            </Badge>
          </div>
        )}

        {/* Dynamic Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
