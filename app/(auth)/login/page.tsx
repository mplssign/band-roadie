'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/config/site';
import { Wordmark } from '@/components/branding/Wordmark';

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'icloud.com', 'outlook.com'];

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const supabase = createClient();

  // Check for error parameters from auth callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    if (errorParam || errorCode) {
      let message = 'Authentication failed.';
      
      if (errorCode === 'otp_expired') {
        message = 'Your login link has expired. Please request a new one.';
      } else if (errorDescription) {
        message = decodeURIComponent(errorDescription);
      } else if (errorParam) {
        message = decodeURIComponent(errorParam);
      }
      
      setError(message);
    }
  }, [searchParams]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError(null);
    setSuccess(false);
    
    // Detect if email ends with one of our domains
    const trimmed = value.trim();
    const matched = EMAIL_DOMAINS.find((domain) => trimmed.endsWith(`@${domain}`));
    setSelectedDomain(matched ?? null);
  };

  const appendDomain = (domain: string) => {
    setSelectedDomain((prevSelected) => {
      // Toggle off if already selected
      if (prevSelected === domain) {
        setEmail((prevInput) => {
          const trimmed = prevInput.trim();
          if (!trimmed) return '';
          if (trimmed === `@${domain}`) return '';
          if (trimmed.endsWith(`@${domain}`)) {
            const base = trimmed.slice(0, -(`@${domain}`).length);
            return base.trim();
          }
          return trimmed;
        });
        return null;
      }

      // Append/replace domain
      setEmail((prevInput) => {
        const trimmed = prevInput.trim();
        const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
        const sanitized = base.replace(/\s+/g, '');
        return sanitized ? `${sanitized}@${domain}` : `@${domain}`;
      });

      return domain;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      if (otpError) throw otpError;
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Wordmark size="xl" className="text-foreground inline-block" />
        </div>
        
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
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md bg-zinc-800 text-white placeholder-zinc-500 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-rose-600 px-3 py-2 mb-3"
            required
            disabled={success}
            aria-describedby={error ? 'email-error' : undefined}
          />

          {/* Email domain shortcuts */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
            {EMAIL_DOMAINS.map((domain) => {
              const isSelected = selectedDomain === domain;
              const isEnabled = email.trim().length > 0 && !success;
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => appendDomain(domain)}
                  disabled={!isEnabled}
                  aria-label={`Use ${domain} domain`}
                  aria-pressed={isSelected}
                  className={`rounded-full px-3 py-1 text-sm transition-colors flex-shrink-0 ${
                    isSelected
                      ? 'border-2 border-rose-600 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30'
                      : 'border border-zinc-700 bg-zinc-800/40 text-zinc-400'
                  } ${
                    isEnabled ? 'hover:bg-zinc-700/60 hover:text-zinc-200' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  @{domain}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full rounded-md bg-rose-600 hover:bg-rose-700 active:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 font-medium text-white transition"
          >
            {loading ? 'Sending…' : success ? 'Link Sent!' : 'Send Login Link'}
          </button>

          {error && (
            <p id="email-error" role="alert" className="mt-4 text-sm text-rose-400 bg-rose-950/50 rounded px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="mt-4 text-sm text-emerald-400 bg-emerald-950/50 rounded px-3 py-2">
              Check your email for a login link.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <div className="text-zinc-400">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}