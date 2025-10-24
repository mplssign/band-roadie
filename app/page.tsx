'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/branding/Wordmark';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // For now, just redirect to login
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="text-4xl mb-4">🎸</div>
        <Wordmark size="xl" className="text-foreground" />
        <p className="text-zinc-400 mt-4">Loading...</p>
      </div>
    </div>
  );
}
