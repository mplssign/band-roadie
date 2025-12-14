'use client';

import { useState, useRef, ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';

interface SwipeToActionProps {
  children: ReactNode;
  onSwipeAction: () => void;
  actionLabel?: string;
  className?: string;
}

export function SwipeToAction({ 
  children, 
  onSwipeAction, 
  actionLabel = 'Copy',
  className = '' 
}: SwipeToActionProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isActioned, setIsActioned] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const elementRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80; // Distance needed to trigger action
  const MAX_DRAG = 120; // Maximum drag distance

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsDragging(true);
    setIsActioned(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    currentX.current = e.touches[0].clientX;
    const deltaX = currentX.current - startX.current;
    
    // Only allow left swipe (negative delta)
    if (deltaX < 0) {
      const clampedDelta = Math.max(deltaX, -MAX_DRAG);
      setDragOffset(clampedDelta);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const deltaX = currentX.current - startX.current;
    
    if (deltaX <= -SWIPE_THRESHOLD) {
      // Trigger action
      setIsActioned(true);
      onSwipeAction();
      
      // Reset after success feedback
      setTimeout(() => {
        setDragOffset(0);
        setIsActioned(false);
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
    setIsActioned(false);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      currentX.current = e.clientX;
      const deltaX = currentX.current - startX.current;
      
      if (deltaX < 0) {
        const clampedDelta = Math.max(deltaX, -MAX_DRAG);
        setDragOffset(clampedDelta);
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      const deltaX = currentX.current - startX.current;
      
      if (deltaX <= -SWIPE_THRESHOLD) {
        setIsActioned(true);
        onSwipeAction();
        
        setTimeout(() => {
          setDragOffset(0);
          setIsActioned(false);
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

  const actionOpacity = Math.min(Math.abs(dragOffset) / SWIPE_THRESHOLD, 1);
  const actionScale = 0.8 + (actionOpacity * 0.2);

  return (
    <div 
      ref={elementRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Action overlay - shown on swipe */}
      <div 
        className="absolute inset-0 bg-blue-500 flex items-center justify-end pr-6 pointer-events-none"
        style={{
          transform: `translateX(${100 + (dragOffset / MAX_DRAG) * 100}%)`,
          opacity: actionOpacity
        }}
      >
        <div 
          className="flex items-center gap-2 text-white font-medium"
          style={{
            transform: `scale(${actionScale})`,
            transition: isActioned ? 'all 0.3s ease' : 'transform 0.1s ease'
          }}
        >
          {isActioned ? (
            <>
              <Check className="h-5 w-5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-5 w-5" />
              <span>{actionLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div
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