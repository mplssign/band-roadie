'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface AddBlockoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blockout: { startDate: string; endDate: string; reason: string }) => void;
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
    onSave({ startDate, endDate, reason: reason || 'Blocked Out' });
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
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Reason <span className="text-xs text-muted-foreground/60">(Optional)</span></label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Out of town, vacation, etc."
              className="w-full rounded-lg border border-border/60 bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Block out dates will be visible to all band members on the shared calendar, helping them avoid scheduling gigs during your unavailable periods.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={handleSave}
              disabled={!startDate || !endDate}
              className={`w-full py-4 rounded-lg text-lg font-medium transition-colors ${
                startDate && endDate
                  ? 'cursor-pointer bg-secondary text-secondary-foreground shadow shadow-secondary/30 transition-opacity hover:opacity-90'
                  : 'cursor-not-allowed bg-muted/40 text-muted-foreground'
              }`}
            >
              Add Block Out Dates
            </button>

            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-muted/40 py-4 font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
