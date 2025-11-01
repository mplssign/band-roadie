'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { X, ClipboardList, Music, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { MusicSong, TuningType } from '@/lib/types';
import { normalizeTuning, getTuningsOrderedByPopularity, getTuningDisplayString } from '@/lib/utils/tuning';

interface BulkPasteDrawerProps {
  open: boolean;
  onClose: () => void;
  onImportSongs: (songs: MusicSong[]) => void;
  existingSongs?: MusicSong[];
}

interface ParsedSong {
  artist: string;
  title: string;
  bpm?: number;
  tuning?: TuningType;
  duration_seconds?: number;
  id?: string;
  isDuplicate?: boolean;
  // Duration lookup state
  durationLookupStatus?: 'pending' | 'loading' | 'found' | 'multiple' | 'not_found' | 'error';
  durationLookupError?: string;
  durationResolverOptions?: {
    id: string;
    artist: string;
    title: string;
    duration_seconds: number;
    artwork?: string;
  }[];
}

type ParseStep = 'paste' | 'parsing' | 'preview' | 'importing';

export function BulkPasteDrawer({ open, onClose, onImportSongs, existingSongs = [] }: BulkPasteDrawerProps) {
  const [step, setStep] = useState<ParseStep>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsedSongs, setParsedSongs] = useState<ParsedSong[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  // Duration lookup state
  const [durationLookupProgress, setDurationLookupProgress] = useState<{
    completed: number;
    total: number;
    active: boolean;
  }>({ completed: 0, total: 0, active: false });
  const [durationLookupCancelled, setDurationLookupCancelled] = useState(false);
  const [resolvingSongIndex, setResolvingSongIndex] = useState<number | null>(null);

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (open) {
      setStep('paste');
      setPasteText('');
      setParsedSongs([]);
      setSelectedSongs(new Set());
      setError(null);
      setDuplicateCount(0);
      setDurationLookupProgress({ completed: 0, total: 0, active: false });
      setDurationLookupCancelled(false);
      setResolvingSongIndex(null);
    }
  }, [open]);

  // Duration lookup functions
  const fetchSongDurations = async (songs: ParsedSong[]) => {
    if (durationLookupCancelled) return;

    const songsNeedingDuration = songs.filter(song => 
      !song.isDuplicate && !song.duration_seconds && song.artist && song.title
    );

    if (songsNeedingDuration.length === 0) return;

    setDurationLookupProgress({ 
      completed: 0, 
      total: songsNeedingDuration.length, 
      active: true 
    });

    // Mark all songs as pending
    const updatedSongs = songs.map(song => {
      if (songsNeedingDuration.includes(song)) {
        return { ...song, durationLookupStatus: 'pending' as const };
      }
      return song;
    });
    setParsedSongs(updatedSongs);

    try {
      // Prepare lookup requests
      const lookupRequests = songsNeedingDuration.map(song => ({
        artist: song.artist,
        title: song.title
      }));

      // Call bulk duration API
      const response = await fetch('/api/songs/bulk-durations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs: lookupRequests })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch durations');
      }

      const { results } = await response.json();

      // Process results and update songs
      const processedSongs = [...songs];
      let completed = 0;

      for (let i = 0; i < results.length; i++) {
        if (durationLookupCancelled) break;

        const result = results[i];
        const songIndex = songs.findIndex(song => 
          song.artist === result.artist && song.title === result.title
        );

        if (songIndex !== -1) {
          const currentSong = processedSongs[songIndex];
          
          switch (result.status) {
            case 'found':
              processedSongs[songIndex] = {
                ...currentSong,
                duration_seconds: result.duration_seconds,
                durationLookupStatus: 'found'
              };
              break;
              
            case 'multiple':
              processedSongs[songIndex] = {
                ...currentSong,
                durationLookupStatus: 'multiple',
                durationResolverOptions: result.matches
              };
              break;
              
            case 'not_found':
              processedSongs[songIndex] = {
                ...currentSong,
                durationLookupStatus: 'not_found'
              };
              break;
              
            case 'error':
              processedSongs[songIndex] = {
                ...currentSong,
                durationLookupStatus: 'error',
                durationLookupError: result.error
              };
              break;
          }
        }

        completed++;
        setDurationLookupProgress(prev => ({ ...prev, completed }));
        setParsedSongs([...processedSongs]); // Update UI progressively
        
        // Small delay for UI responsiveness
        if (i < results.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

    } catch (error) {
      console.error('Duration lookup error:', error);
      // Mark remaining songs as error
      const errorSongs = songs.map(song => {
        if (songsNeedingDuration.includes(song) && !song.duration_seconds) {
          return { 
            ...song, 
            durationLookupStatus: 'error' as const,
            durationLookupError: 'Failed to fetch duration'
          };
        }
        return song;
      });
      setParsedSongs(errorSongs);
    } finally {
      setDurationLookupProgress(prev => ({ ...prev, active: false }));
    }
  };

  const resolveDurationForSong = (songIndex: number, selectedOption: { duration_seconds: number }) => {
    const updatedSongs = [...parsedSongs];
    updatedSongs[songIndex] = {
      ...updatedSongs[songIndex],
      duration_seconds: selectedOption.duration_seconds,
      durationLookupStatus: 'found',
      durationResolverOptions: undefined
    };
    setParsedSongs(updatedSongs);
    setResolvingSongIndex(null);
  };

  const cancelDurationLookups = () => {
    setDurationLookupCancelled(true);
    setDurationLookupProgress(prev => ({ ...prev, active: false }));
  };

  const parseSpreadsheetData = (text: string): ParsedSong[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const parsed: ParsedSong[] = [];
    let headerSkipped = false;

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      // Try to detect and skip header row
      if (!headerSkipped && (
        cleanLine.toLowerCase().includes('artist') || 
        cleanLine.toLowerCase().includes('song') ||
        cleanLine.toLowerCase().includes('title')
      )) {
        headerSkipped = true;
        continue;
      }

      // Parse different formats: TSV, CSV, or simple separated
      let parts: string[] = [];
      
      if (cleanLine.includes('\t')) {
        // Tab-separated (TSV)
        parts = cleanLine.split('\t');
      } else if (cleanLine.includes(',')) {
        // Comma-separated (CSV) - basic parsing, doesn't handle quoted commas
        parts = cleanLine.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      } else if (cleanLine.includes(' - ')) {
        // Simple "Artist - Song" format
        parts = cleanLine.split(' - ');
      } else if (cleanLine.includes(' — ')) {
        // Em dash format
        parts = cleanLine.split(' — ');
      } else {
        // Single column, assume it's just a title
        parts = ['Unknown Artist', cleanLine];
      }

      if (parts.length >= 2) {
        const artist = parts[0]?.trim() || 'Unknown Artist';
        const title = parts[1]?.trim();
        
        if (title) {
          const song: ParsedSong = {
            artist,
            title
          };

          // Try to parse BPM (3rd column)
          if (parts[2]) {
            const bpmMatch = parts[2].match(/\d+/);
            if (bpmMatch) {
              song.bpm = parseInt(bpmMatch[0], 10);
            }
          }

          // Try to parse tuning (4th column) with auto-matching
          if (parts[3]) {
            const tuningText = parts[3].trim();
            const normalizedTuning = normalizeTuning(tuningText);
            if (normalizedTuning) {
              song.tuning = normalizedTuning;
            }
            // If no match, leave undefined (will show as "—" in UI)
          }

          parsed.push(song);
        }
      }
    }

    return parsed;
  };

  const checkForDuplicates = (songs: ParsedSong[]): ParsedSong[] => {
    const existingSet = new Set(
      existingSongs.map(song => 
        `${song.artist.toLowerCase()}|${song.title.toLowerCase()}|${song.bpm || ''}|${song.tuning || ''}`
      )
    );

    const seenInBatch = new Set<string>();
    let duplicates = 0;

    const processed = songs.map(song => {
      const key = `${song.artist.toLowerCase()}|${song.title.toLowerCase()}|${song.bpm || ''}|${song.tuning || ''}`;
      const isDuplicate = existingSet.has(key) || seenInBatch.has(key);
      
      if (isDuplicate) {
        duplicates++;
      } else {
        seenInBatch.add(key);
      }

      return {
        ...song,
        isDuplicate
      };
    });

    setDuplicateCount(duplicates);
    return processed;
  };

  const handleParse = async () => {
    if (!pasteText.trim()) {
      setError('Please paste some data to import.');
      return;
    }

    setStep('parsing');
    setError(null);

    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      const parsed = parseSpreadsheetData(pasteText);
      
      if (parsed.length === 0) {
        throw new Error('No valid songs found. Please check your data format.');
      }

      const processed = checkForDuplicates(parsed);
      setParsedSongs(processed);
      
      // Auto-select non-duplicates
      const nonDuplicateIndices = processed
        .map((song, index) => song.isDuplicate ? -1 : index)
        .filter(index => index !== -1);
      
      setSelectedSongs(new Set(nonDuplicateIndices));
      setStep('preview');

      // Start duration lookups automatically
      setDurationLookupCancelled(false);
      fetchSongDurations(processed);
    } catch (err) {
      console.error('Error parsing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse data.');
      setStep('paste');
    }
  };

  const handleImport = async () => {
    const songsToImport = parsedSongs
      .filter((_, index) => selectedSongs.has(index))
      .filter(song => !song.isDuplicate);
    
    if (songsToImport.length === 0) {
      setError('Please select at least one non-duplicate song to import.');
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
    if (parsedSongs[index].isDuplicate) return; // Can't select duplicates
    
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSongs(newSelected);
  };

  const toggleSelectAll = () => {
    const selectableIndices = parsedSongs
      .map((song, index) => song.isDuplicate ? -1 : index)
      .filter(index => index !== -1);
    
    if (selectedSongs.size === selectableIndices.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(selectableIndices));
    }
  };



  const updateSong = (index: number, field: keyof ParsedSong, value: string) => {
    const newSongs = [...parsedSongs];
    const song = { ...newSongs[index] };
    
    if (field === 'bpm') {
      const numValue = parseInt(value, 10);
      song.bpm = isNaN(numValue) ? undefined : numValue;
    } else if (field === 'tuning') {
      song.tuning = value as TuningType;
    } else if (field === 'artist') {
      song.artist = value;
    } else if (field === 'title') {
      song.title = value;
    }
    
    newSongs[index] = song;
    setParsedSongs(newSongs);
  };

  if (!open) return null;

  return (
    <>
        {/* Background overlay */}
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-300"
          onClick={onClose}
        />      {/* Duration Resolver Modal */}
      {resolvingSongIndex !== null && parsedSongs[resolvingSongIndex]?.durationResolverOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-medium">Select Duration for &quot;{parsedSongs[resolvingSongIndex].title}&quot;</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResolvingSongIndex(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {parsedSongs[resolvingSongIndex].durationResolverOptions!.map((option) => (
                <button
                  key={option.id}
                  onClick={() => resolveDurationForSong(resolvingSongIndex, option)}
                  className="w-full p-3 border-b border-border hover:bg-muted/50 text-left flex items-center gap-3"
                >
                  {option.artwork ? (
                    <Image
                      src={option.artwork}
                      alt={`${option.title} artwork`}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <Music className="h-10 w-10 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{option.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{option.artist}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {Math.floor(option.duration_seconds / 60)}:{(option.duration_seconds % 60).toString().padStart(2, '0')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-lg shadow-xl backdrop-blur-lg max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-2 duration-300 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-foreground" />
            <h2 className="text-lg font-semibold">Bulk Add Songs</h2>
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
          {step === 'paste' && (
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Paste data from your spreadsheet</label>
                <p className="text-xs text-muted-foreground">
                  Your spreadsheet should have the columns: ARTIST&nbsp;&nbsp;&nbsp;&nbsp;SONG&nbsp;&nbsp;&nbsp;&nbsp;BPM&nbsp;&nbsp;&nbsp;&nbsp;TUNING
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste data from a spreadsheet (TSV/CSV) or use format:&#10;Artist[TAB]Song[TAB]BPM[TAB]Tuning&#10;&#10;Example:&#10;The Beatles[TAB]Come Together[TAB]82[TAB]standard&#10;Led Zeppelin[TAB]Black Dog[TAB]95[TAB]drop_d"
                  className="w-full min-h-[200px] p-3 border border-border rounded-lg bg-background text-foreground font-mono text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Supported formats:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Tab-separated (TSV) or comma-separated (CSV)</li>
                    <li>Simple format: &quot;Artist - Song&quot; or &quot;Artist — Song&quot;</li>
                    <li>Columns: ARTIST | SONG | BPM | TUNING (BPM and TUNING optional)</li>
                  </ul>
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

          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner />
              <p className="mt-4 text-sm text-muted-foreground">Parsing data...</p>
            </div>
          )}

          {step === 'preview' && parsedSongs.length > 0 && (
            <div className="p-4 space-y-4">
              {/* Instruction Text */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Make sure your columns in your spreadsheet match the columns below before pasting data.
                </p>
              </div>
              
              {/* Preview Header */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">Preview ({parsedSongs.length} songs parsed)</h3>
                  {duplicateCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} found (will be skipped)
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedSongs.size === parsedSongs.filter(s => !s.isDuplicate).length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Duration lookup progress */}
              {durationLookupProgress.active && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <LoadingSpinner size="small" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Fetching durations... {durationLookupProgress.completed}/{durationLookupProgress.total}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelDurationLookups}
                        className="text-xs h-6 px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                    {durationLookupProgress.total > 0 && (
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(durationLookupProgress.completed / durationLookupProgress.total) * 100}%` 
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Songs Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 grid grid-cols-12 gap-3 text-xs font-medium uppercase text-muted-foreground">
                  <div className="col-span-1"></div>
                  <div className="col-span-4">Artist</div>
                  <div className="col-span-4">Song</div>
                  <div className="col-span-2">BPM</div>
                  <div className="col-span-1">Tuning</div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {parsedSongs.map((song, index) => (
                    <div
                      key={index}
                      className={`px-4 py-3 grid grid-cols-12 gap-3 border-t border-border text-sm ${
                        song.isDuplicate 
                          ? 'bg-muted/25 text-muted-foreground opacity-60' 
                          : selectedSongs.has(index) 
                            ? 'bg-rose-50 dark:bg-rose-950' 
                            : 'hover:bg-muted/25'
                      }`}
                    >
                      <div className="col-span-1 flex items-center">
                        {song.isDuplicate ? (
                          <span className="text-xs text-muted-foreground">DUP</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedSongs.has(index)}
                            onChange={() => toggleSongSelection(index)}
                            className="rounded border-border"
                          />
                        )}
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={song.artist}
                          onChange={(e) => updateSong(index, 'artist', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-sm focus:outline-none focus:ring-0 break-words"
                          disabled={song.isDuplicate}
                          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={song.title}
                          onChange={(e) => updateSong(index, 'title', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-sm focus:outline-none focus:ring-0 break-words"
                          disabled={song.isDuplicate}
                          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                        />
                        {/* Duration status inline */}
                        <div className="text-xs text-muted-foreground mt-1">
                          {song.durationLookupStatus === 'loading' && (
                            <span className="flex items-center gap-1">
                              <LoadingSpinner size="small" />
                              Fetching duration...
                            </span>
                          )}
                          {song.durationLookupStatus === 'found' && song.duration_seconds && (
                            <span className="text-green-600 dark:text-green-400">
                              Duration: {Math.floor(song.duration_seconds / 60)}:{(song.duration_seconds % 60).toString().padStart(2, '0')}
                            </span>
                          )}
                          {song.durationLookupStatus === 'multiple' && (
                            <button
                              onClick={() => setResolvingSongIndex(index)}
                              className="text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              Resolve duration ({song.durationResolverOptions?.length} matches)
                            </button>
                          )}
                          {song.durationLookupStatus === 'not_found' && (
                            <span className="text-muted-foreground">
                              Duration: unknown
                            </span>
                          )}
                          {song.durationLookupStatus === 'error' && (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Duration: error
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={song.bpm || ''}
                          onChange={(e) => updateSong(index, 'bpm', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-sm focus:outline-none focus:ring-0"
                          placeholder="—"
                          disabled={song.isDuplicate}
                          min="1"
                          max="300"
                        />
                      </div>
                      <div className="col-span-1">
                        <select
                          value={song.tuning || ''}
                          onChange={(e) => updateSong(index, 'tuning', e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0"
                          disabled={song.isDuplicate}
                        >
                          <option value="">—</option>
                          {getTuningsOrderedByPopularity().map(({ type }) => (
                            <option key={type} value={type}>
                              {getTuningDisplayString(type).toUpperCase()}
                            </option>
                          ))}
                        </select>
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
              <p className="mt-4 text-sm text-muted-foreground">Adding songs to setlist...</p>
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
            {step === 'paste' && (
              <Button
                onClick={handleParse}
                disabled={!pasteText.trim()}
                className="flex-1"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Parse Data
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