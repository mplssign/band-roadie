'use client';

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";
import { Button } from "./button";

// Re-export all the Sheet components as-is
export {
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

// Enhanced Sheet that includes all original Sheet props
interface SheetWithCloseProps extends React.ComponentPropsWithoutRef<typeof Sheet> {
  children: React.ReactNode;
}

export const SheetWithClose: React.FC<SheetWithCloseProps> = ({ children, ...props }) => (
  <Sheet {...props}>
    {children}
  </Sheet>
);
SheetWithClose.displayName = "SheetWithClose";

// Enhanced SheetContent with built-in close button and lighter surface
interface SheetContentWithCloseProps
  extends React.ComponentPropsWithoutRef<typeof SheetContent> {
  showCloseButton?: boolean;
  closeButtonProps?: React.ComponentPropsWithoutRef<typeof Button>;
}

export const SheetContentWithClose = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  SheetContentWithCloseProps
>(({ 
  className, 
  children, 
  showCloseButton = true, 
  closeButtonProps,
  ...props 
}, ref) => (
  <SheetContent
    ref={ref}
    className={cn("br-drawer-surface", className)}
    {...props}
  >
    {/* Close button positioned at top-right */}
    {showCloseButton && (
      <SheetClose asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute top-3 right-3 z-50",
            "h-11 w-11 min-h-[44px] min-w-[44px]", // Large touch target
            "rounded-full",
            "hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-colors"
          )}
          aria-label="Close"
          {...closeButtonProps}
        >
          <X className="h-5 w-5" />
        </Button>
      </SheetClose>
    )}
    
    {children}
  </SheetContent>
));
SheetContentWithClose.displayName = "SheetContentWithClose";

// For convenience, also export the enhanced content as default SheetContent
export { SheetContentWithClose as SheetContent };