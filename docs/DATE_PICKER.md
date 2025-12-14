# shadcn-only  Components

Complete, production-ready  components built exclusively with shadcn/ui components.

## Overview

This implementation provides:
- **DatePicker** - Single date selection
- **DateRangePicker** - Date range selection with dual calendar
- **PresetButtons** - Quick selection shortcuts
- **Zero external dependencies** - Only shadcn/ui + date-fns for formatting

## Features

✅ **shadcn/ui Only** - Built with Popover, Calendar, Button components  
✅ **Perfect Alignment** - 7-column grid ensures headers and dates align  
✅ **Fully Accessible** - Complete keyboard navigation and ARIA support  
✅ **Controlled API** - Standard value/onChange pattern  
✅ **Dark Mode** - Respects system theme preferences  
✅ **TypeScript** - Full type safety and IntelliSense  

## Installation

Already included in this project:
- `components/date-picker.tsx` -  components
- `app/examples/date-picker/page.tsx` - Live examples and documentation

## Components

### DatePicker (Single Date)

```tsx
import { DatePicker } from '@/components/date-picker';
import { useState } from 'react';

function MyComponent() {
  const [date, setDate] = useState<Date>();

  return (
    <DatePicker
      value={date}
      onChange={setDate}
      placeholder="Pick a date"
    />
  );
}
```

#### Props

```typescript
interface DatePickerProps {
  value?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: string;
  disabled?: Matcher | Matcher[];
  fromYear?: number;  // Default: 2000
  toYear?: number;    // Default: 2050
  presets?: DatePreset[];
  className?: string;
}
```

### DateRangePicker

```tsx
import { DateRangePicker } from '@/components/date-picker';
import { type DateRange } from 'react-day-picker';
import { useState } from 'react';

function MyComponent() {
  const [range, setRange] = useState<DateRange>();

  return (
    <DateRangePicker
      value={range}
      onChange={setRange}
      placeholder="Pick a date range"
    />
  );
}
```

#### Props

```typescript
interface DateRangePickerProps {
  value?: DateRange;  // { from?: Date; to?: Date }
  onChange?: (range?: DateRange) => void;
  placeholder?: string;
  disabled?: Matcher | Matcher[];
  fromYear?: number;
  toYear?: number;
  presets?: DateRangePreset[];
  className?: string;
}
```

## Presets

### Built-in Presets

```tsx
import {
  DatePicker,
  getCommonDatePresets,
  getCommonDateRangePresets,
} from '@/components/date-picker';

// Single date presets: Today, Tomorrow, In 7 days, In 30 days
<DatePicker
  value={date}
  onChange={setDate}
  presets={getCommonDatePresets()}
/>

// Range presets: Today, Tomorrow, This Week, Next 7 Days, This Month, Next 30 Days
<DateRangePicker
  value={range}
  onChange={setRange}
  presets={getCommonDateRangePresets()}
/>
```

### Custom Presets

```tsx
import { type DatePreset, type DateRangePreset } from '@/components/date-picker';

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
  {
    label: 'Q2 2025',
    range: {
      from: new Date(2025, 3, 1),
      to: new Date(2025, 5, 30),
    },
  },
];

<DatePicker presets={customPresets} />
<DateRangePicker presets={customRangePresets} />
```

## Advanced Usage

### Disable Specific Dates

```tsx
// Disable weekends
const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

<DatePicker disabled={isWeekend} />

// Disable past dates
const isPast = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

<DatePicker disabled={isPast} />

// Disable specific date ranges
const disabledRanges = [
  { from: new Date(2025, 11, 24), to: new Date(2025, 11, 26) }, // Christmas
  { from: new Date(2025, 0, 1), to: new Date(2025, 0, 1) },     // New Year
];

<DatePicker disabled={disabledRanges} />

// Combine multiple conditions
<DatePicker
  disabled={[
    isWeekend,
    isPast,
    { from: new Date(2025, 11, 24), to: new Date(2025, 11, 26) },
  ]}
/>
```

### Year Range Limits

```tsx
// Limit year dropdown to specific range
<DatePicker
  fromYear={2020}
  toYear={2030}
  placeholder="Select date (2020-2030)"
/>

// Only future years
const currentYear = new Date().getFullYear();
<DatePicker
  fromYear={currentYear}
  toYear={currentYear + 10}
/>
```

### Form Integration

```tsx
import { useForm } from 'react-hook-form';
import { DatePicker } from '@/components/date-picker';

interface FormData {
  eventDate: Date;
}

function EventForm() {
  const { register, watch, setValue } = useForm<FormData>();
  const eventDate = watch('eventDate');

  return (
    <form>
      <DatePicker
        value={eventDate}
        onChange={(date) => setValue('eventDate', date)}
      />
    </form>
  );
}
```

### Controlled State with Validation

```tsx
function BookingForm() {
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [error, setError] = useState<string>();

  const handleCheckInChange = (date?: Date) => {
    setCheckIn(date);
    setError(undefined);
    
    // Clear check-out if it's before new check-in
    if (date && checkOut && checkOut < date) {
      setCheckOut(undefined);
    }
  };

  const handleCheckOutChange = (date?: Date) => {
    if (checkIn && date && date < checkIn) {
      setError('Check-out must be after check-in');
      return;
    }
    setCheckOut(date);
    setError(undefined);
  };

  return (
    <>
      <DatePicker
        value={checkIn}
        onChange={handleCheckInChange}
        placeholder="Check-in date"
      />
      <DatePicker
        value={checkOut}
        onChange={handleCheckOutChange}
        placeholder="Check-out date"
        disabled={(date) => checkIn ? date < checkIn : false}
      />
      {error && <p className="text-destructive">{error}</p>}
    </>
  );
}
```

## Keyboard Navigation

Full keyboard accessibility out of the box:

| Key | Action |
|-----|--------|
| <kbd>↑↓←→</kbd> | Navigate between dates |
| <kbd>Enter</kbd> | Select highlighted date |
| <kbd>Esc</kbd> | Close popover |
| <kbd>Tab</kbd> | Move focus between elements |
| <kbd>Home</kbd> | First day of week |
| <kbd>End</kbd> | Last day of week |
| <kbd>PageUp</kbd> | Previous month |
| <kbd>PageDown</kbd> | Next month |
| <kbd>Shift+PageUp</kbd> | Previous year |
| <kbd>Shift+PageDown</kbd> | Next year |

## Styling

### Custom Width

```tsx
<DatePicker className="w-[280px]" />
<DateRangePicker className="w-full md:w-auto" />
```

### Custom Trigger Button

The trigger button uses shadcn's Button component with `variant="outline"`:

```tsx
// Override button styling via className
<DatePicker
  className="border-dashed hover:border-solid"
  placeholder="Custom styled picker"
/>
```

### Popover Positioning

```tsx
// PopoverContent always uses align="start" by default
// Customize by modifying the component source if needed
```

## Architecture

### Component Structure

```
components/date-picker.tsx
├── PresetButtons       - Reusable preset button group
├── DatePicker          - Single date selection
├── DateRangePicker     - Date range selection
└── Helper functions
    ├── getCommonDatePresets()
    └── getCommonDateRangePresets()
```

### Dependencies

- **@/components/ui/button** - Trigger button and preset buttons
- **@/components/ui/calendar** - Calendar grid (react-day-picker wrapper)
- **@/components/ui/popover** - Popover container
- **lucide-react** - CalendarIcon
- **date-fns** - format() function only
- **react-day-picker** - Types (DateRange, Matcher)

### No External CSS

All styling uses:
- Tailwind utility classes
- shadcn/ui CSS variables
- No custom CSS files required

## Live Examples

Visit `/examples/date-picker` to see:
- Basic single 
-  with presets
- Year range limits
- Disabled weekends
- Basic range picker
- Range picker with presets
- Future dates only
- Custom configurations
- Usage code snippets

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## Accessibility

✅ ARIA labels and roles  
✅ Keyboard navigation  
✅ Focus management  
✅ Screen reader support  
✅ Focus trap in popover  
✅ Semantic HTML  

## Performance

- Lazy loads calendar only when popover opens
- Minimal re-renders with React.useState
- No unnecessary date calculations
- Efficient grid rendering

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '@/components/date-picker';

test('selects a date', async () => {
  const handleChange = jest.fn();
  const user = userEvent.setup();
  
  render(<DatePicker onChange={handleChange} />);
  
  const button = screen.getByRole('button');
  await user.click(button);
  
  // Calendar is now open
  const today = screen.getByText('15'); // Example
  await user.click(today);
  
  expect(handleChange).toHaveBeenCalled();
});
```

## Migration from Other Pickers

### From react-datepicker

```diff
- import DatePicker from 'react-datepicker';
+ import { DatePicker } from '@/components/date-picker';

- <DatePicker
-   selected={date}
-   onChange={setDate}
- />
+ <DatePicker
+   value={date}
+   onChange={setDate}
+ />
```

### From MUI DatePicker

```diff
- import { DatePicker } from '@mui/x-date-pickers';
+ import { DatePicker } from '@/components/date-picker';

- <DatePicker
-   value={date}
-   onChange={(newValue) => setDate(newValue)}
-   renderInput={(params) => <TextField {...params} />}
- />
+ <DatePicker
+   value={date}
+   onChange={setDate}
+ />
```

## Troubleshooting

### Dates not aligning with weekday headers

✅ Already fixed - uses `grid-cols-7` on both headers and date cells

### Popover doesn't close on selection

- Check that you're passing `onChange` prop
- Single date: Closes automatically after selection
- Range: Closes after both dates selected

### Keyboard navigation not working

- Ensure `initialFocus` is true (default)
- Check that popover is open
- Verify no other elements stealing focus

### Presets not working

```tsx
// ❌ Wrong - not using preset helpers
const presets = [{ label: 'Today', date: 'today' }];

// ✅ Correct - Date objects
const presets = [{ label: 'Today', date: new Date() }];

// ✅ Or use built-in helpers
import { getCommonDatePresets } from '@/components/date-picker';
```

## Contributing

The  is part of the Band Roadie project component library. To modify:

1. Edit `components/date-picker.tsx`
2. Test in `/examples/date-picker`
3. Ensure build passes: `pnpm build`
4. Commit changes

## License

Same as Band Roadie project.
