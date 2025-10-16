'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/config/site';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      if (error) throw error;
      setMessage('Check your email for the login link. It may take a few seconds.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Band Roadie</h1>
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 rounded-xl p-6 shadow">
          <label htmlFor="email" className="block text-sm text-zinc-300 mb-2">
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md bg-zinc-800 text-white placeholder-zinc-500 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-600 px-3 py-2 mb-4"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 font-medium text-white transition"
          >
            {loading ? 'Sending…' : 'Send Magic Link'}
          </button>

          {message && (
            <p className="mt-4 text-sm text-zinc-200 bg-zinc-800/70 rounded px-3 py-2">{message}</p>
          )}
        </form>

        <p className="mt-4 text-center text-zinc-400 text-sm">
          Need an account?
          <a href="/auth/signup" className="text-red-500 hover:underline ml-1">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}