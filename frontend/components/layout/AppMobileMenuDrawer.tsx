'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMockStore, demoIdentities } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { UserRole } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  X,
  User,
  Users,
  FolderKanban,
  CheckSquare,
  Sparkles,
  BarChart3,
  Flame,
  FileSpreadsheet,
  History,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export function AppMobileMenuDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, switchDemoRole, activeRole: mockRole, isDemoMode, exitDemoMode } = useMockStore();
  const { user, profile, role: authRole, isAuthenticated, organization, signOut } = useAuth();

  const isLive = isAuthenticated && Boolean(organization?.id);
  const activeRole = (isLive && authRole ? authRole : mockRole) as UserRole;
  const currentUserId = isLive ? (user?.id || '') : currentUser.id;

  // Touch gesture state for swipe-down to dismiss
  const touchStartY = React.useRef<number | null>(null);
  const touchCurrentY = React.useRef<number | null>(null);

  // Keyboard escape listener (WCAG AA requirement)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartY.current !== null && touchCurrentY.current !== null) {
      const deltaY = touchCurrentY.current - touchStartY.current;
      // If pulled down by more than 60px, dismiss
      if (deltaY > 60) {
        onClose();
      }
    }
    touchStartY.current = null;
    touchCurrentY.current = null;
  };

  const handleSignOut = async () => {
    onClose();
    if (isDemoMode) {
      exitDemoMode();
      router.push('/login');
    } else {
      await signOut();
      router.push('/login');
    }
  };

  const displayUser = React.useMemo(() => {
    if (isLive) {
      const name = profile?.fullName || user?.email?.split('@')[0] || 'User';
      const avatar = (profile?.fullName || user?.email || 'U')[0].toUpperCase();
      return {
        name,
        department: organization?.name || 'Workspace',
        role: authRole || 'member',
        avatar,
      };
    }
    return currentUser;
  }, [isLive, profile, user, authRole, organization, currentUser]);

  // Secondary navigation items tailored strictly by role (V3.1 Section 5.3)
  // Employee has ZERO secondary navigation links to protected areas!
  const secondaryLinks = React.useMemo(() => {
    switch (activeRole) {
      case 'employee':
        return []; // Strictly empty per V3.1
      case 'manager':
        return [
          { name: 'Staff Directory', href: '/employees', icon: Users },
          { name: 'Capacity Monitor', href: '/workload', icon: BarChart3 },
          { name: 'Employee Insights', href: '/insights', icon: Flame },
          { name: 'Reports & Analytics', href: '/reports', icon: FileSpreadsheet },
          { name: 'Notifications', href: '/notifications', icon: Bell },
        ];
      case 'hr':
        return [
          { name: 'Project Portfolio', href: '/projects', icon: FolderKanban },
          { name: 'Task Management', href: '/tasks', icon: CheckSquare },
          { name: 'AI Recommendations', href: '/matching', icon: Sparkles },
          { name: 'Capacity Monitor', href: '/workload', icon: BarChart3 },
          { name: 'Reports & Analytics', href: '/reports', icon: FileSpreadsheet },
          { name: 'Notifications', href: '/notifications', icon: Bell },
        ];
      case 'organizer':
      case 'admin':
      default:
        return [
          { name: 'Task Management', href: '/tasks', icon: CheckSquare },
          { name: 'AI Recommendations', href: '/matching', icon: Sparkles },
          { name: 'Capacity Monitor', href: '/workload', icon: BarChart3 },
          { name: 'Employee Insights', href: '/insights', icon: Flame },
          { name: 'Reports & Analytics', href: '/reports', icon: FileSpreadsheet },
          { name: 'Notifications', href: '/notifications', icon: Bell },
          { name: 'Workspace Settings', href: '/settings', icon: Settings },
        ];
    }
  }, [activeRole]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace Menu">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-hover"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-[28px] border-t border-wf-border-default bg-wf-surface-card p-4 sm:p-6 shadow-elevated transition-transform animate-in slide-in-from-bottom duration-drawer ease-apple-drawer overflow-hidden"
      >
        {/* Swipe Handle Indicator */}
        <div className="mx-auto h-1.5 w-12 rounded-full bg-wf-border-strong mb-3 opacity-60" />

        {/* Sheet Header with Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-wf-border-subtle">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-wf-brand-burgundy dark:text-wf-cream">
              Workspace Menu
            </span>
            <Badge variant="slate" size="sm" className="font-mono text-[10px] uppercase">
              {activeRole}
            </Badge>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-wf-text-secondary hover:bg-wf-surface-subtle hover:text-wf-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus"
            aria-label="Close menu drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* User Profile Card */}
          <div className="flex items-center gap-3.5 rounded-2xl bg-wf-surface-subtle p-3.5 border border-wf-border-default shadow-sm">
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-wf-brand-burgundy text-white font-bold text-sm border border-wf-border-default shadow-sm">
                {displayUser.avatar}
              </div>
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-wf-surface-subtle" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-wf-text-primary truncate">
                  {displayUser.name}
                </span>
                <ShieldCheck className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream shrink-0" />
              </div>
              <p className="text-xs text-wf-text-secondary truncate mt-0.5">
                {displayUser.department} • <span className="font-mono uppercase text-[10px]">{displayUser.role}</span>
              </p>
            </div>
          </div>

          {/* Self Profile Link (Permitted for all roles, including employee) */}
          {currentUserId && (
            <Link
              href={`/employees/${currentUserId}`}
              onClick={onClose}
              className="flex items-center justify-between rounded-xl p-3.5 bg-wf-surface-elevated hover:bg-wf-surface-subtle border border-wf-border-default transition-all shadow-sm group min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wf-cream/35 dark:bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-wf-text-primary">
                    {activeRole === 'employee' ? 'My Profile & Capacity' : 'View My Profile'}
                  </span>
                  <span className="text-[10px] text-wf-text-secondary">
                    Personal allocation, skills and schedule
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-wf-text-tertiary group-hover:text-wf-text-primary transition-colors" />
            </Link>
          )}

          {/* Secondary Role Navigation Links (Filtered strictly - empty for employee) */}
          {secondaryLinks.length > 0 && (
            <div className="space-y-1">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-wf-text-tertiary block">
                Additional Modules
              </span>
              <div className="space-y-1">
                {secondaryLinks.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center justify-between rounded-xl p-3 text-xs font-medium transition-colors border min-h-[44px]',
                        isActive
                          ? 'bg-wf-cream/35 dark:bg-wf-surface-subtle text-wf-text-primary border-wf-border-default font-semibold'
                          : 'bg-transparent hover:bg-wf-surface-subtle text-wf-text-secondary hover:text-wf-text-primary border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn('h-4 w-4', isActive ? 'text-wf-brand-burgundy dark:text-wf-cream' : 'text-wf-text-secondary')} />
                        <span>{item.name}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-wf-text-tertiary" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Demo Identity Switcher (Accessible in Demo Mode for easy role testing) */}
          {isDemoMode && (
            <div className="rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-wf-brand-burgundy dark:text-wf-cream block">
                ⚡ Switch Demo Role
              </span>
              <div className="space-y-1">
                {demoIdentities.map((identity) => {
                  const isSelected = identity.id === currentUser.id;
                  return (
                    <button
                      key={identity.id}
                      type="button"
                      onClick={() => {
                        switchDemoRole(identity.id);
                        onClose();
                      }}
                      className={cn(
                        'w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors min-h-[44px]',
                        isSelected
                          ? 'bg-wf-cream/30 dark:bg-wf-surface-card text-wf-text-primary border border-wf-border-default font-semibold'
                          : 'text-wf-text-secondary hover:bg-wf-surface-card hover:text-wf-text-primary'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wf-surface-card text-[10px] font-bold text-wf-text-primary border border-wf-border-default shrink-0">
                          {identity.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-wf-text-primary truncate">
                            {identity.name}
                          </div>
                          <div className="text-[10px] text-wf-text-secondary truncate">
                            {identity.jobTitle}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          identity.role === 'organizer'
                            ? 'amber'
                            : identity.role === 'admin'
                            ? 'violet'
                            : identity.role === 'manager'
                            ? 'cyan'
                            : identity.role === 'hr'
                            ? 'emerald'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {identity.role.toUpperCase()}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Display Preferences */}
          <div className="rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3.5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-wf-text-tertiary block">
              Display Preferences
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-wf-text-secondary">Interface Theme</span>
              <ThemeToggle variant="segmented" />
            </div>
          </div>

          {/* Sign Out / Exit Demo */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg/40 p-3 text-xs font-semibold text-wf-semantic-danger hover:bg-wf-semantic-danger-bg transition-colors active:scale-[0.98] min-h-[44px]"
            >
              <LogOut className="h-4 w-4" />
              <span>{isDemoMode ? 'Exit Demo Session' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
