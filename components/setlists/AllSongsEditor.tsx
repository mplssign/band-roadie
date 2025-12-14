'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING_CONFIG } from '@/lib/motion-config';
import { SetlistSong, TuningType } from '@/lib/types';
import { SetlistSongRow } from '@/components/setlists/SetlistSongRow';
import { BulkCopyToSetlistSheet } from '@/components/setlists/BulkCopyToSetlistSheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Copy, CheckSquare, Square } from 'lucide-react';

interface AllSongsEditorProps {
  songs: SetlistSong[];
  setlistId: string;
  onUpdate: (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => Promise<void>;
  onRemove: (songId: string) => Promise<boolean>;
  onBulkRemove: (songIds: string[]) => Promise<void>;
  isEditMode?: boolean;
}

export function AllSongsEditor({ 
  songs, 
  setlistId,
  onUpdate, 
  onRemove, 
  onBulkRemove,
  isEditMode = false 
}: AllSongsEditorProps) {
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showBulkCopySheet, setShowBulkCopySheet] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const hasSelection = selectedSongs.size > 0;
  const allSelected = songs.length > 0 && selectedSongs.size === songs.length;

  // Toggle song selection
  const toggleSongSelection = useCallback((songId: string) => {
    setSelectedSongs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(songId)) {
        newSet.delete(songId);
      } else {
        newSet.add(songId);
      }
      
      // Auto-exit multi-select mode when nothing is selected
      if (newSet.size === 0) {
        setIsMultiSelectMode(false);
      }
      
      return newSet;
    });
  }, []);

  // Select all songs
  const selectAll = useCallback(() => {
    if (allSelected) {
      setSelectedSongs(new Set());
      setIsMultiSelectMode(false);
    } else {
      setSelectedSongs(new Set(songs.map(song => song.id)));
      setIsMultiSelectMode(true);
    }
  }, [songs, allSelected]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedSongs.size === 0) return;
    
    try {
      await onBulkRemove(Array.from(selectedSongs));
      setSelectedSongs(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Error bulk deleting songs:', error);
    }
  }, [selectedSongs, onBulkRemove]);

  // Handle bulk copy
  const handleBulkCopy = useCallback(() => {
    if (selectedSongs.size === 0) return;
    setShowBulkCopySheet(true);
  }, [selectedSongs]);

  // Enhanced song removal that works with selection
  const handleSongRemove = useCallback(async (songId: string) => {
    const success = await onRemove(songId);
    if (success) {
      // Remove from selection if it was selected
      setSelectedSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        
        // Auto-exit multi-select mode when nothing is selected
        if (newSet.size === 0) {
          setIsMultiSelectMode(false);
        }
        
        return newSet;
      });
    }
    return success;
  }, [onRemove]);

  // Start multi-select mode
  const startMultiSelect = useCallback(() => {
    setIsMultiSelectMode(true);
  }, []);

  // Exit multi-select mode
  const exitMultiSelect = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedSongs(new Set());
  }, []);

  return (
    <>
      {/* Multi-select header */}
      {isEditMode && (
        <div className="mb-4 space-y-3">
          {/* All Songs special header */}
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-rose-800">
              <span className="font-medium">Master Catalog:</span>
              <span>{songs.length} song{songs.length === 1 ? '' : 's'} in your repertoire</span>
            </div>
          </div>
          
          {!isMultiSelectMode ? (
            <Button
              variant="outline"
              onClick={startMultiSelect}
              className="w-full"
              disabled={songs.length === 0}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select Songs to Copy or Delete
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Selection controls */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    className="p-1"
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="text-sm font-medium">
                    {hasSelection ? `${selectedSongs.size} selected` : 'Select songs'}
                  </span>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitMultiSelect}
                >
                  Cancel
                </Button>
              </div>

              {/* Bulk actions */}
              {hasSelection && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleBulkCopy}
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy {selectedSongs.size} song{selectedSongs.size === 1 ? '' : 's'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleBulkDelete}
                    className="flex-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {selectedSongs.size} song{selectedSongs.size === 1 ? '' : 's'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Songs list */}
      <div className="space-y-3">
        {songs.map((song) => (
          <motion.div
            key={song.id}
            className="relative"
            layout
            transition={SPRING_CONFIG.default}
          >
            {/* Selection checkbox overlay in multi-select mode */}
            {isEditMode && isMultiSelectMode && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                <Checkbox
                  checked={selectedSongs.has(song.id)}
                  onCheckedChange={() => toggleSongSelection(song.id)}
                  className="bg-background/80 backdrop-blur-sm"
                />
              </div>
            )}
            
            {/* Song row with left padding in multi-select mode */}
            <div className={isMultiSelectMode ? "ml-8" : ""}>
              <SetlistSongRow
                setlistSong={song}
                setlistId={setlistId}
                onUpdate={onUpdate}
                onRemove={handleSongRemove}
                isEditMode={isEditMode}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bulk copy sheet */}
      <BulkCopyToSetlistSheet
        isOpen={showBulkCopySheet}
        onClose={() => setShowBulkCopySheet(false)}
        songIds={Array.from(selectedSongs)}
        fromSetlistId={setlistId}
        onComplete={() => {
          setSelectedSongs(new Set());
          setIsMultiSelectMode(false);
        }}
      />
    </>
  );
}