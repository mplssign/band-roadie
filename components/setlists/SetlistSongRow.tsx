'use client';

import { useState, useRef, memo, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING_CONFIG } from '@/lib/motion-config';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';
import { SetlistSong, TuningType } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { BpmInput } from '@/components/setlists/BpmInput';
import { TuningBadge } from '@/components/setlists/TuningBadge';
import { DurationInput } from '@/components/setlists/DurationInput';
import { SwipeableContainer } from '@/components/setlists/SwipeableContainer';
import { CopyToSetlistSheet } from '@/components/setlists/CopyToSetlistSheet';
import { useDurationBackfill } from '@/hooks/useDurationBackfill';
import { GripVertical } from 'lucide-react';

interface SetlistSongRowProps {
  setlistSong: SetlistSong;
  setlistId: string;
  onUpdate: (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => Promise<void>;
  onRemove: (songId: string) => Promise<boolean>;
  isEditMode?: boolean;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const SetlistSongRow = memo(function SetlistSongRow({ 
  setlistSong, 
  setlistId, 
  onUpdate, 
  onRemove, 
  isEditMode = false 
}: SetlistSongRowProps) {
  const router = useRouter();
  
  const [showCopySheet, setShowCopySheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDndDragging,
  } = useSortable({ id: setlistSong.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

  const handleBpmChange = useCallback((newBpm: number | undefined) => {
    onUpdate(setlistSong.id, { bpm: newBpm });
  }, [onUpdate, setlistSong.id]);

  const handleRowClick = useCallback(() => {
    if (setlistSong.songs?.id && !isEditMode) {
      router.push(`/songs/${setlistSong.songs.id}`);
    }
  }, [setlistSong.songs?.id, isEditMode, router]);

  const handleDelete = useCallback(async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      const success = await onRemove(setlistSong.id);
      if (!success) {
        setIsDeleting(false);
      }
      // Success case: row will be removed from parent's state, no UI reset needed
    } catch (error) {
      // Unexpected error, reset UI state
      setIsDeleting(false);
    }
  }, [isDeleting, onRemove, setlistSong.id]);

  const handleCopy = useCallback(() => {
    setShowCopySheet(true);
  }, []);

  // Memoize row content to prevent unnecessary re-renders during drag
  const rowContent = useMemo(() => (
    <div className="flex items-start gap-3">
      {/* Drag handle - only in edit mode */}
      {isEditMode && (
        <button
          className="text-muted-foreground hover:text-foreground p-1 -m-1 cursor-grab active:cursor-grabbing mt-1"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
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
          <div 
            className={`text-lg font-medium truncate whitespace-nowrap overflow-hidden pr-2 flex-1 min-w-0 ${
              !isEditMode && setlistSong.songs?.id 
                ? 'hover:text-primary transition-colors' 
                : ''
            }`} 
            style={{ marginRight: '8px' }}
          >
            {setlistSong.songs?.title || 'Unknown Song'}
          </div>
          
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

        {/* Bottom row: Artist and fixed controls */}
        <div className="flex items-start gap-2">
          <div className="text-sm text-muted-foreground truncate flex-1 min-w-0">
            {setlistSong.songs?.artist || 'Unknown Artist'}
            {setlistSong.songs?.is_live && <span className="ml-2">[Live]</span>}
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            {isEditMode ? (
              <DurationInput
                value={displayDuration}
                onChange={(newDuration) => onUpdate(setlistSong.id, { duration_seconds: newDuration })}
                placeholder="M:SS"
              />
            ) : (
              <div className="bg-background/80 text-foreground border border-border/30 px-2 py-1 rounded text-sm font-medium backdrop-blur-sm">
                {displayDuration ? formatDuration(displayDuration) : '--:--'}
              </div>
            )}

            <TuningBadge 
              value={displayTuning}
              setlistSongId={setlistSong.id}
              editMode={isEditMode}
              onLocalChange={isEditMode ? (newTuning) => onUpdate(setlistSong.id, { tuning: newTuning }) : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  ), [
    isEditMode,
    setlistSong,
    displayBpm,
    displayTuning,
    displayDuration,
    handleBpmChange,
    onUpdate,
    attributes,
    listeners
  ]);

  return (
    <>
      <AnimatePresence mode="popLayout">
        {!isDeleting && (
          <motion.div
            key={setlistSong.id}
            className="border-t border-border/60 first:border-t-0"
            initial={{ opacity: 1, height: 'auto' }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ 
              opacity: 0, 
              height: 0,
              transition: SPRING_CONFIG.gentle
            }}
            layout
            transition={SPRING_CONFIG.default}
          >
            {isEditMode ? (
              // In edit mode, use DnD-kit directly without SwipeableContainer
              <div
                ref={setNodeRef}
                style={style}
                className="rounded-lg"
              >
                <Card
                  className={`song-card transition-all ${
                    isDndDragging ? 'border-gray-600 shadow-lg z-10' : ''
                  }`}
                >
                  <div className="p-4">
                    {rowContent}
                  </div>
                </Card>
              </div>
            ) : (
              // In view mode, use SwipeableContainer for swipe actions
              <SwipeableContainer
                mode="edit"
                onCopy={handleCopy}
                onDelete={handleDelete}
                onTap={handleRowClick}
                className="rounded-lg"
              >
                <Card
                  className={`song-card transition-all ${
                    !isEditMode && setlistSong.songs?.id ? 'cursor-pointer hover:shadow-md hover:border-gray-600' : ''
                  } ${
                    isPressed ? 'bg-gray-900' : ''
                  }`}
                >
                  <div 
                    className="p-4"
                    data-pressed={isPressed}
                    onPointerDown={() => setIsPressed(true)}
                    onPointerUp={() => setIsPressed(false)}
                    onPointerCancel={() => setIsPressed(false)}
                    onPointerLeave={() => setIsPressed(false)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isEditMode && setlistSong.songs?.id) {
                        e.preventDefault();
                        setIsPressed(true);
                        handleRowClick();
                      }
                    }}
                    onKeyUp={() => setIsPressed(false)}
                    role={!isEditMode && setlistSong.songs?.id ? "button" : undefined}
                    tabIndex={!isEditMode && setlistSong.songs?.id ? 0 : undefined}
                    aria-label={!isEditMode && setlistSong.songs?.id ? `View notes for ${setlistSong.songs?.title}` : undefined}
                  >
                    {rowContent}
                  </div>
                </Card>
              </SwipeableContainer>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy to setlist sheet */}
      <CopyToSetlistSheet
        isOpen={showCopySheet}
        onClose={() => setShowCopySheet(false)}
        songId={setlistSong.id}
        fromSetlistId={setlistId}
        songTitle={setlistSong.songs?.title}
      />
    </>
  );
});