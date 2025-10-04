'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useBands } from '@/hooks/useBands';
import { createClient } from '@/lib/supabase/client';
import AddEventDrawer from '@/app/(protected)/calendar/AddEventDrawer';
import EditRehearsalDrawer from '@/app/(protected)/calendar/EditRehearsalDrawer';
import EditGigDrawer from '@/app/(protected)/calendar/EditGigDrawer';

interface Rehearsal {
  id: string;
  date: string;
  time: string;
  location: string;
  start_time?: string;
  end_time?: string;
  raw_date?: string;
}

function convertTo12Hour(time24: string): string {
  if (!time24) return '';
  const [hour, minute] = time24.split(':');
  const h = parseInt(hour, 10);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minute} ${ampm}`;
}

function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentBand, bands, loading: bandsLoading } = useBands();

  const [user, setUser] = useState<User | null>(null);
  const [nextRehearsal, setNextRehearsal] = useState<Rehearsal | null>(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isEditRehearsalOpen, setIsEditRehearsalOpen] = useState(false);
  const [isEditGigOpen, setIsEditGigOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const defaultEventType: 'rehearsal' | 'gig' = 'rehearsal';

  // auth check
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUser(user);
    })();
  }, [router, supabase]);

  const loadDashboardData = useCallback(async () => {
    if (!currentBand?.id) return;
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

      const { data: rehearsals } = await supabase
        .from('rehearsals')
        .select('*')
        .eq('band_id', currentBand.id)
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(1);

      if (rehearsals && rehearsals.length) {
        const r = rehearsals[0];
        setNextRehearsal({
          id: r.id,
          date: formatDateForDisplay(r.date),
          time: `${convertTo12Hour(r.start_time)} - ${convertTo12Hour(r.end_time)}`,
          location: r.location,
          start_time: r.start_time,
          end_time: r.end_time,
          raw_date: r.date
        });
      } else {
        setNextRehearsal(null);
      }
    } finally {
      setLoading(false);
    }
  }, [currentBand?.id, supabase]);

  useEffect(() => {
    if (currentBand?.id && user) loadDashboardData();
    else if (!bandsLoading && user) setLoading(false);
  }, [user, bandsLoading, currentBand?.id, loadDashboardData]);

  if (!user || bandsLoading || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!currentBand) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-400">Loading dashboard...</div>
      </div>
    );
  }

  if (bands.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Welcome to Band Roadie!</h2>
          <p className="text-zinc-300 mb-8">
            You&apos;re not part of any bands yet. Create a new band or ask a bandmate to invite you.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/bands/create')}
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:opacity-90"
            >
              Create New Band
            </button>
            <button
              onClick={() => router.push('/bands/join')}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-200 rounded-lg font-medium"
            >
              Join Existing Band
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-40 pt-6">
      <div className="px-6 max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => { setIsAddEventOpen(true); }}
              className="rounded-lg bg-white text-black px-4 py-2 font-semibold hover:opacity-90"
            >
              Add Event
            </button>
            {nextRehearsal && (
              <button
                onClick={() => setIsEditRehearsalOpen(true)}
                className="rounded-lg bg-zinc-900 px-4 py-2 border border-zinc-700 hover:bg-zinc-800"
              >
                Edit Rehearsal
              </button>
            )}
          </div>
        </header>

        {/* Next Rehearsal */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold mb-3">Next Rehearsal</h2>
          {nextRehearsal ? (
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <div className="text-zinc-400 text-sm">Date</div>
                <div className="text-white font-medium">{nextRehearsal.date}</div>
              </div>
              <div>
                <div className="text-zinc-400 text-sm">Time</div>
                <div className="text-white font-medium">{nextRehearsal.time}</div>
              </div>
              <div>
                <div className="text-zinc-400 text-sm">Location</div>
                <div className="text-white font-medium">{nextRehearsal.location}</div>
              </div>
            </div>
          ) : (
            <div className="text-zinc-400">No upcoming rehearsal. Add one to get rolling.</div>
          )}
        </section>
      </div>

      {/* Drawers */}
      <AddEventDrawer
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        defaultEventType={defaultEventType}
        onSave={() => {
          setIsAddEventOpen(false);
          loadDashboardData();
        }}
      />

      <EditRehearsalDrawer
        isOpen={isEditRehearsalOpen}
        onClose={() => setIsEditRehearsalOpen(false)}
        rehearsal={nextRehearsal ? {
          id: nextRehearsal.id,
          date: nextRehearsal.raw_date ?? '',
          start_time: nextRehearsal.start_time ?? '',
          end_time: nextRehearsal.end_time ?? '',
          location: nextRehearsal.location
        } : null}
        onRehearsalUpdated={() => {
          setIsEditRehearsalOpen(false);
          loadDashboardData();
        }}
      />

      <EditGigDrawer
        isOpen={isEditGigOpen}
        onClose={() => setIsEditGigOpen(false)}
        gig={null}
        onGigUpdated={() => {
          setIsEditGigOpen(false);
          loadDashboardData();
        }}
      />
    </main>
  );
}