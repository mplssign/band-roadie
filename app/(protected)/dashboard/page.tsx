'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, CalendarDays, MapPin } from 'lucide-react';
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';
import { createClient } from '@/lib/supabase/client';
import { GradientBorderButton } from '@/components/ui/gradient-border-button';
import type { EventPayload } from '@/app/(protected)/calendar/AddEventDrawer';
import { formatTimeRange } from '@/lib/utils/time';

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
  setlist_id?: string;
  setlist_name?: string;
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
  yesCount?: number;
  noCount?: number;
  notRespondedCount?: number;
}

function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateForPotentialGig(dateString: string): string {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateWithYear(dateString: string): string {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateForRehearsalCard(dateString: string): string {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Shared section title styling
const sectionTitle = "text-xl md:text-2xl font-semibold tracking-tight text-foreground";

export default function DashboardPage() {
  const router = useRouter();
  const { currentBand, bands, loading: bandsLoading } = useBands();

  const [nextRehearsal, setNextRehearsal] = useState<Rehearsal | null>(null);
  const [upcomingGigs, setUpcomingGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDataBandId, setCurrentDataBandId] = useState<string | null>(null);

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

  // Middleware handles auth, no need for client-side check
  // Just load dashboard data directly

  const loadDashboardData = useCallback(async () => {
    if (!currentBand?.id) return;
    
    const bandId = currentBand.id;
    console.log('[Dashboard] Loading data for band:', bandId);
    
    try {
      setLoading(true);
      const supabase = createClient();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Fetch next rehearsal
      const { data: rehearsals } = await supabase
        .from('rehearsals')
        .select('*')
        .eq('band_id', bandId)
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(1);

      // Defensive check: ensure we're still on the same band
      if (currentBand?.id !== bandId) {
        console.warn('[Dashboard] Band changed during rehearsal fetch, discarding results');
        return;
      }

      if (rehearsals && rehearsals.length) {
        const r = rehearsals[0];
        
        // Fetch setlist name if rehearsal has a setlist
        let setlist_name = undefined;
        if (r.setlist_id) {
          const { data: setlist } = await supabase
            .from('setlists')
            .select('name')
            .eq('id', r.setlist_id)
            .eq('band_id', bandId)
            .single();
          setlist_name = setlist?.name;
        }

        // Final defensive check before setting state
        if (currentBand?.id !== bandId) {
          console.warn('[Dashboard] Band changed during setlist fetch, discarding results');
          return;
        }
        
        const rehearsalData = {
          id: r.id,
          date: formatDateForDisplay(r.date),
          time: formatTimeRange(r.start_time, undefined, r.date),
          location: r.location,
          start_time: r.start_time,
          end_time: r.end_time,
          raw_date: r.date,
          setlist_id: r.setlist_id,
          setlist_name
        };
        
        console.log('[Dashboard] Setting rehearsal for band:', bandId, rehearsalData.date);
        setNextRehearsal(rehearsalData);
        setCurrentDataBandId(bandId);
      } else {
        console.log('[Dashboard] No rehearsals found for band:', bandId);
        setNextRehearsal(null);
        setCurrentDataBandId(bandId);
      }

            // Fetch upcoming gigs
      const { data: gigs, error: gigsError } = await supabase
        .from('gigs')
        .select(`
          *,
          setlists (
            id,
            name
          )
        `)
        .eq('band_id', bandId)
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(5);

      // Defensive check before processing gigs
      if (currentBand?.id !== bandId) {
        console.warn('[Dashboard] Band changed during gigs fetch, discarding results');
        return;
      }

      if (gigsError) {
        console.error('Error fetching gigs:', gigsError);
        setUpcomingGigs([]);
      } else {
        const gigsWithSetlists = (
          await Promise.all(
            (gigs || []).map(async (g: any) => {
              // Get setlist name if gig has a setlist
              let setlist_name = undefined;
              if (g.setlist_id) {
                const { data: setlist } = await supabase
                  .from('setlists')
                  .select('name')
                  .eq('id', g.setlist_id)
                  .eq('band_id', bandId)
                  .single();
                setlist_name = setlist?.name;
              }

              // Get response counts for potential gigs
              let yesCount = 0;
              let noCount = 0; 
              let notRespondedCount = 0;
              
              if (g.is_potential) {
                // Get all band members (active only)
                const { data: allMembers } = await supabase
                  .from('band_members')
                  .select('id, user_id')
                  .eq('band_id', bandId)
                  .eq('is_active', true);

                // Get gig member responses
                const { data: responses } = await supabase
                  .from('gig_member_responses')
                  .select('band_member_id, response')
                  .eq('gig_id', g.id);

                // Get optional members for this gig
                const { data: optionalMembers } = await supabase
                  .from('gig_optional_members')
                  .select('band_member_id')
                  .eq('gig_id', g.id);

                const optionalMemberIds = new Set((optionalMembers || []).map(om => om.band_member_id));
                const requiredMembers = (allMembers || []).filter(m => !optionalMemberIds.has(m.id));
                const responsesMap = new Map((responses || []).map(r => [r.band_member_id, r.response]));

                // Count responses for required members only
                yesCount = requiredMembers.filter(m => responsesMap.get(m.id) === 'yes').length;
                noCount = requiredMembers.filter(m => responsesMap.get(m.id) === 'no').length;
                notRespondedCount = requiredMembers.filter(m => !responsesMap.has(m.id)).length;
              }

              return {
                id: g.id,
                name: g.name,
                date: formatDateForDisplay(g.date),
                time: g.start_time ? formatTimeRange(g.start_time, g.end_time, g.date) : 'TBD',
                location: g.venue || g.location || 'TBD',
                venue: g.venue,
                start_time: g.start_time,
                end_time: g.end_time,
                is_potential: g.is_potential,
                setlist_id: g.setlist_id,
                setlist_name,
                yesCount,
                noCount,
                notRespondedCount
              };
            })
          )
        );

        // Final defensive check before setting gigs state
        if (currentBand?.id !== bandId) {
          console.warn('[Dashboard] Band changed during gigs processing, discarding results');
          return;
        }

        console.log('[Dashboard] Setting gigs for band:', bandId, gigsWithSetlists.length, 'gigs');
        setUpcomingGigs(gigsWithSetlists);
        setCurrentDataBandId(bandId);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading data:', error);
      // On error, clear data to prevent showing stale info
      setNextRehearsal(null);
      setUpcomingGigs([]);
      setCurrentDataBandId(null);
    } finally {
      setLoading(false);
    }
  }, [currentBand?.id]);

  // Handler to open edit rehearsal drawer
  const openEditRehearsal = useCallback((rehearsal: Rehearsal) => {
    setEditEvent(rehearsalToEventPayload(rehearsal));
    setDrawerMode('edit');
    setDrawerOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Handler to create new setlist (matches Setlists page behavior)
  const handleCreateSetlist = useCallback(async () => {
    if (!currentBand?.id) return;

    try {
      const response = await fetch('/api/setlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          band_id: currentBand.id,
          name: 'New Setlist'
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create setlist');
      }

      router.push(`/setlists/${data.setlist.id}`);
    } catch (err) {
      console.error('Error creating setlist:', err);
      // You could add error handling here if needed
    }
  }, [currentBand?.id, router]);

  // Handler to open edit gig drawer
  const openEditGig = useCallback((gig: Gig) => {
    setEditEvent(gigToEventPayload(gig));
    setDrawerMode('edit');
    setDrawerOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler to open add event drawer
  const openAddEvent = useCallback((eventType: 'rehearsal' | 'gig') => {
    setDefaultEventType(eventType);
    setDrawerMode('add');
    setEditEvent(undefined);
    setDrawerOpen(true);
  }, []);

  // React to band changes: close drawers and refetch data
  useBandChange({
    onBandChange: () => {
      console.log('[Dashboard] Band changed, clearing state and refetching data');
      
      // Close any open drawers
      setDrawerOpen(false);
      setEditEvent(undefined);
      setDrawerMode('add');

      // Clear stale state immediately and synchronously
      setNextRehearsal(null);
      setUpcomingGigs([]);
      setCurrentDataBandId(null);

      // Refetch data for new band (if available)
      // Note: useEffect will also trigger, but this ensures immediate state clearing
      if (currentBand?.id) {
        loadDashboardData();
      }
    }
  });

  useEffect(() => {
    if (currentBand?.id) loadDashboardData();
    else if (!bandsLoading) setLoading(false);
  }, [bandsLoading, currentBand?.id, loadDashboardData]);

  // Skeleton for Potential Gig card
  const PotentialGigSkeleton = () => (
    <section>
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-gig">
        <div className="p-6">
          {/* Header Row skeleton */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-5 bg-white/20 rounded w-28 animate-pulse"></div>
            </div>
            <div className="text-right space-y-1">
              <div className="h-4 bg-white/20 rounded w-24 animate-pulse"></div>
              <div className="h-4 bg-white/20 rounded w-28 animate-pulse"></div>
            </div>
          </div>
          {/* Title block skeleton */}
          <div className="mb-4 space-y-2">
            <div className="h-6 bg-white/20 rounded w-3/4 animate-pulse"></div>
            <div className="h-5 bg-white/20 rounded w-1/2 animate-pulse"></div>
          </div>
          {/* Response summary skeleton */}
          <div className="h-4 bg-white/20 rounded w-2/3 animate-pulse"></div>
        </div>
      </div>
    </section>
  );

  // Skeleton for Next Rehearsal card
  const NextRehearsalSkeleton = () => (
    <section>
      <h2 className={`${sectionTitle} mb-4`}>Next Rehearsal</h2>
      <div className="block w-full rounded-2xl overflow-hidden bg-gradient-rehearsal">
        <div className="p-5">
          {/* Primary row skeleton: Time • Day, Date */}
          <div className="flex items-center gap-2 mb-2.5 min-h-[28px]">
            <div className="h-5 bg-white/20 rounded w-16 animate-pulse"></div>
            <span className="text-white/60">•</span>
            <div className="h-5 bg-white/20 rounded w-24 animate-pulse"></div>
          </div>
          {/* Location line skeleton */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-white/70 flex-shrink-0" />
            <div className="h-4 bg-white/20 rounded w-32 animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );

  if (bandsLoading || loading) {
    return (
      <div className="min-h-screen bg-black text-white pb-28">
        <div className="px-4 pt-4 space-y-6">
          <PotentialGigSkeleton />
          <NextRehearsalSkeleton />
          <div className="text-center text-zinc-400 text-sm py-8">
            Loading dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (bands.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Welcome to Band Roadie!</h2>
          <p className="text-zinc-300 mb-8">
            You&apos;re officially backstage — but your band&apos;s not here yet. Fire up a new band or text your drummer (they&apos;re late as usual) to add you. Let&apos;s make some noise.
          </p>
        </div>
      </div>
    );
  }

  // Find potential gigs and confirmed gigs
  // Only show data that matches current band to prevent data bleed
  // Allow showing data if currentDataBandId is null (initial state) but currentBand exists
  const safeUpcomingGigs = (currentDataBandId === currentBand?.id || (currentDataBandId === null && currentBand?.id)) ? upcomingGigs : [];
  const potentialGigs = safeUpcomingGigs.filter(g => g.is_potential);
  const confirmedGigs = safeUpcomingGigs.filter(g => !g.is_potential);

  return (
    <main className="min-h-screen bg-black text-white pb-40 pt-6">
      <div className="px-6 max-w-5xl mx-auto space-y-6">
        {/* Potential Gigs */}
        {potentialGigs.length > 0 && (
          <section>
            {potentialGigs.length === 1 ? (
              /* Single potential gig - full width */
              <div className="w-full">
                <button
                  onClick={() => openEditGig(potentialGigs[0])}
                  className="w-full text-left rounded-2xl overflow-hidden bg-gradient-gig hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  aria-label={`Potential Gig, ${potentialGigs[0].name}, ${formatDateForPotentialGig(potentialGigs[0].date)}, ${potentialGigs[0].start_time && potentialGigs[0].end_time ? formatTimeRange(potentialGigs[0].start_time, potentialGigs[0].end_time, potentialGigs[0].date) : 'TBD'}, Yes ${potentialGigs[0].yesCount || 0}, No ${potentialGigs[0].noCount || 0}, Not Responded ${potentialGigs[0].notRespondedCount || 0}`}
                >
                  <div className="p-6">
                    {/* Header Row: ⚠️ Label on left, Date/Time on right */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚠️</span>
                        <span className="text-base font-semibold text-white">Potential Gig</span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays className="w-4 h-4 text-white/80" />
                          <span className="text-sm font-medium text-white">{formatDateForPotentialGig(potentialGigs[0].date)}</span>
                        </div>
                        {potentialGigs[0].start_time && potentialGigs[0].end_time && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" strokeWidth="2" />
                              <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
                            </svg>
                            <span className="text-sm font-medium text-white">{formatTimeRange(potentialGigs[0].start_time, potentialGigs[0].end_time, potentialGigs[0].date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title Block: Event title (2 lines max) and location */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">{potentialGigs[0].name}</h3>
                      <div className="text-white/90 text-base truncate">{potentialGigs[0].location}</div>
                    </div>

                    {/* Bottom Section: Response Summary */}
                    <div className="text-sm text-white/90 truncate">
                      Yes ({potentialGigs[0].yesCount || 0}) • No ({potentialGigs[0].noCount || 0}) • Not Responded ({potentialGigs[0].notRespondedCount || 0})
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              /* Multiple potential gigs - horizontal scroll */
              <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {potentialGigs.map((gig) => (
                  <div key={gig.id} className="flex-shrink-0 snap-start" style={{ width: '320px' }}>
                    <button
                      onClick={() => openEditGig(gig)}
                      className="w-full text-left rounded-2xl overflow-hidden bg-gradient-gig hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      aria-label={`Potential Gig, ${gig.name}, ${formatDateForPotentialGig(gig.date)}, ${gig.start_time && gig.end_time ? formatTimeRange(gig.start_time, gig.end_time, gig.date) : 'TBD'}, Yes ${gig.yesCount || 0}, No ${gig.noCount || 0}, Not Responded ${gig.notRespondedCount || 0}`}
                    >
                      <div className="p-6">
                        {/* Header Row: ⚠️ Label on left, Date/Time on right */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⚠️</span>
                            <span className="text-base font-semibold text-white">Potential Gig</span>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarDays className="w-4 h-4 text-white/80" />
                              <span className="text-sm font-medium text-white">{formatDateForPotentialGig(gig.date)}</span>
                            </div>
                            {gig.start_time && gig.end_time && (
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                  <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
                                </svg>
                                <span className="text-sm font-medium text-white">{formatTimeRange(gig.start_time, gig.end_time, gig.date)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Title Block: Event title (2 lines max) and location */}
                        <div className="mb-4">
                          <h3 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">{gig.name}</h3>
                          <div className="text-white/90 text-base truncate">{gig.location}</div>
                        </div>

                        {/* Bottom Section: Response Summary */}
                        <div className="text-sm text-white/90 truncate">
                          Yes ({gig.yesCount || 0}) • No ({gig.noCount || 0}) • Not Responded ({gig.notRespondedCount || 0})
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Next Rehearsal */}
        {nextRehearsal && (currentDataBandId === currentBand?.id || (currentDataBandId === null && currentBand?.id)) ? (
          <div
            role="button"
            tabIndex={0}
            aria-label={`Edit rehearsal: ${formatDateForRehearsalCard(nextRehearsal.raw_date || '')} ${nextRehearsal.time}`}
            onClick={() => openEditRehearsal(nextRehearsal)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEditRehearsal(nextRehearsal);
              }
            }}
            className="block w-full rounded-2xl overflow-hidden bg-gradient-rehearsal cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-transform hover:scale-[1.01]"
          >
            <div className="p-5">
              {/* Header with title */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-white">Next Rehearsal</h2>
              </div>

              {/* Primary row: Time • Day, Date */}
              <div className="flex items-center gap-2 text-white font-medium text-lg mb-2.5 min-h-[28px]">
                <span className="flex-shrink-0">{nextRehearsal.time}</span>
                <span className="text-white/60 flex-shrink-0">•</span>
                <span className="truncate">{formatDateForRehearsalCard(nextRehearsal.raw_date || '')}</span>
              </div>

              {/* Location line with setlist badge */}
              {nextRehearsal.location && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MapPin className="w-4 h-4 text-white/70 flex-shrink-0" />
                    <span
                      className="text-white/90 text-sm truncate"
                      title={nextRehearsal.location}
                    >
                      {nextRehearsal.location}
                    </span>
                  </div>
                  {nextRehearsal.setlist_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/70">Setlist</span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/90 text-white font-medium">
                        {nextRehearsal.setlist_name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Standalone setlist line for cases without location */}
              {!nextRehearsal.location && nextRehearsal.setlist_name && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">Setlist</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/90 text-white font-medium">
                    {nextRehearsal.setlist_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (currentDataBandId === currentBand?.id || (currentDataBandId === null && currentBand?.id)) ? (
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
        ) : null}

        {/* Upcoming Gigs */}
        <section>
          <h2 className={sectionTitle + " mb-4"}>Upcoming Gigs</h2>
          {confirmedGigs.length > 0 ? (
            <div className="flex gap-6 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {confirmedGigs.map((gig) => {
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
                                {formatTimeRange(gig.start_time, gig.end_time, gig.date)}
                              </div>
                            )}
                          </div>

                          {/* Spotlight Icon - 24px to the right of time, flipped */}
                          <Image
                            src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNwb3RsaWdodC1pY29uIGx1Y2lkZS1zcG90bGlnaHQiPjxwYXRoIGQ9Ik0xNS4yOTUgMTkuNTYyIDE2IDIyIi8+PHBhdGggZD0ibTE3IDE2IDMuNzU4IDIuMDk4Ii8+PHBhdGggZD0ibTE5IDEyLjUgMy4wMjYtLjU5OCIvPjxwYXRoIGQ9Ik03LjYxIDYuM2EzIDMgMCAwIDAtMy45MiAxLjNsLTEuMzggMi43OWEzIDMgMCAwIDAgMS4zIDMuOTFsNi44OSAzLjU5N2ExIDEgMCAwIDAgMS4zNDItLjQ0N2wzLjEwNi02LjIxMWExIDEgMCAwIDAtLjQ0Ny0xLjM0MXoiLz48cGF0aCBkPSJNOCA5VjIiLz48L3N2Zz4="
                            alt="Spotlight"
                            width={48}
                            height={48}
                            className="ml-6"
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
          ) : potentialGigs.length > 0 ? (
            <div className="text-center text-zinc-500 text-sm py-4">
              No confirmed gigs scheduled yet.
            </div>
          ) : currentDataBandId === currentBand?.id || (currentDataBandId === null && currentBand?.id) ? (
            <section className="rounded-2xl overflow-hidden bg-zinc-900">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-3">No upcoming gigs.</h2>
                <p className="text-white/80 text-sm mb-5">
                  The spotlight awaits — time to book that next show and light up the stage!
                </p>
                <button
                  onClick={() => openAddEvent('gig')}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-medium px-5 py-2.5 rounded-lg transition-colors backdrop-blur-sm border border-white/30"
                  aria-label="Create gig"
                >
                  <Plus className="w-4 h-4" />
                  Create Gig
                </button>
              </div>
            </section>
          ) : null}
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
                onClick={handleCreateSetlist}
                gradientClass="bg-rose-500"
                className="px-5 bg-zinc-900 hover:bg-zinc-800 transition-colors whitespace-nowrap h-14"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                <span className="text-base font-semibold">Create Setlist</span>
              </GradientBorderButton>
            </div>

            <div className="flex-shrink-0 snap-start">
              <GradientBorderButton
                onClick={() => openAddEvent('gig')}
                gradientClass="bg-rose-500"
                className="px-5 bg-zinc-900 hover:bg-zinc-800 transition-colors whitespace-nowrap h-14"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                <span className="text-base font-semibold">Create Gig</span>
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