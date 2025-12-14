'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Which side the panel slides from */
  side?: DrawerSide;
  /** Width class for left/right drawers (ignored for top/bottom) */
  widthClassName?: string;
  /** Height class for top/bottom drawers (ignored for left/right) */
  heightClassName?: string;
  /** Extra classes for the overlay */
  overlayClassName?: string;
  /** Extra classes for the panel (bg, borders, etc.) */
  panelClassName?: string;
  /** Base z-index (overlay = z, panel = z+1) */
  mountZ?: number;
};

export default function AnimatedDrawer({
  isOpen,
  onClose,
  children,
  side = 'right',
  widthClassName = 'w-full max-w-md',
  heightClassName = 'h-[90vh]',
  overlayClassName = 'bg-background/70 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60',
  panelClassName = 'bg-card/95 text-foreground border-border shadow-2xl shadow-primary/20 backdrop-blur-lg',
  mountZ = 60,
}: Props) {
  const isHorizontal = side === 'left' || side === 'right';

  const initial = isHorizontal
    ? { x: side === 'right' ? 480 : -480, y: 0 }
    : { x: 0, y: side === 'bottom' ? 480 : -480 };
  const animate = { x: 0, y: 0 };
  const exit = initial;

  const sidePos =
    side === 'right'
      ? 'right-0 top-0 bottom-0'
      : side === 'left'
      ? 'left-0 top-0 bottom-0'
      : side === 'bottom'
      ? 'left-0 right-0 bottom-0'
      : 'left-0 right-0 top-0';

  const sizeClass = isHorizontal ? widthClassName : heightClassName;

  const borderClass =
    side === 'right'
      ? 'border-l'
      : side === 'left'
      ? 'border-r'
      : side === 'bottom'
      ? 'border-t rounded-t-3xl'
      : 'border-b rounded-b-3xl';

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`fixed inset-0 ${overlayClassName}`}
            style={{ zIndex: mountZ }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`fixed ${sidePos} ${sizeClass} ${panelClassName} ${borderClass} overflow-hidden`}
            style={{ zIndex: mountZ + 1 }}
            initial={initial}
            animate={animate}
            exit={exit}
            transition={{ type: 'tween', duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
