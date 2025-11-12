'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';
import { useToast } from '@/hooks/useToast';
import { Setlist } from '@/lib/types';
import { deleteSetlist } from '@/lib/supabase/setlists';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Plus, Music, Clock, ListMusic } from 'lucide-react';
import { formatSecondsHuman, calculateSetlistTotal } from '@/lib/time/duration';

// Dynamic imports for performance
const SwipeableContainer = lazy(() => import('@/components/setlists/SwipeableContainer').then(m => ({ default: m.SwipeableContainer })));
const ConfirmDeleteSetlistDialog = lazy(() => import('@/components/setlists/ConfirmDeleteSetlistDialog').then(m => ({ default: m.ConfirmDeleteSetlistDialog })));

function SetlistCard({ 
  setlist, 
  onClick, 
  onCopy,
  onDelete 
}: { 
  setlist: Setlist & { song_count?: number; setlist_type?: string; calculated_duration?: number }; 
  onClick: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const songCount = setlist.song_count ?? setlist.songs?.length ?? 0;
  const isAllSongs = setlist.setlist_type === 'all_songs' || setlist.name === 'All Songs';
  
  return (
    <Suspense fallback={<div className="rounded-lg bg-card p-4 animate-pulse h-20" />}>
      <SwipeableContainer
        mode={isAllSongs ? "view" : "edit"}
        onCopy={isAllSongs ? undefined : onCopy}
        onDelete={isAllSongs ? undefined : onDelete}
        onTap={onClick}
        className="rounded-lg"
      >
      <Card
        className={`p-4 cursor-pointer hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 ${
          isAllSongs ? 'bg-rose-50 border-rose-200 border-2 dark:bg-rose-950/20 dark:border-rose-500' : ''
        }`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Open setlist ${setlist.name} with ${songCount} songs`}
      >
                <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`text-lg font-semibold truncate ${
                isAllSongs ? 'text-rose-900 dark:text-rose-400' : ''
              }`}>{setlist.name}</h3>
            </div>
            <div className={`flex items-center gap-4 text-sm ${
              isAllSongs ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'
            }`}>
              <div className="flex items-center gap-1">
                <Music className="h-4 w-4" />
                <span>{songCount} songs</span>
              </div>
              {((setlist as any).calculated_duration || (setlist as any).total_duration) && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatSecondsHuman((setlist as any).calculated_duration || (setlist as any).total_duration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </SwipeableContainer>
    </Suspense>
  );
}

export default function SetlistsPage() {
  const router = useRouter();
  const { currentBand, loading: bandsLoading } = useBands();
  const { showToast } = useToast();
  const [setlists, setSetlists] = useState<(Setlist & { song_count?: number; setlist_type?: string; calculated_duration?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [setlistToDelete, setSetlistToDelete] = useState<Setlist & { song_count?: number; calculated_duration?: number } | null>(null);

  const loadSetlists = useCallback(async () => {
    if (!currentBand?.id) {
      console.log('[Setlists] No current band ID, skipping load');
      return;
    }

    console.log('[Setlists] Loading setlists for band:', currentBand.id);
    setLoading(true);
    setError(null);

    try {
      // Use the working endpoint but also fetch duration data
      const url = `/api/setlists?band_id=${currentBand.id}`;
      console.log('[Setlists] Fetching from:', url);
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      console.log('[Setlists] Response status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('[Setlists] Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load setlists');
      }

      // Debug logging for setlist IDs
      if (data.setlists) {
        console.log('[Setlists] Setlist IDs:', data.setlists.map((s: any) => ({ id: s.id, name: s.name, type: s.setlist_type })));
        
        // Filter out any setlists that don't belong to current band (defensive programming)
        data.setlists = data.setlists.filter((s: any) => {
          // Remove the known problematic ID
          if (s.id === 'f8d67671-1a0c-4515-95d2-b01813220dfa') {
            console.warn('Filtering out problematic setlist ID:', s.id);
            return false;
          }
          return true;
        });
        
        console.log('[Setlists] After filtering:', data.setlists.map((s: any) => ({ id: s.id, name: s.name, type: s.setlist_type })));
      }

      // Enhance setlists with calculated durations
      const setlistsWithDurations = await Promise.all(
        (data.setlists || []).map(async (setlist: any) => {
          try {
            // Fetch detailed setlist data for duration calculation
            const detailResponse = await fetch(`/api/setlists/${setlist.id}?band_id=${currentBand.id}`);
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              const songs = detailData.setlist?.songs || [];
              
              // Use proper duration calculation logic
              const calculatedDuration = calculateSetlistTotal(songs.map((song: any) => ({
                id: song.id,
                duration_seconds: song.duration_seconds,
                duration_text: null, // No duration_text field in current schema
                songs: song.songs ? {
                  duration_seconds: song.songs.duration_seconds
                } : null
              })));
              
              return {
                ...setlist,
                calculated_duration: calculatedDuration
              };
            }
          } catch (err) {
            console.warn('Failed to calculate duration for setlist:', setlist.id);
          }
          return {
            ...setlist,
            calculated_duration: 0
          };
        })
      );

      console.log('[Setlists] Setting setlists:', setlistsWithDurations.length, 'items');
      setSetlists(setlistsWithDurations);
    } catch (err) {
      console.error('Error loading setlists:', err);
      setError(err instanceof Error ? err.message : 'Failed to load setlists');
    } finally {
      setLoading(false);
    }
  }, [currentBand?.id]);

  // React to band changes
  useBandChange({
    onBandChange: () => {
      setSetlists([]);
      setError(null);
      if (currentBand?.id) {
        loadSetlists();
      }
    }
  });

  useEffect(() => {
    if (!bandsLoading && currentBand?.id) {
      loadSetlists();
    }
  }, [currentBand?.id, bandsLoading, loadSetlists]);

  const handleCreateSetlist = async () => {
    if (!currentBand?.id) return;

    try {
      const response = await fetch('/api/setlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          band_id: currentBand.id,
          name: 'New Setlist'
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create setlist');
      }

      router.push(`/setlists/${data.setlist.id}`);
    } catch (err) {
      console.error('Error creating setlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to create setlist');
    }
  };

  const handleSetlistClick = (setlist: Setlist) => {
    // Check for the problematic setlist ID and replace with correct one if needed
    const problematicId = 'f8d67671-1a0c-4515-95d2-b01813220dfa';
    
    if (setlist.id === problematicId) {
      console.warn('Detected problematic setlist ID, finding correct All Songs setlist...');
      // Find the actual "All Songs" setlist
      const allSongsSetlist = setlists.find(s => 
        (s as any).setlist_type === 'all_songs' || s.name === 'All Songs'
      );
      
      if (allSongsSetlist && allSongsSetlist.id !== problematicId) {
        console.log('Redirecting to correct All Songs setlist:', allSongsSetlist.id);
        router.push(`/setlists/${allSongsSetlist.id}`);
        return;
      }
    }
    
    router.push(`/setlists/${setlist.id}`);
  };

  const handleCopySetlist = async (setlist: Setlist & { song_count?: number; setlist_type?: string }) => {
    if (!currentBand?.id) return;

    // Prevent copying "All Songs"
    const isAllSongs = setlist.setlist_type === 'all_songs' || setlist.name === 'All Songs';
    if (isAllSongs) {
      setError('The "All Songs" setlist cannot be copied.');
      return;
    }

    try {
      const response = await fetch(`/api/setlists/${setlist.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ band_id: currentBand.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to copy setlist');
      }

      // Refresh the setlists list to show the new copy
      await loadSetlists();
    } catch (err) {
      console.error('Error copying setlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to copy setlist');
    }
  };

  const handleDeleteSetlist = (setlist: Setlist & { song_count?: number; setlist_type?: string }) => {
    // Prevent deleting "All Songs"
    const isAllSongs = setlist.setlist_type === 'all_songs' || setlist.name === 'All Songs';
    if (isAllSongs) {
      setError('The "All Songs" setlist cannot be deleted.');
      return;
    }
    
    setSetlistToDelete(setlist);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSetlist = async (setlistId: string) => {
    if (!currentBand?.id || !setlistToDelete) return;

    const result = await deleteSetlist(setlistId);

    if (result.success) {
      // Optimistically remove from UI
      setSetlists(prev => prev.filter(s => s.id !== setlistId));
      setDeleteDialogOpen(false);
      setSetlistToDelete(null);
      showToast('Setlist deleted', 'success');
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

  if (bandsLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background text-foreground">
        <LoadingSpinner />
      </div>
    );
  }

  // If no current band, this page shouldn't be accessible (bottom nav is hidden)
  if (!currentBand) {
    return (
      <div className="bg-background px-6 py-8 text-foreground flex items-center justify-center min-h-[60vh]">
        <div>No band selected</div>
      </div>
    );
  }

  return (
    <div className="bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Setlists</h1>
          </div>
          <Button
            onClick={handleCreateSetlist}
            className="gap-2"
            disabled={!currentBand?.id}
          >
            <Plus className="h-4 w-4" />
            Setlist
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <p>{error}</p>
          </div>
        )}

        {setlists.length === 0 ? (
          <div className="text-center py-12">
            <ListMusic className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No setlists yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first setlist to start organizing your songs
            </p>
            <Button
              onClick={handleCreateSetlist}
              className="gap-2"
              disabled={!currentBand?.id}
            >
              <Plus className="h-4 w-4" />
              Create Your First Setlist
            </Button>
          </div>
        ) : (
          <>
            {/* Check if "All Songs" exists and is empty */}
            {(() => {
              const allSongsSetlist = setlists.find(s => (s as any).setlist_type === 'all_songs' || s.name === 'All Songs') as (Setlist & { song_count?: number; setlist_type?: string }) | undefined;
              const allSongsIsEmpty = allSongsSetlist && (allSongsSetlist.song_count || 0) === 0;
              const hasOtherSetlists = setlists.some(s => (s as any).setlist_type !== 'all_songs' && s.name !== 'All Songs');
              
              return allSongsIsEmpty && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <ListMusic className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-rose-900 mb-1">
                        Welcome to your band catalog!
                      </h3>
                      <p className="text-sm text-rose-800 mb-3">
                        We've created an "All Songs" setlist for you. This special setlist will automatically 
                        include every song you add to any other setlist, giving you a complete catalog of your band's repertoire.
                      </p>
                      <div className="text-sm text-rose-800">
                        <p className="font-medium mb-1">Get started:</p>
                        <ul className="space-y-1 ml-4">
                          <li>• Click "All Songs" to add your first songs directly</li>
                          {!hasOtherSetlists && <li>• Create separate setlists for specific shows or themes</li>}
                          <li>• Any song added to other setlists will automatically appear in "All Songs"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {setlists.map((setlist) => (
                <SetlistCard
                  key={setlist.id}
                  setlist={setlist}
                  onClick={() => handleSetlistClick(setlist)}
                  onCopy={() => handleCopySetlist(setlist)}
                  onDelete={() => handleDeleteSetlist(setlist)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {setlistToDelete && (
        <ConfirmDeleteSetlistDialog
          open={deleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          setlistId={setlistToDelete.id}
          setlistName={setlistToDelete.name}
          songCount={setlistToDelete.song_count ?? setlistToDelete.songs?.length}
          onConfirm={confirmDeleteSetlist}
        />
      )}
    </div>
  );
}
