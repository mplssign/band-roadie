'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface Rehearsal {
  date: string;
  time: string;
  location: string;
}

interface EditRehearsalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rehearsal: Rehearsal;
}

const WEEKDAYS = [
  { short: 'M', full: 'Mon', value: 1 },
  { short: 'T', full: 'Tue', value: 2 },
  { short: 'W', full: 'Wed', value: 3 },
  { short: 'T', full: 'Thu', value: 4 },
  { short: 'F', full: 'Fri', value: 5 },
  { short: 'S', full: 'Sat', value: 6 },
  { short: 'S', full: 'Sun', value: 0 }
];

const FREQUENCIES = ['Weekly', 'Biweekly', 'Monthly'];

const MOCK_SETLISTS = [
  'Summer Festival Set',
  'Wedding Set',
  'Rock Classics',
  'Jazz Standards',
  'Holiday Special',
  'Acoustic Set'
];

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

function formatEndDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${monthName} ${day}, ${year}`;
}

function getRecurringSummary(selectedDays: number[], frequency: string): string {
  if (selectedDays.length === 0) return '';
  
  const dayNames = selectedDays.map(day => {
    const weekday = WEEKDAYS.find(w => w.value === day);
    return weekday?.full;
  }).filter(Boolean);
  
  if (dayNames.length === 0) return '';
  
  const daysList = dayNames.length === 1 
    ? dayNames[0]
    : dayNames.length === 2
    ? `${dayNames[0]} and ${dayNames[1]}`
    : `${dayNames.slice(0, -1).join(', ')}, and ${dayNames[dayNames.length - 1]}`;
  
  const frequencyText = frequency === 'Biweekly' ? 'every other week on' : frequency === 'Monthly' ? 'monthly on' : 'every';
  
  return `Occurs ${frequencyText} ${daysList} until`;
}

export default function EditRehearsalDrawer({ isOpen, onClose, rehearsal }: EditRehearsalDrawerProps) {
  const { showToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [frequency, setFrequency] = useState('Weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [selectedSetlist, setSelectedSetlist] = useState<string | null>(null);

  const [originalValues, setOriginalValues] = useState({
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    isRecurring: false,
    selectedDays: [] as number[],
    frequency: 'Weekly',
    recurringEndDate: '',
    selectedSetlist: null as string | null
  });

  useEffect(() => {
    if (isOpen) {
      const parsedDate = '2025-01-14';
      
      setDate(parsedDate);
      setStartTime('19:00');
      setEndTime('21:00');
      setLocation(rehearsal.location);
      setIsRecurring(false);
      setSelectedDays([]);
      setFrequency('Weekly');
      setRecurringEndDate('');
      setSelectedSetlist('Summer Festival Set');

      setOriginalValues({
        date: parsedDate,
        startTime: '19:00',
        endTime: '21:00',
        location: rehearsal.location,
        isRecurring: false,
        selectedDays: [],
        frequency: 'Weekly',
        recurringEndDate: '',
        selectedSetlist: 'Summer Festival Set'
      });

      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, rehearsal]);

  useEffect(() => {
    const hasChanged = 
      date !== originalValues.date ||
      startTime !== originalValues.startTime ||
      endTime !== originalValues.endTime ||
      location !== originalValues.location ||
      isRecurring !== originalValues.isRecurring ||
      JSON.stringify(selectedDays) !== JSON.stringify(originalValues.selectedDays) ||
      frequency !== originalValues.frequency ||
      recurringEndDate !== originalValues.recurringEndDate ||
      selectedSetlist !== originalValues.selectedSetlist;
    
    setHasChanges(hasChanged);
  }, [date, startTime, endTime, location, isRecurring, selectedDays, frequency, recurringEndDate, selectedSetlist, originalValues]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
      setIsExiting(false);
    }, 300);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    showToast('Rehearsal updated successfully!', 'success');
    handleClose();
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this rehearsal?')) {
      showToast('Rehearsal deleted', 'success');
      handleClose();
    }
  };

  if (!isOpen && !isExiting) return null;

  const recurringSummary = isRecurring ? getRecurringSummary(selectedDays, frequency) : '';
  const formattedDate = formatDateDisplay(date);
  const formattedEndDate = recurringEndDate ? formatEndDate(recurringEndDate) : '';

  return (
    <>
      {/* Backdrop */}
      <div
      className={`fixed inset-0 bg-background/80 transition-opacity duration-300 ${
          isExiting ? 'opacity-0 z-[100]' : 'opacity-50 z-[100]'
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
      className={`fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[90vh] flex flex-col transition-transform duration-300 ease-out z-[101] ${
          isExiting ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Edit Rehearsal</h2>
          <button
            onClick={handleClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Date Display */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date
            </label>
            <div className="relative cursor-pointer" onClick={() => (document.getElementById('date-input') as HTMLInputElement | null)?.showPicker?.()}>
              <input
                id="date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              />
              <div className="absolute inset-0 px-4 py-3 pointer-events-none text-white">
                {formattedDate || 'Select date'}
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Time
              </label>
              <div className="relative cursor-pointer" onClick={() => (document.getElementById('start-time-input') as HTMLInputElement | null)?.showPicker?.()}>
                <input
                  id="start-time-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Time
              </label>
                <div className="relative cursor-pointer" onClick={() => (document.getElementById('end-time-input') as HTMLInputElement | null)?.showPicker?.()}>
                <input
                  id="end-time-input"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Setlist Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Setlist (Optional)
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {MOCK_SETLISTS.map((setlist) => (
                <button
                  key={setlist}
                  onClick={() => setSelectedSetlist(selectedSetlist === setlist ? null : setlist)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedSetlist === setlist
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                  }`}
                >
                  {setlist}
                </button>
              ))}
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="recurring" className="text-sm font-medium text-gray-300">
              Make this recurring
            </label>
          </div>

          {/* Recurring Options */}
          {isRecurring && (
            <div className="space-y-4 p-4 bg-zinc-800/50 rounded-lg">
              {/* Days of Week */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Days of the Week
                </label>
                <div className="flex gap-2 justify-between">
                  {WEEKDAYS.map((day, index) => (
                    <button
                      key={`${day.full}-${index}`}
                      onClick={() => toggleDay(day.value)}
                      className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                        selectedDays.includes(day.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Frequency
                </label>
                <div className="flex gap-2">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        frequency === freq
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary and End Date */}
              {recurringSummary && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schedule
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-blue-300 whitespace-nowrap">{recurringSummary}</span>
                    <div className="relative cursor-pointer flex-1 min-w-[200px]" onClick={() => (document.getElementById('end-date-input') as HTMLInputElement | null)?.showPicker?.()}>
                      <input
                        id="end-date-input"
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="absolute inset-0 px-4 py-2 pointer-events-none text-white">
                        {formattedEndDate || 'Indefinitely'}
                      </div>
                    </div>
                  </div>
                  {!recurringEndDate && (
                    <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite recurrence</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`w-full py-4 rounded-lg text-lg font-medium transition-colors ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              Save Changes
            </button>

            <button
              onClick={handleClose}
              className="w-full py-4 bg-zinc-800 text-gray-300 rounded-lg hover:bg-zinc-700 transition-colors font-medium"
            >
              Cancel
            </button>

            {/* Delete Link */}
            <div className="text-center pt-2">
              <button
                onClick={handleDelete}
                className="text-red-500 hover:text-red-400 transition-colors text-sm font-medium"
              >
                Delete Rehearsal
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
