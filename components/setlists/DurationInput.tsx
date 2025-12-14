'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface DurationInputProps {
  value?: number; // Duration in seconds
  onChange: (value: number | undefined) => void;
  className?: string;
  placeholder?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function parseDuration(input: string): number | undefined {
  // Handle MM:SS format
  const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const minutes = parseInt(timeMatch[1]);
    const seconds = parseInt(timeMatch[2]);
    if (seconds < 60) {
      return minutes * 60 + seconds;
    }
  }
  
  // Handle just minutes (e.g., "3" = 3:00)
  const minutesOnly = parseInt(input);
  if (!isNaN(minutesOnly) && minutesOnly >= 0 && minutesOnly <= 59) {
    return minutesOnly * 60;
  }
  
  return undefined;
}

export function DurationInput({ value, onChange, className, placeholder = "M:SS" }: DurationInputProps) {
  const [inputValue, setInputValue] = useState(value ? formatDuration(value) : '');

  useEffect(() => {
    setInputValue(value ? formatDuration(value) : '');
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentValue = value || 0;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey ? 30 : 15; // 30 seconds or 15 seconds
      const newValue = currentValue + step;
      const formatted = formatDuration(newValue);
      setInputValue(formatted);
      onChange(newValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 30 : 15; // 30 seconds or 15 seconds
      const newValue = Math.max(currentValue - step, 0);
      const formatted = formatDuration(newValue);
      setInputValue(formatted);
      onChange(newValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Parse the input and update if valid
    if (newValue === '') {
      onChange(undefined);
    } else {
      const parsedValue = parseDuration(newValue);
      if (parsedValue !== undefined) {
        onChange(parsedValue);
      }
    }
  };

  const handleBlur = () => {
    // Clean up the input value on blur
    if (inputValue === '') {
      onChange(undefined);
      return;
    }
    
    const parsedValue = parseDuration(inputValue);
    if (parsedValue !== undefined) {
      const formatted = formatDuration(parsedValue);
      setInputValue(formatted);
      onChange(parsedValue);
    } else {
      // Invalid input, revert to previous value
      setInputValue(value ? formatDuration(value) : '');
    }
  };

  return (
    <Input
      type="text"
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`w-16 text-center text-sm ${className || ''}`}
      title="Enter duration as M:SS (e.g., 3:45) or just minutes (e.g., 3). Use ↑/↓ arrows to adjust by ±15s (Shift for ±30s)"
    />
  );
}