'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface BpmInputProps {
  value?: number;
  onChange: (value: number | undefined) => void;
  className?: string;
  placeholder?: string;
}

export function BpmInput({ value, onChange, className, placeholder = "BPM" }: BpmInputProps) {
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  useEffect(() => {
    setInputValue(value?.toString() || '');
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentValue = parseInt(inputValue) || 0;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      const newValue = Math.min(currentValue + step, 999);
      setInputValue(newValue.toString());
      onChange(newValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      const newValue = Math.max(currentValue - step, 0);
      setInputValue(newValue.toString());
      onChange(newValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('BpmInput handleChange:', { newValue, oldValue: inputValue });
    setInputValue(newValue);
    
    // Only call onChange if it's a valid number or empty
    if (newValue === '') {
      console.log('BpmInput: Setting to undefined');
      onChange(undefined);
    } else {
      const numValue = parseInt(newValue);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 999) {
        console.log('BpmInput: Setting to', numValue);
        onChange(numValue);
      }
    }
  };

  const handleBlur = () => {
    console.log('BpmInput handleBlur:', { inputValue });
    // Clean up the input value on blur
    const numValue = parseInt(inputValue);
    if (isNaN(numValue)) {
      console.log('BpmInput blur: Setting to undefined (NaN)');
      setInputValue('');
      onChange(undefined);
    } else {
      const clampedValue = Math.max(0, Math.min(999, numValue));
      console.log('BpmInput blur: Setting to clamped value:', clampedValue);
      setInputValue(clampedValue.toString());
      onChange(clampedValue);
    }
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`w-20 text-center ${className || ''}`}
      title="Use ↑/↓ arrows to adjust BPM (Shift + arrows for ±5)"
    />
  );
}