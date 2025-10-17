'use client';

import { useState, useEffect } from 'react';
import { useBands } from '@/hooks/useBands';
import { useToast } from '@/hooks/useToast';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type EventType = 'rehearsal' | 'gig';

interface SavedEvent {
  type: EventType;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
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

export default function AddEventDrawer({
  isOpen,
  onClose,
  prefilledDate = '',
  onSave: _onSave,
  defaultEventType = 'rehearsal',
}: AddEventDrawerProps) {
  const { currentBand } = useBands();
  const { showToast } = useToast();

  // Event type toggle
  const [eventType, setEventType] = useState<EventType>(defaultEventType);

  // Date and time
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    prefilledDate ? new Date(prefilledDate) : undefined
  );
  const [startHour, setStartHour] = useState<string>('7');
  const [startMinute, setStartMinute] = useState<string>('00');
  const [startPeriod, setStartPeriod] = useState<string>('PM');
  const [duration, setDuration] = useState<string>('2h');

  // Location
  const [location, setLocation] = useState<string>('');

  // Recurring options
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<string>('weekly');
  const [untilDate, setUntilDate] = useState<Date | undefined>(undefined);

  useEffect(() => setEventType(defaultEventType), [defaultEventType]);

  // Form validation - check if all required fields are filled
  const isFormValid = selectedDate && startHour && startMinute && startPeriod && duration && location.trim() !== '';

  // Calculate end time based on duration
  const calculateEndTime = () => {
    const hour24 = startPeriod === 'PM' && startHour !== '12' 
      ? parseInt(startHour) + 12 
      : startPeriod === 'AM' && startHour === '12'
        ? 0
        : parseInt(startHour);
    
    const totalMinutes = hour24 * 60 + parseInt(startMinute);
    
    const durationMap: { [key: string]: number } = {
      '30m': 30,
      '1h': 60,
      '1h 30m': 90,
      '2h': 120,
      '2h 30m': 150,
      '3h': 180,
    };
    
    const endMinutes = totalMinutes + (durationMap[duration] || 120);
    const endHour24 = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;
    
    const endHour12 = endHour24 === 0 ? 12 : endHour24 > 12 ? endHour24 - 12 : endHour24;
    const endPeriod = endHour24 >= 12 ? 'PM' : 'AM';
    
    return `${endHour12}:${endMin.toString().padStart(2, '0')} ${endPeriod}`;
  };

  const handleSave = async () => {
    if (!currentBand?.id) {
      showToast('No band selected', 'error');
      return;
    }

    if (!isFormValid) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    showToast('Save functionality coming soon', 'info');
    onClose();
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader className="px-6">
          <SheetTitle className="text-xl font-semibold">Add Event</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 py-6">
          <div className="space-y-6 px-6">
            {/* Event Type Toggle */}
            <div>
              <ToggleGroup
                type="single"
                value={eventType}
                onValueChange={(value) => value && setEventType(value as EventType)}
                className="justify-start gap-2"
              >
                <ToggleGroupItem value="rehearsal" className="flex-1">
                  Rehearsal
                </ToggleGroupItem>
                <ToggleGroupItem value="gig" className="flex-1">
                  Gig
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Date Picker */}
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal mt-2',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Start Time */}
            <div>
              <Label>Start Time</Label>
              <div className="flex gap-2 mt-2">
                <Select value={startHour} onValueChange={setStartHour}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                      <SelectItem key={hour} value={hour.toString()}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={startMinute} onValueChange={setStartMinute}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="00">:00</SelectItem>
                    <SelectItem value="15">:15</SelectItem>
                    <SelectItem value="30">:30</SelectItem>
                    <SelectItem value="45">:45</SelectItem>
                  </SelectContent>
                </Select>

                <ToggleGroup
                  type="single"
                  value={startPeriod}
                  onValueChange={(value) => value && setStartPeriod(value)}
                  className="w-24"
                >
                  <ToggleGroupItem value="AM" className="flex-1">
                    AM
                  </ToggleGroupItem>
                  <ToggleGroupItem value="PM" className="flex-1">
                    PM
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Duration */}
            <div>
              <Label>Duration</Label>
              <ScrollArea className="w-full">
                <div className="flex gap-2 mt-2 pb-2">
                  <ToggleGroup
                    type="single"
                    value={duration}
                    onValueChange={(value) => value && setDuration(value)}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="30m">30m</ToggleGroupItem>
                    <ToggleGroupItem value="1h">1h</ToggleGroupItem>
                    <ToggleGroupItem value="1h 30m">1h 30m</ToggleGroupItem>
                    <ToggleGroupItem value="2h">2h</ToggleGroupItem>
                    <ToggleGroupItem value="2h 30m">2h 30m</ToggleGroupItem>
                    <ToggleGroupItem value="3h">3h</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </ScrollArea>
              {duration && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ends at {calculateEndTime()}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location"
                className="mt-2"
              />
            </div>

            {/* Recurring Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring">Make this recurring</Label>
                <Switch
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>

              {isRecurring && (
                <div className="space-y-4 pl-4 border-l-2">
                  {/* Days of the Week */}
                  <div>
                    <Label className="text-sm">Days of the Week</Label>
                    <div className="flex gap-2 mt-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                        const dayValue = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][index];
                        return (
                          <Button
                            key={dayValue}
                            variant={selectedDays.includes(dayValue) ? 'default' : 'outline'}
                            size="icon"
                            className="rounded-full w-10 h-10"
                            onClick={() => toggleDay(dayValue)}
                          >
                            {day}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <Label className="text-sm">Frequency</Label>
                    <ToggleGroup
                      type="single"
                      value={frequency}
                      onValueChange={(value) => value && setFrequency(value)}
                      className="justify-start gap-2 mt-2"
                    >
                      <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
                      <ToggleGroupItem value="biweekly">Biweekly</ToggleGroupItem>
                      <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Until Date */}
                  <div>
                    <Label className="text-sm">Until (optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal mt-2',
                            !untilDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {untilDate ? format(untilDate, 'EEEE, MMMM d, yyyy') : 'Select end date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={untilDate}
                          onSelect={setUntilDate}
                          initialFocus
                          disabled={(date) => selectedDate ? date < selectedDate : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-col gap-2 sm:flex-col px-6 pb-6">
          <Button onClick={handleSave} className="w-full" disabled={!isFormValid}>
            Create {eventType === 'rehearsal' ? 'Rehearsal' : 'Gig'}
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
