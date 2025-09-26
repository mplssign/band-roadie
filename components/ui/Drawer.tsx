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

  return (
    <>
      {open && (
        <div 
          className="drawer-backdrop" 
          onClick={onClose}
        />
      )}
      <div 
        className={clsx(
          side === 'left' ? 'drawer-left' : 'drawer-right',
          {
            '-translate-x-full': side === 'left' && !open,
            'translate-x-full': side === 'right' && !open,
            'translate-x-0': open,
          }
        )}
      >
        {children}
      </div>
    </>
  );
}
