'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeEvent, OptimisticUpdate } from '@/lib/types/realtime';
import { useBands } from '@/contexts/BandsContext';
import { useToast } from '@/hooks/useToast';

interface UseRealtimeOptions {
  /**
   * Filter events to specific types (optional)
   */
  eventTypes?: RealtimeEvent['type'][];
  
  /**
   * Handle incoming real-time events
   */
  onEvent?: (event: RealtimeEvent) => void;
  
  /**
   * Handle connection errors
   */
  onError?: (error: Error) => void;
  
  /**
   * Handle reconnection events
   */
  onReconnect?: () => void;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
  
  /**
   * Disable automatic reconnection
   */
  disableReconnect?: boolean;
}

interface UseRealtimeReturn {
  /**
   * Whether the connection is currently active
   */
  connected: boolean;
  
  /**
   * Connection error if any
   */
  error: Error | null;
  
  /**
   * Manually reconnect
   */
  reconnect: () => void;
  
  /**
   * Close the connection
   */
  disconnect: () => void;
  
  /**
   * Add an optimistic update
   */
  addOptimisticUpdate: (update: Omit<OptimisticUpdate, 'id' | 'timestamp'>) => string;
  
  /**
   * Confirm an optimistic update (remove from pending)
   */
  confirmOptimisticUpdate: (id: string) => void;
  
  /**
   * Fail an optimistic update (mark as failed)
   */
  failOptimisticUpdate: (id: string, error?: string) => void;
  
  /**
   * Get all pending optimistic updates
   */
  optimisticUpdates: OptimisticUpdate[];
}

/**
 * Hook for real-time updates within the current band context
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { currentBand } = useBands();
  const { showToast } = useToast();
  
  const {
    eventTypes,
    onEvent,
    onError,
    onReconnect,
    debug = false,
    disableReconnect = false,
  } = options;
  
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  
  const log = useCallback((message: string, ...args: unknown[]) => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[useRealtime] ${message}`, ...args);
    }
  }, [debug]);
  
  const connect = useCallback(() => {
    if (!currentBand?.id) {
      log('No current band, skipping connection');
      return;
    }
    
    if (eventSourceRef.current) {
      log('Connection already exists, cleaning up first');
      eventSourceRef.current.close();
    }
    
    log('Connecting to real-time updates for band:', currentBand.id);
    
    const url = `/api/realtime?bandId=${encodeURIComponent(currentBand.id)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      log('Connected to real-time updates');
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      
      if (onReconnect && reconnectAttempts.current > 0) {
        onReconnect();
      }
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle heartbeat
        if (data.type === 'heartbeat') {
          log('Received heartbeat');
          return;
        }
        
        // Handle connection confirmation
        if (data.type === 'connected') {
          log('Connection confirmed');
          return;
        }
        
        // Handle real-time events
        if (data.event) {
          const realtimeEvent: RealtimeEvent = data.event;
          
          log('Received event:', realtimeEvent.type, realtimeEvent.data);
          
          // Filter by event types if specified
          if (eventTypes && !eventTypes.includes(realtimeEvent.type)) {
            log('Event type filtered out:', realtimeEvent.type);
            return;
          }
          
          // Show toast notification for remote changes
          const userDisplayName = realtimeEvent.userDisplayName || 'Someone';
          const eventDescription = getEventDescription(realtimeEvent);
          
          if (eventDescription) {
            showToast(`${userDisplayName} ${eventDescription}`, 'info');
          }
          
          // Call custom event handler
          if (onEvent) {
            onEvent(realtimeEvent);
          }
        }
      } catch (err) {
        console.error('Failed to parse real-time event:', err);
      }
    };
    
    eventSource.onerror = (event) => {
      log('Connection error:', event);
      setConnected(false);
      
      const errorObj = new Error('Real-time connection error');
      setError(errorObj);
      
      if (onError) {
        onError(errorObj);
      }
      
      // Attempt to reconnect unless disabled
      if (!disableReconnect && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
        log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        log('Max reconnection attempts reached or reconnection disabled');
      }
    };
  }, [currentBand?.id, eventTypes, onEvent, onError, onReconnect, disableReconnect, log, showToast]);
  
  const disconnect = useCallback(() => {
    log('Disconnecting from real-time updates');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setConnected(false);
    setError(null);
    reconnectAttempts.current = 0;
  }, [log]);
  
  const reconnect = useCallback(() => {
    log('Manual reconnection requested');
    disconnect();
    setTimeout(connect, 100);
  }, [connect, disconnect, log]);
  
  // Connect when band changes or component mounts
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  // Optimistic updates management
  const addOptimisticUpdate = useCallback((update: Omit<OptimisticUpdate, 'id' | 'timestamp'>): string => {
    const id = `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticUpdate: OptimisticUpdate = {
      ...update,
      id,
      timestamp: Date.now(),
    };
    
    setOptimisticUpdates(prev => [...prev, optimisticUpdate]);
    
    // Auto-fail after 10 seconds if not confirmed
    setTimeout(() => {
      setOptimisticUpdates(prev => 
        prev.map(u => u.id === id && u.status === 'pending' 
          ? { ...u, status: 'failed' as const } 
          : u
        )
      );
    }, 10000);
    
    return id;
  }, []);
  
  const confirmOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, []);
  
  const failOptimisticUpdate = useCallback((id: string, errorMessage?: string) => {
    setOptimisticUpdates(prev => 
      prev.map(u => u.id === id 
        ? { 
            ...u, 
            status: 'failed' as const, 
            data: typeof u.data === 'object' && u.data !== null 
              ? { ...u.data, error: errorMessage } 
              : { error: errorMessage }
          } 
        : u
      )
    );
  }, []);
  
  return {
    connected,
    error,
    reconnect,
    disconnect,
    addOptimisticUpdate,
    confirmOptimisticUpdate,
    failOptimisticUpdate,
    optimisticUpdates,
  };
}

/**
 * Get a human-readable description of an event for toast notifications
 */
function getEventDescription(event: RealtimeEvent): string | null {
  switch (event.type) {
    case 'gig:created':
      return `created a new ${event.data.isPotential ? 'potential gig' : 'gig'}: ${event.data.name}`;
    case 'gig:updated':
      return 'updated a gig';
    case 'gig:response':
      return `responded ${event.data.response} to ${event.data.memberName || 'a gig'}`;
    case 'rehearsal:created':
      return `scheduled a rehearsal: ${event.data.name}`;
    case 'rehearsal:updated':
      return 'updated a rehearsal';
    case 'setlist:created':
      return `created setlist: ${event.data.name}`;
    case 'setlist:song:added':
      return 'added a song to a setlist';
    case 'setlist:song:reordered':
      return 'reordered songs in a setlist';
    case 'member:joined':
      return 'joined the band';
    case 'member:left':
      return 'left the band';
    default:
      return null;
  }
}