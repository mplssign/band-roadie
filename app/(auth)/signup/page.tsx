'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/config/site';

export default function SignupPage() {
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
      setMessage('Check your email for the signup link. It may take a few seconds.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Create Account
        </h1>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full p-3 mb-4 bg-gray-800 text-white rounded"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Sign Up'}
          </button>

          {message && (
            <p className="mt-4 text-sm text-white bg-gray-800/70 rounded px-3 py-2">
              {message}
            </p>
          )}
        </form>
        <p className="mt-4 text-center text-gray-400">
          Have an account?{' '}
          <a href="/login" className="text-red-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}