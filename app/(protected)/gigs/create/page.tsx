'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import { useBands } from '@/contexts/BandsContext';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface Setlist {
  id: string;
  name: string;
}

interface BandMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
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

export default function CreateGigPage() {
  const router = useRouter();
  const { currentBand } = useBands();
  const { showToast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [gigName, setGigName] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState('7');
  const [startMinute, setStartMinute] = useState('00');
  const [startAmPm, setStartAmPm] = useState('PM');
  const [duration, setDuration] = useState('120');
  const [location, setLocation] = useState('');
  const [selectedSetlist, setSelectedSetlist] = useState('');
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [isPotentialGig, setIsPotentialGig] = useState(false);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);

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
      loadBandMembers();
    }
    // intentionally ignore exhaustive-deps here because loadSetlists/loadBandMembers are stable in this component
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

  const loadBandMembers = async () => {
    if (!currentBand?.id) return;

    try {
      const { data: membersData } = await supabase
        .from('band_members')
        .select(`
          id,
          user_id,
          profiles!inner(
            first_name,
            last_name,
            email
          )
        `)
        .eq('band_id', currentBand.id);

      if (membersData) {
        const members = membersData.map((member: unknown) => {
          const m = member as Record<string, unknown>;
          const profiles = m.profiles as Record<string, unknown> | undefined;
          return {
            id: String(m.id ?? ''),
            user_id: String(m.user_id ?? ''),
            first_name: typeof profiles?.first_name === 'string' ? profiles!.first_name as string : '',
            last_name: typeof profiles?.last_name === 'string' ? profiles!.last_name as string : '',
            email: typeof profiles?.email === 'string' ? profiles!.email as string : '',
          };
        });
        setBandMembers(members);
      }
    } catch (error) {
      console.error('Failed to load band members:', error);
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
    const input = document.getElementById('gig-date-input') as HTMLInputElement;
    if (input && 'showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker();
    }
  };

  const handleSubmit = async () => {
    if (!currentBand?.id || !gigName || !date) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);

    try {
      const startTime = getStartTimeString();
      const endTime = calculateEndTime();
      const selectedSetlistData = setlists.find(s => s.id === selectedSetlist);

      const gigData = {
        band_id: currentBand.id,
        name: gigName,
        date,
        start_time: startTime,
        end_time: endTime,
        location: location || 'TBD',
        is_potential: isPotentialGig,
        setlist_id: selectedSetlist || null,
        setlist_name: selectedSetlistData?.name || null,
        notes: null
      };

      const { error } = await supabase
        .from('gigs')
        .insert([gigData]);

      if (error) throw error;

      const gigType = isPotentialGig ? 'Potential gig' : 'Gig';
      showToast(`${gigType} created successfully!`, 'success');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to create gig:', error);
      showToast('Failed to create gig. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = formatDateDisplay(date);
  const isValid = gigName && date && startHour && startMinute;

  return (
    <div className="bg-background text-foreground">
      <div className="flex items-center gap-4 p-4 border-b border-border/70">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold">Create Gig</h1>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <Label htmlFor="gig-name">Gig Name *</Label>
          <Input
            id="gig-name"
            type="text"
            value={gigName}
            onChange={(e) => setGigName(e.target.value)}
            placeholder="Enter gig name"
            className="mt-2"
          />
        </div>

        {/* Potential Gig Toggle */}
        <div className="bg-muted/40 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Potential Gig</h3>
              <p className="text-sm text-muted-foreground">
                Requires confirmation from band members before becoming a confirmed gig
              </p>
            </div>
            <Switch
              checked={isPotentialGig}
              onCheckedChange={setIsPotentialGig}
            />
          </div>
        </div>

        {/* Band Members - Show when potential gig is enabled */}
        {isPotentialGig && bandMembers.length > 0 && (
          <div>
            <Label>Band Members</Label>
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar mt-2">
              {bandMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-full flex-shrink-0"
                >
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{member.first_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="gig-date">Date *</Label>
          <div className="relative cursor-pointer mt-2" onClick={handleDateClick}>
            <Input
              id="gig-date-input"
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
            {loading ? 'Creating...' : 'Create Gig'}
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
