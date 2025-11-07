'use client';

import { useCallback } from 'react';
import { TuningType, TUNING_OPTIONS } from '@/lib/types';
import { getTuningInfo } from '@/lib/utils/tuning';
import { updateSetlistSongTuning } from '@/lib/supabase/setlists';
import { useToast } from '@/hooks/useToast';

interface TuningBadgeProps {
  value: TuningType;
  setlistSongId: string;
  editMode: boolean;
  onLocalChange?: (value: TuningType) => void;
  className?: string;
}

export function TuningBadge({ 
  value, 
  setlistSongId, 
  editMode, 
  onLocalChange,
  className = '' 
}: TuningBadgeProps) {
  const { showToast } = useToast();

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTuning = e.target.value as TuningType;
    
    // Optimistic update
    onLocalChange?.(nextTuning);
    
    try {
      await updateSetlistSongTuning(setlistSongId, nextTuning);
      showToast('Tuning updated', 'success');
    } catch (err: unknown) {
      console.error('Failed to update tuning:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tuning';
      showToast(errorMessage, 'error');
      // Revert on error
      onLocalChange?.(value);
    }
  }, [setlistSongId, value, onLocalChange, showToast]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <span className={`relative inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-muted/60 ${className}`}>
      {/* Visible badge text */}
      <span className="pointer-events-none select-none text-foreground">
        {TUNING_OPTIONS.find(o => o.value === value)?.label ?? 'Standard'}
      </span>

      {/* Native select overlay only in edit mode */}
      {editMode && (
        <select
          aria-label="Guitar tuning"
          value={value}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ 
            WebkitAppearance: 'menulist', 
            appearance: 'menulist' 
          } as React.CSSProperties}
        >
          {TUNING_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

// Legacy interface support for existing usage
interface LegacyTuningBadgeProps {
  tuning: TuningType;
  onChange?: (newTuning: TuningType) => void;
  disabled?: boolean;
  className?: string;
}

// Legacy component for backward compatibility (uses custom dropdown)
export function LegacyTuningBadge({ 
  tuning, 
  className = ''
}: LegacyTuningBadgeProps) {
  // Static badge when disabled (non-edit mode)
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-muted/60 ${className}`}>
      <span className="text-foreground">
        {TUNING_OPTIONS.find(o => o.value === tuning)?.label ?? 'Standard'}
      </span>
    </span>
  );
}