'use client';

import { useEffect, useState } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { Users, Phone, Mail, MapPin, CalendarDays } from 'lucide-react';

type MemberRow = {
  user_id: string;
  role: string;
  joined_at: string | null;
  user: {
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    zip?: string | null;
    birthday?: string | null;
    roles?: string[] | null;
    profile_completed?: boolean | null;
  } | null;
};
export default function MembersPage() {
  const { currentBand, loading: bandsLoading } = useBands();
  const [members, setMembers] = useState<MemberRow[]>([]);
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load members';
        setError(msg);
        setMembers([]);
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

  // If no current band, this page shouldn't be accessible (bottom nav is hidden)
  if (!currentBand) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex items-center justify-center">
        <div>No band selected</div>
      </div>
    );
  }



  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Members</h2>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-40">
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="grid gap-6">
          {members.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">No Members Yet</h3>
              <p className="text-zinc-500">Add bandmates to get started!</p>
            </div>
          ) : (
            members.map((member) => {
              // Use first_name and last_name from users table
              const firstName = member.user?.first_name || "";
              const lastName = member.user?.last_name || "";
              // Format phone number
              const phone = member.user?.phone || "";
              const formattedPhone = phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
              // Address, city, zip, birthday
              const address = member.user?.address || "";
              const zip = member.user?.zip || "";
              const birthday = member.user?.birthday || "";
              // Get city from zip code (dummy lookup)
              let city = member.user?.city || "";
              if (!city && zip) {
                // Simple zip-to-city lookup (replace with real lookup as needed)
                const zipCityMap: Record<string, string> = {
                  "55401": "Minneapolis",
                  "10001": "New York",
                  "94103": "San Francisco",
                  // Add more as needed
                };
                city = zipCityMap[zip] || "";
              }
              // Get all the user's band roles (musical instruments/roles)
              const bandRoles: string[] = [];
              if (member.user?.roles && Array.isArray(member.user.roles)) {
                bandRoles.push(...member.user.roles.filter(r => typeof r === 'string' && r.trim().length > 0));
              }
              // Format birthday as 'Month Day'
              let birthdayLabel = "";
              if (birthday) {
                const dateObj = new Date(birthday);
                if (!isNaN(dateObj.getTime())) {
                  const month = dateObj.toLocaleString('en-US', { month: 'long' });
                  const day = dateObj.getDate();
                  birthdayLabel = `${month} ${day}`;
                }
              }
              return (
                <div
                  key={member.user_id}
                  className="rounded-2xl border-2 border-primary bg-card p-6 flex flex-col gap-2"
                >
                  {/* Name */}
                  <div className="text-2xl font-bold text-primary-foreground mb-1">
                    {firstName} {lastName}
                  </div>
                  {/* Band Role Badges - Show all musical roles in a row */}
                  {bandRoles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {bandRoles.map((role, index) => (
                        <span
                          key={index}
                          className="inline-block px-3 py-1 border border-primary text-primary bg-transparent text-sm rounded-full font-semibold"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Phone Number */}
                  <div className="text-lg text-primary-foreground mb-1 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    {formattedPhone}
                  </div>
                  {/* Email */}
                  <div className="text-base text-primary-foreground mb-2 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    {member.user?.email || "No email"}
                  </div>
                  {/* Address, City */}
                  <div className="text-base text-primary-foreground mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    {address}{address && city ? ", " : ""}{city}
                  </div>
                  {/* Birthday */}
                  <div className="text-base text-primary-foreground flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Birthday:</span> {birthdayLabel}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}