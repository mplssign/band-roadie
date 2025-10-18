"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Event = {
  id: string;
  name?: string;
  date: string;
  time: string;
  location: string;
  setlist?: string | null;
  type: 'gig' | 'rehearsal';
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
};

export default function EventBottomDrawer({ isOpen, onClose, event }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !event) return null;

  const isGig = event.type === 'gig';
  const title = isGig ? 'Gig Details' : 'Rehearsal Details';
  const editButtonText = isGig ? 'Edit Gig' : 'Edit Rehearsal';
  const editPath = isGig ? `/gigs/${event.id}/edit` : `/rehearsals/${event.id}/edit`;

  return (
    <>
      <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[100]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[101] bg-card rounded-t-3xl max-h-[80vh] flex flex-col transition-transform">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {event.name && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
              <div className="text-lg font-semibold text-foreground">{event.name}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
            <div className="text-base text-foreground">{event.date}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Time</label>
            <div className="text-base text-foreground">{event.time}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
            <div className="text-base text-foreground">{event.location}</div>
          </div>

          {event.setlist && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Setlist</label>
              <div className="text-base text-foreground">{event.setlist}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => {
              onClose();
              router.push(editPath);
            }}
            className="flex-1 rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground"
          >
            {editButtonText}
          </button>
          <button
            onClick={() => {
              onClose();
            }}
            className="flex-1 rounded-lg border border-border bg-muted/40 py-3 text-center font-semibold text-muted-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}