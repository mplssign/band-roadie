'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBands } from '@/hooks/useBands';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type EventType = 'rehearsal' | 'gig';

interface SavedEvent {
  type: EventType;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm (24h)
  endTime: string;    // HH:mm (24h)
  location: string;
}

export type AddEventPayload = SavedEvent;

interface AddEventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledDate?: string;
  onSave: (event: SavedEvent) => void;
  defaultEventType?: EventType;
}

interface Setlist {
  id: string;
  name: string;
}

function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function AddEventDrawer({
  isOpen,
  onClose,
  prefilledDate = '',
  onSave,
  defaultEventType = 'rehearsal',
}: AddEventDrawerProps) {
  const supabase = createClient();
  const { currentBand } = useBands();
  const { showToast } = useToast();

  const [eventType, setEventType] = useState<EventType>(defaultEventType);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState('7');
  const [startMinute, setStartMinute] = useState('00');
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('PM');
  const [duration, setDuration] = useState('120'); // minutes
  const [location, setLocation] = useState('');
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [selectedSetlist, setSelectedSetlist] = useState<string>('');
  const [isPotentialGig, setIsPotentialGig] = useState(false);

  // Recurrence (rehearsals)
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [endDate, setEndDate] = useState('');

  useEffect(() => setEventType(defaultEventType), [defaultEventType]);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => `${i + 1}`), []);
  const minutes = useMemo(() => ['00', '15', '30', '45'], []);
  const durations = useMemo(
    () => [
      { value: '30', label: '30m' },
      { value: '60', label: '1h' },
      { value: '90', label: '1h 30m' },
      { value: '120', label: '2h' },
      { value: '150', label: '2h 30m' },
      { value: '180', label: '3h' },
      { value: '210', label: '3h 30m' },
      { value: '240', label: '4h' },
    ],
    []
  );

  const loadSetlists = useCallback(async () => {
    if (!currentBand?.id) return;
    const { data, error } = await supabase
      .from('setlists')
      .select('id, name')
      .eq('band_id', currentBand.id)
      .order('name');

    if (error) {
      // Non-blocking: just surface the error to the user
      showToast('Failed to load setlists', 'error');
      return;
    }
    setSetlists(data ?? []);
  }, [currentBand?.id, supabase, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    if (prefilledDate) {
      setDate(prefilledDate);
      // Preselect day-of-week for recurrence helper
      const dow = new Date(`${prefilledDate}T00:00:00`).getDay();
      setSelectedDays([dow]);
    }
    void loadSetlists();
  }, [isOpen, prefilledDate, loadSetlists]);

  const hour24 = useMemo(() => {
    const h = parseInt(startHour, 10);
    if (startAmPm === 'PM' && startHour !== '12') return h + 12;
    if (startAmPm === 'AM' && startHour === '12') return 0;
    return h;
  }, [startHour, startAmPm]);

  const startTimeString = useMemo(() => {
    return `${hour24.toString().padStart(2, '0')}:${startMinute}`;
  }, [hour24, startMinute]);

  const endTimeString = useMemo(() => {
    const startMinutes = hour24 * 60 + parseInt(startMinute, 10);
    const endMinutes = startMinutes + parseInt(duration, 10);
    const h = Math.floor(endMinutes / 60) % 24;
    const m = endMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }, [hour24, startMinute, duration]);

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => (prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index]));
  };

  const daysOfWeek = [
    { short: 'S', full: 'Sun', index: 0 },
    { short: 'M', full: 'Mon', index: 1 },
    { short: 'T', full: 'Tue', index: 2 },
    { short: 'W', full: 'Wed', index: 3 },
    { short: 'T', full: 'Thu', index: 4 },
    { short: 'F', full: 'Fri', index: 5 },
    { short: 'S', full: 'Sat', index: 6 },
  ];

  const recurrenceSummary = useMemo(() => {
    if (!isRecurring || selectedDays.length === 0) return '';
    const list = selectedDays
      .slice()
      .sort()
      .map((d) => daysOfWeek.find((x) => x.index === d)?.full ?? '')
      .filter(Boolean)
      .join(', ');
    const until = endDate ? ` until ${new Date(endDate).toLocaleDateString()}` : '';
    const freq =
      recurringFrequency === 'weekly'
        ? 'Weekly'
        : recurringFrequency === 'biweekly'
        ? 'Every 2 weeks'
        : 'Monthly';
    return `${freq} on ${list}${until}`;
  }, [isRecurring, selectedDays, endDate, recurringFrequency]);

  const isValid = useMemo(() => {
    if (!date) return false;
    if (eventType === 'gig' && title.trim().length === 0) return false;
    return true;
  }, [date, eventType, title]);

  const handleSave = async () => {
    if (!currentBand?.id) {
      showToast('No band selected', 'error');
      return;
    }

    try {
      if (eventType === 'rehearsal') {
        const rehearsal = {
          band_id: currentBand.id,
          date,
          start_time: startTimeString,
          end_time: endTimeString,
          location: location || 'TBD',
          notes: null as string | null,
        };
        const { error } = await supabase.from('rehearsals').insert([rehearsal]);
        if (error) throw error;
        showToast('Rehearsal scheduled', 'success');
      } else {
        const chosen = setlists.find((s) => s.id === selectedSetlist);
        const gig = {
          band_id: currentBand.id,
          name: title,
          date,
          start_time: startTimeString,
          end_time: endTimeString,
          location: location || 'TBD',
          is_potential: isPotentialGig,
          setlist_id: selectedSetlist || null,
          setlist_name: chosen?.name ?? null,
          notes: null as string | null,
        };
        const { error } = await supabase.from('gigs').insert([gig]);
        if (error) throw error;
        showToast(isPotentialGig ? 'Potential gig added' : 'Gig added', 'success');
      }

      onSave({
        type: eventType,
        title: eventType === 'gig' ? title : 'Band Rehearsal',
        date,
        startTime: startTimeString,
        endTime: endTimeString,
        location,
      });

      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save event:', err);
      showToast('Failed to save event. Please try again.', 'error');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent side="bottom" className="h-[90vh] w-full p-0 bg-background text-foreground border-border overflow-x-hidden">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>Add Event</SheetTitle>
          <SheetDescription />
        </SheetHeader>

        <ScrollArea className="h-[calc(90vh-60px-72px)] overflow-x-hidden">
          <div className="px-4 py-4 space-y-6 w-full max-w-full overflow-x-hidden">
            {/* Event Type Toggle */}
            <div className="flex gap-2 w-full min-w-0">
              <Button
                type="button"
                variant={eventType === 'rehearsal' ? 'default' : 'secondary'}
                onClick={() => setEventType('rehearsal')}
                className="flex-1 min-w-0"
              >
                Rehearsal
              </Button>
              <Button
                type="button"
                variant={eventType === 'gig' ? 'default' : 'secondary'}
                onClick={() => setEventType('gig')}
                className="flex-1 min-w-0"
              >
                Gig
              </Button>
            </div>

            {eventType === 'gig' && (
              <div className="space-y-2 w-full min-w-0">
                <Label htmlFor="gig-name">Gig Name *</Label>
                <Input
                  id="gig-name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter gig name"
                  className="w-full"
                />

                <div className="flex items-center justify-between rounded-lg border border-border p-3 w-full min-w-0">
                  <div className="space-y-1 flex-1 min-w-0 pr-3">
                    <div className="font-medium">Potential Gig</div>
                    <div className="text-sm text-muted-foreground">
                      Requires member confirmation before it&apos;s confirmed
                    </div>
                  </div>
                  <Switch checked={isPotentialGig} onCheckedChange={setIsPotentialGig} />
                </div>
              </div>
            )}

            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="event-date">Date *</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">
                {formatDateDisplay(date) || 'Select a date'}
              </div>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label>Start Time</Label>
              <div className="flex gap-2 w-full min-w-0 overflow-x-hidden">
                <Select value={startHour} onValueChange={setStartHour}>
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={startMinute} onValueChange={setStartMinute}>
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={startAmPm} onValueChange={(v) => setStartAmPm(v as 'AM' | 'PM')}>
                  <SelectTrigger className="w-20 min-w-0">
                    <SelectValue placeholder="AM/PM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                Ends at {endTimeString}
              </div>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label>Duration</Label>
              <div className="w-full min-w-0 overflow-x-hidden">
                <ToggleGroup
                  type="single"
                  value={duration}
                  onValueChange={(v) => v && setDuration(v)}
                  className="flex flex-wrap gap-2 w-full min-w-0"
                >
                  {durations.map((d) => (
                    <ToggleGroupItem
                      key={d.value}
                      value={d.value}
                      className="h-10 px-3 py-2 rounded-xl flex-1 sm:flex-none"
                    >
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location (optional)"
                className="w-full"
              />
            </div>            {eventType === 'gig' && setlists.length > 0 && (
              <div className="space-y-2 w-full min-w-0">
                <Label>Setlist (Optional)</Label>
                <Select value={selectedSetlist || undefined} onValueChange={(value) => setSelectedSetlist(value || '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No Setlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {setlists.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {eventType === 'rehearsal' && (
              <div className="space-y-4 rounded-lg border border-border p-4 w-full min-w-0">
                <div className="flex items-center gap-3">
                  <Switch id="recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
                  <Label htmlFor="recurring" className="cursor-pointer">
                    Make this recurring
                  </Label>
                </div>

                {isRecurring && (
                  <>
                    <div className="space-y-2 w-full min-w-0">
                      <div className="font-medium">Days of the Week</div>
                      <div className="flex gap-2 flex-wrap">
                        {daysOfWeek.map((d) => {
                          const active = selectedDays.includes(d.index);
                          return (
                            <Button
                              key={d.index}
                              type="button"
                              size="icon"
                              variant={active ? 'default' : 'secondary'}
                              className="rounded-full w-10 h-10"
                              onClick={() => toggleDay(d.index)}
                            >
                              {d.short}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 w-full min-w-0">
                      <div className="font-medium">Frequency</div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant={recurringFrequency === 'weekly' ? 'default' : 'secondary'}
                          onClick={() => setRecurringFrequency('weekly')}
                          className="flex-1 sm:flex-none"
                        >
                          Weekly
                        </Button>
                        <Button
                          type="button"
                          variant={recurringFrequency === 'biweekly' ? 'default' : 'secondary'}
                          onClick={() => setRecurringFrequency('biweekly')}
                          className="flex-1 sm:flex-none"
                        >
                          Biweekly
                        </Button>
                        <Button
                          type="button"
                          variant={recurringFrequency === 'monthly' ? 'default' : 'secondary'}
                          onClick={() => setRecurringFrequency('monthly')}
                          className="flex-1 sm:flex-none"
                        >
                          Monthly
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 w-full min-w-0">
                      <Label htmlFor="until">Until (optional)</Label>
                      <Input
                        id="until"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full"
                      />
                      <div className="text-sm text-muted-foreground">
                        {recurrenceSummary || 'Select days and frequency'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t border-border px-4 py-4 gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
          >
            {eventType === 'rehearsal' ? 'Add Rehearsal' : 'Add Gig'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}