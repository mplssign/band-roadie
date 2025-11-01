'use client';


import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SetlistSong, TuningType } from '@/lib/types';
import { Button } from '@/components/ui/button';
// Note: Using custom dropdown instead of select component
import { BpmInput } from '@/components/setlists/BpmInput';
import { TuningBadge } from '@/components/setlists/TuningBadge';
import { useDurationBackfill } from '@/hooks/useDurationBackfill';
import { GripVertical, X } from 'lucide-react';

interface SongRowProps {
  setlistSong: SetlistSong;
  onUpdate: (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => void;
  onRemove: (songId: string) => void;
  isEditMode?: boolean;
}



function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function SongRow({ setlistSong, onUpdate, onRemove, isEditMode = false }: SongRowProps) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: setlistSong.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleBpmChange = (newBpm: number | undefined) => {
    onUpdate(setlistSong.id, { bpm: newBpm });
  };



  const displayBpm = setlistSong.bpm ?? setlistSong.songs?.bpm;
  const displayTuning = setlistSong.tuning ?? setlistSong.songs?.tuning ?? 'standard';
  const displayDuration = setlistSong.duration_seconds ?? setlistSong.songs?.duration_seconds;

  // Auto-backfill duration if missing
  useDurationBackfill({
    songId: setlistSong.id,
    title: setlistSong.songs?.title || 'Unknown Song',
    artist: setlistSong.songs?.artist || 'Unknown Artist',
    currentDuration: displayDuration,
    enabled: !!setlistSong.songs?.title && !!setlistSong.songs?.artist,
    onUpdate: (duration) => {
      onUpdate(setlistSong.id, { duration_seconds: duration });
    },
  });



  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border/40 rounded-lg p-4 transition-all ${
        isDragging ? 'shadow-lg border-border/60' : 'hover:shadow-md hover:border-border/60'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle - only in edit mode */}
        {isEditMode && (
          <button
            className="text-muted-foreground hover:text-foreground p-1 -m-1 cursor-grab active:cursor-grabbing mt-1"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Album artwork */}
        {setlistSong.songs?.album_artwork && (
          <div className="flex-shrink-0">
            <Image 
              src={setlistSong.songs.album_artwork} 
              alt={`${setlistSong.songs.title} album artwork`}
              width={48}
              height={48}
              className="w-12 h-12 rounded-md object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Song info */}
        <div className="flex-1 min-w-0 relative">
          {/* Top row: Song title and BPM */}
          <div className="flex items-start justify-between gap-2 mb-1">
            {/* Song title - with right margin to prevent overlap with BPM */}
            <div className="text-lg font-medium truncate whitespace-nowrap overflow-hidden pr-2 flex-1 min-w-0" style={{ marginRight: '8px' }}>
              {setlistSong.songs?.title || 'Unknown Song'}
            </div>
            
            {/* BPM - positioned in top right */}
            <div className="flex-shrink-0">
              {isEditMode ? (
                <BpmInput
                  value={displayBpm}
                  onChange={handleBpmChange}
                  placeholder="BPM"
                />
              ) : (
                <div className="text-base font-medium">
                  {displayBpm ? `${displayBpm} BPM` : '— BPM'}
                </div>
              )}
            </div>
          </div>

          {/* Bottom row: Artist and Duration/Tuning */}
          <div className="flex items-start justify-between gap-2">
            {/* Artist */}
            <div className="text-sm text-muted-foreground truncate whitespace-nowrap overflow-hidden flex-1 min-w-0">
              {setlistSong.songs?.artist || 'Unknown Artist'}
              {setlistSong.songs?.is_live && <span className="ml-2">[Live]</span>}
            </div>

            {/* Duration and Tuning - aligned under BPM */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Duration */}
              <div className="bg-transparent text-white border border-white px-2 py-1 rounded text-sm font-medium">
                {formatDuration(displayDuration)}
              </div>

              {/* Tuning */}
              <TuningBadge 
                tuning={displayTuning}
                onChange={isEditMode ? (newTuning) => onUpdate(setlistSong.id, { tuning: newTuning }) : undefined}
                disabled={!isEditMode}
              />
            </div>
          </div>
        </div>

        {/* Remove button - only in edit mode */}
        {isEditMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(setlistSong.id)}
            className="text-muted-foreground hover:text-destructive p-1 h-auto"
            aria-label="Remove song"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}