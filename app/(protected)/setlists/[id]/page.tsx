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
import { Dialog } from '@/components/ui/Dialog';
import { SetlistSongRow } from '@/components/setlists/SetlistSongRow';
import { ArrowLeft, Search, Save, Plus, Edit, X, ClipboardList } from 'lucide-react';
import { capitalizeWords } from '@/lib/utils/formatters';
import { AppleMusicIcon, SpotifyIcon, AmazonMusicIcon } from '@/components/icons/ProviderIcons';

// Dynamic imports for performance optimization
const SongSearchOverlay = lazy(() => import('@/components/setlists/OptimizedSongSearchOverlay'));
import { ProviderImportDrawer } from '@/components/setlists/ProviderImportDrawer';
import { BulkPasteDrawer } from '@/components/setlists/BulkPasteDrawer';

// Define types based on actual API usage
type TuningType = 'standard' | 'drop_d' | 'half_step' | 'full_step';

interface Setlist {
  id: string;
  band_id: string;
  name: string;
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

function formatDuration(seconds: number): string {
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
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/setlists/${params.id}?band_id=${currentBand.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load setlist');
      }

      setSetlist(data.setlist);
      setSetlistName(data.setlist.name);
      setOriginalSetlistName(data.setlist.name);



      setSongs(data.setlist.setlist_songs || []);
      setOriginalSongs(data.setlist.setlist_songs || []);
    } catch (err) {
      console.error('Error loading setlist:', err);
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
        const updateSongsResponse = await fetch(`/api/setlists/${setlistId}/songs`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songs }),
        });

        if (!updateSongsResponse.ok) {
          const errorData = await updateSongsResponse.json();
          throw new Error(errorData.error || 'Failed to update song positions');
        }
      }

      // Reload setlist data to get updated totals
      if (setlistId !== 'new') {
        await loadSetlist();
        // Exit edit mode after successful save
        setIsEditMode(false);
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

  const handleDeleteSetlist = async () => {
    if (!setlist?.id || !currentBand?.id) return;
    setShowDeleteDialog(false);

    try {
      const response = await fetch(`/api/setlists/${setlist.id}?band_id=${currentBand.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete setlist');
      }

      router.push('/setlists');
    } catch (err) {
      console.error('Error deleting setlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete setlist');
    }
  };

  const handleAddSong = async (song: MusicSong) => {
    if (!currentBand?.id) return;

    try {
      const setlistId = setlist?.id || params.id;
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

        const data = await response.json();
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

          const data = await response.json();
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

  const handleRemoveSong = async (songId: string) => {
    try {
      const setlistId = setlist?.id || params.id;

      if (setlistId !== 'new') {
        const response = await fetch(`/api/setlists/${setlistId}/songs/${songId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove song');
        }
      }

      setSongs(prev => prev.filter(song => song.id !== songId));
    } catch (err) {
      console.error('Error removing song:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove song');
    }
  };

  const handleUpdateSong = async (songId: string, updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }) => {
    try {
      const setlistId = setlist?.id || params.id;

      if (setlistId !== 'new') {
        const response = await fetch(`/api/setlists/${setlistId}/songs/${songId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update song');
        }
      }

      setSongs(prev => prev.map(song =>
        song.id === songId ? { ...song, ...updates } : song
      ));
    } catch (err) {
      console.error('Error updating song:', err);
      setError(err instanceof Error ? err.message : 'Failed to update song');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
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
    }
  };

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
            {isEditMode ? (
              <Input
                value={setlistName}
                onChange={(e) => setSetlistName(capitalizeWords(e.target.value))}
                className="text-2xl font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0"
                placeholder="Setlist name"
              />
            ) : (
              <h1 className="text-2xl font-bold">{setlistName}</h1>
            )}
            
            {/* Totals Display - directly under title */}
            <div className="flex items-center gap-4 mt-2 text-lg text-muted-foreground font-medium">
              <div className="flex items-center gap-1">
                <span>{totals.songCount} songs</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{formatDuration(totals.totalDuration)}</span>
              </div>
            </div>
          </div>

          {setlist && !isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(true)}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}

          {isEditMode && setlist && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditMode(false);
                // Reset to original values if canceling
                setSetlistName(originalSetlistName);
                setSongs([...originalSongs]);
              }}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>

        {/* Setlist Summary - only in view mode */}
        {!isEditMode && setlist && songs.length > 0 && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{songs.length} songs</span>
                <span>
                  {Math.floor((setlist.total_duration || 0) / 60)}m {(setlist.total_duration || 0) % 60}s total
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <p>{error}</p>
          </div>
        )}

        {/* Song Action Buttons - only in edit mode */}
        {isEditMode && (
          <div className="mb-6 space-y-4">
            {/* 1. Song Actions Row - Song Lookup and Bulk Paste */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setSearchOpen(true)}
                variant="outline"
                className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                size="lg"
                aria-label="Search and add songs to setlist"
              >
                <Search className="h-4 w-4" />
                Song Lookup
              </Button>
              
              <Button
                onClick={() => setBulkPasteOpen(true)}
                variant="outline"
                className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                size="lg"
                aria-label="Bulk paste songs from spreadsheet"
              >
                <ClipboardList className="h-4 w-4" />
                Bulk Paste
              </Button>
            </div>
            
            {/* 2. Provider Import Row - Three Equal-Width Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => setProviderImportOpen('spotify')}
                variant="outline"
                className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                aria-label="Import from Spotify"
              >
                <SpotifyIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Spotify</span>
              </Button>
              
              <Button
                onClick={() => setProviderImportOpen('apple')}
                variant="outline"
                className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                aria-label="Import from Apple Music"
              >
                <AppleMusicIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Apple Music</span>
              </Button>
              
              <Button
                onClick={() => setProviderImportOpen('amazon')}
                variant="outline"
                className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                aria-label="Import from Amazon Music"
              >
                <AmazonMusicIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Amazon</span>
              </Button>
            </div>
          </div>
        )}

        {/* Songs list */}
        {songs.length === 0 ? (
          <div className="text-center py-12">
            <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No songs in this setlist</h3>
            <p className="text-muted-foreground mb-4">
              Search and add songs to build your setlist
            </p>
            {isEditMode && (
              <Button onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="h-4 w-4" />
                Add Your First Song
              </Button>
            )}
          </div>
        ) : (
          isEditMode ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
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
            <div className="space-y-0">
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
        )}


      </div>

      {/* Fixed Bottom Buttons - only in edit mode */}
      {isEditMode && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-background/95 backdrop-blur-xl p-4 pb-24">
          <div className="flex flex-col gap-3 max-w-4xl mx-auto">
            <Button
              onClick={handleSaveSetlist}
              disabled={saving || !setlistName.trim() || !hasChanges()}
              className="w-full"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            {setlist && (
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
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Setlist"
      >
        <div className="space-y-4">
          <p>Are you sure you want to delete this setlist? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSetlist}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}