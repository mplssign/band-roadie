"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Users, AlertTriangle } from "lucide-react";
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

// Calendar alignment: weekday headers and date columns use the same 7-column grid
const alignedCalendarClasses = {
  months: "w-full",
  month: "space-y-4",
  caption: "flex justify-center pt-1 relative items-center",
  caption_label: "text-sm font-medium",
  nav: "space-x-1 flex items-center",
  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
  nav_button_previous: "absolute left-1",
  nav_button_next: "absolute right-1",
  table: "w-full border-collapse",
  head_row: "grid grid-cols-7 gap-1 px-3",
  head_cell: "grid place-items-center text-[0.8rem] font-normal text-muted-foreground",
  row: "grid grid-cols-7 gap-1 px-3",
  cell: "relative p-0",
  day: "h-9 w-full grid place-items-center p-0 font-normal aria-selected:opacity-100",
  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
  day_today: "bg-accent text-accent-foreground",
  day_outside: "text-muted-foreground opacity-50",
  day_disabled: "text-muted-foreground opacity-50",
} as const;

const DAY_OPTIONS = [
  { short: "M", label: "Mon" },
  { short: "T", label: "Tue" },
  { short: "W", label: "Wed" },
  { short: "T", label: "Thu" },
  { short: "F", label: "Fri" },
  { short: "S", label: "Sat" },
  { short: "S", label: "Sun" },
] as const;

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

export type EditGigDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: AddEventPayload) => void;
  onDelete?: (gigId: string) => void;
  editingData?: {
    id?: string;
    name?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    setlist?: string;
    potential?: boolean;
  };
};

type SetlistOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
  initials: string;
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

function buildInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

// Parse time string (HH:MM) and return components for form
function parseTimeString(timeStr: string) {
  if (!timeStr) return { hour: "7", minute: "00", period: "PM" as "AM" | "PM" };
  
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour24 = parseInt(hourStr || "19", 10);
  const minute = (minuteStr && MINUTES.includes(minuteStr as typeof MINUTES[number])) ? minuteStr as typeof MINUTES[number] : "00";
  
  let hour12: string;
  let period: "AM" | "PM";
  
  if (hour24 === 0) {
    hour12 = "12";
    period = "AM";
  } else if (hour24 < 12) {
    hour12 = hour24.toString();
    period = "AM";
  } else if (hour24 === 12) {
    hour12 = "12";
    period = "PM";
  } else {
    hour12 = (hour24 - 12).toString();
    period = "PM";
  }
  
  return { hour: hour12, minute, period };
}

// Calculate duration between start and end times
function calculateDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 120;
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  const duration = endMinutes - startMinutes;
  return duration > 0 ? duration : 120;
}

export type GigForm = {
  id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  is_potential: boolean;
  setlist_id?: string | null;
};

export default function EditGigDrawer({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingData,
}: EditGigDrawerProps) {
  const { currentBand } = useBands();
  const supabase = createClient();
  const { showToast } = useToast();

  const [eventType, setEventType] = useState<EventType>("gig");
  const [dateValue, setDateValue] = useState<Date | undefined>();
  const [startHour, setStartHour] = useState("7");
  const [startMinute, setStartMinute] = useState<(typeof MINUTES)[number]>("00");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("PM");
  const [dateOpen, setDateOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [location, setLocation] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<(typeof DAY_OPTIONS)[number]["label"][]>([]);
  const [recurringFrequency, setRecurringFrequency] = useState<Frequency>("weekly");
  const [untilDate, setUntilDate] = useState<Date | undefined>();
  const [untilOpen, setUntilOpen] = useState(false);

  const [gigName, setGigName] = useState("");
  const [isPotentialGig, setIsPotentialGig] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);

  // Store original values for change detection
  const [originalData, setOriginalData] = useState<EditGigDrawerProps['editingData']>();

  const [setlists, setSetlists] = useState<SetlistOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingSetlists, setLoadingSetlists] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Always set to gig mode for editing
    setEventType("gig");
    setSubmitAttempted(false);
    setIsRecurring(false);
    setRecurringDays([]);
    setRecurringFrequency("weekly");
    setUntilDate(undefined);
    setUntilOpen(false);
    setDateOpen(false);
    
    if (editingData) {
      // Store original data for change detection
      setOriginalData(editingData);
      
      // Populate form with editing data
      setGigName(editingData.name || "");
      setIsPotentialGig(editingData.potential || false);
      setSelectedMemberIds([]);
      setSelectedSetlistId(editingData.setlist || null);
      setLocation(editingData.location || "");
      
      // Parse and set date
      if (editingData.date) {
        const dateObj = new Date(`${editingData.date}T00:00:00`);
        if (!Number.isNaN(dateObj.getTime())) {
          setDateValue(dateObj);
        }
      }
      
      // Parse and set time
      const startTime = parseTimeString(editingData.startTime || "");
      setStartHour(startTime.hour);
      setStartMinute(startTime.minute as typeof MINUTES[number]);
      setStartPeriod(startTime.period);
      
      // Calculate duration
      if (editingData.startTime && editingData.endTime) {
        const duration = calculateDurationMinutes(editingData.startTime, editingData.endTime);
        setDurationMinutes(duration);
      } else {
        setDurationMinutes(120);
      }
    } else {
      // Default values if no editing data
      setOriginalData(undefined);
      setGigName("");
      setIsPotentialGig(false);
      setSelectedMemberIds([]);
      setSelectedSetlistId(null);
      setLocation("");
      setDurationMinutes(120);
      setStartHour("7");
      setStartMinute("00");
      setStartPeriod("PM");
      setDateValue(undefined);
    }
  }, [isOpen, editingData]);

  const loadSetlists = useCallback(async () => {
    if (!currentBand?.id) return;
    try {
      setLoadingSetlists(true);
      const { data, error } = await supabase
        .from("setlists")
        .select("id, name")
        .eq("band_id", currentBand.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setSetlists((data ?? []).map((item) => ({ id: item.id as string, name: item.name as string })));
    } catch (error) {
      console.error(error);
      showToast("Unable to load setlists", "error");
    } finally {
      setLoadingSetlists(false);
    }
  }, [currentBand?.id, showToast, supabase]);

  const loadMembers = useCallback(async () => {
    if (!currentBand?.id) return;
    try {
      setLoadingMembers(true);
      const { data, error } = await supabase
        .from("band_members")
        .select(
          `user_id, users:users(first_name, last_name, email)`
        )
        .eq("band_id", currentBand.id);

      if (error) throw error;

      const formatted = (data ?? []).map((row) => {
        const user = (row as { users?: { first_name?: string | null; last_name?: string | null; email?: string | null } }).users;
        const displayName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Band Member" : "Band Member";
        return {
          id: row.user_id as string,
          name: displayName,
          initials: buildInitials(displayName),
        };
      });

      setMembers(formatted);
    } catch (error) {
      console.error(error);
      showToast("Unable to load members", "error");
    } finally {
      setLoadingMembers(false);
    }
  }, [currentBand?.id, showToast, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    void loadSetlists();
    void loadMembers();
  }, [isOpen, loadSetlists, loadMembers]);

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

  // Check if form has required fields and if changes have been made
  const hasRequiredFields = Boolean(dateValue) && (eventType === "rehearsal" || gigName.trim().length > 0);
  
  const hasChanges = useMemo(() => {
    if (!originalData) return true; // If no original data, allow saving (new item)
    
    // Check for changes in each field
    const nameChanged = (originalData.name || "") !== gigName.trim();
    const locationChanged = (originalData.location || "") !== location.trim();
    const potentialChanged = (originalData.potential || false) !== isPotentialGig;
    const setlistChanged = (originalData.setlist || null) !== selectedSetlistId;
    
    // Check date change
    const originalDateStr = originalData.date;
    const currentDateStr = dateValue ? toIsoDate(dateValue) : undefined;
    const dateChanged = originalDateStr !== currentDateStr;
    
    // Check time changes
    const originalStartTime = parseTimeString(originalData.startTime || "");
    const timeChanged = originalStartTime.hour !== startHour || 
                       originalStartTime.minute !== startMinute || 
                       originalStartTime.period !== startPeriod;
    
    // Check duration change
    const originalDuration = originalData.startTime && originalData.endTime ? 
                            calculateDurationMinutes(originalData.startTime, originalData.endTime) : 120;
    const durationChanged = originalDuration !== durationMinutes;
    
    return nameChanged || locationChanged || potentialChanged || setlistChanged || 
           dateChanged || timeChanged || durationChanged;
  }, [originalData, gigName, location, isPotentialGig, selectedSetlistId, dateValue, 
      startHour, startMinute, startPeriod, durationMinutes]);

  const isValid = hasRequiredFields && hasChanges;

  const handleDayToggle = (label: (typeof DAY_OPTIONS)[number]["label"]) => {
    setRecurringDays((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const handleMemberToggle = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!isValid || !dateValue) return;

    const payload: AddEventPayload = {
      type: eventType,
      date: toIsoDate(dateValue)!,
      startTime: startTimeLabel,
      durationMinutes,
      endTime: endTimeLabel,
      location: location.trim() || undefined,
    };

    if (eventType === "rehearsal") {
      if (isRecurring) {
        payload.recurring = {
          enabled: true,
          days: recurringDays,
          frequency: recurringFrequency,
          until: toIsoDate(untilDate),
        };
      }
    } else {
      payload.gig = {
        name: gigName.trim(),
        potential: isPotentialGig,
        members: isPotentialGig && selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
        setlist: selectedSetlistId ?? undefined,
      };
    }

    onSave(payload);
    onClose();
  };

  const handleDelete = async () => {
    if (!editingData?.id || !onDelete) return;
    
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this gig? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // Call the parent's delete handler
      onDelete(editingData.id);
      onClose();
      showToast('Gig deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting gig:', error);
      showToast('Failed to delete gig', 'error');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-[90vh] w-full max-w-md flex-col border-border bg-background px-0 pb-0 text-foreground overflow-visible"
      >
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle className="text-xl font-semibold">Edit Gig</SheetTitle>
        </SheetHeader>

        <div className="flex h-full w-full flex-col">
          <div className="px-4 pt-4">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 opacity-50"
                disabled
              >
                Rehearsal
              </Button>
              <Button
                type="button"
                variant="default"
                className="flex-1 text-primary-foreground"
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
                    <Label>Date *</Label>
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left font-medium"
                          onClick={() => {
                            setDateOpen(true);
                            setDateValue((prev) => prev ?? new Date());
                          }}
                        >
                          <span>{formatDateDisplay(dateValue)}</span>
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto border-border bg-card p-0" align="start">
                        <div className="w-[308px] p-3">
                          <Calendar
                            mode="single"
                            selected={dateValue}
                            onSelect={(day) => {
                              setDateValue(day ?? undefined);
                              setDateOpen(false);
                            }}
                            initialFocus
                            month={dateValue ?? new Date()}
                            classNames={alignedCalendarClasses}
                          />
                        </div>
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
                </section>

                {eventType === 'rehearsal' && (
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
                      {( [
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
                      <Label className="text-sm">Until (optional)</Label>
                      <Popover open={untilOpen} onOpenChange={setUntilOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium"
                          >
                            <span>{untilDate ? formatDateDisplay(untilDate) : "Pick an end date"}</span>
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto border-border bg-card p-0" align="start">
                          <div className="w-[308px] p-3">
                            <Calendar
                              mode="single"
                              selected={untilDate}
                              onSelect={(day) => {
                                setUntilDate(day ?? undefined);
                                setUntilOpen(false);
                              }}
                              disabled={(date) => !!dateValue && date < dateValue}
                              initialFocus
                              month={untilDate ?? dateValue ?? new Date()}
                              classNames={alignedCalendarClasses}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      {recurrenceHint && (
                        <p className="text-xs text-muted-foreground">{recurrenceHint}</p>
                    )}
                  </div>
                </div>
              )}
                </div>
              )}

              {eventType === 'gig' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Gig Name <span className="text-red-400">*</span></Label>
                    <Input
                      value={gigName}
                      onChange={(event) => setGigName(event.target.value)}
                      placeholder="Enter gig name"
                      className="rounded-xl border-border bg-card text-sm"
                    />
                    {submitAttempted && gigName.trim().length === 0 && (
                      <p className="text-xs text-red-400">Gig name is required.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border bg-card px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Potential Gig</p>
                      <p className="text-xs text-muted-foreground">Requires member confirmation</p>
                      </div>
                      <Switch
                        checked={isPotentialGig}
                        onCheckedChange={(value) => {
                          setIsPotentialGig(value);
                          if (!value) setSelectedMemberIds([]);
                        }}
                      />
                    </div>

                    {isPotentialGig && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Select members to confirm</span>
                        </div>

                        {loadingMembers ? (
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Loading members...</span>
                          </div>
                        ) : members.length === 0 ? (
                          <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                            Add band members to assign confirmations.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {members.map((member) => {
                          const active = selectedMemberIds.includes(member.id);
                              return (
                                <Button
                                  key={member.id}
                                  type="button"
                                  variant={active ? "default" : "secondary"}
                              className={cn(
                                "flex items-center gap-2 rounded-full border px-3 py-2 text-sm",
                                active ? "text-primary-foreground" : ""
                              )}
                                  onClick={() => handleMemberToggle(member.id)}
                                  aria-pressed={active}
                                >
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                                    {member.initials}
                                  </span>
                                  {member.name}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Setlist (optional)</Label>
                    {loadingSetlists ? (
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Loading setlists...</span>
                      </div>
                    ) : setlists.length === 0 ? (
                      <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                        No setlists yet. Create one to assign here.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {setlists.map((setlist) => {
                          const active = selectedSetlistId === setlist.id;
                          return (
                            <Button
                              key={setlist.id}
                              type="button"
                              variant={active ? "default" : "secondary"}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm",
                                active ? "text-primary-foreground" : ""
                              )}
                              onClick={() => setSelectedSetlistId(active ? null : setlist.id)}
                              aria-pressed={active}
                            >
                              {setlist.name}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              Update Gig
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="h-12 w-full rounded-xl border border-border bg-secondary text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              Cancel
            </Button>
            {editingData?.id && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full text-center text-sm text-rose-600 hover:text-rose-700 underline py-2"
              >
                Delete Gig
              </button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
