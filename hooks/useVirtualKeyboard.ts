'use client';

import { useState, useEffect, useCallback } from 'react';

interface VirtualKeyboardState {
  isKeyboardOpen: boolean;
  viewportHeight: number;
  keyboardHeight: number;
}

/**
 * Hook to detect virtual keyboard show/hide events on mobile devices
 * 
 * This hook monitors viewport height changes to determine when the virtual
 * keyboard is displayed, which is useful for adjusting UI layout to ensure
 * important elements remain visible above the keyboard.
 * 
 * @returns Object containing keyboard state and measurements
 */
export function useVirtualKeyboard() {
  const [state, setState] = useState<VirtualKeyboardState>({
    isKeyboardOpen: false,
    viewportHeight: 0,
    keyboardHeight: 0,
  });

  const [initialViewportHeight, setInitialViewportHeight] = useState(0);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Store initial viewport height
    const initialHeight = window.innerHeight;
    setInitialViewportHeight(initialHeight);
    setState(prev => ({ ...prev, viewportHeight: initialHeight }));

    const handleViewportChange = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialHeight - currentHeight;
      
      // Consider keyboard open if viewport shrunk by more than 150px
      // This threshold accounts for browser UI changes on mobile
      const isKeyboardOpen = heightDifference > 150;
      const keyboardHeight = isKeyboardOpen ? heightDifference : 0;

      setState({
        isKeyboardOpen,
        viewportHeight: currentHeight,
        keyboardHeight,
      });
    };

    // Listen for viewport changes
    window.addEventListener('resize', handleViewportChange);
    
    // Also listen for visual viewport API if available (more accurate)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  return state;
}

/**
 * Hook to adjust element position when virtual keyboard is shown
 * 
 * This hook provides a style object that can be applied to elements
 * to shift them up when the keyboard appears, ensuring they remain visible.
 * 
 * @param enabled - Whether to apply the adjustment
 * @param offset - Additional offset in pixels (default: 20)
 * @returns Style object with transform adjustment
 */
export function useKeyboardAdjustment(enabled: boolean = true, offset: number = 20) {
  const { isKeyboardOpen, keyboardHeight } = useVirtualKeyboard();

  return {
    transform: enabled && isKeyboardOpen 
      ? `translateY(-${Math.min(keyboardHeight - offset, keyboardHeight * 0.5)}px)`
      : 'none',
    transition: 'transform 0.3s ease-out',
  };
}