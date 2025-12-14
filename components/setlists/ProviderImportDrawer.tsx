'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useBands } from '@/hooks/useBands';

import { X, Link, Music, AlertCircle } from 'lucide-react';
import { AppleMusicIcon, SpotifyIcon, AmazonMusicIcon } from '@/components/icons/ProviderIcons';
import { MusicSong } from '@/lib/types';

interface ProviderImportDrawerProps {
  open: boolean;
  provider: 'apple' | 'spotify' | 'amazon' | null;
  onClose: () => void;
  onImportSongs: (songs: MusicSong[]) => Promise<void>;
}

type ImportStep = 'input' | 'parsing' | 'preview' | 'importing';

interface ParsedSong {
  artist: string;
  title: string;
  bpm?: number;
  tuning?: 'standard' | 'drop_d' | 'half_step' | 'full_step';
  duration_seconds?: number;
  id?: string;
}

const PROVIDER_NAMES = {
  apple: 'Apple Music',
  spotify: 'Spotify',
  amazon: 'Amazon Music'
};

const PROVIDER_ICONS = {
  apple: AppleMusicIcon,
  spotify: SpotifyIcon,
  amazon: AmazonMusicIcon
};

export function ProviderImportDrawer({ open, provider, onClose, onImportSongs }: ProviderImportDrawerProps) {
  const [step, setStep] = useState<ImportStep>('input');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [parsedSongs, setParsedSongs] = useState<ParsedSong[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  const { currentBand } = useBands();

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (open) {
      setStep('input');
      setPlaylistUrl('');
      setParsedSongs([]);
      setSelectedSongs(new Set());
      setError(null);
    }
  }, [open]);

  const ProviderIcon = provider ? PROVIDER_ICONS[provider] : null;
  const providerName = provider ? PROVIDER_NAMES[provider] : '';

  const handleParsePlaylist = async () => {
    if (!playlistUrl.trim()) {
      setError('Please enter a playlist URL');
      return;
    }

    setStep('parsing');
    setError(null);
    
    try {
      const response = await fetch('/api/playlists/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: playlistUrl.trim(),
          bandId: currentBand?.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse playlist');
      }

      if (data.songs && data.songs.length > 0) {
        setParsedSongs(data.songs);
        setSelectedSongs(new Set(data.songs.map((_: ParsedSong, index: number) => index))); // Select all by default
        setStep('preview');
      } else {
        setError('No songs found in the playlist. Please check the URL and try again.');
        setStep('input');
      }
    } catch (error) {
      console.error('Error parsing playlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse playlist. Please try again.';
      setError(errorMessage);
      setStep('input');
    }
  };

  const handleImport = async () => {
    const songsToImport = parsedSongs.filter((_, index) => selectedSongs.has(index));
    if (songsToImport.length === 0) {
      setError('Please select at least one song to import.');
      return;
    }

    setStep('importing');
    setError(null);

    try {
      // Convert parsed songs to MusicSong format
      const musicSongs: MusicSong[] = songsToImport.map(song => ({
        id: song.id || '', // Will be created if empty
        title: song.title,
        artist: song.artist,
        bpm: song.bpm,
        tuning: song.tuning,
        duration_seconds: song.duration_seconds
      }));

      onImportSongs(musicSongs);
      onClose();
    } catch (err) {
      console.error('Error importing songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to import songs.');
      setStep('preview');
    }
  };

  const toggleSongSelection = (index: number) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSongs(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedSongs.size === parsedSongs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(parsedSongs.map((_, index) => index)));
    }
  };

  if (!open || !provider) return null;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-300"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-lg shadow-xl backdrop-blur-lg max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-2 duration-300 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            {ProviderIcon && <ProviderIcon className="h-6 w-6 text-foreground" />}
            <h2 className="text-lg font-semibold">Import Playlist — {providerName}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {step === 'input' && (
            <div className="p-6 space-y-6">
              {/* Provider Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Music className="h-5 w-5 text-rose-600" />
                <span className="text-sm">Import from {providerName}</span>
              </div>

              {/* URL Input */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Playlist URL or Track List</label>
                <Input
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder={`Paste a public ${providerName} playlist link or list of tracks (one per line: "Artist — Song")`}
                  className="min-h-[100px]"
                  style={{ resize: 'vertical' }}
                />
                <p className="text-xs text-muted-foreground">
                  For track lists, use format: &quot;Artist — Song&quot; (one per line)
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner />
              <p className="mt-4 text-sm text-muted-foreground">Parsing playlist...</p>
            </div>
          )}

          {step === 'preview' && parsedSongs.length > 0 && (
            <div className="p-4 space-y-4">
              {/* Preview Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Preview ({parsedSongs.length} songs found)</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedSongs.size === parsedSongs.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Songs Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <div className="col-span-1"></div>
                  <div className="col-span-5">Artist</div>
                  <div className="col-span-4">Song</div>
                  <div className="col-span-1">BPM</div>
                  <div className="col-span-1">Tuning</div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {parsedSongs.map((song, index) => (
                    <div
                      key={index}
                      className={`px-4 py-3 grid grid-cols-12 gap-2 border-t border-border text-sm hover:bg-muted/25 cursor-pointer ${
                        selectedSongs.has(index) ? 'bg-rose-50 dark:bg-rose-950' : ''
                      }`}
                      onClick={() => toggleSongSelection(index)}
                    >
                      <div className="col-span-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSongs.has(index)}
                          onChange={() => toggleSongSelection(index)}
                          className="rounded border-border"
                        />
                      </div>
                      <div className="col-span-5 truncate">{song.artist}</div>
                      <div className="col-span-4 truncate">{song.title}</div>
                      <div className="col-span-1 text-muted-foreground">{song.bpm || '—'}</div>
                      <div className="col-span-1 text-muted-foreground text-xs">
                        {song.tuning ? song.tuning.replace('_', ' ').toUpperCase() : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner />
              <p className="mt-4 text-sm text-muted-foreground">Importing songs...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            {step === 'input' && (
              <Button
                onClick={handleParsePlaylist}
                disabled={!playlistUrl.trim()}
                className="flex-1"
              >
                <Link className="h-4 w-4 mr-2" />
                Parse Playlist
              </Button>
            )}
            {step === 'preview' && (
              <Button
                onClick={handleImport}
                disabled={selectedSongs.size === 0}
                className="flex-1"
              >
                <Music className="h-4 w-4 mr-2" />
                Add {selectedSongs.size} Songs
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}