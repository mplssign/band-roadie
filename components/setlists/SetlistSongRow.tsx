'use client';

import { useState, useRef, memo, useMemo, useCallback } from 'react';
import { motion, useMotionValue, animate, PanInfo, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';
import { SetlistSong, TuningType } from '@/lib/types';
import { BpmInput } from '@/components/setlists/BpmInput';
import { TuningBadge } from '@/components/setlists/TuningBadge';
import { DurationInput } from '@/components/setlists/DurationInput';
import { SwipeActions } from '@/components/setlists/SwipeActions';
import { CopyToSetlistSheet } from '@/components/setlists/CopyToSetlistSheet';
import { useDurationBackfill } from '@/hooks/useDurationBackfill';
import { GripVertical } from 'lucide-react';

interface SetlistSongRowProps {
  setlistSong: SetlistSong;
  setlistId: string;
  onUpdate: (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => void;
  onRemove: (songId: string) => Promise<boolean>;
  isEditMode?: boolean;
}

const SPRING = { type: 'spring', stiffness: 420, damping: 28, mass: 1, bounce: 0.2 } as const;

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
  
  const x = useMotionValue(0);
  const dragStartedRef = useRef(false);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;

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

  const handleRowClick = () => {
    if (!dragStartedRef.current && setlistSong.songs?.id && !isEditMode) {
      router.push(`/songs/${setlistSong.songs.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isEditMode && setlistSong.songs?.id) {
      e.preventDefault();
      router.push(`/songs/${setlistSong.songs.id}`);
    }
  };

  const handleDragStart = () => {
    dragStartedRef.current = true;
    setIsPressed(true);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentX = info.offset.x;
    const leftTarget = -0.25 * vw;
    const rightTarget = 0.25 * vw;
    
    // Reset drag started flag after a short delay
    setTimeout(() => {
      dragStartedRef.current = false;
    }, 100);

    // Hard trigger thresholds
    if (currentX <= -0.6 * vw) {
      // Delete action - animate off screen left
      animate(x, -vw, SPRING).then(() => {
        handleDelete();
      });
      return;
    }

    if (currentX >= 0.6 * vw) {
      // Copy action - animate off screen right
      animate(x, vw, SPRING).then(() => {
        handleCopy();
        // Reset position after opening drawer
        animate(x, 0, SPRING);
      });
      return;
    }

    // Snap to nearest target using improved logic
    const targets = [leftTarget, 0, rightTarget];
    const closestTarget = targets.reduce((closest, target) => {
      return Math.abs(currentX - target) < Math.abs(currentX - closest) ? target : closest;
    });

    // Apply threshold for revealing actions (18% of viewport width)
    const threshold = 0.18 * vw;
    let finalTarget = closestTarget;

    if (Math.abs(currentX) < threshold) {
      finalTarget = 0; // Return to center if below threshold
    }

    animate(x, finalTarget, SPRING);
    
    // Clear pressed state after drag ends
    setIsPressed(false);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      const success = await onRemove(setlistSong.id);
      if (!success) {
        // Delete failed, reset UI state
        animate(x, 0, SPRING);
        setIsDeleting(false);
      }
      // Success case: row will be removed from parent's state, no UI reset needed
    } catch (error) {
      // Unexpected error, reset UI state
      animate(x, 0, SPRING);
      setIsDeleting(false);
    }
  };

  const handleCopy = () => {
    setShowCopySheet(true);
  };

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
              tuning={displayTuning}
              onChange={isEditMode ? (newTuning) => onUpdate(setlistSong.id, { tuning: newTuning }) : undefined}
              disabled={!isEditMode}
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
            ref={setNodeRef}
            style={style}
            className="relative overflow-hidden border-t border-border/60 first:border-t-0"
            initial={{ opacity: 1, height: 'auto' }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ 
              opacity: 0, 
              height: 0,
              transition: { duration: 0.2, ease: 'easeOut' }
            }}
            layout
          >
            {/* Black backdrop behind actions - only in edit mode */}
            {isEditMode && (
              <div className="absolute inset-0 bg-black z-0" />
            )}

            {/* Swipe actions background - only in edit mode */}
            {isEditMode && (
              <SwipeActions 
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
            )}

            {/* Main row content */}
            <motion.div
              drag={isEditMode ? "x" : false}
              dragDirectionLock={true}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onPointerDown={() => setIsPressed(true)}
              onPointerUp={() => setIsPressed(false)}
              onPointerCancel={() => setIsPressed(false)}
              onPointerLeave={() => setIsPressed(false)}
              style={{ 
                x, 
                touchAction: 'pan-y'
              }}
              data-pressed={isPressed}
              className={`song-card bg-card rounded-xl overflow-hidden isolate will-change-transform z-10 p-4 relative ${
                isDndDragging ? 'border-border/40' : isEditMode ? '' : 'hover:shadow-md hover:border-border/30'
              } ${
                !isEditMode && setlistSong.songs?.id ? 'cursor-pointer' : ''
              }`}
              role={!isEditMode ? "button" : undefined}
              tabIndex={!isEditMode ? 0 : undefined}
              onClick={handleRowClick}
              onKeyDown={handleKeyDown}
              aria-label={!isEditMode ? `View notes for ${setlistSong.songs?.title}` : undefined}
            >
              {rowContent}
            </motion.div>
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