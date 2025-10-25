'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useBands } from '@/contexts/BandsContext';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Setlist {
  id: string;
  name: string;
}

function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${dayName}, ${monthName} ${day}, ${year}`;
}

export default function CreateRehearsalPage() {
  const router = useRouter();
  const { currentBand } = useBands();
  const { showToast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState('7');
  const [startMinute, setStartMinute] = useState('00');
  const [startAmPm, setStartAmPm] = useState('PM');
  const [duration, setDuration] = useState('120');
  const [location, setLocation] = useState('');
  const [selectedSetlist, setSelectedSetlist] = useState('');
  const [setlists, setSetlists] = useState<Setlist[]>([]);

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = ['00', '15', '30', '45'];
  const durations = [
    { value: '30', label: '1/2 hr' },
    { value: '60', label: '1 hr' },
    { value: '90', label: '1hr 30min' },
    { value: '120', label: '2 hr' },
    { value: '150', label: '2hr 30min' },
    { value: '180', label: '3 hr' },
    { value: '210', label: '3hr 30min' },
    { value: '240', label: '4 hr' },
  ];

  useEffect(() => {
    if (currentBand?.id) {
      loadSetlists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBand?.id]);

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

  const calculateEndTime = () => {
    const hour24 = startAmPm === 'PM' && startHour !== '12' ? parseInt(startHour) + 12 :
      startAmPm === 'AM' && startHour === '12' ? 0 : parseInt(startHour);

    const startMinutes = hour24 * 60 + parseInt(startMinute);
    const endMinutes = startMinutes + parseInt(duration);
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;

    return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
  };

  const getStartTimeString = () => {
    const hour24 = startAmPm === 'PM' && startHour !== '12' ? parseInt(startHour) + 12 :
      startAmPm === 'AM' && startHour === '12' ? 0 : parseInt(startHour);
    return `${hour24.toString().padStart(2, '0')}:${startMinute}`;
  };

  const handleDateClick = () => {
    const input = document.getElementById('rehearsal-date-input') as HTMLInputElement;
    if (input && 'showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker();
    }
  };

  const handleSubmit = async () => {
    if (!currentBand?.id || !date) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);

    try {
      const startTime = getStartTimeString();
      const endTime = calculateEndTime();

      const rehearsalData = {
        band_id: currentBand.id,
        date,
        start_time: startTime,
        end_time: endTime,
        location: location || 'TBD',
        setlist_id: selectedSetlist || null,
        notes: null
      };

      const { error } = await supabase
        .from('rehearsals')
        .insert([rehearsalData]);

      if (error) throw error;

      showToast('Rehearsal created successfully!', 'success');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to create rehearsal:', error);
      showToast('Failed to create rehearsal. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = formatDateDisplay(date);
  const isValid = date && startHour && startMinute;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="flex items-center gap-4 p-4 border-b border-border/70">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold">Create Rehearsal</h1>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <Label htmlFor="rehearsal-date">Date *</Label>
          <div className="relative cursor-pointer mt-2" onClick={handleDateClick}>
            <Input
              id="rehearsal-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-transparent cursor-pointer bg-zinc-900 border-zinc-700 [color-scheme:dark]"
            />
            <div className="absolute inset-0 px-3 py-2 pointer-events-none text-foreground flex items-center">
              {formattedDate || 'Select date'}
            </div>
          </div>
        </div>

        <div>
          <Label>Start Time</Label>
          <div className="flex gap-2 mt-2">
            <Select value={startHour} onValueChange={setStartHour}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hours.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={startMinute} onValueChange={setStartMinute}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={startAmPm} onValueChange={setStartAmPm}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Duration</Label>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar mt-2">
            {durations.map((d) => (
              <Button
                key={d.value}
                type="button"
                variant={duration === d.value ? 'default' : 'secondary'}
                onClick={() => setDuration(d.value)}
                className="whitespace-nowrap flex-shrink-0"
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <div className="relative mt-2">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location (optional)"
              className="pl-10"
            />
          </div>
        </div>

        {/* Setlist Selection */}
        {setlists.length > 0 && (
          <div>
            <Label>Setlist (Optional)</Label>
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar mt-2">
              <Button
                type="button"
                variant={!selectedSetlist ? 'default' : 'secondary'}
                onClick={() => setSelectedSetlist('')}
                className="whitespace-nowrap flex-shrink-0"
              >
                No Setlist
              </Button>
              {setlists.map((setlist) => (
                <Button
                  key={setlist.id}
                  type="button"
                  variant={selectedSetlist === setlist.id ? 'default' : 'secondary'}
                  onClick={() => setSelectedSetlist(setlist.id)}
                  className="whitespace-nowrap flex-shrink-0"
                >
                  {setlist.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Creating...' : 'Create Rehearsal'}
          </Button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
