'use client';

import * as React from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import { UserRole } from './types';
import { generateSlug, isValidSlug } from './slug';

export interface UserProfileData {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  department: string;
  jobTitle: string;
  weeklyCapacityHours: number;
}

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

export interface SignUpResult {
  error: string | null;
  requiresConfirmation?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfileData | null;
  organization: OrganizationData | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
    organizationName: string,
    customSlug?: string
  ) => Promise<SignUpResult>;
  bootstrapOrganization: (
    organizationName: string,
    customSlug?: string
  ) => Promise<{ error: string | null; orgId?: string }>;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<UserProfileData | null>(null);
  const [organization, setOrganization] = React.useState<OrganizationData | null>(null);
  const [role, setRole] = React.useState<UserRole>('employee');
  const [isLoading, setIsLoading] = React.useState(true);

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

        // Immediately query and set active organization & admin role
        const { data: membershipData } = await supabase
          .from('organization_memberships')
          .select('role, organization_id, organizations(id, name, slug)')
          .eq('user_id', currentSession.user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (membershipData) {
          setRole((membershipData.role as UserRole) || 'admin');
          if (membershipData.organizations) {
            const org = membershipData.organizations as any;
            setOrganization({
              id: org.id,
              name: org.name,
              slug: org.slug,
            });
          }
        } else if (orgId) {
          setRole('admin');
          setOrganization({
            id: orgId as string,
            name: trimmedName,
            slug: finalSlug,
          });
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

        // 2. Fetch active organization membership & role
        const { data: membershipData, error: memberErr } = await supabase
          .from('organization_memberships')
          .select('role, organization_id, organizations(id, name, slug)')
          .eq('user_id', currentUser.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (membershipData && !memberErr) {
          if (membershipData.role) {
            setRole(membershipData.role as UserRole);
          }
          if (membershipData.organizations) {
            const org = membershipData.organizations as any;
            setOrganization({
              id: org.id,
              name: org.name,
              slug: org.slug,
            });
          }
        } else {
          setOrganization(null);
        }
      } catch (err) {
        console.warn('Could not fetch Supabase profile data:', err);
      }
    },
    [supabase]
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
    organizationName: string,
    customSlug?: string
  ): Promise<SignUpResult> => {
    try {
      const trimmedName = fullName.trim();
      const trimmedOrg = organizationName.trim();

      if (trimmedName.length < 2) {
        return { error: 'Full name must be at least 2 characters.' };
      }
      if (trimmedOrg.length < 2) {
        return { error: 'Organization name must be at least 2 characters.' };
      }

      const slug = customSlug ? generateSlug(customSlug) : generateSlug(trimmedOrg);
      if (!isValidSlug(slug)) {
        return { error: 'Invalid organization slug format. Use lowercase alphanumeric characters and hyphens.' };
      }

      // 1. Sign up user via Supabase Auth with metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedName,
            organization_name: trimmedOrg,
            organization_slug: slug,
          },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      });

      if (signUpError) {
        return { error: signUpError.message };
      }

      // 2. Check if an active session is returned immediately (instant sign-up without email confirmation)
      if (data?.session && data.user) {
        const { error: bootstrapErr } = await bootstrapOrganization(trimmedOrg, slug);
        if (bootstrapErr) {
          return { error: bootstrapErr };
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
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        role,
        isAuthenticated: !!user,
        isLoading,
        signInWithPassword,
        signUpWithPassword,
        bootstrapOrganization,
        refreshUserData,
        signOut,
        resetPasswordForEmail,
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


