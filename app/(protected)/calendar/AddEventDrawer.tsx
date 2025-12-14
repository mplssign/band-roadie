'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { useToast } from '@/hooks/useToast';
import { useBandMembers } from '@/hooks/useBandMembers';
import type { GigMemberResponse } from '@/lib/types';
import { buildMemberLabelMap, summarizeGigResponses } from '@/lib/utils/potential-gigs';

import {
  SheetWithClose as Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/SheetWithClose';
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
import { capitalizeWords } from '@/lib/utils/formatters';

type DrawerMode = 'add' | 'edit';

type EventType = 'rehearsal' | 'gig';

export type PotentialGigMemberResponse = GigMemberResponse;

export interface EventPayload {
  id: string;
  type: EventType;
  title: string;
  date: Date;                  // real Date object
  startHour: number;           // 1..12
  startMinute: number;         // 0, 15, 30, 45
  startAmPm: 'AM' | 'PM';
  durationMinutes: number;     // e.g., 60, 90, 120
  location?: string;
  setlistId?: string | null;
  setlistName?: string | null;
  isPotential?: boolean;       // for gigs
  optionalMemberIds?: string[];
  memberResponses?: GigMemberResponse[];
  recurring?: {
    enabled: boolean;
    rule?: string;
  };
}

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
  onEventUpdated: () => void;
  defaultEventType?: EventType;
  mode?: DrawerMode;
  event?: EventPayload;
}

interface Setlist {
  id: string;
  name: string;
}

// Helper function for time formatting
function to12h(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  if (hour24 === 0) return { hour12: 12, period: 'AM' };
  if (hour24 < 12) return { hour12: hour24, period: 'AM' };
  if (hour24 === 12) return { hour12: 12, period: 'PM' };
  return { hour12: hour24 - 12, period: 'PM' };
}

// Helper function to format date display like Create Gig page
function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${dayName}, ${monthName} ${day}, ${year}`;
}

// Days of week constant (moved outside component to avoid recreating on every render)
const daysOfWeek = [
  { short: 'S', full: 'Sun', index: 0 },
  { short: 'M', full: 'Mon', index: 1 },
  { short: 'T', full: 'Tue', index: 2 },
  { short: 'W', full: 'Wed', index: 3 },
  { short: 'T', full: 'Thu', index: 4 },
  { short: 'F', full: 'Fri', index: 5 },
  { short: 'S', full: 'Sat', index: 6 },
];

export default function AddEventDrawer({
  isOpen,
  onClose,
  prefilledDate = '',
  onEventUpdated,
  defaultEventType = 'rehearsal',
  mode = 'add',
  event,
}: AddEventDrawerProps) {
  const { currentBand } = useBands();
  const { showToast } = useToast();

  const [eventType, setEventType] = useState<EventType>(defaultEventType);
  const [eventId, setEventId] = useState<string>('');
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
  const [optionalMemberIds, setOptionalMemberIds] = useState<string[]>([]);
  const [memberResponses, setMemberResponses] = useState<GigMemberResponse[]>([]);

  const {
    members: bandMembers,
    loading: membersLoading,
    error: membersError,
  } = useBandMembers(currentBand?.id, { enabled: isOpen && eventType === 'gig' });

  // Recurrence (rehearsals)
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [endDate, setEndDate] = useState('');

  // Initialize from event payload when in edit mode
  useEffect(() => {
    if (!isOpen) return; // Only initialize when drawer is open

    if (mode === 'edit' && event) {
      setEventId(event.id);
      setEventType(event.type);
      setTitle(event.title || '');

      // Convert Date to YYYY-MM-DD string
      const dateObj = event.date instanceof Date ? event.date : new Date(event.date);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
      }

      setStartHour(String(event.startHour));
      setStartMinute(String(event.startMinute).padStart(2, '0'));
      setStartAmPm(event.startAmPm);
      setDuration(String(event.durationMinutes));
      setLocation(event.location || '');
      setSelectedSetlist(event.setlistId || '');
      setIsPotentialGig(event.isPotential || false);
      setOptionalMemberIds(event.optionalMemberIds ? [...event.optionalMemberIds] : []);
      setMemberResponses(event.memberResponses ? [...event.memberResponses] : []);

      if (event.recurring?.enabled) {
        setIsRecurring(true);
        // Parse recurring rule if needed
      }
    } else if (mode === 'add') {
      // Reset for add mode
      setEventType(defaultEventType);
      setEventId('');
      setTitle('');
      setDate(prefilledDate || '');
      setStartHour('7');
      setStartMinute('00');
      setStartAmPm('PM');
      setDuration('120');
      setLocation('');
      setSelectedSetlist('');
      setIsPotentialGig(false);
      setOptionalMemberIds([]);
      setMemberResponses([]);
      setIsRecurring(false);
      setSelectedDays(prefilledDate ? [new Date(`${prefilledDate}T00:00:00`).getDay()] : []);
      setEndDate('');
    }
  }, [mode, event, defaultEventType, isOpen, prefilledDate]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isPotentialGig) {
      setOptionalMemberIds([]);
    }
  }, [isPotentialGig, isOpen]);

  useEffect(() => {
    if (eventType !== 'gig') {
      setIsPotentialGig(false);
      setOptionalMemberIds([]);
    }
  }, [eventType]);

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

    try {
      const response = await fetch(`/api/setlists?band_id=${currentBand.id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load setlists');
      }

      const { setlists } = await response.json();
      setSetlists(setlists ?? []);
    } catch (error) {
      // Non-blocking: just surface the error to the user
      showToast('Failed to load setlists', 'error');
    }
  }, [currentBand?.id, showToast]);

  useEffect(() => {
    if (!isOpen || mode !== 'add') return;

    if (prefilledDate) {
      setDate(prefilledDate);
      const dow = new Date(`${prefilledDate}T00:00:00`).getDay();
      setSelectedDays([dow]);
    } else {
      setDate('');
      setSelectedDays([]);
    }
  }, [isOpen, mode, prefilledDate]);

  useEffect(() => {
    if (!isOpen) return;
    void loadSetlists();
  }, [isOpen, loadSetlists]);

  const hour24 = useMemo(() => {
    const h = parseInt(startHour, 10);
    if (startAmPm === 'PM' && startHour !== '12') return h + 12;
    if (startAmPm === 'AM' && startHour === '12') return 0;
    return h;
  }, [startHour, startAmPm]);

  const startTimeString = useMemo(() => {
    return `${hour24.toString().padStart(2, '0')}:${startMinute}`;
  }, [hour24, startMinute]);

  // For API - returns 24-hour format (HH:MM)
  const endTimeString = useMemo(() => {
    // Validate inputs
    const hourNum = parseInt(startHour, 10);
    const minuteNum = parseInt(startMinute, 10);
    const durationNum = parseInt(duration, 10);
    
    // Return fallback for invalid inputs (API needs a valid time)
    if (isNaN(hourNum) || isNaN(minuteNum) || isNaN(durationNum) || 
        hourNum < 1 || hourNum > 12 || 
        minuteNum < 0 || minuteNum > 59 || 
        durationNum <= 0) {
      // Default to 1 hour after start time if duration is invalid
      const fallbackDuration = 60;
      const startMinutesFromMidnight = hour24 * 60 + (isNaN(minuteNum) ? 0 : minuteNum);
      const endMinutesFromMidnight = startMinutesFromMidnight + fallbackDuration;
      const endHour24 = Math.floor(endMinutesFromMidnight / 60) % 24;
      const endMinute = endMinutesFromMidnight % 60;
      return `${endHour24.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    }

    // Calculate total start minutes from midnight
    const startMinutesFromMidnight = hour24 * 60 + minuteNum;
    const endMinutesFromMidnight = startMinutesFromMidnight + durationNum;
    
    // Handle cross-midnight (end time next day)
    const endHour24 = Math.floor(endMinutesFromMidnight / 60) % 24;
    const endMinute = endMinutesFromMidnight % 60;

    // Return 24-hour format for API
    return `${endHour24.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  }, [startHour, startMinute, duration, hour24]);

  // For display - returns 12-hour format with proper placeholder
  const endTimeDisplay = useMemo(() => {
    // Validate inputs
    const hourNum = parseInt(startHour, 10);
    const minuteNum = parseInt(startMinute, 10);
    const durationNum = parseInt(duration, 10);
    
    // Return placeholder for invalid inputs
    if (isNaN(hourNum) || isNaN(minuteNum) || isNaN(durationNum) || 
        hourNum < 1 || hourNum > 12 || 
        minuteNum < 0 || minuteNum > 59 || 
        durationNum <= 0) {
      return '—';
    }

    // Calculate total start minutes from midnight
    const startMinutesFromMidnight = hour24 * 60 + minuteNum;
    const endMinutesFromMidnight = startMinutesFromMidnight + durationNum;
    
    // Handle cross-midnight (end time next day)
    const endHour24 = Math.floor(endMinutesFromMidnight / 60) % 24;
    const endMinute = endMinutesFromMidnight % 60;

    // Convert to 12-hour format
    const { hour12, period } = to12h(endHour24);
    return `${hour12}:${endMinute.toString().padStart(2, '0')} ${period}`;
  }, [startHour, startMinute, duration, hour24]);

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => (prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index]));
  };

  const recurrenceSummary = useMemo(() => {
    if (!isRecurring || selectedDays.length === 0) return '';
    const list = selectedDays
      .slice()
      .sort()
      .map((d) => daysOfWeek.find((x) => x.index === d)?.full ?? '')
      .filter(Boolean)
      .join(', ');
    const until = endDate ? ` until ${new Date(endDate + 'T00:00:00').toLocaleDateString()}` : '';
    const freq =
      recurringFrequency === 'weekly'
        ? 'Weekly'
        : recurringFrequency === 'biweekly'
          ? 'Every 2 weeks'
          : 'Monthly';
    return `${freq} on ${list}${until}`;
  }, [isRecurring, selectedDays, endDate, recurringFrequency]);

  const isValid = useMemo(() => {
    const valid = !(
      !date || 
      (eventType === 'gig' && title.trim().length === 0)
    );
    // eslint-disable-next-line no-console
    console.log('[AddEventDrawer] Validation check:', { date, eventType, title: title.trim(), valid });
    return valid;
  }, [date, eventType, title]);

  const handleToggleOptionalMember = useCallback((memberId: string) => {
    setOptionalMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  }, []);

  // Helper function to build member labels with disambiguation
  const buildMemberLabels = useMemo(() => {
    const memberInfos = bandMembers.map((member) => ({
      id: member.id,
      first_name: member.first_name ?? null,
      last_name: member.last_name ?? null,
    }));
    
    return buildMemberLabelMap(memberInfos, memberResponses, optionalMemberIds);
  }, [bandMembers, memberResponses, optionalMemberIds]);

  // Helper function to get response summary for edit mode
  const getResponseSummary = useMemo(() => {
    if (mode !== 'edit') return null;
    
    const memberInfos = bandMembers.map((member) => ({
      id: member.id,
      first_name: member.first_name ?? null,
      last_name: member.last_name ?? null,
    }));
    
    return summarizeGigResponses(memberInfos, optionalMemberIds, memberResponses);
  }, [mode, bandMembers, optionalMemberIds, memberResponses]);

  const handleDelete = async () => {
    if (mode !== 'edit' || !eventId) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete this ${eventType === 'rehearsal' ? 'rehearsal' : 'gig'}?`
    );

    if (!confirmDelete) return;

    try {
      const endpoint = eventType === 'rehearsal' ? '/api/rehearsals' : '/api/gigs';
      const response = await fetch(`${endpoint}?id=${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }

      showToast(`${eventType === 'rehearsal' ? 'Rehearsal' : 'Gig'} deleted`, 'success');
      onEventUpdated();
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete event:', err);
      showToast('Failed to delete event. Please try again.', 'error');
    }
  };

  const handleSave = async () => {
    // eslint-disable-next-line no-console
    console.log('[AddEventDrawer] handleSave called', { eventType, mode, title, date, currentBand: currentBand?.id });
    
    if (!currentBand?.id) {
      showToast('No band selected', 'error');
      return;
    }

    if (!date) {
      showToast('Please select a date', 'error');
      return;
    }

    if (eventType === 'gig' && !title.trim()) {
      showToast('Please enter a gig name', 'error');
      return;
    }

    // date is already in YYYY-MM-DD format
    const dateString = date;

    try {
      if (mode === 'edit') {
        // UPDATE existing event
        if (!eventId) {
          showToast('No event ID provided for update', 'error');
          return;
        }

        if (eventType === 'rehearsal') {
          const rehearsal = {
            id: eventId,
            date: dateString,
            start_time: startTimeString,
            end_time: endTimeString,
            location: location || 'TBD',
            setlist_id: selectedSetlist || null,
          };
          const response = await fetch('/api/rehearsals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rehearsal),
            credentials: 'include',
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update rehearsal');
          }
          showToast('Rehearsal updated', 'success');
        } else {
          const chosen = setlists.find((s) => s.id === selectedSetlist);
          const gig = {
            id: eventId,
            name: title,
            date: dateString,
            start_time: startTimeString,
            end_time: endTimeString,
            location: location || 'TBD',
            is_potential: isPotentialGig,
            setlist_id: selectedSetlist || null,
            setlist_name: chosen?.name ?? null,
            // optional_member_ids: isPotentialGig ? optionalMemberIds : [], // Temporarily removed - column doesn't exist in current schema
            member_responses: memberResponses,
          };
          const response = await fetch('/api/gigs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gig),
            credentials: 'include',
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update gig');
          }
          showToast('Gig updated', 'success');
        }
      } else {
        // INSERT new event
        if (eventType === 'rehearsal') {
          const rehearsal = {
            band_id: currentBand.id,
            date: dateString,
            start_time: startTimeString,
            end_time: endTimeString,
            location: location || 'TBD',
            notes: null as string | null,
            setlist_id: selectedSetlist || null,
          };
          const response = await fetch('/api/rehearsals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rehearsal),
            credentials: 'include',
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create rehearsal');
          }
          showToast('Rehearsal scheduled', 'success');
        } else {
          const chosen = setlists.find((s) => s.id === selectedSetlist);
          const gig = {
            band_id: currentBand.id,
            name: title,
            date: dateString,
            start_time: startTimeString,
            end_time: endTimeString,
            location: location || 'TBD',
            is_potential: isPotentialGig,
            setlist_id: selectedSetlist || null,
            setlist_name: chosen?.name ?? null,
            notes: null as string | null,
            // optional_member_ids: isPotentialGig ? optionalMemberIds : [], // Temporarily removed - column doesn't exist in current schema
            member_responses: memberResponses,
          };
          // eslint-disable-next-line no-console
          console.log('[AddEventDrawer] Creating gig with payload:', gig);
          
          const response = await fetch('/api/gigs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gig),
            credentials: 'include',
          });
          
          // eslint-disable-next-line no-console
          console.log('[AddEventDrawer] Gig API response:', response.status, response.statusText);
          
          if (!response.ok) {
            const error = await response.json();
            // eslint-disable-next-line no-console
            console.error('[AddEventDrawer] Gig creation failed:', error);
            throw new Error(error.error || 'Failed to create gig');
          }
          
          const result = await response.json();
          // eslint-disable-next-line no-console
          console.log('[AddEventDrawer] Gig created successfully:', result);
          
          showToast(isPotentialGig ? 'Potential gig added' : 'Gig added', 'success');
        }
      }

      // Trigger refresh of events
      onEventUpdated();
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AddEventDrawer] Failed to save event:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      // eslint-disable-next-line no-console
      console.error('[AddEventDrawer] Error details:', errorMessage);
      showToast(`Failed to save event: ${errorMessage}`, 'error');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent side="bottom" className="h-[90vh] w-full p-0 br-drawer-surface text-foreground border-border overflow-x-hidden">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>{mode === 'edit' ? 'Edit Event' : 'Add Event'}</SheetTitle>
          <SheetDescription />
        </SheetHeader>

        <ScrollArea className="h-[calc(90vh-60px-72px)] overflow-x-hidden">
          <div className="px-4 py-4 space-y-6 w-full max-w-full overflow-x-hidden">
            {/* Event Type Toggle */}
            <div className="flex gap-2 w-full min-w-0">
              <Button
                type="button"
                variant={eventType === 'rehearsal' ? 'default' : 'secondary'}
                onClick={() => mode === 'add' && setEventType('rehearsal')}
                disabled={mode === 'edit' && eventType !== 'rehearsal'}
                className="flex-1 min-w-0"
              >
                Rehearsal
              </Button>
              <Button
                type="button"
                variant={eventType === 'gig' ? 'default' : 'secondary'}
                onClick={() => mode === 'add' && setEventType('gig')}
                disabled={mode === 'edit' && eventType !== 'gig'}
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
                  onChange={(e) => {
                    const capitalized = capitalizeWords(e.target.value);
                    setTitle(capitalized);
                  }}
                  placeholder="Enter gig name"
                  className="w-full"
                />

                <div className={`space-y-4 rounded-lg border p-3 w-full min-w-0 transition-colors duration-200 ${
                  isPotentialGig 
                    ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/20' 
                    : 'border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1 min-w-0 pr-3">
                      <div className="font-medium">Potential Gig</div>
                      <div className="text-sm text-muted-foreground">
                        Requires member confirmation before it&apos;s confirmed
                      </div>
                    </div>
                    <Switch 
                      checked={isPotentialGig} 
                      onCheckedChange={(checked) => {
                        setIsPotentialGig(checked);
                        if (!checked) {
                          // Clear optional members when turning off potential gig
                          setOptionalMemberIds([]);
                        }
                      }} 
                    />
                  </div>

                  {isPotentialGig && (
                    <div className="space-y-4 pt-3 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        Unselect members who are optional for this gig.
                      </div>

                      {membersLoading ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div
                                key={i}
                                className="h-8 bg-muted/40 rounded-lg animate-pulse"
                              />
                            ))}
                          </div>
                        </div>
                      ) : membersError ? (
                        <div className="text-sm text-destructive">
                          Unable to load band members. Please try again.
                        </div>
                      ) : bandMembers.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No members found
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Member selection grid */}
                          <div className="grid grid-cols-4 gap-2">
                            {bandMembers.map((member) => {
                              const isRequired = !optionalMemberIds.includes(member.id);
                              const memberFirstName = member.first_name || 'Unknown';

                              return (
                                <Button
                                  key={member.id}
                                  type="button"
                                  size="sm"
                                  variant={isRequired ? 'secondary' : 'outline'}
                                  onClick={() => handleToggleOptionalMember(member.id)}
                                  className={`
                                    h-8 px-3 text-xs truncate transition-all
                                    ${isRequired
                                      ? 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600'
                                      : 'border-dashed border-muted-foreground hover:border-muted-foreground/80'
                                    }
                                  `}
                                  title={memberFirstName}
                                  aria-pressed={isRequired}
                                >
                                  {memberFirstName}
                                </Button>
                              );
                            })}
                          </div>

                          {/* Response summary for edit mode */}
                          {mode === 'edit' && getResponseSummary && (
                            <div className="space-y-2">
                              {/* YES responses */}
                              <div className="text-sm">
                                <span className="font-medium text-green-600">YES:</span>
                                <span className="ml-2 text-foreground">
                                  {getResponseSummary.yes.length > 0 
                                    ? getResponseSummary.yes.map(member => member.label).join(', ')
                                    : 'None'
                                  }
                                </span>
                              </div>

                              {/* NO responses */}
                              <div className="text-sm">
                                <span className="font-medium text-red-600">NO:</span>
                                <span className="ml-2 text-foreground">
                                  {getResponseSummary.no.length > 0 
                                    ? getResponseSummary.no.map(member => member.label).join(', ')
                                    : 'None'
                                  }
                                </span>
                              </div>

                              {/* NOT RESPONDED */}
                              <div className="text-sm">
                                <span className="font-medium text-yellow-600">NOT RESPONDED:</span>
                                <span className="ml-2 text-foreground">
                                  {getResponseSummary.notResponded.length > 0 
                                    ? getResponseSummary.notResponded.map(member => member.label).join(', ')
                                    : 'None'
                                  }
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="event-date">Date *</Label>
              <div className="relative cursor-pointer" onClick={() => {
                const input = document.getElementById('event-date-input') as HTMLInputElement;
                if (input) input.showPicker?.();
              }}>
                <input
                  id="event-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer [color-scheme:dark]"
                />
                <div className="absolute inset-0 px-4 py-3 pointer-events-none text-foreground">
                  {formatDateDisplay(date) || 'Select date'}
                </div>
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

                <ToggleGroup
                  type="single"
                  value={startAmPm}
                  onValueChange={(v) => v && setStartAmPm(v as 'AM' | 'PM')}
                  className="shrink-0"
                >
                  <ToggleGroupItem value="AM" className="w-14">
                    AM
                  </ToggleGroupItem>
                  <ToggleGroupItem value="PM" className="w-14">
                    PM
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="text-sm text-muted-foreground">
                {endTimeDisplay === '—' ? 'Ends at —' : `Ends at ${endTimeDisplay}`}
              </div>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label>Duration</Label>
              <div className="w-full min-w-0 overflow-x-hidden">
                <ToggleGroup
                  type="single"
                  value={duration}
                  onValueChange={(v) => v && setDuration(v)}
                  className="grid grid-cols-4 gap-2 w-full"
                >
                  {durations.map((d) => (
                    <ToggleGroupItem
                      key={d.value}
                      value={d.value}
                      className="h-10 px-2 py-2 rounded-xl"
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
            </div>

            {/* Setlist Selection - Available for both rehearsals and gigs */}
            {setlists.length > 0 && (
              <div className="space-y-2 w-full min-w-0">
                <Label>Setlist (Optional)</Label>
                <div className="flex flex-wrap gap-2 w-full min-w-0">
                  <Button
                    type="button"
                    size="sm"
                    variant={!selectedSetlist ? 'secondary' : 'outline'}
                    onClick={() => setSelectedSetlist('')}
                    className={`shrink-0 ${!selectedSetlist ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}`}
                  >
                    None
                  </Button>
                  {setlists.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      size="sm"
                      variant={selectedSetlist === s.id ? 'secondary' : 'outline'}
                      onClick={() => setSelectedSetlist(s.id)}
                      className={`shrink-0 max-w-[200px] ${selectedSetlist === s.id ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}`}
                      title={s.name}
                    >
                      <span className="truncate">{s.name}</span>
                    </Button>
                  ))}
                </div>
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
                      <div className="grid grid-cols-7 gap-1">
                        {daysOfWeek.map((d) => {
                          const active = selectedDays.includes(d.index);
                          return (
                            <Button
                              key={d.index}
                              type="button"
                              size="icon"
                              variant={active ? 'default' : 'secondary'}
                              className="rounded-full h-10 w-full aspect-square text-xs"
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
                      <div className="relative cursor-pointer" onClick={() => {
                        const input = document.getElementById('recurring-end-input') as HTMLInputElement;
                        if (input) input.showPicker?.();
                      }}>
                        <input
                          id="recurring-end-input"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer [color-scheme:dark]"
                        />
                        <div className="absolute inset-0 px-4 py-3 pointer-events-none text-foreground">
                          {formatDateDisplay(endDate) || 'No end date'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 w-full min-w-0">
                      <Label>Recurrence Summary</Label>
                      <div className="text-sm text-muted-foreground rounded-md border border-border bg-muted/20 p-3">
                        {recurrenceSummary || 'Select days and frequency above'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t border-border px-4 py-4">
          <div className="w-full space-y-3">
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                onClick={handleSave}
                disabled={!isValid}
                className="flex-1"
              >
                {mode === 'edit'
                  ? `Update ${eventType === 'rehearsal' ? 'Rehearsal' : 'Gig'}`
                  : `Add ${eventType === 'rehearsal' ? 'Rehearsal' : 'Gig'}`
                }
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            </div>
            {mode === 'edit' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm text-destructive hover:underline"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}