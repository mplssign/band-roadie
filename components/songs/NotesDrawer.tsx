'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Save } from 'lucide-react';

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

interface NotesDrawerProps {
  open: boolean;
  onClose: () => void;
  existingNote?: SongNote | null;
  onSave: (content: string) => Promise<void>;
}

export function NotesDrawer({
  open,
  onClose,
  existingNote,
  onSave,
}: NotesDrawerProps) {
  const [content, setContent] = useState(existingNote?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(content.trim());
      onClose();
      setContent('');
    } catch (err) {
      console.error('Error saving note:', err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setContent(existingNote?.content || '');
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/60 rounded-t-xl max-h-[80vh] flex flex-col z-50 animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {existingNote ? 'Edit Note' : 'Add Note'}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Note Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add a note about this song for your band..."
                className="w-full h-32 px-3 py-2 border border-border/60 rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Notes are shared with all band members and can include chord progressions, performance tips, or any other relevant information.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/20 flex-shrink-0">
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="gap-2"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {existingNote ? 'Update Note' : 'Add Note'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}