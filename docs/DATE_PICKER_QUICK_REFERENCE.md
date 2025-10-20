// Quick Reference: Date Picker Components
// ===========================================

// ============================================
// 1. BASIC SINGLE DATE PICKER
// ============================================
import { DatePicker } from '@/components/date-picker';
import { useState } from 'react';

const [date, setDate] = useState<Date>();

<DatePicker
  value={date}
  onChange={setDate}
  placeholder="Pick a date"
/>

// ============================================
// 2. DATE PICKER WITH PRESETS
// ============================================
import { DatePicker, getCommonDatePresets } from '@/components/date-picker';

<DatePicker
  value={date}
  onChange={setDate}
  presets={getCommonDatePresets()}
/>

// ============================================
// 3. BASIC DATE RANGE PICKER
// ============================================
import { DateRangePicker } from '@/components/date-picker';
import { type DateRange } from 'react-day-picker';

const [range, setRange] = useState<DateRange>();

<DateRangePicker
  value={range}
  onChange={setRange}
  placeholder="Pick a date range"
/>

// ============================================
// 4. RANGE PICKER WITH PRESETS
// ============================================
import { DateRangePicker, getCommonDateRangePresets } from '@/components/date-picker';

<DateRangePicker
  value={range}
  onChange={setRange}
  presets={getCommonDateRangePresets()}
/>

// ============================================
// 5. DISABLE WEEKENDS
// ============================================
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

<DatePicker disabled={isWeekend} />

// ============================================
// 6. DISABLE PAST DATES
// ============================================
const isPast = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

<DatePicker disabled={isPast} />

// ============================================
// 7. YEAR RANGE LIMITS
// ============================================
<DatePicker
  fromYear={2020}
  toYear={2030}
/>

// ============================================
// 8. CUSTOM PRESETS
// ============================================
import { type DatePreset } from '@/components/date-picker';

const customPresets: DatePreset[] = [
  { label: 'Project Start', date: new Date(2025, 0, 1) },
  { label: 'Q1 End', date: new Date(2025, 2, 31) },
];

<DatePicker presets={customPresets} />

// ============================================
// 9. CUSTOM RANGE PRESETS
// ============================================
import { type DateRangePreset } from '@/components/date-picker';

const customRangePresets: DateRangePreset[] = [
  {
    label: 'Q1 2025',
    range: {
      from: new Date(2025, 0, 1),
      to: new Date(2025, 2, 31),
    },
  },
];

<DateRangePicker presets={customRangePresets} />

// ============================================
// 10. MULTIPLE DISABLED CONDITIONS
// ============================================
<DatePicker
  disabled={[
    isWeekend,
    isPast,
    { from: new Date(2025, 11, 24), to: new Date(2025, 11, 26) },
  ]}
/>

// ============================================
// 11. FULL CONFIGURATION EXAMPLE
// ============================================
<DatePicker
  value={date}
  onChange={setDate}
  placeholder="Select event date"
  disabled={[isWeekend, isPast]}
  fromYear={2024}
  toYear={2026}
  presets={getCommonDatePresets()}
  className="w-full md:w-[280px]"
/>

// ============================================
// 12. CONTROLLED VALIDATION
// ============================================
const [startDate, setStartDate] = useState<Date>();
const [endDate, setEndDate] = useState<Date>();
const [error, setError] = useState<string>();

const handleStartChange = (date?: Date) => {
  setStartDate(date);
  if (date && endDate && endDate < date) {
    setEndDate(undefined);
  }
  setError(undefined);
};

const handleEndChange = (date?: Date) => {
  if (startDate && date && date < startDate) {
    setError('End date must be after start date');
    return;
  }
  setEndDate(date);
  setError(undefined);
};

<>
  <DatePicker value={startDate} onChange={handleStartChange} />
  <DatePicker
    value={endDate}
    onChange={handleEndChange}
    disabled={(date) => startDate ? date < startDate : false}
  />
  {error && <p className="text-destructive">{error}</p>}
</>

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
// ↑↓←→ : Navigate dates
// Enter: Select date
// Esc  : Close popover
// Tab  : Move focus
// Home : First day of week
// End  : Last day of week
// PgUp : Previous month
// PgDn : Next month

// ============================================
// AVAILABLE IMPORTS
// ============================================
import {
  DatePicker,              // Single date picker component
  DateRangePicker,         // Range picker component
  PresetButtons,           // Preset button group component
  getCommonDatePresets,    // Helper: common single date presets
  getCommonDateRangePresets, // Helper: common range presets
  type DatePreset,         // Type: single date preset
  type DateRangePreset,    // Type: range preset
  type DatePickerProps,    // Type: DatePicker props
  type DateRangePickerProps, // Type: DateRangePicker props
} from '@/components/date-picker';

// ============================================
// COMMON PATTERNS
// ============================================

// Form integration with react-hook-form
import { useForm, Controller } from 'react-hook-form';

const { control } = useForm();

<Controller
  name="eventDate"
  control={control}
  render={({ field }) => (
    <DatePicker
      value={field.value}
      onChange={field.onChange}
    />
  )}
/>

// Zustand store integration
import { create } from 'zustand';

const useStore = create((set) => ({
  date: undefined,
  setDate: (date) => set({ date }),
}));

const Component = () => {
  const { date, setDate } = useStore();
  return <DatePicker value={date} onChange={setDate} />;
};

// Context integration
const DateContext = createContext();

const Component = () => {
  const { date, setDate } = useContext(DateContext);
  return <DatePicker value={date} onChange={setDate} />;
};

// ============================================
// STYLING EXAMPLES
// ============================================

// Full width
<DatePicker className="w-full" />

// Fixed width
<DatePicker className="w-[280px]" />

// Responsive width
<DatePicker className="w-full md:w-auto" />

// Custom border
<DatePicker className="border-dashed hover:border-solid" />

// With error state
<DatePicker className={error ? "border-destructive" : ""} />

// ============================================
// LIVE DEMO
// ============================================
// Visit: http://localhost:3001/examples/date-picker
// Source: app/examples/date-picker/page.tsx
// Component: components/date-picker.tsx
// Docs: docs/DATE_PICKER.md
