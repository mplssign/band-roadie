'use client';

import { Copy, Trash2 } from 'lucide-react';

interface SwipeActionsProps {
  onCopy: () => void;
  onDelete: () => void;
}

export function SwipeActions({ onCopy, onDelete }: SwipeActionsProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-0">
      {/* Left zone (copy action) */}
      <div className="flex items-center justify-start h-full" style={{ width: '25vw' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="h-12 w-12 rounded-full grid place-items-center shadow-md bg-blue-600 pointer-events-auto ml-3"
          aria-label="Copy song"
          style={{ marginLeft: '12px' }}
        >
          <Copy className="text-white h-5 w-5" />
        </button>
      </div>

      {/* Right zone (delete action) */}
      <div className="flex items-center justify-end h-full" style={{ width: '25vw' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-12 w-12 rounded-full grid place-items-center shadow-md bg-red-600 pointer-events-auto mr-3"
          aria-label="Delete song"
          style={{ marginRight: '12px' }}
        >
          <Trash2 className="text-white h-5 w-5" />
        </button>
      </div>
    </div>
  );
}