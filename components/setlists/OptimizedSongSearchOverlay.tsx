'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Music, Clock, X } from 'lucide-react';

interface MusicSong {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  tuning?: string;
  duration_seconds?: number;
}

interface SongSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectSong: (song: MusicSong) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SearchResults = memo(function SearchResults({
  songs,
  loading,
  error,
  onSelectSong,
  activeIndex,
}: {
  songs: MusicSong[];
  loading: boolean;
  error: string | null;
  onSelectSong: (song: MusicSong) => void;
  activeIndex: number;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Music className="w-12 h-12 mx-auto mb-4" />
        <p>No songs found. Try a different search term.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {songs.map((song, idx) => {
        const active = idx === activeIndex;
        return (
          <button
            key={song.id}
            type="button"
            onClick={() => onSelectSong(song)}
            className={[
              'w-full text-left flex items-center gap-4 p-3 rounded-lg border transition-colors',
              active
                ? 'bg-accent border-accent-foreground/20'
                : 'bg-card border-border hover:border-accent-foreground/30',
            ].join(' ')}
          >
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-medium truncate pr-2">{song.title}</h3>
                {song.duration_seconds ? (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Clock className="w-4 h-4" />
                    {formatDuration(song.duration_seconds)}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
              {song.bpm ? (
                <p className="text-xs text-muted-foreground mt-1">{song.bpm} BPM</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
});

function OptimizedSongSearchOverlay({ open, onClose, onSelectSong }: SongSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<MusicSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSongs([]);
      setError(null);
      setActiveIndex(0);
      // Defer focus to ensure element is mounted
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Outside click to close
  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) onClose();
  };

  // Debounced, cancelable search
  const searchSongs = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSongs([]);
        setError(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to search songs');
        setSongs(Array.isArray(data.songs) ? data.songs : []);
        setActiveIndex(0);
      } catch (err: unknown) {
        if ((err as any)?.name === 'AbortError') return;
        setSongs([]);
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchSongs(query), 300);
    return () => clearTimeout(t);
  }, [open, query, searchSongs]);

  // Keyboard navigation within results
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!songs.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % songs.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + songs.length) % songs.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const song = songs[activeIndex];
      if (song) {
        onSelectSong(song);
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Add Song"
    >
      <div
        className="bg-background text-foreground rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-border shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Add Song</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for songs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKeyDown}
            className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6" onKeyDown={onListKeyDown} tabIndex={-1}>
          <SearchResults
            songs={songs}
            loading={loading}
            error={error}
            onSelectSong={(song) => {
              onSelectSong(song);
              onClose();
            }}
            activeIndex={activeIndex}
          />
        </div>
      </div>
    </div>
  );
}

OptimizedSongSearchOverlay.displayName = 'OptimizedSongSearchOverlay';
export default memo(OptimizedSongSearchOverlay);