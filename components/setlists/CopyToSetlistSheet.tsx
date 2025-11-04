'use client';

import { useState, useEffect } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { listSetlists, copySongToSetlist, SetlistOption } from '@/lib/supabase/setlists';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { Copy, Loader2 } from 'lucide-react';

interface CopyToSetlistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  fromSetlistId: string;
  songTitle?: string;  // For toast messaging
}

const STORAGE_KEY = "br:lastCopySetlistId";

export function CopyToSetlistSheet({
  isOpen,
  onClose,
  songId,
  fromSetlistId,
  songTitle = "Song"
}: CopyToSetlistSheetProps) {
  const [setlists, setSetlists] = useState<SetlistOption[]>([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const { currentBand } = useBands();
  const { showToast } = useToast();

  // Load setlists when sheet opens
  useEffect(() => {
    if (!isOpen || !currentBand?.id) return;

    const loadSetlists = async () => {
      setLoading(true);
      try {
        const availableSetlists = await listSetlists(currentBand.id, fromSetlistId);
        setSetlists(availableSetlists);

        // Try to preselect the last used destination
        const lastDestination = typeof window !== "undefined" 
          ? localStorage.getItem(STORAGE_KEY) 
          : null;
        
        if (lastDestination && availableSetlists.some(s => s.id === lastDestination)) {
          setSelectedSetlistId(lastDestination);
        } else {
          setSelectedSetlistId("");
        }
      } catch (error) {
        console.error('Error loading setlists:', error);
        showToast("Failed to load setlists", "error");
      } finally {
        setLoading(false);
      }
    };

    loadSetlists();
  }, [isOpen, currentBand?.id, fromSetlistId, showToast]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSetlistId("");
      setSetlists([]);
      setLoading(true);
    }
  }, [isOpen]);

  const handleCopy = async () => {
    if (!selectedSetlistId) return;

    setCopying(true);
    try {
      await copySongToSetlist(songId, fromSetlistId, selectedSetlistId);
      
      // Get the destination setlist name for the toast
      const destinationSetlist = setlists.find(s => s.id === selectedSetlistId);
      const setlistName = destinationSetlist?.name || "setlist";

      // Save the chosen destination for next time
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, selectedSetlistId);
      }

      showToast(`Copied "${songTitle}" to ${setlistName}`, "success");

      onClose();
    } catch (error) {
      console.error('Error copying song:', error);
      showToast(
        error instanceof Error ? error.message : "Failed to copy song",
        "error"
      );
    } finally {
      setCopying(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[400px] br-drawer-surface">
        <SheetHeader>
          <SheetTitle>Copy to setlist</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : setlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No other setlists available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create another setlist to copy songs between them.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="setlist-select" className="text-sm font-medium">
                  Destination setlist
                </label>
                <Select 
                  value={selectedSetlistId} 
                  onValueChange={setSelectedSetlistId}
                >
                  <SelectTrigger id="setlist-select" aria-label="Destination setlist">
                    <SelectValue placeholder="Choose a setlist..." />
                  </SelectTrigger>
                  <SelectContent>
                    {setlists.map((setlist) => (
                      <SelectItem key={setlist.id} value={setlist.id}>
                        {setlist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={copying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCopy}
                  disabled={!selectedSetlistId || copying}
                  className="flex-1 gap-2"
                >
                  {copying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copying ? 'Copying...' : 'Copy'}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}