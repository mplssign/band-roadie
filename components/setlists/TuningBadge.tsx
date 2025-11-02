'use client';

import { useState, useRef, useEffect } from 'react';
import { TuningType } from '@/lib/types';
import { getTuningInfo, getTuningsOrderedByPopularity } from '@/lib/utils/tuning';
import { ChevronDown } from 'lucide-react';

interface TuningBadgeProps {
  tuning: TuningType;
  onChange?: (newTuning: TuningType) => void;
  disabled?: boolean;
  className?: string;
}

export function TuningBadge({ 
  tuning, 
  onChange,
  disabled = false,
  className = ''
}: TuningBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const tuningInfo = getTuningInfo(tuning);
  const allTunings = getTuningsOrderedByPopularity();
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(allTunings.findIndex(t => t.type === tuning));
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, allTunings.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0) {
          handleTuningSelect(allTunings[focusedIndex].type);
        }
        break;
    }
  };

  const handleTuningSelect = (newTuning: TuningType) => {
    onChange?.(newTuning);
    setIsOpen(false);
    setFocusedIndex(-1);
    buttonRef.current?.focus();
  };

  const handleButtonClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setFocusedIndex(allTunings.findIndex(t => t.type === tuning));
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          px-2 py-1 rounded-md text-xs font-semibold text-white transition-all
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500
          flex items-center gap-1 min-w-0 shadow-sm
          ${tuningInfo.color}
          ${disabled 
            ? 'opacity-60 cursor-not-allowed' 
            : 'cursor-pointer hover:opacity-95 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
          }
        `}
        aria-label={`Guitar tuning: ${tuningInfo.name}. Click to change tuning.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{tuningInfo.name}</span>
        {!disabled && (
          <ChevronDown 
            className={`h-3 w-3 flex-shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        )}
      </button>

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 left-0 bg-popover border border-border rounded-md shadow-lg min-w-[200px] max-h-60 overflow-y-auto"
          role="listbox"
          aria-label="Guitar tuning options"
        >
          {allTunings.map((tuningOption, index) => (
            <button
              key={tuningOption.type}
              onClick={() => handleTuningSelect(tuningOption.type)}
              className={`
                w-full px-3 py-2 text-left text-sm transition-colors
                flex items-center justify-between
                ${index === focusedIndex 
                  ? 'bg-accent text-accent-foreground' 
                  : 'hover:bg-accent hover:text-accent-foreground'
                }
                ${tuningOption.type === tuning ? 'font-medium' : ''}
              `}
              role="option"
              aria-selected={tuningOption.type === tuning}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {tuningOption.info.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  ({tuningOption.info.notes})
                </div>
              </div>
              {tuningOption.type === tuning && (
                <div className="flex-shrink-0 ml-2 text-primary">✓</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}