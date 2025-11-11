'use client';

// DateRange import removed as it's not used

// Event type matching CalendarEvent interface from calendar page
interface CalendarEventForDots {
  id?: string;
  date: string;
  type: 'rehearsal' | 'gig' | 'blockout';
  is_potential?: boolean;
  blockout?: {
    startDate: string;
    endDate: string;
    color?: string;
    name?: string;
  };
}

interface DayDotsProps {
  date: Date;
  displayMonth: Date;
  eventsMap?: Map<string, CalendarEventForDots[]>;
}

// Helper to format date as YYYY-MM-DD in local timezone
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to check if two dates are the same day
function isSameDay(date1: string, date2: string): boolean {
  return date1 === date2;
}

export function DayDots({ date, displayMonth: _displayMonth, eventsMap }: DayDotsProps) {
  const dayNumber = date.getDate();
  const dateKey = formatDateKey(date);

  // Get events for this day from the pre-computed map
  const dayEvents = eventsMap?.get(dateKey) || [];

  // Separate events by type
  const rehearsals = dayEvents.filter(e => e.type === 'rehearsal');
  const gigs = dayEvents.filter(e => e.type === 'gig' && !e.is_potential);
  const potentialGigs = dayEvents.filter(e => e.type === 'gig' && e.is_potential);
  const blockouts = dayEvents.filter(e => e.type === 'blockout');

  // Combine all events (non-blockout) for line rendering
  const allEvents = [
    ...rehearsals.map(e => ({ ...e, eventType: 'rehearsal', color: '#2563EB' })),
    ...gigs.map(e => ({ ...e, eventType: 'gig', color: '#22c55e' })),
    ...potentialGigs.map(e => ({ ...e, eventType: 'potential-gig', color: '#ea580c' }))
  ];

  const hasBlockout = blockouts.length > 0;
  const eventCount = allEvents.length;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-start pt-1">
      {/* Day number */}
      <span className="text-sm font-medium">{dayNumber}</span>

      {/* Event lines - positioned at bottom, spanning width */}
      {eventCount > 0 && (
        <div className="absolute bottom-2 left-0 right-0 flex">
          {allEvents.map((event, idx) => {
            const widthPercent = 100 / eventCount;
            const leftPercent = (idx * 100) / eventCount;
            
            return (
              <div
                key={`event-line-${idx}`}
                className="absolute h-1 rounded-sm"
                style={{
                  backgroundColor: event.color,
                  width: `${widthPercent}%`,
                  left: `${leftPercent}%`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Blockout lines - positioned below event lines, stacked for multiple people */}
      {hasBlockout && (
        <div className="absolute bottom-1 left-0 right-0">
          {blockouts.map((blockout, idx) => {
            if (!blockout.blockout) return null;

            const { startDate, endDate } = blockout.blockout;
            const isSingleDay = isSameDay(startDate, endDate);
            const isStartDay = dateKey === startDate;
            const isEndDay = dateKey === endDate;
            const isMiddleDay = !isStartDay && !isEndDay && dateKey > startDate && dateKey < endDate;
            
            // Show blockout if it's a single day or any part of multi-day range
            const shouldShowBlockout = isSingleDay || isStartDay || isMiddleDay || isEndDay;
            
            if (!shouldShowBlockout) return null;

            // Get color from blockout data, fallback to red
            const blockoutColor = blockout.blockout.color || '#dc2626';
            
            // Stack multiple blockout lines vertically
            const lineHeight = 2; // 0.5rem = 2px
            const topOffset = idx * lineHeight;

            return (
              <div 
                key={`blockout-${blockout.id || idx}`}
                className="absolute w-full h-0.5 rounded-sm"
                style={{
                  backgroundColor: blockoutColor,
                  top: `${topOffset}px`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
