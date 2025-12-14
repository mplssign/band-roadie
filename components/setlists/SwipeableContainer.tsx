'use client';

import { ReactNode, memo, useCallback, useMemo } from 'react';
import { SwipeToActionDual } from './SwipeToActionDual';
import { SwipeActions } from './SwipeActions';

interface SwipeableContainerProps {
  children: ReactNode;
  mode: 'edit' | 'view';
  onCopy?: () => void;
  onDelete?: () => void;
  onTap?: () => void;
  className?: string;
}

export const SwipeableContainer = memo(function SwipeableContainer({
  children,
  mode,
  onCopy,
  onDelete,
  onTap,
  className = ''
}: SwipeableContainerProps) {
  const defaultCopy = useCallback(() => {}, []);
  const defaultDelete = useCallback(() => {}, []);

  const renderActions = useCallback((currentMode: 'edit' | 'view') => (
    <SwipeActions 
      interactive={currentMode === 'edit'}
      onCopy={onCopy || defaultCopy}
      onDelete={onDelete || defaultDelete}
    />
  ), [onCopy, onDelete, defaultCopy, defaultDelete]);

  const containerProps = useMemo(() => ({
    role: onTap ? "button" as const : undefined,
    tabIndex: onTap ? 0 : undefined,
    className: "cursor-pointer"
  }), [onTap]);

  return (
    <SwipeToActionDual
      mode={mode}
      onSwipeLeft={onDelete}
      onSwipeRight={onCopy}
      onTap={onTap}
      leftActionLabel="Delete"
      rightActionLabel="Copy"
      className={className}
      renderActions={renderActions}
    >
      <div {...containerProps}>
        {children}
      </div>
    </SwipeToActionDual>
  );
});