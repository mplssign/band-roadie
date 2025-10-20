'use client';

import { useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';
import EventDrawer from './EventDrawer';
import AddEventDrawer, { type AddEventPayload } from './AddEventDrawer';
import AddBlockoutDrawer from './AddBlockoutDrawer';
import EditRehearsalDrawer from './EditRehearsalDrawer';
import EditGigDrawer, { type GigForm } from './EditGigDrawer';
import { formatTimeRange } from '@/lib/utils/formatters';

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
  onAddEvent: (event: AddEventPayload) => void;
  onAddBlockout: (blockout: { startDate: string; endDate: string; reason: string }) => void;
  onEventUpdated: () => void;
}

// Removed unused date formatting helpers; keep simpler formatting in the parent component

export default function CalendarContent({ events, user: _user, loading = false, onAddEvent, onAddBlockout, onEventUpdated }: CalendarContentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [addEventDrawerOpen, setAddEventDrawerOpen] = useState(false);
  const [addBlockoutDrawerOpen, setAddBlockoutDrawerOpen] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  const [editRehearsal, setEditRehearsal] = useState<{ id: string; date: string; start_time: string; end_time: string; location: string } | null>(null);
  const [editRehearsalDrawerOpen, setEditRehearsalDrawerOpen] = useState(false);
  const [editGig, setEditGig] = useState<GigForm | null>(null);
  const [editGigDrawerOpen, setEditGigDrawerOpen] = useState(false);

  // Hooks for delete functionality
  const supabase = createClient();
  const { showToast } = useToast();

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

    return events.calendarEvents
      .filter(
        (evt) =>
          (evt.type === 'rehearsal' || evt.type === 'gig' || evt.type === 'blockout') && 
          typeof evt.date === 'string' && 
          evt.date &&
          /^\d{4}-\d{2}-\d{2}$/.test(evt.date), // Validate YYYY-MM-DD format
      )
      .map((evt) => {
        const date = new Date(`${evt.date}T00:00:00Z`);
        return { evt, date };
      })
      .filter(({ date }) => {
        // Check if date is valid
        if (Number.isNaN(date.getTime())) {
          console.warn('Invalid date found in event:', date);
          return false;
        }
        return date.getUTCMonth() === currentMonth && date.getUTCFullYear() === currentYear;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
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

  const handleDayClick = (date: Date, dayEvents: CalendarEvent[]) => {
    setSelectedDate(date);
    
    if (dayEvents.length === 0) {
      setPrefilledDate(date.toISOString().split('T')[0]);
      setAddEventDrawerOpen(true);
    } else {
      setSelectedEvents(dayEvents);
      setEventDrawerOpen(true);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEventDrawerOpen(false);
    setSelectedEvents([]);
    if (event.type === 'rehearsal' && event.id) {
      const start = event.start_time ?? '19:00';
      const end = event.end_time ?? '21:00';
      setEditRehearsal({
        id: event.id,
        date: event.date,
        start_time: start,
        end_time: end,
        location: event.location ?? 'TBD',
      });
      setEditRehearsalDrawerOpen(true);
    } else if (event.type === 'gig' && event.id) {
      setEditGig({
        id: event.id,
        name: event.title,
        date: event.date,
        start_time: event.start_time ?? '19:00',
        end_time: event.end_time ?? '21:00',
        location: event.location ?? 'TBD',
        is_potential: event.is_potential ?? false,
        setlist_id: event.setlist_id ?? null,
      });
      setEditGigDrawerOpen(true);
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

  return (
    <>
      <main className="flex flex-col bg-gray-900">
        <div className="flex flex-1 flex-col px-6 pt-4">
          
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
          <div className="rounded-3xl bg-gray-800 p-4 shadow-2xl">
            {/* Day Headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                const today = new Date();
                const todayDayOfWeek = (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format
                const isToday = index === todayDayOfWeek;
                
                return (
                  <div key={day} className={`py-2 text-center text-sm font-medium ${
                    isToday ? 'text-white' : 'text-gray-400'
                  }`}>
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-12" />;
                }
                
                const date = new Date(year, month, day);
                // Use local date string (YYYY-MM-DD) to match event dates
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const isoDate = `${y}-${m}-${d}`;
                const dayEvents = getEventsForDate(date);
                const isToday = new Date().toDateString() === date.toDateString();
                const blockoutsForDay = blockoutRanges.filter(
                  (range) => isoDate >= range.startISO && isoDate <= range.endISO,
                );
                
                // Check if this is the start or end of a blockout range
                const isBlockoutStart = blockoutsForDay.some(range => range.startISO === isoDate);
                const isBlockoutEnd = blockoutsForDay.some(range => range.endISO === isoDate);
                const isBlockoutMiddle = blockoutsForDay.length > 0 && !isBlockoutStart && !isBlockoutEnd;
                
                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(date, dayEvents)}
                    className={`group relative flex h-12 w-full items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 ${
                      isToday 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' 
                        : isBlockoutMiddle
                          ? 'bg-zinc-500/20 text-gray-300 hover:bg-zinc-500/30'
                          : 'bg-transparent text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    {/* Blockout connecting line - subtle gray horizontal bar */}
                    {blockoutsForDay.length > 0 && (
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                        <div className="h-0.5 w-full bg-zinc-500/25" />
                      </div>
                    )}
                    {/* Day Number */}
                    <span className={`text-base font-medium ${isToday ? 'text-white' : ''}`}>
                      {day}
                    </span>
                    
                    {/* Event Indicators - Clean dots at bottom */}
                    <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                      {dayEvents.some(e => e.type === 'rehearsal') && (
                        <div className={`h-1.5 w-1.5 rounded-full bg-blue-500 ${isToday ? 'ring-1 ring-white' : ''}`} />
                      )}
                      {dayEvents.some(e => e.type === 'gig') && (
                        <div className={`h-1.5 w-1.5 rounded-full bg-purple-500 ${isToday ? 'ring-1 ring-white' : ''}`} />
                      )}
                      {/* Blockout indicators - gray dots for start/end */}
                      {(isBlockoutStart || isBlockoutEnd) && (
                        <div className={`h-1.5 w-1.5 rounded-full bg-zinc-400 ${isToday ? 'ring-1 ring-white' : ''}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => {
                setPrefilledDate('');
                setAddEventDrawerOpen(true);
              }}
              className="flex flex-1 items-center justify-center gap-3 rounded-xl bg-primary py-4 font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-opacity hover:opacity-90"
            >
              <Plus className="w-5 h-5" />
              <span>Add Event</span>
            </button>

            <button
              onClick={() => setAddBlockoutDrawerOpen(true)}
              className="flex flex-1 items-center justify-center gap-3 rounded-xl bg-secondary py-4 font-medium text-secondary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="w-5 h-5" />
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
                      return { label: 'Rehearsal', className: 'bg-blue-500 text-white' };
                    }
                    if (evt.type === 'gig' && evt.is_potential) {
                      return { label: 'Potential Gig', className: 'bg-purple-500/80 text-white' };
                    }
                    if (evt.type === 'gig') {
                      return { label: 'Gig', className: 'bg-purple-500 text-white' };
                    }
                    if (evt.type === 'blockout') {
                      return { label: 'Block Out', className: 'bg-zinc-500 text-white' };
                    }
                    return { label: 'Event', className: 'bg-muted text-foreground' };
                  })();

                  const { month, day } = getMonthDay(evt.date);
                  
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
                      className="grid grid-cols-[20%_1fr] gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm cursor-pointer hover:bg-card/90 transition-colors"
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
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
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

      <AddEventDrawer
        isOpen={addEventDrawerOpen}
        onClose={() => setAddEventDrawerOpen(false)}
        prefilledDate={prefilledDate}
        onSave={onAddEvent}
      />

      <AddBlockoutDrawer
        isOpen={addBlockoutDrawerOpen}
        onClose={() => setAddBlockoutDrawerOpen(false)}
        onSave={onAddBlockout}
      />

      <EditRehearsalDrawer
        isOpen={editRehearsalDrawerOpen}
        onClose={() => {
          setEditRehearsalDrawerOpen(false);
          setEditRehearsal(null);
        }}
        rehearsal={editRehearsal}
        onRehearsalUpdated={() => {
          setEditRehearsalDrawerOpen(false);
          setEditRehearsal(null);
          onEventUpdated();
        }}
        onDelete={handleDeleteRehearsal}
      />

      <EditGigDrawer
        isOpen={editGigDrawerOpen}
        onClose={() => {
          setEditGigDrawerOpen(false);
          setEditGig(null);
        }}
        editingData={editGig ? {
          id: editGig.id,
          name: editGig.name,
          date: editGig.date,
          startTime: editGig.start_time,
          endTime: editGig.end_time,
          location: editGig.location,
          setlist: editGig.setlist_id || undefined,
          potential: editGig.is_potential
        } : undefined}
        onSave={async (_event) => {
          // Handle gig update here
          setEditGigDrawerOpen(false);
          setEditGig(null);
          onEventUpdated();
        }}
        onDelete={handleDeleteGig}
      />
    </>
  );
}
