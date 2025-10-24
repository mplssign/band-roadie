"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';

type Gig = {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  setlist?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  gig: Gig | null;
};

export default function EditGigBottomDrawer({ isOpen, onClose, gig }: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this gig?')) {
      showToast('Gig deleted', 'success');
      onClose();
    }
  };

  if (!isOpen || !gig) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[100]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[101] bg-card rounded-t-3xl max-h-[80vh] flex flex-col transition-transform">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Gig Details</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
            <div className="text-lg font-semibold text-foreground">{gig.name}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
            <div className="text-base text-foreground">{gig.date}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Time</label>
            <div className="text-base text-foreground">{gig.time}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
            <div className="text-base text-foreground">{gig.location}</div>
          </div>

          {gig.setlist && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Setlist</label>
              <div className="text-base text-foreground">{gig.setlist}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => {
              onClose();
              router.push(`/gigs/${gig.id}/edit`);
            }}
            className="flex-1 rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground"
          >
            Edit Gig
          </button>
          <button
            onClick={() => {
              showToast('Feature: delete/edit from gig page', 'info');
              onClose();
            }}
            className="flex-1 rounded-lg border border-border bg-muted/40 py-3 text-center font-semibold text-muted-foreground"
          >
            Close
          </button>
        </div>

        {/* Delete Button */}
        <div className="px-4 pb-4 text-center">
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-400 transition-colors text-sm font-medium"
          >
            Delete Gig
          </button>
        </div>
      </div>
    </>
  );
}
