'use client';

import { SessionSync } from '@/components/auth/SessionSync';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <SessionSync />
      {children}
    </>
  );
}
