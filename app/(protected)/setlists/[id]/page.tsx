// app/(protected)/setlists/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useBands } from '@/contexts/BandsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Dialog } from '@/components/ui/Dialog';
import { SongRow } from '@/components/setlists/SongRow';
import { ArrowLeft, Search, Save, Plus, Edit, X } from 'lucide-react';

// Dynamic import with SSR disabled and safe default export resolution
const SongSearchOverlay = dynamic(
  () =>
    import('@/components/setlists/OptimizedSongSearchOverlay').then(
      (m) => m.default ?? (m as any)
    ),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
        <div className="rounded-md bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <LoadingSpinner />
            <span className="text-sm text-zinc-200">Loading search…</span>
          </div>
        </div>
      </div>
    ),
  }
);

type TuningType = 'standard' | 'drop_d' | 'half_step' | 'full_step';

interface Setlist {
  id: string;
  band_id: string;
  name: string;
  total_duration?: number;
  created_at: string;
  updated_at: string;
}

interface SetlistSong {
  id: string;
  setlist_id?: string;
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadSetlist = useCallback(async () => {
    if (!params.id || params.id === 'new') return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/setlists/${params.id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to load setlist');

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
  }, [params.id]);

  useEffect(() => {
    if (params.id === 'new') {
      setSetlist(null);
      setSetlistName('New Setlist');
      setSongs([]);
      setIsEditMode(true);
      setLoading(false);
      setSearchOpen(true);
    } else {
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

      if (params.id === 'new') {
        const createResponse = await fetch('/api/setlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ band_id: currentBand.id, name: setlistName }),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok) throw new Error(createData.error || 'Failed to create setlist');

        setlistId = createData.setlist.id;
        setSetlist(createData.setlist);
        router.replace(`/setlists/${setlistId}`);
      } else {
        const updateResponse = await fetch(`/api/setlists/${setlistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: setlistName }),
        });
        const updateData = await updateResponse.json();
        if (!updateResponse.ok) throw new Error(updateData.error || 'Failed to update setlist');
      }

      if (songs.length > 0) {
        const updateSongsResponse = await fetch(`/api/setlists/${setlistId}/songs`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ songs }),
        });

        if (!updateSongsResponse.ok) {
          const errorData = await updateSongsResponse.json();
          throw new Error(errorData.error || 'Failed to update song positions');
        }
      }

      if (setlistId !== 'new') {
        await loadSetlist();
        setIsEditMode(false);
      }
    } catch (err) {
      console.error('Error saving setlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to save setlist');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (setlistName !== originalSetlistName) return true;
    if (songs.length !== originalSongs.length) return true;
    return JSON.stringify(songs) !== JSON.stringify(originalSongs);
  };

  const handleDeleteSetlist = async () => {
    if (!setlist?.id) return;
    setShowDeleteDialog(false);

    try {
      const response = await fetch(`/api/setlists/${setlist.id}`, {
        method: 'DELETE',
        credentials: 'include',
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
        const newSetlistSong: SetlistSong = {
          id: `temp-${Date.now()}`,
          setlist_id: 'new',
          song_id: song.id,
          position: songs.length + 1,
          bpm: song.bpm,
          tuning: song.tuning || 'standard',
          duration_seconds: song.duration_seconds,
          songs: song,
        };
        setSongs((prev) => [...prev, newSetlistSong]);
      } else {
        const response = await fetch(`/api/setlists/${setlistId}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            song_id: song.id,
            bpm: song.bpm,
            tuning: song.tuning || 'standard',
            duration_seconds: song.duration_seconds,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add song');

        setSongs((prev) => [...prev, data.setlist_song]);
      }

      setSearchOpen(false);
    } catch (err) {
      console.error('Error adding song:', err);
      setError(err instanceof Error ? err.message : 'Failed to add song');
    }
  };

  const handleRemoveSong = async (songId: string) => {
    try {
      const setlistId = setlist?.id || params.id;

      if (setlistId !== 'new') {
        const response = await fetch(`/api/setlists/${setlistId}/songs/${songId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove song');
        }
      }

      setSongs((prev) => prev.filter((song) => song.id !== songId));
    } catch (err) {
      console.error('Error removing song:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove song');
    }
  };

  const handleUpdateSong = async (
    songId: string,
    updates: { bpm?: number; tuning?: TuningType; duration_seconds?: number }
  ) => {
    try {
      const setlistId = setlist?.id || params.id;

      if (setlistId !== 'new') {
        const response = await fetch(`/api/setlists/${setlistId}/songs/${songId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update song');
        }
      }

      setSongs((prev) => prev.map((song) => (song.id === songId ? { ...song, ...updates } : song)));
    } catch (err) {
      console.error('Error updating song:', err);
      setError(err instanceof Error ? err.message : 'Failed to update song');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSongs((prev) => {
        const oldIndex = prev.findIndex((song) => song.id === active.id);
        const newIndex = prev.findIndex((song) => song.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const newSongs = arrayMove(prev, oldIndex, newIndex);
        return newSongs.map((song, index) => ({ ...song, position: index + 1 }));
      });
    }
  };

  if (loading) {
    return (
      <main className="bg-background text-foreground">
        <div className="px-4 pb-8 pt-21">
          <div className="flex min-h-[50vh] items-center justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground">
      <div className="px-4 pb-8">
        {/* Back Button */}
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
          {isEditMode ? (
            <Input
              value={setlistName}
              onChange={(e) => setSetlistName(e.target.value)}
              className="h-auto border-none bg-transparent p-0 text-2xl font-bold focus-visible:ring-0"
              placeholder="Setlist name"
            />
          ) : (
            <h1 className="text-2xl font-bold">{setlistName}</h1>
          )}

          {setlist && !isEditMode && (
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="gap-2">
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

        {/* Summary (view mode) */}
        {!isEditMode && setlist && songs.length > 0 && (
          <div className="mb-6 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{songs.length} songs</span>
                <span>
                  {Math.floor((setlist.total_duration || 0) / 60)}m {(setlist.total_duration || 0) % 60}
                  s total
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
            <p>{error}</p>
          </div>
        )}

        {/* Add songs (edit mode) */}
        {isEditMode && (
          <div className="mb-6">
            <Button onClick={() => setSearchOpen(true)} variant="outline" className="w-full gap-2 sm:w-auto">
              <Search className="h-4 w-4" />
              Add Songs
            </Button>
          </div>
        )}

        {/* Song list */}
        {songs.length === 0 ? (
          <div className="py-12 text-center">
            <Plus className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No songs in this setlist</h3>
            <p className="mb-4 text-muted-foreground">Search and add songs to build your setlist</p>
            {isEditMode && (
              <Button onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="h-4 w-4" />
                Add Your First Song
              </Button>
            )}
          </div>
        ) : isEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {songs.map((song) => (
                  <SongRow
                    key={song.id}
                    setlistSong={song}
                    onUpdate={handleUpdateSong}
                    onRemove={handleRemoveSong}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2">
            {songs.map((song) => (
              <SongRow
                key={song.id}
                setlistSong={song}
                onUpdate={handleUpdateSong}
                onRemove={handleRemoveSong}
                isEditMode={isEditMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Buttons (edit mode) */}
      {isEditMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 p-4 pb-24 backdrop-blur-xl border-t border-border/60">
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            <Button
              onClick={handleSaveSetlist}
              disabled={saving || !setlistName.trim() || !hasChanges()}
              className="w-full"
              size="lg"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            {setlist && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                size="lg"
              >
                Delete Setlist
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Song Search Overlay (only mount when open) */}
      {searchOpen && (
        <SongSearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelectSong={handleAddSong}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} title="Delete Setlist">
        <div className="space-y-4">
          <p>Are you sure you want to delete this setlist? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSetlist}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}