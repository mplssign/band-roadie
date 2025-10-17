'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useBands } from '@/contexts/BandsContext';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/lib/supabase/client';

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

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = ['00', '15', '30', '45'];
  const durations = [
    { value: '60', label: '1 hr' },
    { value: '90', label: '1hr 30min' },
    { value: '120', label: '2 hr' },
    { value: '150', label: '2hr 30min' },
    { value: '180', label: '3 hr' },
    { value: '210', label: '3hr 30min' },
    { value: '240', label: '4 hr' },
  ];

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
      };

      const { error } = await supabase
        .from('rehearsals')
        .insert([rehearsalData]);

      if (error) throw error;

      showToast('Rehearsal scheduled successfully!', 'success');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to create rehearsal:', error);
      showToast('Failed to schedule rehearsal. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = formatDateDisplay(date);
  const isValid = date && startHour && startMinute;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="flex items-center gap-4 p-4 border-b border-border/70">
        <button
          onClick={() => router.back()}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Schedule Rehearsal</h1>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Date *</label>
          <div className="relative cursor-pointer" onClick={handleDateClick}>
            <input
              id="rehearsal-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-muted/40 border border-border/60 rounded-lg px-4 py-3 text-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            />
            <div className="absolute inset-0 px-4 py-3 pointer-events-none text-foreground">
              {formattedDate || 'Select date'}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Start Time</label>
          <div className="flex gap-2">
            <select
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {hours.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <select
              value={startMinute}
              onChange={(e) => setStartMinute(e.target.value)}
              className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {minutes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={startAmPm}
              onChange={(e) => setStartAmPm(e.target.value)}
              className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-3 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-muted/40 border border-border/60 rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {durations.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter rehearsal location"
              className="w-full bg-muted/40 border border-border/60 rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border/70 bg-background">
        <button
          onClick={handleSubmit}
          disabled={loading || !isValid}
          className={`w-full py-4 px-6 rounded-lg font-semibold transition-all ${
            isValid && !loading
              ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg'
              : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
          }`}
        >
          {loading ? 'Scheduling...' : 'Schedule Rehearsal'}
        </button>
      </div>
    </div>
  );
}