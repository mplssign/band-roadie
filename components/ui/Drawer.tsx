import { ReactNode, useEffect } from 'react';
import { clsx } from 'clsx';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  children: ReactNode;
}

export function Drawer({ open, onClose, side, children }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div 
        className="drawer-backdrop animate-in fade-in-0 duration-300" 
        onClick={onClose}
      />
      <div 
        className={clsx(
          side === 'left' ? 'drawer-left' : 'drawer-right',
          'animate-in duration-300 ease-out',
          {
            'slide-in-from-left': side === 'left',
            'slide-in-from-right': side === 'right',
          }
        )}
      >
        {children}
      </div>
    </>
  );
}
