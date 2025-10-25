'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Plus, CalendarDays, Clock, MapPin } from 'lucide-react';
import { useBands } from '@/hooks/useBands';
import { createClient } from '@/lib/supabase/client';
import Empty from '@/components/ui/empty';
import { Card } from '@/components/ui/Card';
import { GradientBorderButton } from '@/components/ui/gradient-border-button';
import type { EventPayload } from '@/app/(protected)/calendar/AddEventDrawer';

// Lazy load the drawer to avoid initial bundle cost
const AddEventDrawer = dynamic(
  () => import('@/app/(protected)/calendar/AddEventDrawer'),
  { ssr: false }
);

interface Rehearsal {
  id: string;
  date: string;
  time: string;
  location: string;
  start_time?: string;
  end_time?: string;
  raw_date?: string;
}

interface Gig {
  id: string;
  name: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location: string;
  is_potential?: boolean;
  setlist_id?: string;
  setlist_name?: string;
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

function formatDateWithYear(dateString: string): string {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Shared section title styling
const sectionTitle = "text-xl md:text-2xl font-semibold tracking-tight text-foreground";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentBand, bands, loading: bandsLoading } = useBands();

  const [user, setUser] = useState<User | null>(null);
  const [nextRehearsal, setNextRehearsal] = useState<Rehearsal | null>(null);
  const [upcomingGigs, setUpcomingGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);

  // Unified drawer state for add/edit
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [editEvent, setEditEvent] = useState<EventPayload | undefined>(undefined);
  const [defaultEventType, setDefaultEventType] = useState<'rehearsal' | 'gig'>('rehearsal');

  // Helper to convert time string to hour/minute/ampm
  const parseTime = (timeStr: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } => {
    if (!timeStr) return { hour: 7, minute: 0, ampm: 'PM' };
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour24 = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (hour24 === 0) return { hour: 12, minute, ampm: 'AM' };
    if (hour24 < 12) return { hour: hour24, minute, ampm: 'AM' };
    if (hour24 === 12) return { hour: 12, minute, ampm: 'PM' };
    return { hour: hour24 - 12, minute, ampm: 'PM' };
  };

  // Helper to calculate duration from start and end time
  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 120; // default 2 hours
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  // Helper to convert Rehearsal to EventPayload
  const rehearsalToEventPayload = (rehearsal: Rehearsal): EventPayload => {
    const dateStr = rehearsal.raw_date || rehearsal.date;
    const dateObj = new Date(dateStr + 'T00:00:00');
    const { hour, minute, ampm } = parseTime(rehearsal.start_time || '19:00');
    const duration = calculateDuration(rehearsal.start_time || '19:00', rehearsal.end_time || '21:00');

    return {
      id: rehearsal.id,
      type: 'rehearsal',
      title: '',
      date: dateObj,
      startHour: hour,
      startMinute: minute,
      startAmPm: ampm,
      durationMinutes: duration,
      location: rehearsal.location,
    };
  };

  // Helper to convert Gig to EventPayload
  const gigToEventPayload = (gig: Gig): EventPayload => {
    const dateObj = new Date(gig.date + 'T00:00:00');
    const { hour, minute, ampm } = parseTime(gig.start_time || '19:00');
    const duration = calculateDuration(gig.start_time || '19:00', gig.end_time || '21:00');

    return {
      id: gig.id,
      type: 'gig',
      title: gig.name,
      date: dateObj,
      startHour: hour,
      startMinute: minute,
      startAmPm: ampm,
      durationMinutes: duration,
      location: gig.location,
      setlistId: gig.setlist_id,
      setlistName: gig.setlist_name,
      isPotential: gig.is_potential,
    };
  };

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
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Fetch next rehearsal
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

      // Fetch upcoming gigs
      const { data: gigs, error: gigsError } = await supabase
        .from('gigs')
        .select('*')
        .eq('band_id', currentBand.id)
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(10);

      if (gigsError) {
        console.error('Error fetching gigs:', gigsError);
      }

      if (gigs && gigs.length) {
        // Fetch setlist names separately if needed
        const gigsWithSetlists = await Promise.all(
          gigs.map(async (g) => {
            let setlist_name = undefined;
            if (g.setlist_id) {
              const { data: setlist } = await supabase
                .from('setlists')
                .select('name')
                .eq('id', g.setlist_id)
                .single();
              setlist_name = setlist?.name;
            }

            return {
              id: g.id,
              name: g.name,
              date: g.date,
              start_time: g.start_time,
              end_time: g.end_time,
              location: g.location,
              is_potential: g.is_potential,
              setlist_id: g.setlist_id,
              setlist_name
            };
          })
        );

        setUpcomingGigs(gigsWithSetlists);
      } else {
        setUpcomingGigs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentBand?.id, supabase]);

  // Handler to open edit rehearsal drawer
  const openEditRehearsal = useCallback((rehearsal: Rehearsal) => {
    setEditEvent(rehearsalToEventPayload(rehearsal));
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditEvent(undefined);
    setDrawerMode('add');
  }, []);

  const handleEventUpdated = useCallback(() => {
    setDrawerOpen(false);
    setEditEvent(undefined);
    setDrawerMode('add');
    loadDashboardData(); // Refresh the dashboard data
  }, [loadDashboardData]);

  // Handler to open edit gig drawer
  const openEditGig = useCallback((gig: Gig) => {
    setEditEvent(gigToEventPayload(gig));
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  // Handler to open add event drawer
  const openAddEvent = useCallback((eventType: 'rehearsal' | 'gig') => {
    setDefaultEventType(eventType);
    setDrawerMode('add');
    setEditEvent(undefined);
    setDrawerOpen(true);
  }, []);

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

  if (bands.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Welcome to Band Roadie!</h2>
          <p className="text-zinc-300 mb-8">
            You&apos;re not part of any bands yet. Create a new band or ask a bandmate to invite you.
          </p>
        </div>
      </div>
    );
  }

  // Find the first potential gig
  const potentialGig = upcomingGigs.find(g => g.is_potential);
  const confirmedGigs = upcomingGigs.filter(g => !g.is_potential);

  return (
    <main className="min-h-screen bg-black text-white pb-40 pt-6">
      <div className="px-6 max-w-5xl mx-auto space-y-6">
        {/* Potential Gig */}
        {potentialGig && (
          <section className="rounded-2xl overflow-hidden bg-gradient-gig">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-white/60"></div>
                <h2 className="text-base font-medium text-white/90">Potential Gig</h2>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{potentialGig.name}</h3>
              <div className="text-white/90 mb-4">{potentialGig.location}</div>
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-white/80" />
                  <span className="text-white font-medium">{formatDateForDisplay(potentialGig.date)}</span>
                </div>
                {potentialGig.start_time && potentialGig.end_time && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
                    </svg>
                    <span className="text-white font-medium">{`${convertTo12Hour(potentialGig.start_time)} - ${convertTo12Hour(potentialGig.end_time)}`}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button className="flex-1 px-4 py-2.5 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-colors">
                  Yes (1)
                </button>
                <button className="flex-1 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-lg font-semibold border border-white/30 hover:bg-white/30 transition-colors">
                  No (1)
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Next Rehearsal */}
        {nextRehearsal ? (
          <section
            role="button"
            tabIndex={0}
            aria-label={`Edit rehearsal: ${nextRehearsal.date} ${nextRehearsal.time}`}
            onClick={() => openEditRehearsal(nextRehearsal)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEditRehearsal(nextRehearsal);
              }
            }}
            className="rounded-2xl overflow-hidden bg-gradient-rehearsal cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-transform hover:scale-[1.01]"
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Next Rehearsal</h2>
              <div className="space-y-3">
                {/* Date */}
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="w-5 h-5 text-white/80 flex-shrink-0" />
                  <span className="text-white font-medium">{nextRehearsal.date}</span>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-white/80 flex-shrink-0" />
                  <span className="text-white font-medium">{nextRehearsal.time}</span>
                </div>

                {/* Location */}
                {nextRehearsal.location && (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-5 h-5 text-white/80 flex-shrink-0" />
                    <span
                      className="text-white font-medium truncate"
                      title={nextRehearsal.location}
                    >
                      {nextRehearsal.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl overflow-hidden bg-zinc-900">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-3">No Rehearsal Scheduled</h2>
              <p className="text-white/80 text-sm mb-5">
                The stage is empty and the amps are cold. Time to crank it up and get the band back together!
              </p>
              <button
                onClick={() => openAddEvent('rehearsal')}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-medium px-5 py-2.5 rounded-lg transition-colors backdrop-blur-sm border border-white/30"
              >
                <Plus className="w-4 h-4" />
                Schedule Rehearsal
              </button>
            </div>
          </section>
        )}

        {/* Upcoming Gigs */}
        <section>
          <h2 className={sectionTitle + " mb-4"}>Upcoming Gigs</h2>
          {confirmedGigs.length > 0 ? (
            <div className="flex gap-6 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {confirmedGigs.map((gig, index) => {
                // Vary animation speeds across gig cards (11s, 9s, 7s, 6s pattern)
                const speeds = ['animate-gradient-11s', 'animate-gradient-9s', 'animate-gradient-7s', 'animate-gradient-6s'];
                const speedClass = speeds[index % speeds.length];

                return (
                  <div key={gig.id} className="flex-shrink-0 snap-start" style={{ maxWidth: '320px' }}>
                    <GradientBorderButton
                      onClick={() => openEditGig(gig)}
                      gradientClass="bg-rose-500"
                      wrapperClassName="w-full"
                      className="p-6 bg-zinc-900 hover:opacity-90 transition-opacity text-left h-auto justify-start"
                    >
                      <div className="space-y-4">
                        {/* Gig Name & Location - tightly grouped */}
                        <div className="space-y-1">
                          <h3 className="font-semibold text-white text-xl line-clamp-1 m-0">
                            {gig.name}
                          </h3>
                          <div className="text-zinc-400 text-sm line-clamp-1 m-0">
                            {gig.location}
                          </div>
                        </div>

                        {/* Date & Time with Spotlight Icon */}
                        <div className="flex items-end">
                          <div className="space-y-1 m-0 flex-1">
                            <div className="text-white text-sm font-medium">
                              {formatDateWithYear(gig.date)}
                            </div>
                            {gig.start_time && gig.end_time && (
                              <div className="text-zinc-400 text-sm font-medium">
                                {`${convertTo12Hour(gig.start_time)} - ${convertTo12Hour(gig.end_time)}`}
                              </div>
                            )}
                          </div>

                          {/* Spotlight Icon - 24px to the right of time, flipped */}
                          <img
                            src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNwb3RsaWdodC1pY29uIGx1Y2lkZS1zcG90bGlnaHQiPjxwYXRoIGQ9Ik0xNS4yOTUgMTkuNTYyIDE2IDIyIi8+PHBhdGggZD0ibTE3IDE2IDMuNzU4IDIuMDk4Ii8+PHBhdGggZD0ibTE5IDEyLjUgMy4wMjYtLjU5OCIvPjxwYXRoIGQ9Ik03LjYxIDYuM2EzIDMgMCAwIDAtMy45MiAxLjNsLTEuMzggMi43OWEzIDMgMCAwIDAgMS4zIDMuOTFsNi44OSAzLjU5N2ExIDEgMCAwIDAgMS4zNDItLjQ0N2wzLjEwNi02LjIxMWExIDEgMCAwIDAtLjQ0Ny0xLjM0MXoiLz48cGF0aCBkPSJNOCA5VjIiLz48L3N2Zz4="
                            alt="Spotlight"
                            className="w-12 h-12 ml-6"
                            style={{
                              filter: 'brightness(0) saturate(100%) invert(26%) sepia(8%) saturate(381%) hue-rotate(185deg) brightness(94%) contrast(87%)',
                              transform: 'scale(-1, -1)'
                            }}
                          />
                        </div>

                        {/* Setlist */}
                        {gig.setlist_name && (
                          <div className="flex items-center gap-2 m-0">
                            <span className="text-base text-zinc-400">Setlist</span>
                            <span className="text-sm px-3 py-1.5 rounded-full bg-purple-500/90 text-white font-medium">
                              {gig.setlist_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </GradientBorderButton>
                  </div>
                );
              })}
            </div>
          ) : potentialGig ? (
            <div className="text-center text-zinc-500 text-sm py-4">
              No confirmed gigs scheduled yet.
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center gap-2 rounded-xl border border-rose-500 bg-zinc-900/50 p-8 text-center">
              <CalendarDays className="h-6 w-6 text-zinc-600" aria-hidden="true" />
              <p className="text-sm text-zinc-500">No upcoming gigs.</p>
            </Card>
          )}
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className={sectionTitle + " mb-4"}>Quick Actions</h2>
          <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex-shrink-0 snap-start">
              <GradientBorderButton
                onClick={() => openAddEvent('rehearsal')}
                gradientClass="bg-rose-500"
                className="px-5 bg-zinc-900 hover:bg-zinc-800 transition-colors whitespace-nowrap h-14"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                <span className="text-base font-semibold">Schedule Rehearsal</span>
              </GradientBorderButton>
            </div>

            <div className="flex-shrink-0 snap-start">
              <GradientBorderButton
                onClick={() => router.push('/setlists/create')}
                gradientClass="bg-rose-500"
                className="px-5 bg-zinc-900 hover:bg-zinc-800 transition-colors whitespace-nowrap h-14"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                <span className="text-base font-semibold">Create Setlist</span>
              </GradientBorderButton>
            </div>

            <div className="flex-shrink-0 snap-start">
              <GradientBorderButton
                onClick={() => router.push('/gigs/create')}
                gradientClass="bg-rose-500"
                className="px-5 bg-zinc-900 hover:bg-zinc-800 transition-colors whitespace-nowrap h-14"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                <span className="text-base font-semibold">Create Gig</span>
              </GradientBorderButton>
            </div>

            <div className="flex-shrink-0 snap-start">
              <GradientBorderButton
                onClick={() => router.push('/calendar/block-dates')}
                gradientClass="bg-rose-500"
                className="px-5 bg-zinc-900 hover:bg-zinc-800 transition-colors whitespace-nowrap h-14"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                <span className="text-base font-semibold">Add Block Out Dates</span>
              </GradientBorderButton>
            </div>
          </div>
        </section>
      </div>

      {/* Unified Add/Edit Event Drawer */}
      <AddEventDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onEventUpdated={handleEventUpdated}
        prefilledDate=""
        defaultEventType={defaultEventType}
        mode={drawerMode}
        event={editEvent}
      />
    </main>
  );
}