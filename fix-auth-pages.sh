#!/bin/bash

echo "🔧 Fixing authentication pages..."

# Remove the problematic manifest.json from app directory (it should be in public)
if [ -f "app/manifest.json" ]; then
  rm app/manifest.json
  echo "Removed misplaced app/manifest.json"
fi

# Create the manifest.json in public directory
cat > public/manifest.json << 'EOF'
{
  "name": "Band Roadie",
  "short_name": "BandRoadie",
  "description": "Manage your band's rehearsals, gigs, and setlists",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#dc2626",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png"
    }
  ],
  "categories": ["music", "productivity"],
  "prefer_related_applications": false
}
EOF

# Update app/layout.tsx to reference the correct manifest location
cat > app/layout.tsx << 'EOF'
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Band Roadie',
  description: "Manage your band's rehearsals, gigs, and setlists",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Band Roadie',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#dc2626',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.className} dark bg-background text-foreground min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
EOF

# Recreate the login page with proper syntax
mkdir -p "app/(auth)/login"
cat > "app/(auth)/login/page.tsx" << 'EOF'
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';
import { validateEmail } from '@/lib/utils/validators';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      showToast('Check your email for the login link!', 'success');
    } catch (error) {
      console.error('Login error:', error);
      showToast('Failed to send login email. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎸</div>
          <h1 className="text-3xl font-bold text-white">Band Roadie</h1>
          <p className="text-muted-foreground mt-2">
            Manage your band, anywhere
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-6 text-center">Welcome back</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Login Link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {"Don't have an account? "}
              
                href="/signup"
                className="text-primary hover:underline font-medium"
              >
                Sign up
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
EOF

# Create signup page
mkdir -p "app/(auth)/signup"
cat > "app/(auth)/signup/page.tsx" << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';
import { validateEmail } from '@/lib/utils/validators';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    const inviteEmail = searchParams.get('email');
    if (inviteEmail) {
      setEmail(inviteEmail);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            isNewUser: true,
          },
        },
      });

      if (error) throw error;

      showToast('Check your email to verify your account!', 'success');
    } catch (error) {
      console.error('Signup error:', error);
      showToast('Failed to create account. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎸</div>
          <h1 className="text-3xl font-bold text-white">Band Roadie</h1>
          <p className="text-muted-foreground mt-2">
            Manage your band, anywhere
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-6 text-center">Create your account</h2>
          
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
EOF

# Add the Toast component to the layout
cat > "app/(auth)/layout.tsx" << 'EOF'
'use client';

import { ToastContainer } from '@/components/ui/Toast';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
EOF

echo "✅ Fixed authentication pages"
echo ""
echo "The app should now compile. Try running: npm run dev"
echo ""
echo "Note: Authentication won't work until you add your Supabase credentials to .env.local"