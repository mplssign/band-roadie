import { useCallback, useEffect, useMemo, useState } from 'react';

export interface BandMemberRecord {
  id: string;
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  is_active?: boolean | null;
}

interface UseBandMembersOptions {
  enabled?: boolean;
}

interface UseBandMembersResult {
  members: BandMemberRecord[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useBandMembers(
  bandId?: string | null,
  options: UseBandMembersOptions = {},
): UseBandMembersResult {
  const { enabled = true } = options;
  const [members, setMembers] = useState<BandMemberRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!bandId || !enabled) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMembers([]);

    try {
      const response = await fetch(`/api/bands/${bandId}/members`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load members (${response.status})`);
      }

      const payload = await response.json();
      const fetchedMembers = Array.isArray(payload.members) ? payload.members : [];

      setMembers(
        fetchedMembers.map((member: any) => ({
          id: member.id as string,
          user_id: member.user_id as string,
          first_name: member?.user?.first_name ?? null,
          last_name: member?.user?.last_name ?? null,
          is_active: member?.is_active ?? null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load band members'));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [bandId, enabled]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const refresh = useCallback(async () => {
    await fetchMembers();
  }, [fetchMembers]);

  return useMemo(
    () => ({
      members,
      loading,
      error,
      refresh,
    }),
    [members, loading, error, refresh],
  );
}
