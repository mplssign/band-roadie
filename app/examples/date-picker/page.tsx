'use client';

import * as React from 'react';
import { type DateRange } from 'react-day-picker';
import {
  DatePicker,
  DateRangePicker,
  getCommonDatePresets,
  getCommonDateRangePresets,
} from '@/components/date-picker';
import { Card } from '@/components/ui/Card';

export default function DatePickerExamplesPage() {
  // Single date picker states
  const [singleDate, setSingleDate] = React.useState<Date>();
  const [singleWithPresets, setSingleWithPresets] = React.useState<Date>();
  const [singleWithLimits, setSingleWithLimits] = React.useState<Date>();
  const [singleDisabledWeekends, setSingleDisabledWeekends] = React.useState<Date>();

  // Range picker states
  const [dateRange, setDateRange] = React.useState<DateRange>();
  const [rangeWithPresets, setRangeWithPresets] = React.useState<DateRange>();
  const [rangeWithLimits, setRangeWithLimits] = React.useState<DateRange>();

  // Helper to disable weekends
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Helper to disable past dates
  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl space-y-12">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Date Picker Components</h1>
          <p className="text-lg text-muted-foreground">
            Production-ready date pickers built with shadcn/ui components only.
          </p>
        </div>

        {/* Single Date Picker Examples */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Single Date Picker</h2>
            <p className="text-sm text-muted-foreground">
              Select a single date with various configurations
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Basic</h3>
                <p className="text-sm text-muted-foreground">
                  Simple date picker with default settings
                </p>
              </div>
              <DatePicker
                value={singleDate}
                onChange={setSingleDate}
                placeholder="Select date"
                className="w-full"
              />
              {singleDate && (
                <div className="text-sm text-muted-foreground">
                  Selected: {singleDate.toLocaleDateString()}
                </div>
              )}
            </Card>

            {/* With Presets */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">With Presets</h3>
                <p className="text-sm text-muted-foreground">
                  Quick selection buttons above calendar
                </p>
              </div>
              <DatePicker
                value={singleWithPresets}
                onChange={setSingleWithPresets}
                placeholder="Select date"
                presets={getCommonDatePresets()}
                className="w-full"
              />
              {singleWithPresets && (
                <div className="text-sm text-muted-foreground">
                  Selected: {singleWithPresets.toLocaleDateString()}
                </div>
              )}
            </Card>

            {/* With Year Range Limits */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Year Range Limits</h3>
                <p className="text-sm text-muted-foreground">
                  Limit year dropdown to 2020-2030
                </p>
              </div>
              <DatePicker
                value={singleWithLimits}
                onChange={setSingleWithLimits}
                placeholder="Select date (2020-2030)"
                fromYear={2020}
                toYear={2030}
                className="w-full"
              />
              {singleWithLimits && (
                <div className="text-sm text-muted-foreground">
                  Selected: {singleWithLimits.toLocaleDateString()}
                </div>
              )}
            </Card>

            {/* Disabled Weekends */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Disabled Weekends</h3>
                <p className="text-sm text-muted-foreground">
                  Weekends are not selectable
                </p>
              </div>
              <DatePicker
                value={singleDisabledWeekends}
                onChange={setSingleDisabledWeekends}
                placeholder="Select weekday"
                disabled={isWeekend}
                className="w-full"
              />
              {singleDisabledWeekends && (
                <div className="text-sm text-muted-foreground">
                  Selected: {singleDisabledWeekends.toLocaleDateString()}
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* Date Range Picker Examples */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Date Range Picker</h2>
            <p className="text-sm text-muted-foreground">
              Select date ranges with dual calendar view
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Range */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Basic Range</h3>
                <p className="text-sm text-muted-foreground">
                  Select start and end dates
                </p>
              </div>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
                className="w-full"
              />
              {dateRange?.from && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>From: {dateRange.from.toLocaleDateString()}</div>
                  {dateRange.to && <div>To: {dateRange.to.toLocaleDateString()}</div>}
                </div>
              )}
            </Card>

            {/* With Presets */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Range With Presets</h3>
                <p className="text-sm text-muted-foreground">
                  Quick selection for common ranges
                </p>
              </div>
              <DateRangePicker
                value={rangeWithPresets}
                onChange={setRangeWithPresets}
                placeholder="Select date range"
                presets={getCommonDateRangePresets()}
                className="w-full"
              />
              {rangeWithPresets?.from && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>From: {rangeWithPresets.from.toLocaleDateString()}</div>
                  {rangeWithPresets.to && (
                    <div>To: {rangeWithPresets.to.toLocaleDateString()}</div>
                  )}
                </div>
              )}
            </Card>

            {/* Future Dates Only */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Future Dates Only</h3>
                <p className="text-sm text-muted-foreground">
                  Past dates are disabled
                </p>
              </div>
              <DateRangePicker
                value={rangeWithLimits}
                onChange={setRangeWithLimits}
                placeholder="Select future range"
                disabled={isPast}
                className="w-full"
              />
              {rangeWithLimits?.from && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>From: {rangeWithLimits.from.toLocaleDateString()}</div>
                  {rangeWithLimits.to && (
                    <div>To: {rangeWithLimits.to.toLocaleDateString()}</div>
                  )}
                </div>
              )}
            </Card>

            {/* Custom Configuration */}
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Custom Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Combined presets + disabled weekends
                </p>
              </div>
              <DateRangePicker
                value={rangeWithLimits}
                onChange={setRangeWithLimits}
                placeholder="Weekdays only"
                disabled={isWeekend}
                presets={getCommonDateRangePresets()}
                fromYear={2024}
                toYear={2026}
                className="w-full"
              />
            </Card>
          </div>
        </section>

        {/* Usage Code Examples */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Usage Examples</h2>
            <p className="text-sm text-muted-foreground">
              Copy-paste ready code snippets
            </p>
          </div>

          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <h3 className="font-medium">Basic Date Picker</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm">
                <code className="text-zinc-50">{`import { DatePicker } from '@/components/date-picker';

const [date, setDate] = useState<Date>();

<DatePicker
  value={date}
  onChange={setDate}
  placeholder="Pick a date"
/>`}</code>
              </pre>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-medium">Date Picker with Presets</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm">
                <code className="text-zinc-50">{`import { DatePicker, getCommonDatePresets } from '@/components/date-picker';

const [date, setDate] = useState<Date>();

<DatePicker
  value={date}
  onChange={setDate}
  presets={getCommonDatePresets()}
  placeholder="Pick a date"
/>`}</code>
              </pre>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-medium">Date Range Picker</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm">
                <code className="text-zinc-50">{`import { DateRangePicker } from '@/components/date-picker';
import { type DateRange } from 'react-day-picker';

const [range, setRange] = useState<DateRange>();

<DateRangePicker
  value={range}
  onChange={setRange}
  placeholder="Pick a date range"
/>`}</code>
              </pre>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-medium">Range Picker with Presets</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm">
                <code className="text-zinc-50">{`import { DateRangePicker, getCommonDateRangePresets } from '@/components/date-picker';
import { type DateRange } from 'react-day-picker';

const [range, setRange] = useState<DateRange>();

<DateRangePicker
  value={range}
  onChange={setRange}
  presets={getCommonDateRangePresets()}
  placeholder="Pick a date range"
/>`}</code>
              </pre>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-medium">Disable Specific Dates</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm">
                <code className="text-zinc-50">{`// Disable weekends
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

<DatePicker
  value={date}
  onChange={setDate}
  disabled={isWeekend}
/>

// Disable past dates
const isPast = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

<DatePicker
  value={date}
  onChange={setDate}
  disabled={isPast}
/>`}</code>
              </pre>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-medium">Custom Presets</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm">
                <code className="text-zinc-50">{`import { type DatePreset, type DateRangePreset } from '@/components/date-picker';

// Single date presets
const customPresets: DatePreset[] = [
  { label: 'Christmas', date: new Date(2025, 11, 25) },
  { label: 'New Year', date: new Date(2026, 0, 1) },
];

// Range presets
const customRangePresets: DateRangePreset[] = [
  {
    label: 'Q1 2025',
    range: {
      from: new Date(2025, 0, 1),
      to: new Date(2025, 2, 31),
    },
  },
];`}</code>
              </pre>
            </Card>
          </div>
        </section>

        {/* Keyboard Navigation */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Keyboard Navigation</h2>
            <p className="text-sm text-muted-foreground">
              Full keyboard accessibility support
            </p>
          </div>

          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Navigation</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">↑↓←→</kbd> Navigate dates</li>
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">Enter</kbd> Select date</li>
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">Esc</kbd> Close popover</li>
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">Tab</kbd> Move focus</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Shortcuts</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">Home</kbd> First day of week</li>
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">End</kbd> Last day of week</li>
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">PageUp</kbd> Previous month</li>
                  <li><kbd className="rounded bg-muted px-2 py-1 text-xs">PageDown</kbd> Next month</li>
                </ul>
              </div>
            </div>
          </Card>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Features</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-6 space-y-2">
              <h3 className="font-medium">shadcn/ui Only</h3>
              <p className="text-sm text-muted-foreground">
                Built exclusively with Popover, Calendar, and Button components. No external date picker libraries.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <h3 className="font-medium">Perfect Alignment</h3>
              <p className="text-sm text-muted-foreground">
                7-column grid ensures weekday headers and date cells align perfectly at all viewport sizes.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <h3 className="font-medium">Fully Accessible</h3>
              <p className="text-sm text-muted-foreground">
                Complete keyboard navigation, focus management, ARIA labels, and screen reader support.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <h3 className="font-medium">Controlled API</h3>
              <p className="text-sm text-muted-foreground">
                Fully controlled components with value/onChange pattern. Easy to integrate with forms.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <h3 className="font-medium">Dark Mode Ready</h3>
              <p className="text-sm text-muted-foreground">
                Respects system theme preferences with proper contrast and color variables.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <h3 className="font-medium">TypeScript</h3>
              <p className="text-sm text-muted-foreground">
                Full type safety with TypeScript definitions and IntelliSense support.
              </p>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
