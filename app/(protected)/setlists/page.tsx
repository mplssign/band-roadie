'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';
import { Setlist } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Plus, Music, Clock, ListMusic } from 'lucide-react';

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

function SetlistCard({ setlist, onClick }: { setlist: Setlist; onClick: () => void }) {
  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate mb-2">{setlist.name}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Music className="h-4 w-4" />
              <span>{setlist.songs?.length || 0} songs</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDuration((setlist as { total_duration?: number }).total_duration || 0)}</span>
            </div>
          </div>
        </div>
        <ListMusic className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}

export default function SetlistsPage() {
  const router = useRouter();
  const { currentBand, loading: bandsLoading } = useBands();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSetlists = useCallback(async () => {
    if (!currentBand?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/setlists?band_id=${currentBand.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load setlists');
      }

      setSetlists(data.setlists || []);
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
    router.push(`/setlists/${setlist.id}`);
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {setlists.map((setlist) => (
              <SetlistCard
                key={setlist.id}
                setlist={setlist}
                onClick={() => handleSetlistClick(setlist)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
