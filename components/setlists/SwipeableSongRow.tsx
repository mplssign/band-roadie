'use client';

import { useState, useRef } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SetlistSong, TuningType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { BpmInput } from '@/components/setlists/BpmInput';
import { TuningBadge } from '@/components/setlists/TuningBadge';
import { DurationInput } from '@/components/setlists/DurationInput';
import { useDurationBackfill } from '@/hooks/useDurationBackfill';
import { CopyToSetlistSheet } from '@/components/setlists/CopyToSetlistSheet';
import { GripVertical, X, Copy } from 'lucide-react';

interface SwipeableSongRowProps {
  setlistSong: SetlistSong;
  setlistId: string;
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

export function SwipeableSongRow({ 
  setlistSong, 
  setlistId,
  onUpdate, 
  onRemove, 
  isEditMode = false 
}: SwipeableSongRowProps) {
  const router = useRouter();
  const [showCopySheet, setShowCopySheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const dragStartedRef = useRef(false);
  
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

    const handleSongClick = () => {
    // Only navigate if we haven't started dragging
    if (!dragStartedRef.current && !isEditMode && setlistSong.songs?.id) {
      router.push(`/songs/${setlistSong.songs.id}`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onRemove(setlistSong.id);
    setShowDeleteDialog(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isEditMode && setlistSong.songs?.id) {
      e.preventDefault();
      router.push(`/songs/${setlistSong.songs.id}`);
    }
  };

  const handleDragStart = () => {
    dragStartedRef.current = true;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Reset drag flag after a short delay to allow click handlers to check it
    setTimeout(() => {
      dragStartedRef.current = false;
    }, 100);

    // Check if this was a swipe left gesture
    const threshold = -80;
    const velocityThreshold = -800;
    
    if (info.offset.x < threshold || info.velocity.x < velocityThreshold) {
      setShowCopySheet(true);
    }
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

  const songRowContent = (
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
          {/* Song title - with right margin to prevent overlap with BPM */}
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

        {/* Bottom row: Artist and fixed controls */}
        <div className="flex items-start gap-2">
          {/* Artist - takes available space */}
          <div className="text-sm text-muted-foreground truncate flex-1 min-w-0">
            {setlistSong.songs?.artist || 'Unknown Artist'}
            {setlistSong.songs?.is_live && <span className="ml-2">[Live]</span>}
          </div>

          {/* Fixed position duration - aligned under BPM */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {/* Duration - editable in edit mode */}
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

            {/* Tuning */}
            <TuningBadge 
              tuning={displayTuning}
              onChange={isEditMode ? (newTuning) => onUpdate(setlistSong.id, { tuning: newTuning }) : undefined}
              disabled={!isEditMode}
            />
          </div>
        </div>
      </div>

      {/* Remove button - always available */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteClick}
        className="text-muted-foreground hover:text-destructive p-1 h-auto"
        aria-label="Remove song"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={style}
        drag={!isEditMode ? "x" : false}
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        dragPropagation={false}
        whileDrag={{
          scale: 1.02,
          boxShadow: "0 8px 25px rgba(0, 0, 0, 0.15)"
        }}
        className={`bg-card border border-border/20 rounded-lg p-4 transition-all relative overflow-hidden ${
          isDragging ? 'shadow-lg border-border/40' : 'hover:shadow-md hover:border-border/30'
        } ${
          !isEditMode && setlistSong.songs?.id ? 'cursor-pointer' : ''
        }`}
        role={!isEditMode ? "button" : undefined}
        tabIndex={!isEditMode ? 0 : undefined}
        onClick={handleSongClick}
        onKeyDown={handleKeyDown}
        aria-label={!isEditMode ? `View notes for ${setlistSong.songs?.title}` : undefined}
      >
        {/* Swipe action background - visible when dragging left */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/30 flex items-center justify-end pr-6 pointer-events-none rounded-lg"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Copy className="h-5 w-5" />
            <span className="font-medium text-sm">Copy</span>
          </div>
        </motion.div>

        {songRowContent}
      </motion.div>

      {/* Copy to setlist sheet */}
      <CopyToSetlistSheet
        isOpen={showCopySheet}
        onClose={() => setShowCopySheet(false)}
        songId={setlistSong.id}
        fromSetlistId={setlistId}
        songTitle={setlistSong.songs?.title}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Remove Song"
      >
        <div className="space-y-4">
          <p>
            Are you sure you want to remove &ldquo;{setlistSong.songs?.title || 'this song'}&rdquo; from the setlist?{' '}
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Remove
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}