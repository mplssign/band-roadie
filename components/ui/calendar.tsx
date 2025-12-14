'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      components={components}
      classNames={{
        months: 'space-y-4',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        caption_dropdowns: 'flex gap-1',
        dropdown_month: 'relative inline-flex items-center',
        dropdown_year: 'relative inline-flex items-center',
        dropdown: cn(
          'absolute inset-0 w-full appearance-none opacity-0 z-10 cursor-pointer',
          '[&:not([disabled])]:cursor-pointer'
        ),
        dropdown_icon: 'ml-1 h-4 w-4 opacity-50',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'grid grid-cols-7 gap-0',
        head_cell:
          'text-muted-foreground rounded-md font-normal text-[0.8rem] text-center flex items-center justify-center',
        row: 'grid grid-cols-7 gap-0 mt-2',
        cell:
          'h-10 w-full p-0 text-center text-sm relative ' +
          '[&:has([aria-selected])]:bg-accent ' +
          '[&:has([aria-selected])]:text-accent-foreground ' +
          'focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'relative h-10 w-10 p-0 font-normal border border-zinc-700/50 rounded-md aria-selected:opacity-100'
        ),
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary ' +
          'hover:text-primary-foreground focus:bg-primary ' +
          'focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'text-muted-foreground opacity-50',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle:
          'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';