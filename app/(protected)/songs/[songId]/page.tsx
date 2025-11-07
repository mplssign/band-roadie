'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useBands } from '@/contexts/BandsContext';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LegacyTuningBadge as TuningBadge } from '@/components/setlists/TuningBadge';
import { NotesDrawer } from '@/components/songs/NotesDrawer';
import { ArrowLeft, Music, Edit3, Plus } from 'lucide-react';
import { TuningType } from '@/lib/types';

interface Song {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  tuning?: TuningType;
  duration_seconds?: number;
  is_live?: boolean;
  album_artwork?: string;
  lyrics?: string;
}

interface SongNote {
  id: string;
  song_id: string;
  band_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  users?: {
    first_name?: string;
    last_name?: string;
  };
}

interface SongDetailPageProps {
  params: { songId: string };
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function SongDetailPage({ params }: SongDetailPageProps) {
  const router = useRouter();
  const { currentBand } = useBands();
  const [song, setSong] = useState<Song | null>(null);
  const [notes, setNotes] = useState<SongNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [editingNote, setEditingNote] = useState<SongNote | null>(null);

  useEffect(() => {
    const loadSong = async () => {
      if (!params.songId || !currentBand?.id) return;

      setLoading(true);
      setError(null);

      try {
        // Load song details
        const songResponse = await fetch(`/api/songs/${params.songId}?band_id=${currentBand.id}`);
        if (!songResponse.ok) {
          throw new Error('Failed to load song');
        }
        const songData = await songResponse.json();
        setSong(songData.song);

        // Load song notes for this band
        const notesResponse = await fetch(`/api/songs/${params.songId}/notes?band_id=${currentBand.id}`);
        if (notesResponse.ok) {
          const notesData = await notesResponse.json();
          setNotes(notesData.notes || []);
        }
      } catch (err) {
        console.error('Error loading song:', err);
        setError(err instanceof Error ? err.message : 'Failed to load song');
      } finally {
        setLoading(false);
      }
    };

    loadSong();
  }, [params.songId, currentBand?.id]);

  const handleBack = () => {
    // Try to go back to the previous page, fallback to setlists
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/setlists');
    }
  };

  const handleSaveNote = async (content: string) => {
    if (!currentBand?.id) return;

    const response = await fetch(`/api/songs/${params.songId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        band_id: currentBand.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save note');
    }

    const data = await response.json();
    setNotes(prev => [data.note, ...prev]);
  };

  const handleEditNote = (note: SongNote) => {
    setEditingNote(note);
    setShowNotesDrawer(true);
  };

  const handleAddNote = () => {
    setEditingNote(null);
    setShowNotesDrawer(true);
  };

  if (loading) {
    return (
      <main className="bg-background text-foreground">
        <div className="px-4 pt-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <LoadingSpinner />
          </div>
        </div>
      </main>
    );
  }

  if (error || !song) {
    return (
      <main className="bg-background text-foreground">
        <div className="px-4 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 -ml-3 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="text-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Song Not Found</h3>
            <p className="text-muted-foreground">
              {error || 'The song you\'re looking for doesn\'t exist.'}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground pb-32">
      <div className="px-4 pt-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 -ml-3 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Song Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {/* Album Artwork */}
            {song.album_artwork && (
              <div className="flex-shrink-0">
                <Image 
                  src={song.album_artwork} 
                  alt={`${song.title} album artwork`}
                  width={120}
                  height={120}
                  className="w-30 h-30 rounded-lg object-cover shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Song Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-2 leading-tight">
                {song.title}
                {song.is_live && (
                  <span className="ml-2 text-lg text-muted-foreground">[Live]</span>
                )}
              </h1>
              
              {song.artist && (
                <p className="text-lg text-muted-foreground mb-3">
                  {song.artist}
                </p>
              )}

              {/* Song Metadata */}
              <div className="flex flex-wrap items-center gap-3">
                {song.bpm && (
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    {song.bpm} BPM
                  </div>
                )}
                
                <TuningBadge 
                  tuning={song.tuning || 'standard'} 
                  disabled={true}
                />
                
                {song.duration_seconds && (
                  <div className="bg-background/80 text-foreground border border-border/30 px-3 py-1 rounded-full text-sm font-medium">
                    {formatDuration(song.duration_seconds)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lyrics Section */}
        {song.lyrics && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Lyrics</h2>
            <div className="bg-muted/30 rounded-lg p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
                {song.lyrics}
              </pre>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Band Notes
              {notes.length > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({notes.length})
                </span>
              )}
            </h2>
            <Button
              onClick={handleAddNote}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Note
            </Button>
          </div>

          {notes.length === 0 ? (
            <div className="text-center py-8 bg-muted/20 rounded-lg">
              <Edit3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                No notes yet. Add a note to share insights with your band.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-card border border-border/20 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm text-muted-foreground">
                      {note.users?.first_name && note.users?.last_name ? (
                        `${note.users.first_name} ${note.users.last_name}`
                      ) : (
                        'Band Member'
                      )} • {new Date(note.created_at).toLocaleDateString()}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNote(note)}
                      className="text-muted-foreground hover:text-foreground -mr-2"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes Drawer */}
      <NotesDrawer
        open={showNotesDrawer}
        onClose={() => {
          setShowNotesDrawer(false);
          setEditingNote(null);
        }}
        existingNote={editingNote}
        onSave={handleSaveNote}
      />
    </main>
  );
}