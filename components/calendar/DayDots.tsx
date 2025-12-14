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

  // Process blockouts for range rendering
  const blockoutRanges: Array<{
    isSingleDay: boolean;
    isStartDay: boolean;
    isEndDay: boolean;
    isMiddleDay: boolean;
  }> = [];

  blockouts.forEach(blockout => {
    if (!blockout.blockout) return;

    const { startDate, endDate } = blockout.blockout;
    const isSingleDay = isSameDay(startDate, endDate);
    const isStartDay = dateKey === startDate;
    const isEndDay = dateKey === endDate;
    const isMiddleDay = !isStartDay && !isEndDay && dateKey > startDate && dateKey < endDate;

    blockoutRanges.push({
      isSingleDay,
      isStartDay,
      isEndDay,
      isMiddleDay,
    });
  });

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

      {/* Blockout line - positioned below event lines, spanning full width */}
      {hasBlockout && (
        <div className="absolute bottom-1 left-0 right-0">
          {/* Single day blockouts - full width red line */}
          {blockoutRanges.some(b => b.isSingleDay) && (
            <div className="w-full h-1 bg-red-600 rounded-sm" />
          )}
          
          {/* Multi-day blockout ranges - all days get full width lines */}
          {blockoutRanges.map((range, idx) => {
            if (range.isSingleDay) return null;

            return (
              <div key={`blockout-range-${idx}`} className="absolute inset-0">
                {(range.isStartDay || range.isMiddleDay || range.isEndDay) && (
                  <div className="absolute inset-0 w-full h-1 bg-red-600 rounded-sm" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
