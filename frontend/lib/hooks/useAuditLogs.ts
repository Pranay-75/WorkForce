'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/authContext';
import { AuditEvent } from '@/lib/types';

export interface UseAuditLogsResult {
  auditLogs: AuditEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAuditLogs(): UseAuditLogsResult {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const [auditLogs, setAuditLogs] = React.useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const verifiedOrgId = organization?.id || null;
  const activeRequestIdRef = React.useRef<number>(0);

  const fetchAuditLogs = React.useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;

    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated || !verifiedOrgId) {
      setAuditLogs([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('organization_audit_logs')
        .select(`
          id,
          organization_id,
          actor_user_id,
          target_user_id,
          action,
          details,
          created_at,
          actor_profile:user_profiles!organization_audit_logs_actor_user_id_fkey(
            full_name
          )
        `)
        .eq('organization_id', verifiedOrgId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (requestId !== activeRequestIdRef.current) return;

      if (queryError) {
        // Fallback query without foreign join in case constraint name differs
        const { data: rawData, error: rawError } = await supabase
          .from('organization_audit_logs')
          .select('id, organization_id, actor_user_id, target_user_id, action, details, created_at')
          .eq('organization_id', verifiedOrgId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (rawError) {
          setError(rawError.message || 'Failed to load audit logs.');
          setAuditLogs([]);
          return;
        }

        const mapped: AuditEvent[] = (rawData || []).map((row: any) => {
          const detailsObj = typeof row.details === 'object' && row.details !== null ? row.details : {};
          const entityType = detailsObj.entityType || 'Workload';
          const entityTitle = detailsObj.entityTitle || detailsObj.title || row.action;

          return {
            id: row.id,
            actorId: row.actor_user_id || 'system',
            actorName: detailsObj.actorName || (row.actor_user_id ? 'Workspace Member' : 'System'),
            action: row.action,
            entityType: entityType,
            entityId: row.target_user_id || row.id,
            entityTitle: entityTitle,
            details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details || {}),
            timestamp: row.created_at,
          };
        });

        setAuditLogs(mapped);
        return;
      }

      const mapped: AuditEvent[] = (data || []).map((row: any) => {
        const actorProfile = Array.isArray(row.actor_profile) ? row.actor_profile[0] : row.actor_profile;
        const actorName = actorProfile?.full_name || 'Workspace Member';
        const detailsObj = typeof row.details === 'object' && row.details !== null ? row.details : {};
        const entityType = detailsObj.entityType || 'Workload';
        const entityTitle = detailsObj.entityTitle || detailsObj.title || row.action;

        return {
          id: row.id,
          actorId: row.actor_user_id || 'system',
          actorName: detailsObj.actorName || actorName,
          action: row.action,
          entityType: entityType,
          entityId: row.target_user_id || row.id,
          entityTitle: entityTitle,
          details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details || {}),
          timestamp: row.created_at,
        };
      });

      setAuditLogs(mapped);
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        setError(err.message || 'Unexpected error loading audit logs.');
        setAuditLogs([]);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, verifiedOrgId, supabase]);

  React.useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return {
    auditLogs,
    isLoading,
    error,
    refetch: fetchAuditLogs,
  };
}
