/**
 * Custom hook for managing focus in modals, drawers, and dialogs
 * Provides automatic focus trapping, restoration, and keyboard navigation
 */

import { useEffect, useRef, useCallback } from 'react';
import { focusUtils, keyboardUtils } from '@/lib/accessibility-utils';

interface UseFocusManagementOptions {
  isOpen: boolean;
  onClose?: () => void;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  trapFocus?: boolean;
}

export function useFocusManagement({
  isOpen,
  onClose,
  autoFocus = true,
  restoreFocus = true,
  trapFocus = true
}: UseFocusManagementOptions) {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when opening
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Auto-focus first element when opening
  useEffect(() => {
    if (isOpen && autoFocus && containerRef.current) {
      focusUtils.autoFocusFirst(containerRef.current);
    }
  }, [isOpen, autoFocus]);

  // Restore focus when closing
  useEffect(() => {
    if (!isOpen && restoreFocus) {
      focusUtils.restoreFocus(previousActiveElementRef.current);
    }
  }, [isOpen, restoreFocus]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen || !containerRef.current) return;

    // Handle escape key
    if (event.key === 'Escape' && onClose) {
      keyboardUtils.handleEscapeKey(event, onClose);
    }

    // Handle focus trapping
    if (trapFocus) {
      focusUtils.trapFocus(containerRef.current, event);
    }
  }, [isOpen, onClose, trapFocus]);

  // Attach/detach keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  return {
    containerRef,
    handleKeyDown
  };
}