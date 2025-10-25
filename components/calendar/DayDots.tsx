'use client';

import type { DateRange } from 'react-day-picker';

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

export function DayDots({ date, displayMonth, eventsMap }: DayDotsProps) {
  const dayNumber = date.getDate();
  const dateKey = formatDateKey(date);

  // Get events for this day from the pre-computed map
  const dayEvents = eventsMap?.get(dateKey) || [];

  // Separate events by type
  const rehearsals = dayEvents.filter(e => e.type === 'rehearsal');
  const gigs = dayEvents.filter(e => e.type === 'gig' && !e.is_potential);
  const potentialGigs = dayEvents.filter(e => e.type === 'gig' && e.is_potential);
  const blockouts = dayEvents.filter(e => e.type === 'blockout');

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

  const hasBlockoutRange = blockoutRanges.some(b => !b.isSingleDay);
  const hasSingleDayBlockout = blockoutRanges.some(b => b.isSingleDay);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-start pt-1">
      {/* Day number */}
      <span className="text-sm font-medium">{dayNumber}</span>

      {/* Event dots row - positioned at bottom */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1">
        {/* Rehearsal dots (blue #2563EB) */}
        {rehearsals.map((_, idx) => (
          <span
            key={`rehearsal-${idx}`}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#2563EB' }}
          />
        ))}

        {/* Gig dots (green #22c55e) */}
        {gigs.map((_, idx) => (
          <span
            key={`gig-${idx}`}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#22c55e' }}
          />
        ))}

        {/* Potential gig dots (orange #ea580c) */}
        {potentialGigs.map((_, idx) => (
          <span
            key={`potential-${idx}`}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#ea580c' }}
          />
        ))}

        {/* Single-day blockout dots (red #dc2626) - stacked at same position */}
        {hasSingleDayBlockout && blockoutRanges.filter(b => b.isSingleDay).map((_, idx) => (
          <span
            key={`blockout-single-${idx}`}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#dc2626' }}
          />
        ))}
      </div>

      {/* Blockout range row */}
      {hasBlockoutRange && (
        <div className="absolute bottom-4 left-0 right-0 h-3 w-full">
          {blockoutRanges.map((range, idx) => {
            if (range.isSingleDay) return null;

            let barClass = 'absolute top-1/2 -translate-y-1/2 h-1 rounded-full';
            let barStyle: React.CSSProperties = {};

            if (range.isStartDay) {
              // Start day: bar goes from center to right edge
              barClass += ' left-1/2 w-1/2';
              barStyle = { backgroundColor: '#dc262680' }; // 50% opacity
            } else if (range.isEndDay) {
              // End day: bar goes from left edge to center
              barClass += ' left-0 w-1/2';
              barStyle = { backgroundColor: '#dc262680' }; // 50% opacity
            } else if (range.isMiddleDay) {
              // Middle day: bar spans full width
              barClass += ' left-0 w-full';
              barStyle = { backgroundColor: '#dc262680' }; // 50% opacity
            }

            return (
              <div key={`blockout-range-${idx}`}>
                {/* Connecting bar */}
                <div className={barClass} style={barStyle} />

                {/* Dots on start and end days */}
                {range.isStartDay && (
                  <span
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: '#dc2626' }}
                  />
                )}
                {range.isEndDay && (
                  <span
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: '#dc2626' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
