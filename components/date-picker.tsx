'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { type DateRange, type Matcher } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ============================================================================
// PresetButtons Component
// ============================================================================

export interface DatePreset {
  label: string;
  date: Date;
}

export interface DateRangePreset {
  label: string;
  range: DateRange;
}

interface PresetButtonsProps {
  presets: DatePreset[] | DateRangePreset[];
  onSelect: (value: Date | DateRange) => void;
}

export function PresetButtons({ presets, onSelect }: PresetButtonsProps) {
  return (
    <div className="border-b border-border p-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              if ('date' in preset) {
                onSelect(preset.date);
              } else if ('range' in preset) {
                onSelect(preset.range);
              }
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DatePicker Component (Single Date)
// ============================================================================

export interface DatePickerProps {
  value?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: string;
  disabled?: Matcher | Matcher[];
  fromYear?: number;
  toYear?: number;
  presets?: DatePreset[];
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  fromYear = 2000,
  toYear = 2050,
  presets,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    onChange?.(selectedDate);
    setOpen(false);
  };

  const handlePresetSelect = (presetValue: Date | DateRange) => {
    if (presetValue instanceof Date) {
      onChange?.(presetValue);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          data-empty={!value}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {presets && presets.length > 0 && (
          <PresetButtons presets={presets} onSelect={handlePresetSelect} />
        )}
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          disabled={disabled}
          initialFocus
          captionLayout="dropdown"
          fromYear={fromYear}
          toYear={toYear}
          weekStartsOn={0}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// DateRangePicker Component
// ============================================================================

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range?: DateRange) => void;
  placeholder?: string;
  disabled?: Matcher | Matcher[];
  fromYear?: number;
  toYear?: number;
  presets?: DateRangePreset[];
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pick a date range',
  disabled,
  fromYear = 2000,
  toYear = 2050,
  presets,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    onChange?.(selectedRange);
    // Close popover only when both dates are selected
    if (selectedRange?.from && selectedRange?.to) {
      setOpen(false);
    }
  };

  const handlePresetSelect = (presetValue: Date | DateRange) => {
    if (presetValue && typeof presetValue === 'object' && 'from' in presetValue) {
      onChange?.(presetValue);
      setOpen(false);
    }
  };

  const formatRange = (range?: DateRange): string => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, 'PPP');
    return `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className
          )}
          data-empty={!value?.from}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatRange(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {presets && presets.length > 0 && (
          <PresetButtons presets={presets} onSelect={handlePresetSelect} />
        )}
        <Calendar
          mode="range"
          selected={value}
          onSelect={handleSelect}
          disabled={disabled}
          initialFocus
          captionLayout="dropdown"
          fromYear={fromYear}
          toYear={toYear}
          weekStartsOn={0}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Common Preset Helpers
// ============================================================================

export function getCommonDatePresets(): DatePreset[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: tomorrow },
    { label: 'In 7 days', date: nextWeek },
    { label: 'In 30 days', date: nextMonth },
  ];
}

export function getCommonDateRangePresets(): DateRangePreset[] {
  const today = new Date();
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const next7Start = new Date(today);
  const next7End = new Date(today);
  next7End.setDate(today.getDate() + 6);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const next30Start = new Date(today);
  const next30End = new Date(today);
  next30End.setDate(today.getDate() + 29);

  return [
    {
      label: 'Today',
      range: { from: today, to: today },
    },
    {
      label: 'Tomorrow',
      range: { from: tomorrow, to: tomorrow },
    },
    {
      label: 'This Week',
      range: { from: weekStart, to: weekEnd },
    },
    {
      label: 'Next 7 Days',
      range: { from: next7Start, to: next7End },
    },
    {
      label: 'This Month',
      range: { from: monthStart, to: monthEnd },
    },
    {
      label: 'Next 30 Days',
      range: { from: next30Start, to: next30End },
    },
  ];
}
