'use client';

import { useState, useEffect, useCallback, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useBands } from '@/contexts/BandsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import { SetlistSongRow } from '@/components/setlists/SetlistSongRow';
import { AllSongsEditor } from '@/components/setlists/AllSongsEditor';
import { SetlistImportRow } from '@/components/setlists/SetlistImportRow';
import { ConfirmDeleteSetlistDialog } from '@/components/setlists/ConfirmDeleteSetlistDialog';
import { deleteSetlistSong, deleteSetlist } from '@/lib/supabase/setlists';
import { useToast } from '@/hooks/useToast';
import { ArrowLeft, Search, Save, Plus, Edit, X, Trash2, ArrowUpDown, Share } from 'lucide-react';
import { capitalizeWords, buildShareText } from '@/lib/utils/formatters';
import { formatSecondsHuman } from '@/lib/time/duration';

// Import types from main types file
import type { TuningType } from '@/lib/types';
import { getTuningInfo } from '@/lib/utils/tuning';

// Dynamic imports for performance optimization
const SongSearchOverlay = lazy(() => import('@/components/setlists/OptimizedSongSearchOverlay'));
import { ProviderImportDrawer } from '@/components/setlists/ProviderImportDrawer';
import { BulkPasteDrawer } from '@/components/setlists/BulkPasteDrawer';

interface Setlist {
  id: string;
  band_id: string;
  name: string;
  setlist_type?: 'regular' | 'all_songs';
  total_duration?: number; // Based on API response structure
  created_at: string;
  updated_at: string;
}

interface SetlistSong {
  id: string;
  setlist_id?: string; // For new songs
  song_id: string;
  position: number;
  bpm?: number;
  tuning?: TuningType;
  duration_seconds?: number;
  songs?: {
    id: string;
    title: string;
    artist?: string;
    bpm?: number;
    tuning?: TuningType;
    duration_seconds?: number;
    is_live?: boolean;
  };
}

interface MusicSong {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  tuning?: TuningType;
  duration_seconds?: number;
}

interface SetlistDetailPageProps {
  params: { id: string };
}

function formatDurationSummary(seconds: number): string {
  if (seconds === 0) return 'TBD';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

export default function SetlistDetailPage({ params }: SetlistDetailPageProps) {
  const router = useRouter();
  const { currentBand } = useBands();
  const { showToast } = useToast();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setlistName, setSetlistName] = useState('');
  const [originalSetlistName, setOriginalSetlistName] = useState('');
  const [songs, setSongs] = useState<SetlistSong[]>([]);
  const [originalSongs, setOriginalSongs] = useState<SetlistSong[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [providerImportOpen, setProviderImportOpen] = useState<'apple' | 'spotify' | 'amazon' | null>(null);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [tuningGroupMode, setTuningGroupMode] = useState<'none' | 'ascending' | 'descending'>('none');
  const [isProcessingGroupBy, setIsProcessingGroupBy] = useState(false);

  // Calculate totals from current songs
  const totals = {
    songCount: songs.length,
    totalDuration: songs.reduce((sum, song) => {
      const duration = song.duration_seconds ?? song.songs?.duration_seconds ?? 0;
      return sum + duration;
    }, 0)
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadSetlist = useCallback(async () => {
    if (!params.id || params.id === 'new' || !currentBand?.id) {
      console.log('SetlistDetail: Skipping load - missing params or band');
      return;
    }

    console.log('SetlistDetail: Loading setlist:', { setlistId: params.id, bandId: currentBand.id });
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/setlists/${params.id}?band_id=${currentBand.id}`);
      console.log('SetlistDetail: API response status:', response.status);
      
      const data = await response.json();
      console.log('SetlistDetail: API response data:', data);
      console.log('SetlistDetail: Setlist info:', {
        id: data.setlist?.id,
        name: data.setlist?.name,
        band_id: data.setlist?.band_id,
        setlist_type: data.setlist?.setlist_type
      });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load setlist');
      }

      setSetlist(data.setlist);
      setSetlistName(data.setlist.name);
      setOriginalSetlistName(data.setlist.name);

      // Validation check: ensure URL matches loaded setlist
      if (params.id !== data.setlist.id) {
        console.error('URL/setlist ID mismatch:', { urlId: params.id, setlistId: data.setlist.id });
        // Redirect to correct URL
        router.replace(`/setlists/${data.setlist.id}`);
        return;
      }

      setSongs(data.setlist.setlist_songs || []);
      setOriginalSongs(data.setlist.setlist_songs || []);
    } catch (err) {
      console.error('Error loading setlist:', err);
      
      // If this is an "All Songs" setlist that can't be found, try to find the correct one
      if (err instanceof Error && err.message.includes('not found') && 
          (params.id.includes('all') || err.message.includes('All Songs'))) {
        console.log('Attempting to find correct All Songs setlist...');
        try {
          // Fetch all setlists to find the correct "All Songs" ID
          const response = await fetch(`/api/setlists?band_id=${currentBand.id}`);
          const data = await response.json();
          if (response.ok && data.setlists) {
            const allSongsSetlist = data.setlists.find((s: any) => 
              s.setlist_type === 'all_songs' || s.name === 'All Songs'
            );
            if (allSongsSetlist && allSongsSetlist.id !== params.id) {
              console.log('Found correct All Songs setlist, redirecting:', allSongsSetlist.id);
              router.replace(`/setlists/${allSongsSetlist.id}`);
              return;
            }
          }
        } catch (redirectErr) {
          console.error('Failed to find correct All Songs setlist:', redirectErr);
        }
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load setlist');
    } finally {
      setLoading(false);
    }
  }, [params.id, currentBand?.id]);

  useEffect(() => {
    if (params.id === 'new') {
      // New setlist mode - start in edit mode
      setSetlist(null);
      setSetlistName('New Setlist');
      setSongs([]);
      setIsEditMode(true);
      setLoading(false);
      setSearchOpen(true); // Focus search by default for new setlists
    } else {
      // Existing setlist - start in view mode
      console.log('SetlistDetail: Loading setlist with ID:', params.id);
      setIsEditMode(false);
      loadSetlist();
    }
  }, [loadSetlist, params.id]);

  const handleSaveSetlist = async () => {
    if (!currentBand?.id || !setlistName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      let setlistId = params.id;

      // Create setlist if it's new
      if (params.id === 'new') {
        const createResponse = await fetch('/api/setlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            band_id: currentBand.id,
            name: setlistName,
          }),
        });

        const createData = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(createData.error || 'Failed to create setlist');
        }

        setlistId = createData.setlist.id;
        setSetlist(createData.setlist);

        // Update URL to reflect the new setlist ID
        router.replace(`/setlists/${setlistId}`);
      } else {
        // Update existing setlist name
        const updateResponse = await fetch(`/api/setlists/${setlistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: setlistName, band_id: currentBand.id }),
        });

        const updateData = await updateResponse.json();
        if (!updateResponse.ok) {
          throw new Error(updateData.error || 'Failed to update setlist');
        }
      }

      // Update song positions if there are songs
      if (songs.length > 0) {
        console.log('[Frontend] Sending songs to API:', songs);
        console.log('[Frontend] Songs count:', songs.length);
        console.log('[Frontend] First song structure:', songs[0]);
        
        // First try debug endpoint to see what's happening
        try {
          const debugResponse = await fetch(`/api/setlists/${setlistId}/songs/debug`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs }),
          });
          
          const debugData = await debugResponse.json();
          console.log('[Frontend] Debug response:', debugData);
        } catch (debugError) {
          console.log('[Frontend] Debug endpoint error:', debugError);
        }
        
        const updateSongsResponse = await fetch(`/api/setlists/${setlistId}/songs`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songs }),
        });

        console.log('[Frontend] PUT response status:', updateSongsResponse.status);
        
        if (!updateSongsResponse.ok) {
          const errorData = await updateSongsResponse.json();
          console.log('[Frontend] PUT response error:', errorData);
          throw new Error(errorData.error || 'Failed to update song positions');
        } else {
          console.log('[Frontend] PUT response success');
        }
      }

      // Reload setlist data to get updated totals
      if (setlistId !== 'new') {
        await loadSetlist();
        // Exit edit mode after successful save
        setIsEditMode(false);
        setTuningGroupMode('none');
      }
    } catch (err) {
      console.error('Error saving setlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to save setlist');
    } finally {
      setSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = () => {
    if (setlistName !== originalSetlistName) return true;
    if (songs.length !== originalSongs.length) return true;

    // Check if song order or properties changed
    return JSON.stringify(songs) !== JSON.stringify(originalSongs);
  };

  const confirmDeleteSetlist = async (setlistId: string) => {
    if (!setlist?.id || !currentBand?.id) return;

    const result = await deleteSetlist(setlistId);

    if (result.success) {
      setShowDeleteDialog(false);
      showToast('Setlist deleted', 'success');
      router.push('/setlists');
    } else {
      const error = result.error!;
      console.error('Error deleting setlist:', error);
      
      // Show appropriate error message
      let errorMessage = error.message;
      if (error.isRLSIssue) {
        errorMessage = "You don't have permission to delete this setlist";
      } else if (error.status >= 500) {
        errorMessage = 'Server error occurred. Please try again.';
      }
      
      showToast(errorMessage, 'error');
      // Keep dialog open for retry
    }
  };

  const handleAddSong = async (song: MusicSong) => {
    if (!currentBand?.id) return;

    try {
      const setlistId = setlist?.id || params.id;
      
      // Defensive check: if setlist ID doesn't match current setlist data, reload
      if (setlist && setlistId !== setlist.id) {
        console.warn('Setlist ID mismatch detected, reloading setlist data');
        await loadSetlist();
        return; // Exit and let user try again with correct data
      }
      
      if (setlistId === 'new') {
        // For new setlists, just add to local state
        const newSetlistSong: SetlistSong = {
          id: `temp-${Date.now()}`, // Temporary ID for new setlists
          setlist_id: 'new',
          song_id: song.id,
          position: songs.length + 1,
          bpm: song.bpm,
          tuning: song.tuning || 'standard',
          duration_seconds: song.duration_seconds,
          songs: song
        };
        setSongs(prev => [...prev, newSetlistSong]);
      } else {
        // Add to existing setlist
        const response = await fetch(`/api/setlists/${setlistId}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            song_id: song.id,
            bpm: song.bpm,
            tuning: song.tuning || 'standard',
            duration_seconds: song.duration_seconds,
          }),
        });

        console.log('Song addition response status:', response.status);
        const data = await response.json();
        console.log('Song addition response data:', data);
        if (data.debug) {
          console.log('Song addition debug details:', JSON.stringify(data.debug, null, 2));
        }
        
        if (!response.ok) {
          if (data.code === 'DUPLICATE_SONG') {
            setError(`"${song.title}" is already in this setlist`);
            return; // Don't throw, just return early
          }
          throw new Error(data.error || 'Failed to add song');
        }

        setSongs(prev => [...prev, data.setlist_song]);
      }

      setSearchOpen(false);
    } catch (err) {
      console.error('Error adding song:', err);
      setError(err instanceof Error ? err.message : 'Failed to add song');
    }
  };

  const handleBulkAddSongs = async (songsToAdd: MusicSong[]) => {
    if (!currentBand?.id || songsToAdd.length === 0) return;

    try {
      const setlistId = setlist?.id || params.id;
      const newSetlistSongs: SetlistSong[] = [];

      for (let i = 0; i < songsToAdd.length; i++) {
        const song = songsToAdd[i];
        
        // If the song doesn't have an ID, create it first
        let songToAdd = song;
        if (!song.id) {
          const response = await fetch('/api/songs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(song),
          });

          const data = await response.json();
          if (!response.ok) {
            console.error(`Failed to create song: ${song.title}`, data.error);
            continue; // Skip this song and continue with others
          }

          songToAdd = data.song;
        }

        if (setlistId === 'new') {
          // For new setlists, just add to local state
          const newSetlistSong: SetlistSong = {
            id: `temp-${Date.now()}-${i}`, // Temporary ID for new setlists
            setlist_id: 'new',
            song_id: songToAdd.id,
            position: songs.length + newSetlistSongs.length + 1,
            bpm: songToAdd.bpm,
            tuning: songToAdd.tuning || 'standard',
            duration_seconds: songToAdd.duration_seconds,
            songs: songToAdd
          };
          newSetlistSongs.push(newSetlistSong);
        } else {
          // Add to existing setlist
          const response = await fetch(`/api/setlists/${setlistId}/songs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              song_id: songToAdd.id,
              bpm: songToAdd.bpm,
              tuning: songToAdd.tuning || 'standard',
              duration_seconds: songToAdd.duration_seconds,
            }),
          });

          console.log('Bulk song addition response status:', response.status);
          const data = await response.json();
          console.log('Bulk song addition response data:', data);
          if (data.debug) {
            console.log('Bulk song addition debug details:', JSON.stringify(data.debug, null, 2));
          }
          
          if (!response.ok) {
            if (data.code !== 'DUPLICATE_SONG') {
              console.error(`Failed to add song to setlist: ${songToAdd.title}`, data.error);
            }
            // Skip duplicate songs silently in bulk operations
            continue; // Skip this song and continue with others
          }

          newSetlistSongs.push(data.setlist_song);
        }
      }

      if (newSetlistSongs.length > 0) {
        setSongs(prev => [...prev, ...newSetlistSongs]);
      }

      if (newSetlistSongs.length !== songsToAdd.length) {
        setError(`Added ${newSetlistSongs.length} of ${songsToAdd.length} songs. Some songs failed to import.`);
      }
    } catch (err) {
      console.error('Error bulk adding songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to add songs');
    }
  };

  const handleRemoveSong = async (songId: string): Promise<boolean> => {
    const setlistId = setlist?.id || params.id;
    const songToRemove = songs.find(song => song.id === songId);
    
    if (!songToRemove) {
      showToast('Song not found', 'error');
      return false;
    }

    // Optimistic UI: Remove immediately
    setSongs(prev => prev.filter(song => song.id !== songId));

    // For new setlists, no server call needed
    if (setlistId === 'new') {
      showToast(`Removed "${songToRemove.songs?.title || 'song'}" from setlist`, 'success');
      return true;
    }

    try {
      // Use the new helper function with proper validation
      const result = await deleteSetlistSong(songId, setlistId);
      
      if (result.success) {
        showToast(`Removed "${songToRemove.songs?.title || 'song'}" from setlist`, 'success');
        return true;
      } else {
        // Handle detailed error responses
        const { error } = result;
        let errorMessage = error?.message || 'Unknown error';
        
        if (error?.isRLSIssue) {
          errorMessage = `Permission denied (${error.status}): ${error.message}. Check RLS policies.`;
        } else if (error?.status) {
          errorMessage = `Delete failed (${error.status}): ${error.message}`;
          if (error.code) {
            errorMessage += ` [${error.code}]`;
          }
        }

        // Restore the song on error
        setSongs(prev => {
          const restored = [...prev, songToRemove].sort((a, b) => a.position - b.position);
          return restored;
        });

        showToast(errorMessage, 'error');
        return false;
      }
    } catch (err) {
      console.error('Exception in handleRemoveSong:', err);
      
      // Restore the song on exception
      setSongs(prev => {
        const restored = [...prev, songToRemove].sort((a, b) => a.position - b.position);
        return restored;
      });

      showToast(
        `Failed to remove song: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
      return false;
    }
  };

  const handleUpdateSong = async (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => {
    try {
      console.log('handleUpdateSong called:', { songId, updates });
      const setlistId = setlist?.id || params.id;
      console.log('Setlist ID for update:', setlistId);

      if (setlistId !== 'new') {
        console.log('Making API call to update song');
        const response = await fetch(`/api/setlists/${setlistId}/songs/${songId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        console.log('API response status:', response.status);
        if (!response.ok) {
          const data = await response.json();
          console.error('API error response:', data);
          throw new Error(data.error || 'Failed to update song');
        }

        const responseData = await response.json();
        console.log('API success response:', responseData);
      }

      setSongs(prev => prev.map(song =>
        song.id === songId ? { ...song, ...updates } : song
      ));
      console.log('Updated songs state with:', updates);
    } catch (err) {
      console.error('Error updating song:', err);
      setError(err instanceof Error ? err.message : 'Failed to update song');
    }
  };

  const handleBulkRemoveSongs = async (songIds: string[]): Promise<void> => {
    const setlistId = setlist?.id || params.id;
    const songsToRemove = songs.filter(song => songIds.includes(song.id));
    
    if (songsToRemove.length === 0) {
      showToast('No songs to remove', 'error');
      return;
    }

    // Optimistic UI: Remove immediately
    setSongs(prev => prev.filter(song => !songIds.includes(song.id)));

    // For new setlists, no server call needed
    if (setlistId === 'new') {
      showToast(`Removed ${songsToRemove.length} song${songsToRemove.length === 1 ? '' : 's'} from setlist`, 'success');
      return;
    }

    try {
      const response = await fetch(`/api/setlists/${setlistId}/songs/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete songs');
      }

      showToast(`Removed ${songsToRemove.length} song${songsToRemove.length === 1 ? '' : 's'} from setlist`, 'success');
    } catch (err) {
      console.error('Error bulk removing songs:', err);
      
      // Restore the songs on error
      setSongs(prev => {
        const restored = [...prev, ...songsToRemove].sort((a, b) => a.position - b.position);
        return restored;
      });

      showToast(
        `Failed to remove songs: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
      throw err; // Re-throw so caller can handle
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldSongs = songs;
      
      // Optimistically update UI
      setSongs(prev => {
        const oldIndex = prev.findIndex(song => song.id === active.id);
        const newIndex = prev.findIndex(song => song.id === over.id);

        if (oldIndex === -1 || newIndex === -1) {
          return prev;
        }

        const newSongs = arrayMove(prev, oldIndex, newIndex);

        // Update positions
        return newSongs.map((song, index) => ({
          ...song,
          position: index + 1,
        }));
      });

      // Save reorder to backend immediately
      try {
        const newSongs = arrayMove(oldSongs, 
          oldSongs.findIndex(song => song.id === active.id),
          oldSongs.findIndex(song => song.id === over.id)
        ).map((song, index) => ({
          ...song,
          position: index + 1,
        }));

        const response = await fetch(`/api/setlists/${params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songs: newSongs.map(song => ({
              id: song.id,
              position: song.position,
              bpm: song.bpm,
              tuning: song.tuning,
              duration_seconds: song.duration_seconds,
            })),
            band_id: currentBand?.id,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save reorder');
        }

        showToast('Song order updated', 'success');
      } catch (err) {
        console.error('Error saving reorder:', err);
        // Revert on error
        setSongs(oldSongs);
        showToast('Failed to save song order', 'error');
      }
    }
  };

  const handleGroupByTuning = useCallback(async () => {
    setIsProcessingGroupBy(true);
    
    // Cycle through grouping modes: none -> ascending -> descending -> none
    const nextMode = tuningGroupMode === 'none' ? 'ascending' 
                   : tuningGroupMode === 'ascending' ? 'descending' 
                   : 'none';
    
    setTuningGroupMode(nextMode);

    if (nextMode === 'none') {
      // Reset to original order
      setSongs(prev => [...prev].sort((a, b) => a.position - b.position));
      // Use a small timeout to ensure state update completes
      setTimeout(() => setIsProcessingGroupBy(false), 50);
      return;
    }

    // Define logical tuning order for guitarists
    const tuningOrder: Record<string, number> = {
      // Most practical order: Standard → Drop D → Half Step → Full Step → other drops → open tunings
      'standard': 1,
      'drop_d': 2,
      'half_step': 3,
      'full_step': 4,
      'drop_c': 5,
      'drop_b': 6,
      'dadgad': 7,
      'open_g': 8,
      'open_d': 9,
      'open_e': 10,
    };

    // Group songs by tuning based on logical order
    setSongs(prev => {
      const sorted = [...prev].sort((a, b) => {
        const tuningA = a.tuning || a.songs?.tuning || 'standard';
        const tuningB = b.tuning || b.songs?.tuning || 'standard';
        
        const orderA = tuningOrder[tuningA] || 99; // Unknown tunings go to end
        const orderB = tuningOrder[tuningB] || 99;
        
        // Sort by tuning order (ascending = standard first, descending = open tunings first)
        if (nextMode === 'ascending') {
          if (orderA !== orderB) {
            return orderA - orderB; // Lower order = comes first
          }
        } else {
          if (orderA !== orderB) {
            return orderB - orderA; // Higher order = comes first (reversed)
          }
        }
        
        // If same tuning, maintain relative order by position
        return a.position - b.position;
      });

      // Update positions to reflect new order
      return sorted.map((song, index) => ({
        ...song,
        position: index + 1,
      }));
    });
    
    // Use a small timeout to ensure state update completes
    setTimeout(() => setIsProcessingGroupBy(false), 50);
  }, [tuningGroupMode]);

  const handleShare = useCallback(async () => {
    if (!setlist) return;
    
    // Prepare share data
    const shareData = {
      name: setlist.name,
      songs: songs.map(song => ({
        title: song.songs?.title || 'Unknown Song',
        artist: song.songs?.artist || 'Unknown Artist',
        tuning: song.tuning || song.songs?.tuning,
        durationSec: song.duration_seconds || song.songs?.duration_seconds,
        bpm: song.bpm || song.songs?.bpm
      }))
    };
    
    const shareText = buildShareText(shareData);
    
    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: setlist.name,
          text: shareText
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
        console.log('Share cancelled or failed:', err);
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      showToast('Setlist copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      showToast('Failed to share setlist', 'error');
    }
  }, [setlist, songs, showToast]);

  if (loading) {
    return (
      <main className="bg-background text-foreground">
        <div className="px-4 pb-8 pt-21">
          <div className="flex items-center justify-center min-h-[50vh]">
            <LoadingSpinner />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground">
      <div className={`px-4 ${isEditMode ? 'pb-40' : 'pb-8'}`}>
        {/* Back Button - 20px from bottom of topnav */}
        <div className="pt-21 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/setlists')}
            className="gap-2 -ml-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Page Title */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isEditMode && setlist?.setlist_type !== 'all_songs' && setlist?.name !== 'All Songs' ? (
              <Input
                value={setlistName}
                onChange={(e) => setSetlistName(capitalizeWords(e.target.value))}
                className="text-2xl font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0"
                placeholder="Setlist name"
              />
            ) : (
              <div>
                <h1 className="text-2xl font-bold">{setlistName}</h1>
                {(setlist?.setlist_type === 'all_songs' || setlist?.name === 'All Songs') && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Auto-managed catalog
                  </div>
                )}
              </div>
            )}
            
            {/* Totals Display - directly under title */}
            <div className="flex items-center gap-4 mt-2 text-lg text-muted-foreground font-medium">
              <div className="flex items-center gap-1">
                <span>{totals.songCount} songs</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{formatDurationSummary(totals.totalDuration)}</span>
              </div>
            </div>
          </div>

          {setlist && !isEditMode && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-2"
                disabled={loading}
                aria-label="Share setlist"
                title="Share"
              >
                <Share className="h-4 w-4" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
          )}

          {isEditMode && setlist && (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditMode(false);
                  // Reset to original values if canceling
                  setSetlistName(originalSetlistName);
                  setSongs([...originalSongs]);
                  setTuningGroupMode('none');
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              
              {/* Group by Tuning button - only for regular setlists */}
              {setlist?.setlist_type !== 'all_songs' && setlist?.name !== 'All Songs' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGroupByTuning}
                  disabled={isProcessingGroupBy}
                  className="gap-2 justify-start"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span>
                    {isProcessingGroupBy ? 'Processing...' : 
                     tuningGroupMode === 'none' ? 'Group by Tuning' :
                     tuningGroupMode === 'ascending' ? 'Group by Tuning (Standard →)' :
                     'Group by Tuning (Half Step →)'}
                  </span>
                </Button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <p>{error}</p>
          </div>
        )}

        {/* Song Import Actions - only in edit mode */}
        {isEditMode && (
          <div className="mb-6">
            {(setlist?.setlist_type === 'all_songs' || setlist?.name === 'All Songs') && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-rose-900 mb-1">
                      Master Catalog Editor
                    </h4>
                    <p className="text-sm text-rose-800 mb-2">
                      This is your complete song catalog. Songs added here are available to all your setlists. 
                      Removing songs from here won't affect your other setlists.
                    </p>
                    <p className="text-xs text-rose-700">
                      💡 Add songs to any other setlist and they'll automatically appear here too!
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <SetlistImportRow
              onSongLookup={() => setSearchOpen(true)}
              onBulkPaste={() => setBulkPasteOpen(true)}
              onSpotify={() => setProviderImportOpen('spotify')}
              onAppleMusic={() => setProviderImportOpen('apple')}
              onAmazonMusic={() => setProviderImportOpen('amazon')}
            />
          </div>
        )}

        {/* Songs list */}
        {songs.length === 0 ? (
          <div className="text-center py-12">
            <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            {(setlist?.setlist_type === 'all_songs' || setlist?.name === 'All Songs') ? (
              <>
                <h3 className="text-lg font-medium mb-2">Your band catalog is empty</h3>
                <p className="text-muted-foreground mb-4">
                  This is your master catalog. Songs added to any other setlist will automatically appear here.
                  You can also add songs directly to build your complete repertoire.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">No songs in this setlist</h3>
                <p className="text-muted-foreground mb-4">
                  Search and add songs to build your setlist
                </p>
              </>
            )}
            {isEditMode && (
              <Button onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="h-4 w-4" />
                {(setlist?.setlist_type === 'all_songs' || setlist?.name === 'All Songs') 
                  ? 'Add Your First Song to Catalog' 
                  : 'Add Your First Song'
                }
              </Button>
            )}
          </div>
        ) : (
          // Use AllSongsEditor for "All Songs" setlists, regular editor for others
          (setlist?.setlist_type === 'all_songs' || setlist?.name === 'All Songs') ? (
            <AllSongsEditor
              songs={songs}
              setlistId={params.id}
              onUpdate={handleUpdateSong}
              onRemove={handleRemoveSong}
              onBulkRemove={handleBulkRemoveSongs}
              isEditMode={isEditMode}
            />
          ) : (
            isEditMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {songs.map((song) => (
                      <SetlistSongRow
                        key={song.id}
                        setlistSong={song}
                        setlistId={params.id}
                        onUpdate={handleUpdateSong}
                        onRemove={handleRemoveSong}
                        isEditMode={isEditMode}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-3">
                {songs.map((song) => (
                  <SetlistSongRow
                    key={song.id}
                    setlistSong={song}
                    setlistId={params.id}
                    onUpdate={handleUpdateSong}
                    onRemove={handleRemoveSong}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            )
          )
        )}


      </div>

      {/* Fixed Bottom Buttons - only in edit mode */}
      {isEditMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-xl p-4 pb-24">
          <div className="flex flex-col gap-3 max-w-4xl mx-auto">
            <Button
              onClick={handleSaveSetlist}
              disabled={saving || isProcessingGroupBy || !setlistName.trim() || !hasChanges()}
              className="w-full"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : isProcessingGroupBy ? 'Processing...' : 'Save Changes'}
            </Button>

            {setlist && setlist.setlist_type !== 'all_songs' && setlist.name !== 'All Songs' && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                size="lg"
              >
                Delete Setlist
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Song Search Overlay */}
      <SongSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectSong={handleAddSong}
        bandId={currentBand?.id}
      />

      {/* Provider Import Drawer */}
      <ProviderImportDrawer
        open={!!providerImportOpen}
        provider={providerImportOpen}
        onClose={() => setProviderImportOpen(null)}
        onImportSongs={handleBulkAddSongs}
      />

      {/* Bulk Paste Drawer */}
      <BulkPasteDrawer
        open={bulkPasteOpen}
        onClose={() => setBulkPasteOpen(false)}
        onImportSongs={handleBulkAddSongs}
        existingSongs={songs.map(s => s.songs).filter(Boolean) as MusicSong[]}
      />

      {/* Delete Confirmation Dialog */}
      {setlist && (
        <ConfirmDeleteSetlistDialog
          open={showDeleteDialog}
          setOpen={setShowDeleteDialog}
          setlistId={setlist.id}
          setlistName={setlist.name}
          songCount={totals.songCount}
          onConfirm={confirmDeleteSetlist}
        />
      )}
    </main>
  );
}