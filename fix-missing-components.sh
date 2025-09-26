#!/bin/bash

echo "🔧 Creating missing components..."

# Create Toast component
cat > components/ui/Toast.tsx << 'EOF'
'use client';

import { useEffect } from 'react';
import { clsx } from 'clsx';
import { useToast } from '@/hooks/useToast';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'px-4 py-3 rounded-lg shadow-lg min-w-[250px] max-w-[400px]',
            'animate-in slide-in-from-bottom-5',
            {
              'bg-green-600 text-white': toast.type === 'success',
              'bg-red-600 text-white': toast.type === 'error',
              'bg-yellow-600 text-white': toast.type === 'warning',
              'bg-blue-600 text-white': toast.type === 'info',
            }
          )}
          onClick={() => removeToast(toast.id)}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
EOF

echo "✅ Created Toast component"

# Make sure useToast hook exists
if [ ! -f "hooks/useToast.ts" ]; then
  echo "Creating useToast hook..."
  cat > hooks/useToast.ts << 'EOF'
import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastStore {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  showToast: (message, type = 'info') => {
    const id = Date.now().toString();
    const toast: Toast = { id, message, type };
    
    set((state) => ({ toasts: [...state.toasts, toast] }));
    
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
EOF
  echo "✅ Created useToast hook"
fi

# Make sure validateEmail exists
if [ ! -f "lib/utils/validators.ts" ]; then
  echo "Creating validators..."
  cat > lib/utils/validators.ts << 'EOF'
import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Invalid phone format'),
  address: z.string().min(1, 'Address is required'),
  zip: z.string().regex(/^\d{5}$/, 'Invalid ZIP code'),
  birthday: z.string().min(1, 'Birthday is required'),
  roles: z.array(z.string()).min(1, 'Select at least one role'),
});

export const bandSchema = z.object({
  name: z.string().min(1, 'Band name is required').transform(val => 
    val.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  ),
  inviteEmails: z.array(z.string().email()).optional(),
});

export function validateEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

export function validateProfile(data: any): boolean {
  try {
    profileSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}
EOF
  echo "✅ Created validators"
fi

# Make sure all UI components exist
components=(
  "Button"
  "Input"
  "Card"
  "LoadingSpinner"
  "Chip"
  "Dialog"
  "Drawer"
)

for component in "${components[@]}"; do
  if [ ! -f "components/ui/$component.tsx" ]; then
    echo "Creating $component component..."
    
    case $component in
      "Button")
        cat > components/ui/Button.tsx << 'EOF'
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
            'h-9 px-3 text-sm': size === 'sm',
            'h-10 px-4 py-2': size === 'md',
            'h-11 px-8 text-lg': size === 'lg',
          },
          className
        )}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
EOF
        ;;
      "Input")
        cat > components/ui/Input.tsx << 'EOF'
import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2',
          'text-sm ring-offset-background file:border-0 file:bg-transparent',
          'file:text-sm file:font-medium placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          {
            'border-red-500 focus-visible:ring-red-500': error,
          },
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
EOF
        ;;
      "Card")
        cat > components/ui/Card.tsx << 'EOF'
import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
EOF
        ;;
      "LoadingSpinner")
        cat > components/ui/LoadingSpinner.tsx << 'EOF'
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function LoadingSpinner({ size = 'medium', className }: LoadingSpinnerProps) {
  return (
    <div
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
        {
          'h-4 w-4': size === 'small',
          'h-6 w-6': size === 'medium',
          'h-8 w-8': size === 'large',
        },
        className
      )}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
EOF
        ;;
      "Chip")
        cat > components/ui/Chip.tsx << 'EOF'
import { clsx } from 'clsx';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
}

export function Chip({ label, selected = false, onClick, removable = false }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        'border cursor-pointer',
        {
          'bg-primary text-primary-foreground border-primary': selected,
          'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80': !selected,
        }
      )}
    >
      {label}
      {removable && selected && (
        <span className="ml-1 text-xs">✕</span>
      )}
    </button>
  );
}
EOF
        ;;
      "Dialog")
        cat > components/ui/Dialog.tsx << 'EOF'
import { Fragment, ReactNode } from 'react';
import { clsx } from 'clsx';

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
EOF
        ;;
      "Drawer")
        cat > components/ui/Drawer.tsx << 'EOF'
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
EOF
        ;;
    esac
    echo "✅ Created $component"
  fi
done

echo ""
echo "🎸 All missing components created!"
echo ""
echo "Try running: npm run dev"