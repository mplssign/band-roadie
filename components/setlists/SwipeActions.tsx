'use client';

import { Copy, Trash2 } from 'lucide-react';

interface SwipeActionsProps {
  onCopy: () => void;
  onDelete: () => void;
  interactive?: boolean;
}

export function SwipeActions({ onCopy, onDelete, interactive = true }: SwipeActionsProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-0">
      {/* Left zone (copy action - blue) */}
      <div className="flex items-center justify-start h-full" style={{ width: '25vw' }}>
        <button
          onClick={(e) => {
            if (interactive) {
              e.stopPropagation();
              onCopy();
            }
          }}
          className={`h-12 w-12 rounded-full grid place-items-center shadow-md ml-3 ${
            interactive ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={{ 
            marginLeft: '12px',
            backgroundColor: '#2563eb' // blue-600
          }}
          aria-label={interactive ? 'Copy to setlist' : undefined}
          aria-hidden={!interactive}
          tabIndex={interactive ? 0 : -1}
        >
          <Copy className="text-white h-5 w-5" />
        </button>
      </div>

      {/* Right zone (delete action - red) */}
      <div className="flex items-center justify-end h-full" style={{ width: '25vw' }}>
        <button
          onClick={(e) => {
            if (interactive) {
              e.stopPropagation();
              onDelete();
            }
          }}
          className={`h-12 w-12 rounded-full grid place-items-center shadow-md mr-3 ${
            interactive ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={{ 
            marginRight: '12px',
            backgroundColor: '#dc2626' // red-600
          }}
          aria-label={interactive ? 'Delete song' : undefined}
          aria-hidden={!interactive}
          tabIndex={interactive ? 0 : -1}
        >
          <Trash2 className="text-white h-5 w-5" />
        </button>
      </div>
    </div>
  );
}