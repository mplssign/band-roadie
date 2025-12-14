'use client';

import { useState, useEffect } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { listSetlists, SetlistOption } from '@/lib/supabase/setlists';
import { SheetWithClose as Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/SheetWithClose';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { Copy, Loader2 } from 'lucide-react';

interface BulkCopyToSetlistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  songIds: string[];
  fromSetlistId: string;
  onComplete?: () => void;
}

const STORAGE_KEY = "br:lastBulkCopySetlistId";

export function BulkCopyToSetlistSheet({
  isOpen,
  onClose,
  songIds,
  fromSetlistId,
  onComplete
}: BulkCopyToSetlistSheetProps) {
  const [setlists, setSetlists] = useState<SetlistOption[]>([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const { currentBand } = useBands();
  const { showToast } = useToast();

  // Load setlists when sheet opens
  useEffect(() => {
    if (!isOpen || !currentBand?.id || songIds.length === 0) return;

    const loadSetlists = async () => {
      setLoading(true);
      try {
        const availableSetlists = await listSetlists(currentBand.id, fromSetlistId);
        // Filter out "All Songs" setlist from destinations
        const filteredSetlists = availableSetlists.filter(setlist => 
          setlist.name !== 'All Songs'
        );
        setSetlists(filteredSetlists);

        // Try to preselect the last used destination
        const lastDestination = typeof window !== "undefined" 
          ? localStorage.getItem(STORAGE_KEY) 
          : null;
        
        if (lastDestination && filteredSetlists.some(s => s.id === lastDestination)) {
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
  }, [isOpen, currentBand?.id, fromSetlistId, songIds.length, showToast]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSetlistId("");
      setSetlists([]);
      setLoading(true);
    }
  }, [isOpen]);

  const handleBulkCopy = async () => {
    if (!selectedSetlistId || songIds.length === 0) return;

    setCopying(true);

    try {
      let successCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      // Copy each song individually
      for (const songId of songIds) {
        try {
          const response = await fetch(`/api/setlists/${fromSetlistId}/songs/${songId}/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              toSetlistId: selectedSetlistId 
            }),
          });

          const data = await response.json();

          if (response.ok) {
            successCount++;
          } else if (response.status === 409) {
            // Duplicate song
            duplicateCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error copying song:', error);
          errorCount++;
        }
      }

      // Get the destination setlist name for the toast
      const destinationSetlist = setlists.find(s => s.id === selectedSetlistId);
      const setlistName = destinationSetlist?.name || "setlist";

      // Save the chosen destination for next time
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, selectedSetlistId);
      }

      // Show appropriate toast message
      if (successCount > 0) {
        let message = `Copied ${successCount} song${successCount === 1 ? '' : 's'} to ${setlistName}`;
        if (duplicateCount > 0) {
          message += ` (${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} skipped)`;
        }
        if (errorCount > 0) {
          message += ` (${errorCount} failed)`;
        }
        showToast(message, "success");
      } else if (duplicateCount > 0) {
        showToast(`All selected songs are already in ${setlistName}`, "info");
      } else {
        showToast("Failed to copy songs", "error");
      }

      onComplete?.();
      onClose();
    } catch (error) {
      console.error('Error in bulk copy:', error);
      showToast("Failed to copy songs", "error");
    } finally {
      setCopying(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] sm:h-auto">
        <SheetHeader>
          <SheetTitle>
            Copy {songIds.length} song{songIds.length === 1 ? '' : 's'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : setlists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                No other setlists available
              </p>
              <p className="text-sm text-muted-foreground">
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

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={copying}
                >
                  Cancel
                </Button>
                
                <Button
                  onClick={handleBulkCopy}
                  disabled={!selectedSetlistId || copying}
                  className="flex-1"
                >
                  {copying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy {songIds.length} song{songIds.length === 1 ? '' : 's'}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}