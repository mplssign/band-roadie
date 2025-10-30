import { useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';
import { DayDots } from '@/components/calendar/DayDots';
import EventDrawer from './EventDrawer';
import AddBlockoutDrawer from './AddBlockoutDrawer';
import AddEventDrawer, { type EventPayload, type PotentialGigMemberResponse } from './AddEventDrawer';
import { formatTimeRange } from '@/lib/utils/formatters';
import { toDateSafe } from '@/lib/utils/date';

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
  setlist_name?: string | null;
  optional_member_ids?: string[] | null;
  member_responses?: PotentialGigMemberResponse[] | null;
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

interface CalendarContentProps {
  events: {
    nextRehearsal?: {
      date: string;
      time: string;
      location: string;
    };
    nextGig?: {
      name: string;
      date: string;
      location: string;
    };
    calendarEvents: CalendarEvent[];
  };
  user: User | null;
  loading?: boolean;
  onAddBlockout: (blockout: { startDate: string; endDate: string; reason: string }) => void;
  onEventUpdated: () => void;
}

// Removed unused date formatting helpers; keep simpler formatting in the parent component

export default function CalendarContent({ events, user: _user, loading = false, onAddBlockout, onEventUpdated }: CalendarContentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [addEventDrawerOpen, setAddEventDrawerOpen] = useState(false);
  const [addEventMode, setAddEventMode] = useState<'add' | 'edit'>('add');
  const [addEventDefaultType, setAddEventDefaultType] = useState<'rehearsal' | 'gig'>('rehearsal');
  const [editEventPayload, setEditEventPayload] = useState<EventPayload | undefined>(undefined);
  const [addBlockoutDrawerOpen, setAddBlockoutDrawerOpen] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [prefilledDate, setPrefilledDate] = useState<string>('');

  // Hooks for delete functionality
  const supabase = createClient();
  const { showToast } = useToast();

  // Helper to parse time string to hour/minute/ampm
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

  // Pre-compute events map for efficient day lookups
  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    events.calendarEvents.forEach(event => {
      // Validate date format
      if (!event.date || typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
        return;
      }

      const dateKey = event.date; // Already in YYYY-MM-DD format
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });

    return map;
  }, [events.calendarEvents]);

  const blockoutRanges = useMemo(() => {
    return events.calendarEvents
      .filter((evt) => evt.type === 'blockout' && evt.blockout)
      .map((evt) => {
        const { blockout, blockedBy } = evt;
        if (!blockout) return null;
        const startISO = blockout.startDate;
        const endISO = blockout.endDate;
        return {
          id: evt.id ?? startISO,
          startISO,
          endISO,
          color: blockout.color,
          label: blockedBy?.name || 'Unavailable',
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [events.calendarEvents]);

  const getMonthDay = (dateStr?: string) => {
    if (!dateStr) return { month: '', day: '' };
    const date = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return { month: '', day: '' };
    return {
      month: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
      day: date.toLocaleString('en-US', { day: 'numeric', timeZone: 'UTC' }),
    };
  };

  const monthEvents = useMemo(() => {
    const currentMonth = currentDate.getUTCMonth();
    const currentYear = currentDate.getUTCFullYear();

    const allEvents = events.calendarEvents
      .filter(
        (evt) =>
          (evt.type === 'rehearsal' || evt.type === 'gig' || evt.type === 'blockout') &&
          typeof evt.date === 'string' &&
          evt.date
      )
      .map((evt) => {
        const date = toDateSafe(`${evt.date}T00:00:00Z`);
        return { evt, date };
      })
      .filter(({ date }) => {
        // Check if date is valid using toDateSafe
        if (!date) {
          console.warn('Invalid date found in event, skipping');
          return false;
        }
        return date.getUTCMonth() === currentMonth && date.getUTCFullYear() === currentYear;
      })
      .sort((a, b) => {
        // Both dates are guaranteed to be non-null here
        return a.date!.getTime() - b.date!.getTime();
      }) as Array<{ evt: CalendarEvent; date: Date }>;

    // Group consecutive blockout days into single entries
    const processedEvents: Array<{ evt: CalendarEvent; date: Date }> = [];
    const blockoutGroupsProcessed = new Set<string>();

    for (const { evt, date } of allEvents) {
      if (evt.type === 'blockout' && evt.blockout) {
        const blockoutKey = `${evt.blockout.startDate}-${evt.blockout.endDate}`;

        // Skip if we've already processed this blockout range
        if (blockoutGroupsProcessed.has(blockoutKey)) {
          continue;
        }

        blockoutGroupsProcessed.add(blockoutKey);

        // Create a single entry for the entire blockout range
        // Use the start date as the display date
        const startDate = toDateSafe(`${evt.blockout.startDate}T00:00:00Z`);
        if (startDate) {
          processedEvents.push({
            evt: {
              ...evt,
              date: evt.blockout.startDate, // Use start date for sorting
            },
            date: startDate,
          });
        }
      } else {
        // Non-blockout events are added as-is
        processedEvents.push({ evt, date });
      }
    }

    return processedEvents;
  }, [events.calendarEvents, currentDate]);

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    // Use local date string (YYYY-MM-DD) to match event dates
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    return events.calendarEvents.filter(e => {
      // Validate event date format and value
      if (!e.date || typeof e.date !== 'string') return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return false;
      return e.date === dateString;
    });
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEventDrawerOpen(false);
    setSelectedEvents([]);

    if (event.type === 'rehearsal' && event.id) {
      const dateObj = new Date(event.date + 'T00:00:00');
      const { hour, minute, ampm } = parseTime(event.start_time || '19:00');
      const duration = calculateDuration(event.start_time || '19:00', event.end_time || '21:00');

      const payload: EventPayload = {
        id: event.id,
        type: 'rehearsal',
        title: '',
        date: dateObj,
        startHour: hour,
        startMinute: minute,
        startAmPm: ampm,
        durationMinutes: duration,
        location: event.location || 'TBD',
        setlistId: event.setlist_id,
      };

      setEditEventPayload(payload);
      setAddEventMode('edit');
      setAddEventDrawerOpen(true);
    } else if (event.type === 'gig' && event.id) {
      const dateObj = new Date(event.date + 'T00:00:00');
      const { hour, minute, ampm } = parseTime(event.start_time || '19:00');
      const duration = calculateDuration(event.start_time || '19:00', event.end_time || '21:00');

      const payload: EventPayload = {
        id: event.id,
        type: 'gig',
        title: event.title,
        date: dateObj,
        startHour: hour,
        startMinute: minute,
        startAmPm: ampm,
        durationMinutes: duration,
        location: event.location || 'TBD',
        setlistId: event.setlist_id,
        setlistName: event.setlist_name ?? null,
        isPotential: event.is_potential,
        optionalMemberIds: Array.isArray(event.optional_member_ids)
          ? [...event.optional_member_ids]
          : undefined,
        memberResponses: Array.isArray(event.member_responses)
          ? event.member_responses.map(response => ({ ...response }))
          : undefined,
      };

      setEditEventPayload(payload);
      setAddEventMode('edit');
      setAddEventDrawerOpen(true);
    }
  };

  // Delete handlers
  const handleDeleteGig = async (gigId: string) => {
    try {
      const { error } = await supabase
        .from('gigs')
        .delete()
        .eq('id', gigId);

      if (error) throw error;

      // Refresh events after deletion
      onEventUpdated();
      showToast('Gig deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting gig:', error);
      showToast('Failed to delete gig', 'error');
      throw error;
    }
  };

  const handleDeleteRehearsal = async (rehearsalId: string) => {
    try {
      const { error } = await supabase
        .from('rehearsals')
        .delete()
        .eq('id', rehearsalId);

      if (error) throw error;

      // Refresh events after deletion
      onEventUpdated();
      showToast('Rehearsal deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting rehearsal:', error);
      showToast('Failed to delete rehearsal', 'error');
      throw error;
    }
  };

  const handleDeleteBlockout = async (blockoutId: string) => {
    try {
      // First, get the specific blockout record to find associated records
      const { data: targetRecord, error: fetchError } = await supabase
        .from('block_dates')
        .select('user_id, band_id, reason, date')
        .eq('id', blockoutId)
        .single();

      if (fetchError || !targetRecord) throw fetchError || new Error('Blockout not found');

      // Find all records with the same user, band, and reason
      const { data: relatedRecords, error: relatedError } = await supabase
        .from('block_dates')
        .select('id, date')
        .eq('user_id', targetRecord.user_id)
        .eq('band_id', targetRecord.band_id)
        .eq('reason', targetRecord.reason)
        .order('date', { ascending: true });

      if (relatedError) throw relatedError;

      if (relatedRecords && relatedRecords.length > 0) {
        // Find the contiguous date range that includes the target date
        const targetDate = new Date(targetRecord.date);
        const sortedDates = relatedRecords.map(r => ({
          id: r.id,
          date: new Date(r.date)
        })).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Find contiguous range containing the target date
        let rangeStart = -1;
        let rangeEnd = -1;

        for (let i = 0; i < sortedDates.length; i++) {
          if (sortedDates[i].date.getTime() === targetDate.getTime()) {
            rangeStart = i;
            rangeEnd = i;

            // Expand backwards
            while (rangeStart > 0) {
              const prevDate = sortedDates[rangeStart - 1].date;
              const currDate = sortedDates[rangeStart].date;
              const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
              if (daysDiff === 1) {
                rangeStart--;
              } else {
                break;
              }
            }

            // Expand forwards
            while (rangeEnd < sortedDates.length - 1) {
              const currDate = sortedDates[rangeEnd].date;
              const nextDate = sortedDates[rangeEnd + 1].date;
              const daysDiff = (nextDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
              if (daysDiff === 1) {
                rangeEnd++;
              } else {
                break;
              }
            }
            break;
          }
        }

        if (rangeStart !== -1 && rangeEnd !== -1) {
          // Delete all records in the contiguous range
          const idsToDelete = sortedDates.slice(rangeStart, rangeEnd + 1).map(r => r.id);

          const { error: deleteError } = await supabase
            .from('block_dates')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) throw deleteError;

          // Refresh events after deletion
          onEventUpdated();
          showToast(`Blockout period deleted successfully (${idsToDelete.length} days)`, 'success');
        } else {
          throw new Error('Could not find blockout range');
        }
      } else {
        throw new Error('No related blockout records found');
      }
    } catch (error) {
      console.error('Error deleting blockout:', error);
      showToast('Failed to delete blockout', 'error');
      throw error;
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days: Array<number | null> = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    const dayEvents = getEventsForDate(date);

    if (dayEvents.length === 0) {
      // Format date as YYYY-MM-DD in local timezone to avoid off-by-one errors
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setPrefilledDate(`${year}-${month}-${day}`);
      setAddEventDrawerOpen(true);
    } else {
      setSelectedEvents(dayEvents);
      setEventDrawerOpen(true);
    }
  };

  return (
    <>
      <main className="flex flex-col bg-background min-h-screen">
        <div className="flex flex-1 flex-col p-[15px]">

          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
              <div className="text-white">Loading calendar...</div>
            </div>
          )}

          {/* Calendar Header */}
          <div className="mb-4 flex items-center justify-center">
            <button
              onClick={previousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="mx-8 text-2xl font-semibold text-white">{monthName}</h1>
            <button
              onClick={nextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Calendar Container */}
          <div className="p-4">
            {/* Day Headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                const today = new Date();
                const todayDayOfWeek = today.getDay();
                const isToday = index === todayDayOfWeek;

                return (
                  <div key={day} className={`py-2 text-center text-sm font-medium ${isToday ? 'text-white' : 'text-gray-400'
                    }`}>
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Calendar Grid with DayDots */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-12" />;
                }

                // Create date at noon to avoid timezone issues
                const date = new Date(year, month, day, 12, 0, 0, 0);
                const isToday = new Date().toDateString() === date.toDateString();

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(date)}
                    className={`group relative h-12 w-full p-1 rounded-xl border border-zinc-700/50 transition-all duration-200 hover:scale-105 ${isToday
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                        : 'bg-transparent text-gray-300 hover:bg-gray-700/50 hover:text-white'
                      }`}
                  >
                    <DayDots date={date} displayMonth={currentDate} eventsMap={eventsMap} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => {
                setPrefilledDate('');
                setAddEventDefaultType('rehearsal');
                setAddEventMode('add');
                setEditEventPayload(undefined);
                setAddEventDrawerOpen(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-500/60 bg-card py-3 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>

            <button
              onClick={() => setAddBlockoutDrawerOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-500/60 bg-card py-3 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>Block Out</span>
            </button>
          </div>

          {/* Month Events Section */}
          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-bold">This Month&apos;s Events</h2>
            {monthEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                No events scheduled for this month yet.
              </div>
            ) : (
              <div className="space-y-4">
                {monthEvents.map(({ evt }) => {
                  const badge = (() => {
                    if (evt.type === 'rehearsal') {
                      return { label: 'Rehearsal', className: 'text-white', bgColor: '#2563EB' };
                    }
                    if (evt.type === 'gig' && evt.is_potential) {
                      return { label: 'Potential Gig', className: 'text-white', bgColor: '#ea580c' };
                    }
                    if (evt.type === 'gig') {
                      return { label: 'Gig', className: 'text-white', bgColor: '#22c55e' };
                    }
                    if (evt.type === 'blockout') {
                      return { label: 'Block Out', className: 'text-white', bgColor: '#dc2626' };
                    }
                    return { label: 'Event', className: 'bg-muted text-foreground', bgColor: undefined };
                  })();

                  const { month, day } = getMonthDay(evt.date);

                  // Check if blockout spans multiple consecutive days
                  const isMultiDayBlockout = evt.type === 'blockout' && evt.blockout && evt.blockout.startDate !== evt.blockout.endDate;
                  const endMonthDay = isMultiDayBlockout ? getMonthDay(evt.blockout!.endDate) : null;

                  // For blockout events, show date range instead of time
                  const displayText = evt.type === 'blockout' && evt.blockout
                    ? evt.blockout.startDate === evt.blockout.endDate
                      ? new Date(`${evt.blockout.startDate}T00:00:00Z`).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC'
                      })
                      : `${new Date(`${evt.blockout.startDate}T00:00:00Z`).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC'
                      })} - ${new Date(`${evt.blockout.endDate}T00:00:00Z`).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC'
                      })}`
                    : (evt.start_time && evt.end_time ? formatTimeRange(evt.start_time, evt.end_time) : 'Time TBD');

                  return (
                    <div
                      key={`${evt.id ?? evt.date}-${evt.title}`}
                      className={`grid ${isMultiDayBlockout ? 'grid-cols-[20%_1fr_20%]' : 'grid-cols-[20%_1fr]'} gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm cursor-pointer hover:bg-card/90 transition-colors`}
                      onClick={() => {
                        setSelectedEvents([evt]);
                        setSelectedDate(new Date(evt.date));
                        setEventDrawerOpen(true);
                      }}
                    >
                      <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 py-6 text-center text-muted-foreground">
                        <span className="text-sm font-semibold tracking-wide">{month}</span>
                        <span className="text-3xl font-medium text-foreground">{day}</span>
                      </div>
                      <div className="space-y-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                          style={badge.bgColor ? { backgroundColor: badge.bgColor } : undefined}
                        >
                          {badge.label}
                        </span>
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-foreground">{evt.title}</h3>
                          <p className="text-sm text-muted-foreground">{displayText}</p>
                          {evt.type !== 'blockout' && evt.location && (
                            <p className="text-sm text-muted-foreground">Location: {evt.location}</p>
                          )}
                        </div>
                      </div>
                      {isMultiDayBlockout && endMonthDay && (
                        <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 py-6 text-center text-muted-foreground">
                          <span className="text-xs font-normal tracking-wide mb-1">Until</span>
                          <span className="text-sm font-semibold tracking-wide">{endMonthDay.month}</span>
                          <span className="text-3xl font-medium text-foreground">{endMonthDay.day}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </main>

      <EventDrawer
        isOpen={eventDrawerOpen}
        onClose={() => setEventDrawerOpen(false)}
        events={selectedEvents}
        date={selectedDate}
        showBackButton={selectedEvents.length > 1}
        onEditEvent={handleEditEvent}
        onDeleteBlockout={handleDeleteBlockout}
      />

      {/* Unified drawer for adding events (both rehearsals and gigs) */}
      <AddEventDrawer
        isOpen={addEventDrawerOpen}
        onClose={() => setAddEventDrawerOpen(false)}
        onEventUpdated={onEventUpdated}
        prefilledDate={prefilledDate}
        defaultEventType={addEventDefaultType}
      />

      <AddBlockoutDrawer
        isOpen={addBlockoutDrawerOpen}
        onClose={() => setAddBlockoutDrawerOpen(false)}
        onSave={onAddBlockout}
      />

      {/* Unified Add/Edit Event Drawer */}
      <AddEventDrawer
        isOpen={addEventDrawerOpen}
        onClose={() => {
          setAddEventDrawerOpen(false);
          setEditEventPayload(undefined);
          setAddEventMode('add');
        }}
        prefilledDate={prefilledDate}
        defaultEventType={addEventDefaultType}
        onEventUpdated={() => {
          setAddEventDrawerOpen(false);
          setEditEventPayload(undefined);
          setAddEventMode('add');
          onEventUpdated();
        }}
        mode={addEventMode}
        event={editEventPayload}
      />
    </>
  );
}
