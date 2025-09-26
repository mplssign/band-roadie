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
