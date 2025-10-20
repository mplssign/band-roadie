'use client';

import { useState } from 'react';
import { X, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface AddBlockoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blockout: { startDate: string; endDate: string; reason: string }) => void;
}

// Format date as "MMMM d, yyyy"
function formatLongDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function AddBlockoutDrawer({ isOpen, onClose, onSave }: AddBlockoutDrawerProps) {
  const { showToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
      setIsExiting(false);
      setReason('');
      setStartDate('');
      setEndDate('');
    }, 300);
  };

  const handleSave = () => {
    if (!startDate) return;
    
    onSave({ 
      startDate, 
      endDate: endDate || startDate, // If no end date, use start date (single day)
      reason: reason || 'Blocked Out' 
    });
    showToast('Block out dates added successfully!', 'success');
    handleClose();
  };

  if (!isOpen && !isExiting) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          isExiting ? 'opacity-0 z-[100]' : 'opacity-50 z-[100]'
        }`}
        onClick={handleClose}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 z-[101] flex max-h-[90vh] flex-col rounded-t-3xl border-t border-border bg-card transition-transform duration-300 ease-out ${
          isExiting ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border/70 p-4">
          <h2 className="text-xl font-semibold text-foreground">Add Block Out Dates</h2>
          <button onClick={handleClose} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor="blockout-reason">
              Reason <span className="text-xs text-muted-foreground/60">(Optional)</span>
            </Label>
            <Input
              id="blockout-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Out of town, vacation, etc."
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="blockout-start">Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="blockout-start"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {startDate ? formatLongDate(startDate) : "Select date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
                    onSelect={(selectedDate) => {
                      if (selectedDate) {
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setStartDate(`${year}-${month}-${day}`);
                      } else {
                        setStartDate('');
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="blockout-end">Until (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="blockout-end"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {endDate ? formatLongDate(endDate) : "No end date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate ? new Date(`${endDate}T00:00:00`) : undefined}
                    onSelect={(selectedDate) => {
                      if (selectedDate) {
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setEndDate(`${year}-${month}-${day}`);
                      } else {
                        setEndDate('');
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Block out dates will be visible to all band members on the shared calendar, helping them avoid scheduling gigs during your unavailable periods.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={!startDate}
              className="w-full h-12 text-base"
              variant="secondary"
            >
              Add Block Out Dates
            </Button>

            <Button
              onClick={handleClose}
              variant="ghost"
              className="w-full h-12 text-base"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
