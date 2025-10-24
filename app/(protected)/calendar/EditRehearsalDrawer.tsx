"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useBands } from "@/contexts/BandsContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/useToast";

const HOURS = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
const MINUTES = ["00", "15", "30", "45"] as const;
const DURATIONS = [
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h 30m" },
  { value: 120, label: "2h" },
  { value: 150, label: "2h 30m" },
  { value: 180, label: "3h" },
  { value: 210, label: "3h 30m" },
  { value: 240, label: "4h" },
] as const;

const DAY_OPTIONS = [
  { short: "M", label: "Mon" },
  { short: "T", label: "Tue" },
  { short: "W", label: "Wed" },
  { short: "T", label: "Thu" },
  { short: "F", label: "Fri" },
  { short: "S", label: "Sat" },
  { short: "S", label: "Sun" },
] as const;

// Shadcn default calendar classes for proper flex layout
const shadcnCalendarClasses = {
  months: "flex flex-col space-y-4",
  month: "space-y-4",
  caption: "flex justify-center pt-1 relative items-center",
  caption_label: "text-sm font-medium",
  nav: "space-x-1 flex items-center",
  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
  nav_button_previous: "absolute left-1",
  nav_button_next: "absolute right-1",
  table: "w-full border-collapse space-y-1",
  head_row: "flex",
  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
  row: "flex w-full mt-2",
  cell: "text-center text-sm p-0 relative [&:has([aria-selected].day-outside)]:bg-accent/50",
  day: "h-9 w-9 p-0 font-normal rounded-md aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground",
  day_range_end: "day-range-end",
  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
  day_today: "bg-accent text-accent-foreground",
  day_outside: "day-outside text-muted-foreground opacity-50",
  day_disabled: "text-muted-foreground opacity-50",
  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
  day_hidden: "invisible",
} as const;

const DAY_TO_FULL: Record<(typeof DAY_OPTIONS)[number]["label"], string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

type EventType = "rehearsal" | "gig";
type Frequency = "weekly" | "biweekly" | "monthly";

export type AddEventPayload = {
  type: EventType;
  date: string;
  startTime: string;
  durationMinutes: number;
  endTime: string;
  location?: string;
  recurring?: {
    enabled: boolean;
    days: (typeof DAY_OPTIONS)[number]["label"][];
    frequency: Frequency;
    until?: string;
  };
  gig?: {
    name: string;
    potential: boolean;
    members?: string[];
    setlist?: string;
  };
};

export type EditRehearsalDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onRehearsalUpdated: () => void;
  onDelete?: (rehearsalId: string) => void;
  rehearsal: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
  } | null;
};

function toIsoDate(date: Date | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().split("T")[0];
}

function formatDateDisplay(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "Pick a date";
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseTimeString(timeStr: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!timeStr) return { hour: "7", minute: "00", period: "PM" };

  // Handle 24-hour format (e.g., "19:00")
  if (timeStr.includes(":") && !timeStr.includes("AM") && !timeStr.includes("PM")) {
    const [hourStr, minuteStr] = timeStr.split(":");
    const hour24 = parseInt(hourStr, 10);
    const period = hour24 >= 12 ? "PM" : "AM";
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return {
      hour: hour12.toString(),
      minute: minuteStr || "00",
      period
    };
  }

  // Handle 12-hour format (e.g., "7:00 PM")
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (match) {
    return {
      hour: match[1],
      minute: match[2],
      period: match[3].toUpperCase() as "AM" | "PM"
    };
  }

  return { hour: "7", minute: "00", period: "PM" };
}

function calculateDurationMinutes(startTime: string, endTime: string): number {
  const parseTime = (time: string) => {
    const { hour, minute, period } = parseTimeString(time);
    let hour24 = parseInt(hour, 10);
    if (period === "PM" && hour24 !== 12) hour24 += 12;
    if (period === "AM" && hour24 === 12) hour24 = 0;
    return hour24 * 60 + parseInt(minute, 10);
  };

  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  return endMinutes > startMinutes ? endMinutes - startMinutes : 120;
}

// Helper: normalize incoming values and guard invalid dates
const toDate = (v?: Date | string | null): Date | undefined => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

export default function EditRehearsalDrawer({
  isOpen,
  onClose,
  onRehearsalUpdated,
  onDelete,
  rehearsal,
}: EditRehearsalDrawerProps) {
  const { currentBand } = useBands();
  const supabase = createClient();
  const { showToast } = useToast();

  const [eventType, setEventType] = useState<EventType>("rehearsal");
  const [dateValue, setDateValue] = useState<Date | undefined>(undefined);
  const [startHour, setStartHour] = useState("7");
  const [startMinute, setStartMinute] = useState<(typeof MINUTES)[number]>("00");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("PM");
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [location, setLocation] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [selectedSetlist, setSelectedSetlist] = useState('');
  const [setlists, setSetlists] = useState<Array<{ id: string; name: string }>>([]);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<(typeof DAY_OPTIONS)[number]["label"][]>([]);
  const [recurringFrequency, setRecurringFrequency] = useState<Frequency>("weekly");
  const [untilDate, setUntilDate] = useState<Date | undefined>(undefined);


  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // Load setlists when band changes
  useEffect(() => {
    const loadSetlists = async () => {
      if (!currentBand?.id) return;

      try {
        const { data: setlistsData } = await supabase
          .from('setlists')
          .select('id, name')
          .eq('band_id', currentBand.id)
          .order('name');

        if (setlistsData) {
          setSetlists(setlistsData);
        }
      } catch (error) {
        console.error('Failed to load setlists:', error);
      }
    };

    if (currentBand?.id) {
      loadSetlists();
    }
  }, [currentBand?.id, supabase]);

  useEffect(() => {
    if (!isOpen || !rehearsal) return;

    setEventType("rehearsal");
    setSubmitAttempted(false);
    setLocation(rehearsal.location || "");

    // Parse date
    if (rehearsal.date) {
      setDateValue(toDate(rehearsal.date));
    }

    // Parse start time
    if (rehearsal.start_time) {
      const parsed = parseTimeString(rehearsal.start_time);
      setStartHour(parsed.hour);
      setStartMinute(parsed.minute as (typeof MINUTES)[number]);
      setStartPeriod(parsed.period);
    }

    // Calculate duration
    if (rehearsal.start_time && rehearsal.end_time) {
      const duration = calculateDurationMinutes(rehearsal.start_time, rehearsal.end_time);
      setDurationMinutes(duration);
    } else {
      setDurationMinutes(120);
    }

    setIsRecurring(false);
    setRecurringDays([]);
    setRecurringFrequency("weekly");
    setUntilDate(undefined);
    setSelectedSetlist('');
  }, [isOpen, rehearsal]);



  useEffect(() => {
    if (!isRecurring) return;
    const frame = requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLElement | null;
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [isRecurring, recurringFrequency, recurringDays.length]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLElement | null;
      viewport?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [eventType]);

  const startTimeLabel = useMemo(() => {
    const hourNumber = Number.parseInt(startHour, 10) % 12 || 12;
    return `${hourNumber}:${startMinute} ${startPeriod}`;
  }, [startHour, startMinute, startPeriod]);

  const endTimeLabel = useMemo(() => {
    const baseHour = Number.parseInt(startHour, 10) % 12;
    const hour24 = startPeriod === "PM" ? (baseHour === 0 ? 12 : baseHour + 12) : baseHour;
    const minutesStart = (hour24 % 24) * 60 + Number.parseInt(startMinute, 10);
    const total = minutesStart + durationMinutes;
    const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour24End = Math.floor(normalized / 60);
    const minuteEnd = normalized % 60;
    const period = hour24End >= 12 ? "PM" : "AM";
    let hour12 = hour24End % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${minuteEnd.toString().padStart(2, "0")} ${period}`;
  }, [durationMinutes, startHour, startMinute, startPeriod]);

  const recurrenceHint = useMemo(() => {
    if (!isRecurring || recurringDays.length === 0) return undefined;
    if (recurringFrequency === "monthly") {
      const primary = recurringDays[0];
      return primary ? `Monthly on ${DAY_TO_FULL[primary]}` : "Monthly";
    }
    const label = recurringFrequency === "biweekly" ? "Every 2 weeks" : "Weekly";
    return `${label} on ${recurringDays.map((d) => DAY_TO_FULL[d]).join(", ")}`;
  }, [isRecurring, recurringDays, recurringFrequency]);

  const isValid = Boolean(dateValue);

  const handleDayToggle = (label: (typeof DAY_OPTIONS)[number]["label"]) => {
    setRecurringDays((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };



  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!isValid || !dateValue || !rehearsal?.id || !currentBand?.id) return;

    // Convert Date to YYYY-MM-DD format
    const dateString = format(dateValue, 'yyyy-MM-dd');

    try {
      // Convert 12-hour time to 24-hour format
      const convert12to24 = (time: string): string => {
        const { hour, minute, period } = parseTimeString(time);
        let hour24 = parseInt(hour, 10);
        if (period === "PM" && hour24 !== 12) hour24 += 12;
        if (period === "AM" && hour24 === 12) hour24 = 0;
        return `${hour24.toString().padStart(2, "0")}:${minute}`;
      };

      const { error } = await supabase
        .from('rehearsals')
        .update({
          date: dateString,
          start_time: convert12to24(startTimeLabel),
          end_time: convert12to24(endTimeLabel),
          location: location.trim() || 'TBD',
          setlist_id: selectedSetlist || null
        })
        .eq('id', rehearsal.id)
        .eq('band_id', currentBand.id);

      if (error) throw error;

      showToast("Rehearsal updated successfully", "success");
      onRehearsalUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update rehearsal:', error);
      showToast("Failed to update rehearsal", "error");
    }
  };

  const handleDelete = async () => {
    if (!rehearsal?.id || !onDelete) return;

    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this rehearsal? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // Call the parent's delete handler
      onDelete(rehearsal.id);
      onClose();
      showToast('Rehearsal deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting rehearsal:', error);
      showToast('Failed to delete rehearsal', 'error');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-[90vh] w-full max-w-md flex-col border-border bg-background px-0 pb-0 text-foreground overflow-visible"
      >
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle className="text-xl font-semibold">Edit Rehearsal</SheetTitle>
        </SheetHeader>

        <div className="flex h-full w-full flex-col">
          <div className="px-4 pt-4">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="default"
                className="flex-1 text-primary-foreground"
                disabled
              >
                Rehearsal
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled
              >
                Gig
              </Button>
            </div>
          </div>

          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
            <div className="mx-auto w-full max-w-md space-y-6 pb-56 pt-6">
              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rehearsal-date">Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateValue && "text-muted-foreground"
                        )}
                        aria-label="Open rehearsal date picker"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateValue ? format(dateValue, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateValue}
                        onSelect={setDateValue}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {submitAttempted && !dateValue && (
                    <p className="text-xs text-red-400">Date is required.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <div className="grid grid-cols-[repeat(2,minmax(0,1fr))_auto] gap-2">
                    <Select value={startHour} onValueChange={setStartHour}>
                      <SelectTrigger className="rounded-xl border-border bg-card text-sm">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem key={hour} value={hour}>
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={startMinute} onValueChange={(value) => setStartMinute(value as (typeof MINUTES)[number])}>
                      <SelectTrigger className="rounded-xl border-border bg-card text-sm">
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTES.map((minute) => (
                          <SelectItem key={minute} value={minute}>
                            {minute}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
                      {(["AM", "PM"] as const).map((period) => {
                        const active = startPeriod === period;
                        return (
                          <Button
                            key={period}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "secondary"}
                            className={cn(
                              "h-8 min-w-[48px] shrink-0 rounded-md",
                              active ? "text-primary-foreground" : ""
                            )}
                            onClick={() => setStartPeriod(period)}
                            aria-pressed={active}
                          >
                            {period}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Ends at {endTimeLabel}</p>
                </div>

                <div className="space-y-2">
                  <Label>Duration *</Label>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((duration) => {
                      const active = durationMinutes === duration.value;
                      return (
                        <Button
                          key={duration.value}
                          type="button"
                          variant={active ? "default" : "secondary"}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm",
                            active ? "text-primary-foreground" : ""
                          )}
                          onClick={() => setDurationMinutes(duration.value)}
                          aria-pressed={active}
                        >
                          {duration.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Enter location"
                    className="rounded-xl border-border bg-card text-sm"
                  />
                </div>

                {/* Setlist Selection */}
                {setlists.length > 0 && (
                  <div className="space-y-2">
                    <Label>Setlist (Optional)</Label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSetlist('')}
                        className={cn(
                          "px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0",
                          !selectedSetlist
                            ? 'bg-muted text-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted/70'
                        )}
                      >
                        No Setlist
                      </button>
                      {setlists.map((setlist) => (
                        <button
                          key={setlist.id}
                          type="button"
                          onClick={() => setSelectedSetlist(setlist.id)}
                          className={cn(
                            "px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0",
                            selectedSetlist === setlist.id
                              ? 'bg-purple-600 text-white'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted/70'
                          )}
                        >
                          {setlist.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Make this recurring</p>
                    <p className="text-xs text-muted-foreground">Turn on to repeat this rehearsal</p>
                  </div>
                  <Switch
                    checked={isRecurring}
                    onCheckedChange={(value) => {
                      setIsRecurring(value);
                      if (!value) {
                        setRecurringDays([]);
                        setUntilDate(undefined);
                      }
                    }}
                  />
                </div>

                {isRecurring && (
                  <div className="space-y-4 rounded-2xl border border-border bg-card px-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Days of the Week</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAY_OPTIONS.map((day) => {
                          const active = recurringDays.includes(day.label);
                          return (
                            <Button
                              key={day.label}
                              type="button"
                              size="icon"
                              variant={active ? "default" : "secondary"}
                              className={cn(
                                "h-10 w-10 rounded-full",
                                active ? "text-primary-foreground" : ""
                              )}
                              onClick={() => handleDayToggle(day.label)}
                              aria-pressed={active}
                            >
                              {day.short}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Frequency</Label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { label: "Weekly", value: "weekly" },
                          { label: "Biweekly", value: "biweekly" },
                          { label: "Monthly", value: "monthly" },
                        ] as const).map((option) => {
                          const active = recurringFrequency === option.value;
                          return (
                            <Button
                              key={option.value}
                              type="button"
                              variant={active ? "default" : "secondary"}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm",
                                active ? "text-primary-foreground" : ""
                              )}
                              onClick={() => setRecurringFrequency(option.value)}
                              aria-pressed={active}
                            >
                              {option.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm" htmlFor="rehearsal-until">Until (optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !untilDate && "text-muted-foreground"
                            )}
                            aria-label="Open until date picker"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {untilDate ? format(untilDate, 'PPP') : <span>No end date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={untilDate}
                            onSelect={setUntilDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {recurrenceHint && (
                        <p className="text-xs text-muted-foreground">{recurrenceHint}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="sticky bottom-0 left-0 right-0 mt-0 border-t border-border bg-background px-4 pb-6 pt-4">
          <div className="mx-auto w-full max-w-md space-y-3">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              Update Rehearsal
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="h-12 w-full rounded-xl border border-border bg-secondary text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              Cancel
            </Button>
            {rehearsal?.id && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full text-center text-sm text-rose-600 hover:text-rose-700 underline py-2"
              >
                Delete Rehearsal
              </button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
