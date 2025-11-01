'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SetlistSong, TuningType } from '@/lib/types';
import { Button } from '@/components/ui/button';
// Note: Using custom dropdown instead of select component
import { BpmInput } from '@/components/setlists/BpmInput';
import { TuningBadge } from '@/components/setlists/TuningBadge';
import { GripVertical, X } from 'lucide-react';

interface SongRowProps {
  setlistSong: SetlistSong;
  onUpdate: (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => void;
  onRemove: (songId: string) => void;
  isEditMode?: boolean;
}

const tuningOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'drop_d', label: 'Drop D' },
  { value: 'half_step', label: 'Half Step' },
  { value: 'full_step', label: 'Full Step' },
] as const;

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function SongRow({ setlistSong, onUpdate, onRemove, isEditMode = false }: SongRowProps) {
  const [tuningSelectOpen, setTuningSelectOpen] = useState(false);

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

  const handleTuningChange = (newTuning: TuningType) => {
    onUpdate(setlistSong.id, { tuning: newTuning });
    setTuningSelectOpen(false);
  };

  const displayBpm = setlistSong.bpm ?? setlistSong.songs?.bpm;
  const displayTuning = setlistSong.tuning ?? setlistSong.songs?.tuning ?? 'standard';
  const displayDuration = setlistSong.duration_seconds ?? setlistSong.songs?.duration_seconds;



  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border rounded-lg p-4 transition-shadow ${
        isDragging ? 'shadow-lg' : 'hover:shadow-md'
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
        <div className="flex-1 min-w-0">
          {/* Song title */}
          <div className="text-lg font-medium truncate mb-1 whitespace-nowrap overflow-hidden">{setlistSong.songs?.title || 'Unknown Song'}</div>
          
          {/* Artist */}
          <div className="text-sm text-muted-foreground truncate mb-3 whitespace-nowrap overflow-hidden">
            {setlistSong.songs?.artist || 'Unknown Artist'}
            {setlistSong.songs?.is_live && <span className="ml-2">[Live]</span>}
          </div>

          {/* Bottom row with BPM, Duration, and Tuning */}
          <div className="flex items-center gap-3">
            {/* BPM - editable in edit mode, display only in view mode */}
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

            {/* Duration */}
            <div className="bg-transparent text-white border border-white px-2 py-1 rounded text-sm font-medium flex-shrink-0">
              {formatDuration(displayDuration)}
            </div>

            {/* Tuning - editable in edit mode, display only in view mode */}
            <div className="relative flex-shrink-0">
              {isEditMode ? (
                <>
                  <button
                    onClick={() => setTuningSelectOpen(!tuningSelectOpen)}
                    className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                  >
                    <TuningBadge 
                      tuning={displayTuning}
                      songId={setlistSong.song_id}
                      songTitle={setlistSong.songs?.title}
                      artist={setlistSong.songs?.artist}
                      onTuningConfirm={(newTuning) => {
                        // Convert the tuning value to TuningType format
                        let tuningValue: TuningType = 'standard';
                        switch (newTuning) {
                          case 'Drop D':
                            tuningValue = 'drop_d';
                            break;
                          case 'Half Step Down':
                            tuningValue = 'half_step';
                            break;
                          case 'Full Step Down':
                            tuningValue = 'full_step';
                            break;
                          default:
                            tuningValue = 'standard';
                        }
                        onUpdate(setlistSong.id, { tuning: tuningValue });
                      }}
                    />
                  </button>
                  
                  {tuningSelectOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setTuningSelectOpen(false)}
                      />
                      <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] bg-popover border border-border rounded-md shadow-lg">
                        {tuningOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleTuningChange(option.value)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground first:rounded-t-md last:rounded-b-md"
                          >
                            {option.label}
                            {option.value === displayTuning && (
                              <span className="ml-2 text-primary">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <TuningBadge 
                  tuning={displayTuning}
                  songId={setlistSong.song_id}
                  songTitle={setlistSong.songs?.title}
                  artist={setlistSong.songs?.artist}
                  onTuningConfirm={(newTuning) => {
                    // Convert the tuning value to TuningType format
                    let tuningValue: TuningType = 'standard';
                    switch (newTuning) {
                      case 'Drop D':
                        tuningValue = 'drop_d';
                        break;
                      case 'Half Step Down':
                        tuningValue = 'half_step';
                        break;
                      case 'Full Step Down':
                        tuningValue = 'full_step';
                        break;
                      default:
                        tuningValue = 'standard';
                    }
                    onUpdate(setlistSong.id, { tuning: tuningValue });
                  }}
                />
              )}
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