'use client';

import React from 'react';
import { RealtimeEvent } from '@/lib/types/realtime';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Users, 
  Calendar, 
  Music, 
  Clock,
  Volume2,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface LiveUpdateBannerProps {
  isVisible: boolean;
  event: RealtimeEvent | null;
  onAccept?: () => void;
  onDismiss?: () => void;
  onViewChanges?: () => void;
  allowDismiss?: boolean;
}

export function LiveUpdateBanner({
  isVisible,
  event,
  onAccept,
  onDismiss,
  onViewChanges,
  allowDismiss = true,
}: LiveUpdateBannerProps) {
  if (!isVisible || !event) return null;

  const getEventIcon = (eventType: RealtimeEvent['type']) => {
    switch (eventType) {
      case 'gig:created':
      case 'gig:updated':
      case 'gig:deleted':
        return <Calendar className="h-4 w-4" />;
      case 'gig:response':
        return (event.data as { response: 'yes' | 'no' }).response === 'yes' 
          ? <CheckCircle className="h-4 w-4 text-green-500" />
          : <XCircle className="h-4 w-4 text-red-500" />;
      case 'rehearsal:created':
      case 'rehearsal:updated':
      case 'rehearsal:deleted':
        return <Clock className="h-4 w-4" />;
      case 'setlist:created':
      case 'setlist:updated':
      case 'setlist:deleted':
      case 'setlist:song:added':
      case 'setlist:song:removed':
      case 'setlist:song:updated':
      case 'setlist:song:reordered':
        return <Music className="h-4 w-4" />;
      case 'member:joined':
      case 'member:left':
      case 'member:updated':
        return <Users className="h-4 w-4" />;
      case 'band:updated':
        return <Volume2 className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getEventMessage = () => {
    const userName = event.userDisplayName || 'Someone';
    
    switch (event.type) {
      case 'gig:created': {
        const gigData = event.data as { name: string; isPotential: boolean };
        return `${userName} created a new ${gigData.isPotential ? 'potential gig' : 'gig'}: ${gigData.name}`;
      }
      case 'gig:updated':
        return `${userName} updated a gig`;
      case 'gig:deleted':
        return `${userName} deleted a gig`;
      case 'gig:response': {
        const responseData = event.data as { memberName: string; response: 'yes' | 'no' };
        return `${responseData.memberName} responded ${responseData.response} to a gig`;
      }
      case 'rehearsal:created': {
        const rehearsalData = event.data as { name: string };
        return `${userName} scheduled a new rehearsal: ${rehearsalData.name}`;
      }
      case 'rehearsal:updated':
        return `${userName} updated a rehearsal`;
      case 'rehearsal:deleted':
        return `${userName} cancelled a rehearsal`;
      case 'setlist:created': {
        const setlistData = event.data as { name: string };
        return `${userName} created a new setlist: ${setlistData.name}`;
      }
      case 'setlist:updated':
        return `${userName} updated a setlist`;
      case 'setlist:deleted':
        return `${userName} deleted a setlist`;
      case 'setlist:song:added':
        return `${userName} added a song to a setlist`;
      case 'setlist:song:removed':
        return `${userName} removed a song from a setlist`;
      case 'setlist:song:updated':
        return `${userName} updated a song in a setlist`;
      case 'setlist:song:reordered':
        return `${userName} reordered songs in a setlist`;
      case 'member:joined': {
        const memberData = event.data as { firstName?: string; lastName?: string };
        return `${memberData.firstName} ${memberData.lastName} joined the band`;
      }
      case 'member:left': {
        const memberData = event.data as { firstName?: string; lastName?: string };
        return `${memberData.firstName} ${memberData.lastName} left the band`;
      }
      case 'member:updated':
        return `${userName} updated their profile`;
      case 'band:updated':
        return `${userName} updated the band information`;
      default:
        return `${userName} made a change`;
    }
  };

  const getBannerColor = () => {
    switch (event.type) {
      case 'gig:response':
        return (event.data as { response: 'yes' | 'no' }).response === 'yes' 
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'member:joined':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'member:left':
      case 'gig:deleted':
      case 'rehearsal:deleted':
      case 'setlist:deleted':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      default:
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
    }
  };

  const showViewChanges = onViewChanges && (
    event.type.includes(':updated') || 
    event.type === 'setlist:song:reordered'
  );

  return (
    <div className={`
      fixed top-4 right-4 left-4 z-40 mx-auto max-w-2xl
      border rounded-lg p-4 shadow-lg backdrop-blur-sm
      ${getBannerColor()}
      animate-in slide-in-from-top-2 duration-300
    `}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getEventIcon(event.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Live Update
            </p>
            <Badge variant="secondary" className="text-xs">
              Just now
            </Badge>
          </div>
          
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {getEventMessage()}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {showViewChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewChanges}
              className="text-xs h-7"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              View Changes
            </Button>
          )}
          
          {onAccept && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAccept}
              className="text-xs h-7"
            >
              Refresh
            </Button>
          )}
          
          {allowDismiss && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-xs h-7 text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface LiveUpdateBadgeProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export function LiveUpdateBadge({ count, onClick, className = '' }: LiveUpdateBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full
        bg-blue-100 dark:bg-blue-900/50 
        border border-blue-200 dark:border-blue-800
        text-xs font-medium text-blue-700 dark:text-blue-300
        hover:bg-blue-200 dark:hover:bg-blue-900/70
        transition-colors duration-200
        ${className}
      `}
    >
      <RefreshCw className="h-3 w-3" />
      {count} new update{count !== 1 ? 's' : ''}
    </button>
  );
}

interface OptimisticUpdateIndicatorProps {
  status: 'pending' | 'confirmed' | 'failed';
  className?: string;
}

export function OptimisticUpdateIndicator({ 
  status, 
  className = '' 
}: OptimisticUpdateIndicatorProps) {
  const getIndicator = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs">Saving...</span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            <span className="text-xs">Saved</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            <span className="text-xs">Failed to save</span>
          </div>
        );
    }
  };

  return (
    <div className={`inline-flex ${className}`}>
      {getIndicator()}
    </div>
  );
}