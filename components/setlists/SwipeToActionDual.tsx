'use client';

import { useState, useRef, ReactNode } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';

interface SwipeToActionDualProps {
  children: ReactNode;
  onSwipeLeft?: () => void;  // Delete action
  onSwipeRight?: () => void; // Copy action
  onTap?: () => void; // Tap action
  leftActionLabel?: string;
  rightActionLabel?: string;
  className?: string;
  mode?: 'view' | 'edit';
  renderActions?: (mode: 'view' | 'edit') => ReactNode;
}

export function SwipeToActionDual({ 
  children, 
  onSwipeLeft, 
  onSwipeRight,
  onTap,
  leftActionLabel = 'Delete',
  rightActionLabel = 'Copy',
  className = '',
  mode = 'edit',
  renderActions
}: SwipeToActionDualProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [actionTriggered, setActionTriggered] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const elementRef = useRef<HTMLDivElement>(null);

  // Viewport-based thresholds
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const PEEK = 0.12 * vw;
  const TARGET = 0.25 * vw;
  const HARD = 0.6 * vw;
  const TAP_THRESHOLD = 10; // pixels - movements smaller than this are considered taps

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsDragging(true);
    setActionTriggered(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    currentX.current = e.touches[0].clientX;
    const deltaX = currentX.current - startX.current;
    
    // Clamp based on mode
    const maxDrag = mode === 'view' ? PEEK : HARD;
    const clampedDelta = Math.max(Math.min(deltaX, maxDrag), -maxDrag);
    setDragOffset(clampedDelta);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const deltaX = currentX.current - startX.current;
    const threshold = mode === 'view' ? PEEK : TARGET;
    
    // Check if this is a tap (small movement)
    if (Math.abs(deltaX) < TAP_THRESHOLD && onTap) {
      // This is a tap
      setDragOffset(0);
      setIsDragging(false);
      onTap();
      return;
    }
    
    if (deltaX <= -threshold && onSwipeLeft && mode === 'edit') {
      // Left swipe - Delete action
      setActionTriggered('left');
      onSwipeLeft();
      
      // Reset after action
      setTimeout(() => {
        setDragOffset(0);
        setActionTriggered(null);
        setIsDragging(false);
      }, 1500);
    } else if (deltaX >= threshold && onSwipeRight && mode === 'edit') {
      // Right swipe - Copy action
      setActionTriggered('right');
      onSwipeRight();
      
      // Reset after success feedback
      setTimeout(() => {
        setDragOffset(0);
        setActionTriggered(null);
        setIsDragging(false);
      }, 1500);
    } else {
      // Snap back
      setDragOffset(0);
      setIsDragging(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    currentX.current = startX.current;
    setIsDragging(true);
    setActionTriggered(null);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      currentX.current = e.clientX;
      const deltaX = currentX.current - startX.current;
      
      // Clamp based on mode
      const maxDrag = mode === 'view' ? PEEK : HARD;
      const clampedDelta = Math.max(Math.min(deltaX, maxDrag), -maxDrag);
      setDragOffset(clampedDelta);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      const deltaX = currentX.current - startX.current;
      const threshold = mode === 'view' ? PEEK : TARGET;
      
      // Check if this is a tap (small movement)
      if (Math.abs(deltaX) < TAP_THRESHOLD && onTap) {
        // This is a tap
        setDragOffset(0);
        setIsDragging(false);
        onTap();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        return;
      }
      
      if (deltaX <= -threshold && onSwipeLeft && mode === 'edit') {
        setActionTriggered('left');
        onSwipeLeft();
        
        setTimeout(() => {
          setDragOffset(0);
          setActionTriggered(null);
          setIsDragging(false);
        }, 1500);
      } else if (deltaX >= threshold && onSwipeRight && mode === 'edit') {
        setActionTriggered('right');
        onSwipeRight();
        
        setTimeout(() => {
          setDragOffset(0);
          setActionTriggered(null);
          setIsDragging(false);
        }, 1500);
      } else {
        setDragOffset(0);
        setIsDragging(false);
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate opacity for action indicators based on mode
  const threshold = mode === 'view' ? PEEK : TARGET;
  const leftActionOpacity = Math.min(Math.abs(Math.min(dragOffset, 0)) / threshold, 1);
  const rightActionOpacity = Math.min(Math.max(dragOffset, 0) / threshold, 1);
  const leftActionScale = 0.8 + (leftActionOpacity * 0.2);
  const rightActionScale = 0.8 + (rightActionOpacity * 0.2);

  return (
    <div 
      ref={elementRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Action layers */}
      {renderActions ? (
        renderActions(mode)
      ) : (
        <>
          {/* Left Action overlay - Delete (swipe left to reveal) */}
          <div 
            className="absolute inset-0 bg-red-500 flex items-center justify-start pl-6 pointer-events-none"
            style={{
              transform: `translateX(${-100 + (Math.min(dragOffset, 0) / (mode === 'view' ? PEEK : HARD)) * 100}%)`,
              opacity: leftActionOpacity
            }}
          >
            <div 
              className="flex items-center gap-2 text-white font-medium"
              style={{
                transform: `scale(${leftActionScale})`,
                transition: actionTriggered === 'left' ? 'all 0.3s ease' : 'transform 0.1s ease'
              }}
            >
              {actionTriggered === 'left' ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>Deleted!</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5" />
                  <span>{leftActionLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* Right Action overlay - Copy (swipe right to reveal) */}
          <div 
            className="absolute inset-0 bg-blue-500 flex items-center justify-end pr-6 pointer-events-none"
            style={{
              transform: `translateX(${100 - (Math.max(dragOffset, 0) / (mode === 'view' ? PEEK : HARD)) * 100}%)`,
              opacity: rightActionOpacity
            }}
          >
            <div 
              className="flex items-center gap-2 text-white font-medium"
              style={{
                transform: `scale(${rightActionScale})`,
                transition: actionTriggered === 'right' ? 'all 0.3s ease' : 'transform 0.1s ease'
              }}
            >
              {actionTriggered === 'right' ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  <span>{rightActionLabel}</span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div
        className="bg-background relative z-10"
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease'
        }}
      >
        {children}
      </div>
    </div>
  );
}