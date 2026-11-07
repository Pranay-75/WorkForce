'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useMockStore } from '@/lib/mockStore';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  SlidersHorizontal,
  Lock,
  Layers,
  Menu,
  X,
  ExternalLink,
  Users,
  Check,
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, organization } = useAuth();
  const { isDemoMode } = useMockStore();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Determine destination for authenticated users
  const workspaceHref = organization ? '/dashboard' : '/onboarding';

  return (
    <div className="min-h-screen bg-background-base text-zinc-100 flex flex-col selection:bg-zinc-200 selection:text-zinc-950">
      {/* =====================================================================
          1. HEADER
          ===================================================================== */}
      <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-background-base/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Wordmark */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-lg p-1"
            aria-label="WorkForce Home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 shadow-sm group-hover:bg-white transition-colors">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">WorkForce</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                SaaS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
            <a
              href="#capabilities"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded px-1.5 py-1"
            >
              Capabilities
            </a>
            <a
              href="#preview"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded px-1.5 py-1"
            >
              Product Preview
            </a>
            <a
              href="#governance"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded px-1.5 py-1"
            >
              Governance & Security
            </a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated || isDemoMode ? (
              <Link href={workspaceHref}>
                <Button variant="primary" size="sm" className="gap-1.5">
                  <span>Go to Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm" className="gap-1.5">
                    <span>Get started</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-border-subtle bg-zinc-950 px-4 pt-3 pb-5 space-y-4 animate-in fade-in duration-150">
            <nav className="flex flex-col space-y-2">
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-zinc-300 hover:text-white px-2 py-1.5 rounded-md hover:bg-zinc-900"
              >
                Capabilities
              </a>
              <a
                href="#preview"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-zinc-300 hover:text-white px-2 py-1.5 rounded-md hover:bg-zinc-900"
              >
                Product Preview
              </a>
              <a
                href="#governance"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-zinc-300 hover:text-white px-2 py-1.5 rounded-md hover:bg-zinc-900"
              >
                Governance & Security
              </a>
            </nav>
            <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
              {isAuthenticated || isDemoMode ? (
                <Link href={workspaceHref} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="md" className="w-full gap-2">
                    <span>Go to Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="md" className="w-full gap-2">
                      <span>Get started</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="md" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          2. HERO SECTION
          ===================================================================== */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 border-b border-border-subtle overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            {/* Status / Category Chip */}
            <div className="inline-flex items-center gap-2">
              <Badge variant="slate" size="sm" className="font-mono text-zinc-300 border-zinc-700">
                Workforce Capacity Platform
              </Badge>
              <span className="text-xs text-zinc-500 hidden sm:inline">•</span>
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Multi-Tenant Enterprise Architecture
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Operational capacity monitoring & explainable task allocation.
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              Workforce gives engineering and operations leaders real-time visibility into team bandwidth, matches tasks to qualified staff through deterministic skill constraints, and preserves full managerial control with human-in-the-loop approvals.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button variant="primary" size="lg" className="gap-2 text-base">
                  <span>Get started</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="text-base">
                  Sign in
                </Button>
              </Link>
            </div>

            {/* Trust and Engineering Assurances */}
            <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-zinc-300" />
                PostgreSQL Row-Level Security
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-zinc-300" />
                Deterministic matching logic
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-zinc-300" />
                Immutable audit history
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. CORE CAPABILITIES (BENEFITS GROUNDED IN ACTUAL PRODUCT FEATURES)
          ===================================================================== */}
      <section id="capabilities" className="py-20 border-b border-border-subtle bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Core Capabilities
            </h2>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Built for precision, accountability, and operational clarity.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Every feature in Workforce relies on documented formulas, verifiable constraints, and server-side authorization. No black-box guesses or opaque metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Capability 1: Skill-Based Task Matching */}
            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center border border-zinc-700">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Explainable Task Matching</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Matches incoming work to staff using deterministic skill requirements, current capacity, and availability. Contributing factors and score deltas are fully explainable.
              </p>
            </Card>

            {/* Capability 2: Workload & Bandwidth Monitoring */}
            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center border border-zinc-700">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Bandwidth & Capacity Tracking</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Real-time tracking of weekly allocated hours against configured capacity. Flags overload thresholds early using documented operational formulas without clinical speculation.
              </p>
            </Card>

            {/* Capability 3: Human-in-the-Loop Governance */}
            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center border border-zinc-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Human-in-the-Loop Oversight</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Algorithmic recommendations are strictly advisory. Managers and administrators review, approve, or adjust assignments before any task or project allocation takes effect.
              </p>
            </Card>

            {/* Capability 4: Multi-Tenant Role Privileges */}
            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-4">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center border border-zinc-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Role-Based Governance</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Hierarchical role boundaries (Organizer, Admin, HR, Manager, and Staff) enforced by PostgreSQL Row-Level Security, complemented by an immutable compliance audit log.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. PRODUCT PREVIEW (AUTHENTIC UI WITH REAL APP COMPONENTS)
          ===================================================================== */}
      <section id="preview" className="py-20 border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Product Preview
            </h2>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Transparent workflows for everyday team decisions.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Experience the actual interface components used by managers to evaluate task allocations and monitor team capacity.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Preview Left: Task Matching Recommendation Card */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Component: Matching Engine Review</span>
                <Badge variant="emerald" size="sm">Advisory Recommendation</Badge>
              </div>

              <Card className="bg-zinc-900/90 border-zinc-800 p-6 space-y-6">
                {/* Task Context */}
                <div className="space-y-2 border-b border-zinc-800 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-400">TASK-104 • Distributed Backend</span>
                    <Badge variant="slate" size="sm">High Priority</Badge>
                  </div>
                  <h4 className="text-lg font-semibold text-white">
                    Implement Distributed Invalidation Engine
                  </h4>
                  <p className="text-xs text-zinc-400">
                    High complexity • Estimated duration: 14.0 hours
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="blue" size="sm">TypeScript</Badge>
                    <Badge variant="blue" size="sm">PostgreSQL</Badge>
                    <Badge variant="blue" size="sm">Distributed Systems</Badge>
                  </div>
                </div>

                {/* Recommended Candidate */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">Alex Rivera</span>
                        <Badge variant="outline" size="sm">Staff Engineer</Badge>
                      </div>
                      <span className="text-xs text-zinc-400">Current allocation: 32.0 / 40.0 hrs</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-400 font-mono">94% Match</span>
                      <p className="text-[10px] text-zinc-500 font-mono">Mandatory skills verified</p>
                    </div>
                  </div>

                  {/* Factor Breakdown */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Skill overlap (3/3 required skills matched)</span>
                      <span className="font-mono text-zinc-200">100%</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Capacity delta (+14h project allocation)</span>
                      <span className="font-mono text-amber-300">Within Threshold</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Deterministic constraints</span>
                      <span className="font-mono text-emerald-400">Passed</span>
                    </div>
                  </div>

                  {/* Manager Approval CTA */}
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">
                      Requires manager approval to commit
                    </span>
                    <Button variant="primary" size="sm" className="gap-1.5 pointer-events-none">
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve Assignment</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Preview Right: Team Bandwidth Summary */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Component: Capacity Monitor</span>
                <Badge variant="slate" size="sm">Real-Time Data</Badge>
              </div>

              <Card className="bg-zinc-900/90 border-zinc-800 p-6 space-y-5">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Engineering Workspace Bandwidth</h4>
                  <p className="text-xs text-zinc-400">Sprint cycle capacity allocation</p>
                </div>

                {/* Progress Metric */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">Allocated / Available</span>
                    <span className="text-zinc-100 font-semibold">148.0h / 160.0h</span>
                  </div>
                  <ProgressBar value={148} max={160} colorScheme="auto" />
                  <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                    <span>92.5% utilization</span>
                    <span>12h reserve margin</span>
                  </div>
                </div>

                {/* Task Distribution Status */}
                <div className="pt-4 border-t border-zinc-800 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-950/60 p-3 border border-zinc-800/80">
                    <span className="text-[11px] text-zinc-500 block font-mono">In Progress</span>
                    <span className="text-lg font-bold text-zinc-100 font-mono">14</span>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3 border border-zinc-800/80">
                    <span className="text-[11px] text-zinc-500 block font-mono">Completed</span>
                    <span className="text-lg font-bold text-zinc-100 font-mono">28</span>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3 border border-zinc-800/80">
                    <span className="text-[11px] text-zinc-500 block font-mono">To Do</span>
                    <span className="text-lg font-bold text-zinc-100 font-mono">8</span>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3 border border-zinc-800/80">
                    <span className="text-[11px] text-zinc-500 block font-mono">In Review</span>
                    <span className="text-lg font-bold text-zinc-100 font-mono">5</span>
                  </div>
                </div>

                {/* Operational indicator note */}
                <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
                  Indicator: Team workload is balanced across 3 active projects without individual member overload.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. GOVERNANCE & SECURITY SPECIFICATIONS
          ===================================================================== */}
      <section id="governance" className="py-20 border-b border-border-subtle bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Enterprise Governance
            </h2>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Multi-tenant architecture designed for security.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Every request is authenticated, tenant-isolated, and strictly bounded by the database kernel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-zinc-200">
                <Lock className="h-4 w-4" />
                <h4 className="font-semibold text-sm">PostgreSQL Row-Level Security</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                All data queries enforce tenant isolation at the database layer using Postgres RLS policies. Client applications cannot bypass organizational boundary rules.
              </p>
            </Card>

            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-zinc-200">
                <Users className="h-4 w-4" />
                <h4 className="font-semibold text-sm">Fine-Grained Role Hierarchy</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Roles are scoped to each organization membership: Organizer (owner), Admin, HR, Manager, and Staff. Admins cannot promote peers to Organizer or alter owner rights.
              </p>
            </Card>

            <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-zinc-200">
                <Layers className="h-4 w-4" />
                <h4 className="font-semibold text-sm">Immutable Audit Logs</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Critical lifecycle events—member additions, role changes, removals, and ownership transfers—are recorded permanently in the organization audit table.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. CLOSING CALL TO ACTION
          ===================================================================== */}
      <section className="py-20 border-b border-border-subtle bg-zinc-900/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Ready to balance your organization&apos;s workload?
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Create an organization workspace in minutes with role-based access control and deterministic capacity monitoring.
          </p>
          <div className="pt-2 flex flex-wrap justify-center items-center gap-3">
            <Link href="/register">
              <Button variant="primary" size="lg" className="gap-2">
                <span>Get started</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. FOOTER
          ===================================================================== */}
      <footer className="mt-auto py-12 bg-background-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-zinc-800/80 pb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 text-zinc-950">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                </div>
                <span className="font-bold text-sm text-white">WorkForce</span>
              </div>
              <p className="text-xs text-zinc-500">
                AI-Powered Capacity Management & Task Balancing Platform
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-400">
              <Link href="/login" className="hover:text-zinc-100 transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="hover:text-zinc-100 transition-colors">
                Get Started
              </Link>
              <a
                href="https://workforce-platform.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-100 transition-colors flex items-center gap-1"
              >
                <span>Production</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-400">
            <p>© 2026 WorkForce Platform. All rights reserved.</p>
            <p className="font-mono text-zinc-400">
              Multi-tenant architecture protected by PostgreSQL Row-Level Security
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
