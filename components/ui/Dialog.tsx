import { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-md p-4">
        <div className="bg-card rounded-lg p-6 shadow-lg">
          {title && (
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
