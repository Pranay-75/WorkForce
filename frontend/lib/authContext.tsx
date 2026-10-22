'use client';

import * as React from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import { UserRole, UserProfileData, OrganizationData, SignUpResult } from './types';
import { generateSlug, isValidSlug } from './slug';

export type { UserProfileData, OrganizationData, SignUpResult };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfileData | null;
  organization: OrganizationData | null;
  availableOrganizations: OrganizationData[];
  hasAmbiguousMembership: boolean;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
    organizationName?: string,
    customSlug?: string
  ) => Promise<SignUpResult>;
  bootstrapOrganization: (
    organizationName: string,
    customSlug?: string
  ) => Promise<{ error: string | null; orgId?: string }>;
  selectOrganization: (organizationId: string) => void;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<UserProfileData | null>(null);
  const [organization, setOrganization] = React.useState<OrganizationData | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = React.useState<OrganizationData[]>([]);
  const [hasAmbiguousMembership, setHasAmbiguousMembership] = React.useState(false);
  const [role, setRole] = React.useState<UserRole>('employee');
  const [isLoading, setIsLoading] = React.useState(true);

  const allMembershipsRef = React.useRef<any[]>([]);

  const supabase = React.useMemo(() => createClient(), []);

  const bootstrapOrganization = React.useCallback(
    async (organizationName: string, customSlug?: string): Promise<{ error: string | null; orgId?: string }> => {
      try {
        const trimmedName = organizationName.trim();
        if (trimmedName.length < 2) {
          return { error: 'Organization name must be at least 2 characters.' };
        }

        const finalSlug = customSlug ? generateSlug(customSlug) : generateSlug(trimmedName);
        if (!isValidSlug(finalSlug)) {
          return { error: 'Organization identifier (slug) must contain at least 2 alphanumeric characters.' };
        }

        // Check active session before invoking RPC
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!currentSession?.user) {
          return { error: 'Active authentication session required. Please sign in to continue.' };
        }

        // Call atomic security-definer RPC function as the authenticated user
        const { data: orgId, error: rpcError } = await supabase.rpc('create_organization_with_admin', {
          p_name: trimmedName,
          p_slug: finalSlug,
        });

        if (rpcError) {
          const errMsg = (rpcError.message || '').toLowerCase();
          if (errMsg.includes('duplicate key') || errMsg.includes('slug') || errMsg.includes('unique constraint') || errMsg.includes('already taken')) {
            return {
              error: `The organization URL slug "${finalSlug}" is already taken. Please enter a unique identifier.`,
            };
          }
          return { error: rpcError.message || 'Failed to create organization workspace.' };
        }

        // Save active org in localStorage
        if (typeof window !== 'undefined' && orgId) {
          localStorage.setItem('workforce_active_org_id', orgId as string);
        }

        // Immediately query and set active organization & admin role
        const { data: membershipData } = await supabase
          .from('organization_memberships')
          .select('role, organization_id, organizations(id, name, slug)')
          .eq('user_id', currentSession.user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (membershipData?.role) {
          // The creator who bootstrapped this organization is the initial Organizer
          setRole('organizer');
          if (membershipData.organizations) {
            const org = membershipData.organizations as any;
            const orgObj = {
              id: org.id,
              name: org.name,
              slug: org.slug,
            };
            setOrganization(orgObj);
            setAvailableOrganizations([orgObj]);
            setHasAmbiguousMembership(false);
          }
        } else {
          // Fail closed: never assume admin on missing or unverified membership
          setRole('employee');
          setOrganization(null);
          setAvailableOrganizations([]);
          setHasAmbiguousMembership(false);
        }

        return { error: null, orgId: orgId as string };
      } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred during organization bootstrap.' };
      }
    },
    [supabase]
  );

  const fetchUserData = React.useCallback(
    async (currentUser: User) => {
      try {
        // 1. Fetch user_profile
        const { data: profileData, error: profileErr } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profileData && !profileErr) {
          setProfile({
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            avatarUrl: profileData.avatar_url,
            department: profileData.department,
            jobTitle: profileData.job_title,
            weeklyCapacityHours: Number(profileData.weekly_capacity_hours) || 40,
          });
        }

        // 2. Fetch all active memberships deterministically (ordered by created_at DESC)
        const { data: allMemberships, error: memberErr } = await supabase
          .from('organization_memberships')
          .select('role, organization_id, created_at, organizations(id, name, slug)')
          .eq('user_id', currentUser.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        allMembershipsRef.current = allMemberships || [];

        if (memberErr || !allMemberships || allMemberships.length === 0) {
          // Zero memberships: strictly fail closed
          setRole('employee');
          setOrganization(null);
          setAvailableOrganizations([]);
          setHasAmbiguousMembership(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('workforce_active_org_id');
          }
        } else {
          // Map all valid organization summaries
          const orgsList: OrganizationData[] = allMemberships
            .filter((m: any) => m.organizations)
            .map((m: any) => ({
              id: m.organizations.id,
              name: m.organizations.name,
              slug: m.organizations.slug,
            }));
          setAvailableOrganizations(orgsList);

          // Helper to distinguish Organizer (first active member/creator) from delegated Admins
          const resolveMemberRole = async (rawRole: string, orgId: string, currentUid: string, orgCreatedBy?: string): Promise<UserRole> => {
            if (rawRole === 'organizer') return 'organizer';
            if (rawRole === 'admin') {
              if (orgCreatedBy && orgCreatedBy === currentUid) {
                return 'organizer';
              }
              try {
                const { data: firstMember } = await supabase
                  .from('organization_memberships')
                  .select('user_id')
                  .eq('organization_id', orgId)
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                if (firstMember && firstMember.user_id === currentUid) {
                  return 'organizer';
                }
              } catch {
                // Fail-safe to admin
              }
              return 'admin';
            }
            if (rawRole === 'manager') return 'manager';
            return 'employee';
          };

          if (allMemberships.length === 1) {
            // Exactly 1 membership: deterministically select it
            const m = allMemberships[0];
            const org = m.organizations as any;
            const resolved = await resolveMemberRole(m.role, org.id, currentUser.id);
            setRole(resolved);
            setOrganization({
              id: org.id,
              name: org.name,
              slug: org.slug,
            });
            setHasAmbiguousMembership(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem('workforce_active_org_id', org.id);
            }
          } else {
            // Multiple memberships exist: require explicit selection
            const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('workforce_active_org_id') : null;
            const matched = storedOrgId
              ? allMemberships.find((m: any) => m.organization_id === storedOrgId)
              : null;

            if (matched && matched.organizations) {
              const org = matched.organizations as any;
              const resolved = await resolveMemberRole(matched.role, org.id, currentUser.id);
              setRole(resolved);
              setOrganization({
                id: org.id,
                name: org.name,
                slug: org.slug,
              });
              setHasAmbiguousMembership(false);
            } else {
              // Fail closed: multiple memberships with no explicit selection
              // Do NOT silently pick an arbitrary organization
              setRole('employee');
              setOrganization(null);
              setHasAmbiguousMembership(true);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch Supabase profile data:', err);
      }
    },
    [supabase]
  );

  const selectOrganization = React.useCallback(
    async (targetOrgId: string) => {
      const matched = allMembershipsRef.current.find((m: any) => m.organization_id === targetOrgId);
      if (!matched || !matched.organizations) {
        console.warn('Cannot select organization: verified active membership not found.');
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('workforce_active_org_id', targetOrgId);
      }
      const org = matched.organizations as any;
      let determinedRole: UserRole = (matched.role as UserRole) || 'employee';
      if (matched.role === 'admin') {
        try {
          const { data: firstMember } = await supabase
            .from('organization_memberships')
            .select('user_id')
            .eq('organization_id', targetOrgId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstMember && firstMember.user_id === user?.id) {
            determinedRole = 'organizer';
          }
        } catch {
          determinedRole = 'admin';
        }
      }
      setRole(determinedRole);
      setOrganization({
        id: org.id,
        name: org.name,
        slug: org.slug,
      });
      setHasAmbiguousMembership(false);
    },
    [supabase, user]
  );

  const refreshUserData = React.useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    if (currentSession?.user) {
      await fetchUserData(currentSession.user);
    }
  }, [supabase, fetchUserData]);

  React.useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user || null);

          if (initialSession?.user) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('workforce_demo_mode');
              localStorage.removeItem('workforce_demo_user_id');
            }
            await fetchUserData(initialSession.user);
          }
        }
      } catch (err) {
        console.warn('Supabase auth initialization error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('workforce_demo_mode');
          localStorage.removeItem('workforce_demo_user_id');
        }
        await fetchUserData(newSession.user);
      } else {
        setProfile(null);
        setOrganization(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserData]);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Authentication failed' };
    }
  };

  const signUpWithPassword = async (
    email: string,
    password: string,
    fullName: string,
    organizationName?: string,
    customSlug?: string
  ): Promise<SignUpResult> => {
    try {
      const trimmedName = fullName.trim();
      const trimmedOrg = organizationName?.trim() || '';

      if (trimmedName.length < 2) {
        return { error: 'Full name must be at least 2 characters.' };
      }

      let slug = '';
      if (trimmedOrg.length > 0) {
        if (trimmedOrg.length < 2) {
          return { error: 'Organization name must be at least 2 characters.' };
        }
        slug = customSlug ? generateSlug(customSlug) : generateSlug(trimmedOrg);
        if (!isValidSlug(slug)) {
          return { error: 'Invalid organization slug format. Use lowercase alphanumeric characters and hyphens.' };
        }
      }

      // Role assignment is strictly governed:
      // - Creating an organization bootstraps the creator as administrator via secure DB function.
      // - Joining without organization creation defaults metadata role strictly to employee.
      // - Users cannot pick or self-elevate their role during registration.
      const userDepartment = trimmedOrg ? 'Administration' : 'Engineering';
      const userJobTitle = trimmedOrg ? 'Workspace Administrator' : 'Software Engineer';
      const defaultRole: UserRole = trimmedOrg ? 'admin' : 'employee';

      // 1. Sign up user via Supabase Auth with metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedName,
            ...(trimmedOrg ? { organization_name: trimmedOrg, organization_slug: slug } : {}),
            role: defaultRole,
            department: userDepartment,
            job_title: userJobTitle,
          },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      });

      if (signUpError) {
        return { error: signUpError.message };
      }

      // 2. Check if an active session is returned immediately (instant sign-up without email confirmation)
      if (data?.session && data.user) {
        if (trimmedOrg && slug) {
          const { error: bootstrapErr } = await bootstrapOrganization(trimmedOrg, slug);
          if (bootstrapErr) {
            return { error: bootstrapErr };
          }
        }
        await fetchUserData(data.user);
        return { error: null, requiresConfirmation: false };
      }

      // 3. Email confirmation required: User created without session yet
      return { error: null, requiresConfirmation: true };
    } catch (err: any) {
      return { error: err.message || 'Registration failed' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workforce_active_org_id');
      localStorage.removeItem('workforce_demo_mode');
      localStorage.removeItem('workforce_demo_user_id');
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
    setAvailableOrganizations([]);
    setHasAmbiguousMembership(false);
    allMembershipsRef.current = [];
  };

  const resetPasswordForEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Password reset request failed' };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      if (!password || password.length < 8) {
        return { error: 'Password must be at least 8 characters.' };
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Password update failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        availableOrganizations,
        hasAmbiguousMembership,
        role,
        isAuthenticated: !!user,
        isLoading,
        signInWithPassword,
        signUpWithPassword,
        bootstrapOrganization,
        selectOrganization,
        refreshUserData,
        signOut,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


