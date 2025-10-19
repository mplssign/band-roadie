'use client';

import { useEffect, useState } from 'react';
import { X, Clock, MapPin, ArrowLeft } from 'lucide-react';

interface CalendarEvent {
  id?: string;
  date: string;
  type: 'rehearsal' | 'gig' | 'blockout';
  title: string;
  time?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  is_potential?: boolean;
  setlist_id?: string | null;
  blockedBy?: {
    name: string;
    initials: string;
    color: string;
  };
  blockout?: {
    startDate: string;
    endDate: string;
    color: string;
    name: string;
  };
}

interface EventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  date?: Date;
  showBackButton?: boolean;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteBlockout?: (blockoutId: string) => void;
}

export default function EventDrawer({ isOpen, onClose, events, date, showBackButton = false, onEditEvent, onDeleteBlockout }: EventDrawerProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    events.length === 1 ? events[0] : null
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (events.length === 1) {
      setSelectedEvent(events[0]);
    } else {
      setSelectedEvent(null);
    }
  }, [events]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
      setIsExiting(false);
      setSelectedEvent(events.length === 1 ? events[0] : null);
    }, 300);
  };

  const handleBack = () => {
    setSelectedEvent(null);
  };

  const handleEventSelection = (event: CalendarEvent) => {
    if (onEditEvent) {
      onEditEvent(event);
      handleClose();
      return;
    }
    setSelectedEvent(event);
  };

  if (!isOpen && !isExiting) return null;

  const formattedDate = date ? date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  }) : '';

  const handleDeleteConfirm = () => {
    if (selectedEvent && selectedEvent.id && onDeleteBlockout) {
      onDeleteBlockout(selectedEvent.id);
      setShowDeleteDialog(false);
      onClose();
    }
  };

  const renderDeleteDialog = () => (
    showDeleteDialog && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-6 shadow-xl">
          <h3 className="text-xl font-bold text-foreground mb-4">Delete Block Out</h3>
          <p className="text-muted-foreground mb-6">
            Are you sure you want to delete this blockout period? This action cannot be undone and will remove all dates in this blockout range.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteDialog(false)}
              className="flex-1 py-3 bg-muted/40 text-muted-foreground rounded-lg hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="flex-1 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  );

  // Detail view for single event or selected event
  if (selectedEvent) {
    return (
      <>
        <div
          className={`fixed inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
            isExiting ? 'opacity-0 z-[100]' : 'opacity-50 z-[100]'
          }`}
          onClick={handleClose}
        />

        <div
          className={`fixed bottom-0 left-0 right-0 z-[101] flex max-h-[70vh] flex-col rounded-t-3xl border-t border-border bg-card transition-transform duration-300 ease-out ${
            isExiting ? 'translate-y-full' : 'translate-y-0'
          }`}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1 w-12 rounded-full bg-muted/60" />
          </div>

          <div className="flex items-center justify-between border-b border-border/70 px-4 pb-4">
            <div className="flex items-center gap-3">
              {showBackButton && events.length > 1 && (
                <button
                  onClick={handleBack}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {selectedEvent.type === 'blockout' && selectedEvent.blockout 
                    ? selectedEvent.blockout.name.split(' ')[0] + ' Out'
                    : selectedEvent.title}
                </h2>
                {selectedEvent.type === 'blockout' && selectedEvent.blockout ? (
                  <p className="text-base text-muted-foreground mt-1">
                    {selectedEvent.blockout.startDate === selectedEvent.blockout.endDate
                      ? new Date(`${selectedEvent.blockout.startDate}T00:00:00Z`).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC'
                        })
                      : `${new Date(`${selectedEvent.blockout.startDate}T00:00:00Z`).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC'
                        })} - ${new Date(`${selectedEvent.blockout.endDate}T00:00:00Z`).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC'
                        })}`}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{formattedDate}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <button
              type="button"
              onClick={() => handleEventSelection(selectedEvent)}
              className={`w-full rounded-xl border-2 p-6 text-left transition-colors ${
                selectedEvent.type === 'rehearsal'
                  ? 'border-primary/40 bg-primary/10'
                  : selectedEvent.type === 'gig'
                  ? 'border-accent/50 bg-accent/15'
                  : 'border-border/60 bg-muted/20'
              } ${onEditEvent ? 'hover:border-primary/60 hover:bg-primary/15' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    selectedEvent.type === 'rehearsal'
                      ? 'bg-blue-500 text-white'
                      : selectedEvent.type === 'gig' && selectedEvent.is_potential
                      ? 'bg-purple-500 text-white'
                      : selectedEvent.type === 'gig'
                      ? 'bg-green-500 text-white'
                      : selectedEvent.type === 'blockout'
                      ? 'bg-red-500 text-white'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {(() => {
                    if (selectedEvent.type === 'rehearsal') return 'Rehearsal';
                    if (selectedEvent.type === 'gig' && selectedEvent.is_potential) return 'Potential Gig';
                    if (selectedEvent.type === 'gig') return 'Gig';
                    if (selectedEvent.type === 'blockout') return 'Block Out';
                    return 'Event';
                  })()}
                </span>
              </div>

              {selectedEvent.time && (
                <div className="mb-3 flex items-center gap-3 text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span className="text-lg">{selectedEvent.time}</span>
                </div>
              )}

              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="w-5 h-5" />
                  <span className="text-lg">{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.blockedBy && selectedEvent.type !== 'blockout' && (
                <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-4 text-muted-foreground">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-primary-foreground ${selectedEvent.blockedBy.color}`}
                  >
                    {selectedEvent.blockedBy.initials}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground/80">Blocked by</p>
                    <p className="text-lg text-foreground">{selectedEvent.blockedBy.name}</p>
                  </div>
                </div>
              )}
            </button>

            {selectedEvent.type === 'blockout' && onDeleteBlockout && (
              <div className="mt-4 text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="text-sm text-rose-600 hover:text-rose-700 transition-colors"
                >
                  Delete Block Out
                </button>
              </div>
            )}
          </div>
        </div>
        {renderDeleteDialog()}
      </>
    );
  }

  // List view for multiple events
  return (
    <>
      <div
        className={`fixed inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          isExiting ? 'opacity-0 z-[100]' : 'opacity-50 z-[100]'
        }`}
        onClick={handleClose}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 z-[101] flex max-h-[70vh] flex-col rounded-t-3xl border-t border-border bg-card transition-transform duration-300 ease-out ${
          isExiting ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-12 rounded-full bg-muted/60" />
        </div>

        <div className="flex items-center justify-between border-b border-border/70 px-4 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Events</h2>
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {events.map((event, idx) => (
            <button
              key={idx}
              onClick={() => handleEventSelection(event)}
              className={`w-full rounded-xl border-2 p-4 text-left transition-opacity hover:opacity-80 ${
                event.type === 'rehearsal'
                  ? 'border-primary/40 bg-primary/10'
                  : event.type === 'gig'
                  ? 'border-accent/50 bg-accent/15'
                  : 'border-border/60 bg-muted/20'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {event.type === 'blockout' && event.blockout 
                    ? event.blockout.name.split(' ')[0] + ' Out'
                    : event.title}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2 font-semibold ${
                  event.type === 'rehearsal'
                    ? 'bg-blue-500 text-white'
                    : event.type === 'gig' && event.is_potential
                    ? 'bg-purple-500 text-white'
                    : event.type === 'gig'
                    ? 'bg-green-500 text-white'
                    : event.type === 'blockout'
                    ? 'bg-red-500 text-white'
                    : 'bg-muted text-foreground'
                }`}>
                  {(() => {
                    if (event.type === 'rehearsal') return 'Rehearsal';
                    if (event.type === 'gig' && event.is_potential) return 'Potential Gig';
                    if (event.type === 'gig') return 'Gig';
                    if (event.type === 'blockout') return 'Block Out';
                    return 'Event';
                  })()}
                </span>
              </div>

              {event.type === 'blockout' && event.blockout && event.blockout.startDate !== event.blockout.endDate && (
                <div className="mb-2 text-sm text-muted-foreground">
                  {new Date(`${event.blockout.startDate}T00:00:00Z`).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC'
                  })} - {new Date(`${event.blockout.endDate}T00:00:00Z`).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC'
                  })}
                </div>
              )}

              {event.time && (
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{event.time}</span>
                </div>
              )}

              {event.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
              )}

              {event.blockedBy && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${event.blockedBy.color}`}>
                    {event.blockedBy.initials}
                  </div>
                  <span>{event.blockedBy.name}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      {renderDeleteDialog()}
    </>
  );
}
