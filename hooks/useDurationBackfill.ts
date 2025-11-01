'use client';

import { useEffect, useRef } from 'react';

interface UseDurationBackfillOptions {
  songId: string;
  title: string;
  artist: string;
  currentDuration?: number | null;
  enabled?: boolean;
  onUpdate?: (duration: number) => void;
}

// Global cache to prevent redundant API calls
const durationCache = new Map<string, { duration: number | null; timestamp: number }>();
const pendingRequests = new Set<string>();

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

export function useDurationBackfill({
  songId,
  title,
  artist,
  currentDuration,
  enabled = true,
  onUpdate,
}: UseDurationBackfillOptions) {
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Don't run if disabled, already has duration, or already attempted
    if (!enabled || currentDuration || hasAttempted.current) {
      return;
    }

    // Create cache key
    const cacheKey = `${title.toLowerCase()}_${artist.toLowerCase()}`;
    
    // Check if already pending
    if (pendingRequests.has(cacheKey)) {
      return;
    }

    // Check cache first
    const cached = durationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      if (cached.duration && onUpdate) {
        onUpdate(cached.duration);
      }
      hasAttempted.current = true;
      return;
    }

    // Mark as attempted and pending
    hasAttempted.current = true;
    pendingRequests.add(cacheKey);

    // Background fetch with error handling
    const fetchDuration = async () => {
      try {
        const response = await fetch('/api/songs/duration-backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'single',
            songId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          
          // Cache the result (even if null)
          durationCache.set(cacheKey, {
            duration: data.duration || null,
            timestamp: Date.now(),
          });

          // Update if successful and callback provided
          if (data.updated && data.duration && onUpdate) {
            onUpdate(data.duration);
          }
        } else {
          // Cache null result to prevent retrying
          durationCache.set(cacheKey, {
            duration: null,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        // Silently fail - this is background processing
        
        // Cache null result to prevent retrying
        durationCache.set(cacheKey, {
          duration: null,
          timestamp: Date.now(),
        });
      } finally {
        pendingRequests.delete(cacheKey);
      }
    };

    // Add small delay to avoid overwhelming the API when many songs load at once
    const delay = Math.random() * 2000 + 500; // 500-2500ms random delay
    const timeoutId = setTimeout(fetchDuration, delay);

    return () => {
      clearTimeout(timeoutId);
      pendingRequests.delete(cacheKey);
    };
  }, [songId, title, artist, currentDuration, enabled, onUpdate]);

  return {
    isBackfilling: pendingRequests.has(`${title.toLowerCase()}_${artist.toLowerCase()}`),
  };
}