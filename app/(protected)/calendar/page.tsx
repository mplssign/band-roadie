'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useBands } from '@/contexts/BandsContext';
import CalendarContent from './CalendarContent';
import type { AddEventPayload } from './AddEventDrawer';
import { formatTimeRange } from '@/lib/utils/formatters';
import { groupBlockoutsIntoRanges } from '@/lib/utils/blockouts';
import type { BlockoutRow } from '@/lib/utils/blockouts';

interface CalendarEvent {
  id?: string;
  date: string;
  type: 'rehearsal' | 'gig' | 'blockout';
  title: string;
  time?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  is_potential?: boolean;
  setlist_id?: string | null;
  blockedBy?: {
    name: string;
    initials: string;
    color: string;
  };
  blockout?: {
    startDate: string;
    endDate: string;
    color: string;
    name: string;
  };
}

type BlockDateRow = {
  id?: string;
  date: string;
  reason: string;
  user_id?: string | null;
  band_id?: string | null;
  users?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
};

function toTwentyFourHour(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time;

  let hour = Number.parseInt(match[1], 10);
  const minutes = match[2];
  const meridiem = match[3].toUpperCase() as 'AM' | 'PM';

  if (meridiem === 'PM' && hour !== 12) {
    hour += 12;
  } else if (meridiem === 'AM' && hour === 12) {
    hour = 0;
  }

  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentBand } = useBands();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
    };

    checkUser();
  }, [router, supabase]);

  useEffect(() => {
    if (currentBand?.id && user) {
      // Clear events immediately when switching bands
      setEvents([]);
      setLoading(true);
      loadEvents();
    } else if (!currentBand?.id && user) {
      // No band selected, clear events
      setEvents([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBand?.id, user]);

  const loadEvents = async () => {
    if (!currentBand?.id) {
      return;
    }

    try {
      setLoading(true);
      const calendarEvents: CalendarEvent[] = [];
      const blockoutRanges: CalendarEvent[] = [];

      // Load rehearsals
      const { data: rehearsals, error: rehearsalsError } = await supabase
        .from('rehearsals')
        .select('*')
        .eq('band_id', currentBand.id)
        .order('date', { ascending: true });

      if (rehearsalsError) {
        console.error('Error loading rehearsals:', rehearsalsError);
      }

      if (rehearsals) {
        rehearsals.forEach(rehearsal => {
          // Validate date format
          if (!rehearsal.date || typeof rehearsal.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rehearsal.date)) {
            console.warn('Invalid rehearsal date format:', rehearsal);
            return;
          }

          calendarEvents.push({
            id: rehearsal.id,
            date: rehearsal.date,
            type: 'rehearsal',
            title: 'Band Rehearsal',
            time: formatTimeRange(rehearsal.start_time, rehearsal.end_time),
            location: rehearsal.location,
            start_time: rehearsal.start_time,
            end_time: rehearsal.end_time,
          });
        });
      }

      // Load gigs (both confirmed and potential)
      const { data: gigs, error: gigsError } = await supabase
        .from('gigs')
        .select('*')
        .eq('band_id', currentBand.id)
        .order('date', { ascending: true });

      if (gigsError) {
        console.error('Error loading gigs:', gigsError);
      }

      if (gigs) {
        gigs.forEach(gig => {
          // Validate date format
          if (!gig.date || typeof gig.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(gig.date)) {
            console.warn('Invalid gig date format:', gig);
            return;
          }

          calendarEvents.push({
            id: gig.id,
            date: gig.date,
            type: 'gig',
            title: gig.name,
            time: formatTimeRange(gig.start_time, gig.end_time),
            location: gig.location,
            start_time: gig.start_time,
            end_time: gig.end_time,
            is_potential: gig.is_potential,
            setlist_id: gig.setlist_id ?? null,
          });
        });
      }

      // Load block dates - simplified query without join
      const { data: blockDates, error: blockError } = await supabase
        .from('block_dates')
        .select('id, date, reason, user_id')
        .eq('band_id', currentBand.id)
        .order('date', { ascending: true });

      if (blockError) {
        // Handle block dates error silently or show user feedback if needed
        return;
      }

      const fallbackBlockDates = (blockDates as unknown as BlockDateRow[]) ?? [];

      const blockColorPalette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
      const getBlockoutColor = (name: string) => {
        if (!name) return '#ec4899';
        let hash = 0;
        for (const ch of name) {
          hash = (hash + ch.charCodeAt(0) * 31) % blockColorPalette.length;
        }
        return blockColorPalette[hash];
      };

      // Process block dates - get actual user names
      const blockRecords = fallbackBlockDates;

      // Get all unique user IDs to fetch user info efficiently
      const userIds = Array.from(new Set(blockRecords.map(bd => bd.user_id).filter(Boolean)));

      // Fetch user info for all users at once
      const usersMap = new Map();
      if (userIds.length > 0) {
        try {
          const { data: users } = await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', userIds);

          if (users) {
            users.forEach(user => {
              usersMap.set(user.id, user);
            });
          }
        } catch (error) {
          // Could not fetch user info for blockouts, using fallback
        }
      }

      // Group consecutive blockout days into ranges
      const blockoutRows: BlockoutRow[] = blockRecords
        .filter(bd => bd.date && typeof bd.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bd.date))
        .map(bd => ({
          id: bd.id,
          user_id: bd.user_id || '',
          date: bd.date,
          reason: bd.reason,
          band_id: currentBand.id,
        }));

      const groupedBlockoutRanges = groupBlockoutsIntoRanges(blockoutRows);

      // Convert grouped ranges to CalendarEvent format
      groupedBlockoutRanges.forEach((range) => {
        // Get user info from our map
        const userInfo = range.user_id ? usersMap.get(range.user_id) : null;

        const emailIdentifier = typeof userInfo?.email === 'string' ? userInfo.email.split('@')[0] : 'Member';
        const firstName = (userInfo?.first_name || emailIdentifier || 'Band').trim();
        const lastName = userInfo?.last_name?.trim() || '';
        const displayName = [firstName, lastName].filter(Boolean).join(' ') || emailIdentifier || 'Band Member';
        const initialsBase = (firstName || displayName).trim();
        const initials = (initialsBase.slice(0, 1) + (lastName.slice(0, 1) || '')).toUpperCase() || displayName.substring(0, 2).toUpperCase();
        const color = getBlockoutColor(displayName);

        blockoutRanges.push({
          id: range.sourceIds[0], // Use first ID for the range
          date: range.start_date,
          type: 'blockout',
          title: `${firstName} Out`,
          location: range.reason && range.reason !== 'Blocked Out' ? range.reason : undefined,
          blockedBy: {
            name: displayName,
            initials,
            color,
          },
          blockout: {
            startDate: range.start_date,
            endDate: range.end_date,
            color,
            name: displayName,
          },
        });
      });

      const allEvents = [...calendarEvents, ...blockoutRanges];
      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async (event: AddEventPayload) => {
    if (!currentBand?.id) {
      console.error('No current band selected');
      return;
    }

    try {
      if (event.type === 'rehearsal') {
        const { error } = await supabase
          .from('rehearsals')
          .insert([{
            band_id: currentBand.id,
            date: event.date,
            start_time: toTwentyFourHour(event.startTime),
            end_time: toTwentyFourHour(event.endTime),
            location: event.location || 'TBD'
          }]);

        if (error) throw error;
        // Recurring logic can be handled in a follow-up workflow using event.recurring
      } else {
        const { error } = await supabase
          .from('gigs')
          .insert([{
            band_id: currentBand.id,
            name: event.title || 'Untitled Gig',
            date: event.date,
            start_time: toTwentyFourHour(event.startTime),
            end_time: toTwentyFourHour(event.endTime),
            location: event.location || 'TBD',
            is_potential: false,
            setlist_id: null,
            setlist_name: null,
          }]);

        if (error) throw error;
      }

      loadEvents();
    } catch (error) {
      console.error('Failed to add event to database:', error);
    }
  };

  const addBlockout = async (blockout: { startDate: string; endDate: string; reason: string }) => {
    // adding blockout

    if (!currentBand?.id || !user?.id) {
      console.error('Missing band or user information');
      return;
    }

    try {
      const start = new Date(blockout.startDate);
      const end = new Date(blockout.endDate);
      const blockDates: BlockDateRow[] = [];

      // Create array of dates to block out
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        blockDates.push({
          user_id: user.id,
          band_id: currentBand.id,
          date: d.toISOString().split('T')[0],
          reason: blockout.reason
        });
      }

      const { error } = await supabase
        .from('block_dates')
        .upsert(blockDates, {
          onConflict: 'user_id,band_id,date',
          ignoreDuplicates: false
        });

      if (error) throw error;

      // Reload events from database
      loadEvents();
    } catch (error) {
      console.error('Failed to add block dates to database:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const nextRehearsal = events
    .filter(e => e.type === 'rehearsal' && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const nextGig = events
    .filter(e => e.type === 'gig' && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return (
    <CalendarContent
      key={currentBand?.id || 'no-band'}
      events={{
        nextRehearsal: nextRehearsal ? {
          date: new Date(nextRehearsal.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: nextRehearsal.start_time && nextRehearsal.end_time ? formatTimeRange(nextRehearsal.start_time, nextRehearsal.end_time) : 'Time TBD',
          location: nextRehearsal.location || ''
        } : undefined,
        nextGig: nextGig ? {
          name: nextGig.title,
          date: nextGig.date,
          location: nextGig.location || ''
        } : undefined,
        calendarEvents: events
      }}
      user={user}
      loading={loading}
      onAddBlockout={addBlockout}
      onEventUpdated={loadEvents}
    />
  );
}
