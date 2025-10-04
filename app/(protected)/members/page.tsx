'use client';

import { useEffect, useState } from 'react';
import { useBands } from '@/hooks/useBands';

type MemberRow = {
  user_id: string;
  role: string;
  joined_at: string | null;
  users: { email: string | null; first_name: string | null; last_name: string | null } | null;
};

type InviteRow = {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

export default function MembersPage() {
  const { currentBand, loading: bandsLoading } = useBands();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentBand?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/bands/${currentBand.id}/members`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load members');
        setMembers(json.members ?? []);
        setInvites(json.invites ?? []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load members';
        setError(msg);
        setMembers([]);
        setInvites([]);
      } finally {
        setLoading(false);
      }
    }
    if (!bandsLoading) void load();
  }, [currentBand?.id, bandsLoading]);

  if (bandsLoading || loading) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!currentBand) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex items-center justify-center">
        <div className="text-zinc-400">No band selected.</div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-black text-white px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold">Members</h1>
        {error && (
          <div className="mt-4 rounded-lg border border-red-500 bg-red-950/40 p-3 text-red-200">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-lg font-semibold">Current Members</h2>
            </div>
            <div className="px-4 py-4">
              {members.length === 0 ? (
                <p className="text-zinc-400">No members yet.</p>
              ) : (
                <ul className="space-y-3">
                  {members.map((m) => {
                    const name = [m.users?.first_name, m.users?.last_name].filter(Boolean).join(' ');
                    const label = name || m.users?.email || m.user_id;
                    return (
                      <li key={m.user_id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                        <div>
                          <div className="font-medium text-white">{label}</div>
                          <div className="text-sm text-zinc-400">Role: {m.role}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-lg font-semibold">Pending Invites</h2>
            </div>
            <div className="px-4 py-4">
              {invites.length === 0 ? (
                <p className="text-zinc-400">No pending invites.</p>
              ) : (
                <ul className="space-y-3">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                      <div>
                        <div className="font-medium text-white">{i.email}</div>
                        <div className="text-sm text-zinc-400">
                          Status: {i.status} • Expires: {i.expires_at ? new Date(i.expires_at).toLocaleDateString() : 'n/a'}
                        </div>
                      </div>
                      <a href={`/invite/${i.id}`} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black">
                        View
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}