'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

function getNavigationForRole(role: UserRole, unreadCount: number): NavGroup[] {
  // Employee receives strictly isolated "My Workspace" group (V3.1 Section 5.1)
  if (role === 'employee') {
    return [
      {
        label: 'My Workspace',
        items: [
          { name: 'My Focus', href: '/dashboard', icon: LayoutDashboard },
          { name: 'Projects', href: '/projects', icon: FolderKanban },
          { name: 'My Tasks', href: '/tasks', icon: CheckSquare },
          {
            name: 'Notifications',
            href: '/notifications',
            icon: Bell,
            badge: unreadCount > 0 ? String(unreadCount) : undefined,
          },
        ],
      },
    ];
  }

  const coreItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Staff', href: '/employees', icon: Users },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  ];

  const aiItems: NavItem[] = [
    { name: 'AI Recommendations', href: '/matching', icon: Sparkles, badge: 'AI' },
    { name: 'Workload', href: '/workload', icon: BarChart3 },
    { name: 'Employee Insights', href: '/insights', icon: Flame },
  ];

  // Governance items configured strictly per role (V3.1 Section 5.1)
  const govItems: NavItem[] = [
    { name: 'Reports', href: '/reports', icon: FileSpreadsheet },
    ...(role === 'organizer' || role === 'admin'
      ? [{ name: 'Audit Logs', href: '/audit', icon: History }]
      : []),
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    ...(role === 'organizer' || role === 'admin' || role === 'hr'
      ? [{ name: 'Settings', href: '/settings', icon: Settings }]
      : []),
  ];

  return [
    { label: 'Core Workspace', items: coreItems },
    { label: 'AI & Capacity', items: aiItems },
    { label: 'Governance', items: govItems },
  ];
}

export function AppSidebar({
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed: controlledIsCollapsed,
  setIsCollapsed: controlledSetIsCollapsed,
}: {
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const { activeRole: mockRole, currentUser: mockUser, notifications } = useMockStore();
  const { user, profile, role: authRole, isAuthenticated, organization } = useAuth();
  const [internalIsCollapsed, setInternalIsCollapsed] = React.useState(false);

  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = controlledSetIsCollapsed || setInternalIsCollapsed;

  const isLive = isAuthenticated && Boolean(organization?.id);
  const activeRole = (isLive && authRole ? authRole : mockRole) as UserRole;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Touch gesture state for tablet/mobile drawer swipe-left dismiss
  const touchStartX = React.useRef<number | null>(null);
  const touchCurrentX = React.useRef<number | null>(null);

  // Escape key listener for tablet/mobile drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen?.(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, setIsMobileOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchCurrentX.current !== null) {
      const deltaX = touchCurrentX.current - touchStartX.current;
      // If swiped left by > 50px, dismiss
      if (deltaX < -50) {
        setIsMobileOpen?.(false);
      }
    }
    touchStartX.current = null;
    touchCurrentX.current = null;
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
    return mockUser;
  }, [isLive, profile, user, authRole, organization, mockUser]);

  const navigationGroups = React.useMemo(
    () => getNavigationForRole(activeRole, unreadCount),
    [activeRole, unreadCount]
  );

  return (
    <>
      {/* Mobile / Tablet Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-hover"
          onClick={() => setIsMobileOpen?.(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: 260px expanded, 72px collapsed per V3.1 */}
      <aside
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-label="Sidebar Navigation"
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-wf-border-default bg-wf-surface-subtle transition-all duration-nav ease-apple-nav select-none',
          isCollapsed ? 'w-[72px]' : 'w-[260px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Branding Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-wf-border-default px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden group select-none"
            onClick={() => setIsMobileOpen?.(false)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wf-brand-burgundy text-white shadow-sm transition-transform duration-micro group-hover:scale-105">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-wf-text-primary flex items-center gap-1.5">
                  WorkForce
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-wf-surface-card text-wf-text-secondary border border-wf-border-default">
                    SaaS
                  </span>
                </span>
                <span className="text-[10px] text-wf-text-tertiary font-medium tracking-wide">
                  AI Capacity Platform
                </span>
              </div>
            )}
          </Link>

          {/* Tablet/Mobile Close Button */}
          <button
            type="button"
            onClick={() => setIsMobileOpen?.(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-wf-text-secondary hover:bg-wf-surface-card hover:text-wf-text-primary lg:hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-xl p-1.5 text-wf-text-secondary hover:bg-wf-surface-card hover:text-wf-text-primary lg:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navigationGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed ? (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-wf-text-tertiary">
                  {group.label}
                </p>
              ) : (
                <div className="h-2" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false);
                  const Icon = item.icon;

                  return (
                    <div key={item.href} className="relative group">
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen?.(false)}
                        className={cn(
                          'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-nav ease-apple-nav select-none min-h-[40px]',
                          isActive
                            ? 'bg-wf-cream/35 dark:bg-wf-surface-card text-wf-text-primary font-semibold border border-wf-border-default shadow-sm'
                            : 'text-wf-text-secondary hover:bg-wf-surface-card/60 hover:text-wf-text-primary border border-transparent'
                        )}
                      >
                        {/* Sliding Warm Cream / Burgundy Accent Pill */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-wf-brand-burgundy dark:bg-wf-cream transition-all duration-nav ease-apple-nav" />
                        )}

                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            isActive
                              ? 'text-wf-brand-burgundy dark:text-wf-cream'
                              : 'text-wf-text-secondary group-hover:text-wf-text-primary'
                          )}
                        />

                        {!isCollapsed && (
                          <span className="truncate flex-1">{item.name}</span>
                        )}

                        {!isCollapsed && item.badge && (
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              item.badge === 'AI'
                                ? 'bg-wf-brand-burgundy text-white font-mono'
                                : 'bg-wf-surface-card text-wf-text-secondary border border-wf-border-default'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>

                      {/* Floating Apple Tooltip on Hover when Collapsed */}
                      {isCollapsed && (
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute left-[78px] top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 rounded-xl border border-wf-border-default bg-wf-surface-elevated px-3 py-1.5 text-xs font-semibold text-wf-text-primary shadow-elevated backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-hover whitespace-nowrap"
                        >
                          <span>{item.name}</span>
                          {item.badge && (
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-wf-brand-burgundy text-white">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Account / Footer */}
        <div className="border-t border-wf-border-default p-3 bg-wf-surface-subtle">
          <div className="relative group">
            <div
              className={cn(
                'flex items-center gap-3 rounded-xl p-2 bg-wf-surface-card border border-wf-border-default shadow-sm transition-all',
                isCollapsed && 'justify-center p-1.5'
              )}
            >
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wf-brand-burgundy font-semibold text-white text-xs border border-wf-border-default shadow-sm">
                  {displayUser.avatar}
                </div>
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-wf-surface-card" />
              </div>

              {!isCollapsed && (
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-wf-text-primary truncate">
                      {displayUser.name}
                    </span>
                    <ShieldCheck className="h-3.5 w-3.5 text-wf-brand-burgundy dark:text-wf-cream shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-wf-text-secondary">
                    <span className="truncate">{displayUser.department}</span>
                    <span>•</span>
                    <span className="text-wf-text-tertiary font-mono text-[10px] uppercase">
                      {displayUser.role}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsed Mode Floating Profile Tooltip */}
            {isCollapsed && (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-[78px] bottom-1 z-50 rounded-xl border border-wf-border-default bg-wf-surface-elevated px-3 py-2 text-xs text-wf-text-primary shadow-elevated backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-hover whitespace-nowrap"
              >
                <div className="font-semibold text-wf-text-primary">{displayUser.name}</div>
                <div className="text-[10px] text-wf-text-secondary font-mono uppercase mt-0.5">
                  {displayUser.department} • {displayUser.role}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
