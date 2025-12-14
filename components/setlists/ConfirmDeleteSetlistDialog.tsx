'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Trash2 } from 'lucide-react';

interface ConfirmDeleteSetlistDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  setlistId: string;
  setlistName: string;
  songCount?: number;
  onConfirm: (setlistId: string) => Promise<void>;
  loading?: boolean;
}

export function ConfirmDeleteSetlistDialog({
  open,
  setOpen,
  setlistId,
  setlistName,
  songCount,
  onConfirm,
  loading = false,
}: ConfirmDeleteSetlistDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (deleting || loading) return;

    try {
      setDeleting(true);
      await onConfirm(setlistId);
      // Dialog will be closed by the parent component after successful deletion
    } catch (error) {
      // Error handling is done by the parent component
      console.error('Error in dialog confirm handler:', error);
    } finally {
      setDeleting(false);
    }
  };

  const isDisabled = deleting || loading;
  const songCountText = songCount !== undefined 
    ? ` and ${songCount} song${songCount === 1 ? '' : 's'}` 
    : '';

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-left">
              Delete setlist?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            This will permanently remove <strong>&apos;{setlistName}&apos;</strong>
            {songCountText}. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col-reverse sm:flex-row">
          <AlertDialogCancel 
            disabled={isDisabled}
            className="mt-2 sm:mt-0"
          >
            Cancel
          </AlertDialogCancel>
          
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDisabled}
            className="gap-2 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
            aria-label="Delete setlist"
          >
            {deleting ? (
              <>
                <LoadingSpinner size="small" className="text-white" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}