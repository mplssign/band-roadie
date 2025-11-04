'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BlockoutDraft {
  id?: string;
  startDate?: string;
  endDate?: string;
  reason?: string | null;
}

interface AddBlockoutDrawerProps {
  isOpen: boolean;
  mode?: 'add' | 'edit';
  initialBlockout?: BlockoutDraft | null;
  onClose: () => void;
  onSave: (blockout: { id?: string; startDate: string; endDate: string; reason: string }) => Promise<void> | void;
  onDelete?: (blockoutId: string) => Promise<void> | void;
}

function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${monthName} ${day}, ${year}`;
}

export default function AddBlockoutDrawer({
  isOpen,
  mode = 'add',
  initialBlockout = null,
  onClose,
  onSave,
  onDelete,
}: AddBlockoutDrawerProps) {
  const { showToast } = useToast();
  const isEditing = mode === 'edit' && Boolean(initialBlockout?.id);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStartDate(initialBlockout?.startDate ?? '');
      setEndDate(initialBlockout?.endDate ?? initialBlockout?.startDate ?? '');
      setReason(initialBlockout?.reason ?? '');
      setPending(false);
    } else {
      setStartDate('');
      setEndDate('');
      setReason('');
      setPending(false);
    }
  }, [isOpen, initialBlockout]);

  const normalizedEndDate = useMemo(() => {
    if (!startDate) return '';
    if (!endDate) return startDate;
    return endDate < startDate ? startDate : endDate;
  }, [endDate, startDate]);

  const handleClose = () => {
    if (pending) return;
    onClose();
  };

  const handleSave = async () => {
    if (!startDate || pending) return;
    setPending(true);
    const payload = {
      id: initialBlockout?.id,
      startDate,
      endDate: normalizedEndDate || startDate,
      reason: reason.trim() || 'Blocked Out',
    };

    try {
      await onSave(payload);
      showToast(isEditing ? 'Block out updated successfully!' : 'Block out added successfully!', 'success');
      onClose();
    } catch (error) {
      showToast('Failed to save block out. Please try again.', 'error');
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !initialBlockout?.id || !onDelete || pending) return;
    setPending(true);
    try {
      await onDelete(initialBlockout.id);
      onClose();
    } catch (error) {
      showToast('Failed to delete block out. Please try again.', 'error');
      setPending(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <SheetContent side="bottom" className="h-[90vh] w-full br-drawer-surface text-foreground border-border p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>{isEditing ? 'Edit Block Out' : 'Add Block Out'}</SheetTitle>
          <SheetDescription />
        </SheetHeader>

        <ScrollArea className="h-[calc(90vh-60px-72px)] overflow-x-hidden">
          <div className="px-4 py-4 space-y-6 w-full max-w-full">
            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="blockout-start">Start Date *</Label>
              <div
                className="relative cursor-pointer"
                onClick={() => {
                  const input = document.getElementById('blockout-start-input') as HTMLInputElement | null;
                  input?.showPicker?.();
                }}
              >
                <input
                  id="blockout-start-input"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer [color-scheme:dark]"
                />
                <div className="absolute inset-0 px-4 py-3 pointer-events-none text-foreground">
                  {formatDateDisplay(startDate) || 'Select date'}
                </div>
              </div>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="blockout-end">Until (optional)</Label>
              <div
                className="relative cursor-pointer"
                onClick={() => {
                  const input = document.getElementById('blockout-end-input') as HTMLInputElement | null;
                  input?.showPicker?.();
                }}
              >
                <input
                  id="blockout-end-input"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-transparent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer [color-scheme:dark]"
                />
                <div className="absolute inset-0 px-4 py-3 pointer-events-none text-foreground">
                  {normalizedEndDate ? formatDateDisplay(normalizedEndDate) : 'No end date'}
                </div>
              </div>
            </div>

            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor="blockout-reason">
                Reason <span className="text-xs text-muted-foreground/60">(Optional)</span>
              </Label>
              <Input
                id="blockout-reason"
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Out of town, vacation, etc."
                className="w-full"
              />
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="border-t border-border px-4 py-4">
          <div className="w-full space-y-3">
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                onClick={handleSave}
                disabled={!startDate || pending}
                className="flex-1"
              >
                {isEditing ? 'Save Block Out' : 'Add Block Out'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={pending}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
            {isEditing && initialBlockout?.id && onDelete && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm text-rose-500 hover:underline disabled:opacity-60"
                  disabled={pending}
                >
                  Delete Block Out
                </button>
              </div>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
