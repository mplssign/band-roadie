'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // For now, just redirect to login
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">🎸</div>
        <h1 className="text-3xl font-bold text-white">Band Roadie</h1>
        <p className="text-muted-foreground mt-2">Loading...</p>
      </div>
    </div>
  );
}
