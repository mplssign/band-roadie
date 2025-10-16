import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '@/lib/utils';

type ToggleGroupRef = React.ElementRef<typeof ToggleGroupPrimitive.Root>;
type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>;

const ToggleGroup = React.forwardRef<ToggleGroupRef, ToggleGroupProps>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex gap-2', className)}
    {...props}
  />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

type ToggleGroupItemRef = React.ElementRef<typeof ToggleGroupPrimitive.Item>;

interface ToggleGroupItemProps extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> {
  variant?: 'default' | 'outline';
  children?: React.ReactNode;
}

const ToggleGroupItem = React.forwardRef<ToggleGroupItemRef, ToggleGroupItemProps>(
  ({ className, variant = 'default', children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-md px-3 py-2 h-10 text-sm font-medium transition-colors border text-muted-foreground hover:bg-accent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
      variant === 'outline'
        ? 'border-border bg-card'
        : 'border-transparent bg-muted',
      className
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
  )
);
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
