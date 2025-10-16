'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SimpleLoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'http://localhost:3000/auth/callback',
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setMessage('Check your email for the magic link!');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send magic link';
      setMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuth = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMessage('Signed out. Try logging in again.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-8">🔓 Simple Login</h1>
        
        <div className="mb-4">
          <button 
            onClick={clearAuth}
            className="mb-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Auth State
          </button>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-blue-100 rounded">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>This is a simplified login page that bypasses middleware issues.</p>
          <p>If this works, there&apos;s an issue with the main login page or middleware.</p>
        </div>
      </div>
    </div>
  );
}