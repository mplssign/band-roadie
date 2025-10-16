'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Check, AlertCircle, Settings } from 'lucide-react';

interface TuningBadgeProps {
  tuning: string;
  tuningSource?: 'fallback' | 'songsterr' | 'user_confirmed';
  songId?: string;
  songTitle?: string;
  artist?: string;
  className?: string;
  onTuningConfirm?: (newTuning: string) => void;
}

const TUNING_OPTIONS = [
  { value: 'Standard (E)', label: 'Standard (E A D G B E)' },
  { value: 'Drop D', label: 'Drop D (D A D G B E)' },
  { value: 'Drop C', label: 'Drop C (C G C F A D)' },
  { value: 'Drop B', label: 'Drop B (B F# B E G# C#)' },
  { value: 'Half Step Down', label: 'Half Step Down (D# G# C# F# A# D#)' },
  { value: 'Full Step Down', label: 'Full Step Down (D G C F A D)' },
  { value: 'DADGAD', label: 'DADGAD (D A D G A D)' },
  { value: 'Open G', label: 'Open G (D G D G B D)' },
  { value: 'Open D', label: 'Open D (D A D F# A D)' },
  { value: 'Open E', label: 'Open E (E B E G# B E)' },
];

const tuningColorConfig = {
  'user_confirmed': 'bg-green-600 text-white border-green-700 hover:bg-green-700',
  'songsterr': 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700',
  'fallback': 'bg-gray-600 text-white border-gray-700 hover:bg-gray-700',
};

export function TuningBadge({ 
  tuning, 
  tuningSource = 'fallback', 
  songId, 
  songTitle, 
  artist, 
  className,
  onTuningConfirm 
}: TuningBadgeProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTuning, setSelectedTuning] = useState(tuning);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const color = tuningColorConfig[tuningSource] || tuningColorConfig.fallback;
  const displayText = tuning.replace(/\s*\([^)]*\)$/, ''); // Remove "(Songsterr)" suffix for display
  
  const getSourceIcon = () => {
    switch (tuningSource) {
      case 'user_confirmed':
        return <Check className="w-3 h-3 ml-1" />;
      case 'songsterr':
        return <AlertCircle className="w-3 h-3 ml-1" />;
      default:
        return <Settings className="w-3 h-3 ml-1" />;
    }
  };
  
  const getSourceText = () => {
    switch (tuningSource) {
      case 'user_confirmed':
        return 'Confirmed by band member';
      case 'songsterr':
        return 'Suggested by Songsterr (click to confirm)';
      default:
        return 'Default tuning (click to customize)';
    }
  };
  
  const handleConfirmTuning = async () => {
    if (!songId || !songTitle || !artist) return;
    
    setIsConfirming(true);
    try {
      const response = await fetch('/api/tunings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: songId,
          title: songTitle,
          artist: artist,
          confirmed_tuning: selectedTuning
        })
      });
      
      if (response.ok) {
        onTuningConfirm?.(selectedTuning);
        setIsDialogOpen(false);
      } else {
        console.error('Failed to confirm tuning');
      }
    } catch (error) {
      console.error('Error confirming tuning:', error);
    } finally {
      setIsConfirming(false);
    }
  };
  
  return (
    <>
      <Badge 
        variant="outline" 
        className={`${color} whitespace-nowrap cursor-pointer flex items-center ${className || ''}`}
        title={getSourceText()}
        onClick={() => setIsDialogOpen(true)}
      >
        {displayText}
        {getSourceIcon()}
      </Badge>
      
      {isDialogOpen && (
        <Dialog 
          open={isDialogOpen} 
          onClose={() => setIsDialogOpen(false)}
          title="Confirm Guitar Tuning"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>{songTitle}</strong> by {artist}
              </p>
              <p className="text-sm text-gray-500">
                Current tuning source: {getSourceText()}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select the correct tuning for this song:
              </label>
              <Select value={selectedTuning} onValueChange={setSelectedTuning}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TUNING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isConfirming}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmTuning}
                disabled={isConfirming || selectedTuning === tuning}
              >
                {isConfirming ? 'Confirming...' : 'Confirm Tuning'}
              </Button>
            </div>
            
            {tuningSource === 'user_confirmed' && (
              <p className="text-xs text-green-600 text-center">
                ✓ This tuning has been confirmed by your band
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}