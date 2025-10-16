'use client';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // These hooks don't need providers - they manage their own state
  // useBands uses localStorage and direct state management
  // useToast uses Zustand store
  return <>{children}</>;
}
