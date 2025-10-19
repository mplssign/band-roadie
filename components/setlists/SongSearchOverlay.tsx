'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { MusicSong } from '@/lib/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Music, Clock, X } from 'lucide-react';

interface SongSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectSong: (song: MusicSong) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function SongSearchOverlay({ open, onClose, onSelectSong }: SongSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<MusicSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset query when overlay opens/closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setSongs([]);
      setError(null);
    }
  }, [open]);

  const searchSongs = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSongs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/songs?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search songs');
      }

      setSongs(data.songs || []);
    } catch (err) {
      console.error('Error searching songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to search songs');
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search-as-you-type with short debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchSongs(query);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [query, searchSongs]);

  const handleSelectSong = async (song: MusicSong) => {
    try {
      // If the song doesn't have an ID, it means it's from external search
      // and needs to be created in our database first
      if (!song.id) {
        const response = await fetch('/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(song),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create song');
        }

        onSelectSong(data.song);
      } else {
        onSelectSong(song);
      }
      
      // Close the search overlay after successful selection
      handleClose();
    } catch (err) {
      console.error('Error selecting song:', err);
      setError(err instanceof Error ? err.message : 'Failed to add song');
    }
  };

  const handleClose = () => {
    setQuery('');
    setSongs([]);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div>
      {/* Background overlay with blur and darken */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Search overlay positioned like the Add Songs button */}
      <div className="fixed inset-x-4 top-[200px] bottom-20 z-50 bg-background border border-border rounded-lg shadow-lg flex flex-col overflow-hidden">
        {/* Header with close button */}
        <div className="flex items-center border-b border-border px-4 py-4 flex-shrink-0">
          <input
            type="text"
            placeholder="Search song titles..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              searchSongs(e.target.value);
            }}
            className="flex-1 border-none bg-transparent focus:outline-none focus:ring-0 px-0 text-lg placeholder:text-lg text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            onClick={handleClose}
            className="ml-3 p-2 hover:bg-accent rounded-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Results container - takes all remaining space */}
        <div className="flex-1 overflow-y-auto min-h-0 max-h-full">
            {loading && (
              <div className="p-4 flex items-center justify-center h-full">
                <LoadingSpinner />
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-destructive h-full flex flex-col justify-center">
                <p>{error}</p>
                <button 
                  onClick={() => searchSongs(query)}
                  className="mt-2 text-sm underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && songs.length === 0 && query && (
              <div className="h-full flex items-center justify-center">
                <div className="text-muted-foreground text-center">
                  <p>No songs found matching &quot;{query}&quot;</p>
                </div>
              </div>
            )}

            {!loading && !error && songs.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50 bg-background flex-shrink-0">
                  {songs.length} song{songs.length === 1 ? '' : 's'} found
                </div>
                <div className="overflow-y-auto p-2 space-y-1" style={{ height: 'calc(100% - 48px)' }}>
                  {songs.map((song, index) => (
                  <div
                    key={song.id || `${song.title}-${song.artist}-${index}`}
                    onClick={() => handleSelectSong(song)}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm"
                  >
                    {/* Album artwork */}
                    {song.album_artwork ? (
                      <Image 
                        src={song.album_artwork} 
                        alt={`${song.title} album artwork`}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        onError={() => {
                          // Handle error by hiding the image
                        }}
                      />
                    ) : (
                      <Music className="h-10 w-10 text-muted-foreground flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{song.title}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {song.artist}
                        {song.is_live && <span className="ml-2 text-xs">[Live]</span>}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      {song.duration_seconds && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(song.duration_seconds)}
                        </div>
                      )}
                      {song.bpm && (
                        <div>{song.bpm} BPM</div>
                      )}
                    </div>
                  </div>
                  ))}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}