#!/bin/bash

echo "🔧 Fixing Band Roadie file structure..."

# First, ensure the lib/supabase directory exists
mkdir -p lib/supabase

# Check if server.ts exists, if not create it
if [ ! -f "lib/supabase/server.ts" ]; then
  echo "Creating lib/supabase/server.ts..."
  cat > lib/supabase/server.ts << 'EOF'
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle error in Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle error in Server Component
          }
        },
      },
    }
  );
}
EOF
fi

# Check if client.ts exists
if [ ! -f "lib/supabase/client.ts" ]; then
  echo "Creating lib/supabase/client.ts..."
  cat > lib/supabase/client.ts << 'EOF'
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
EOF
fi

# Check if middleware.ts exists
if [ ! -f "lib/supabase/middleware.ts" ]; then
  echo "Creating lib/supabase/middleware.ts..."
  cat > lib/supabase/middleware.ts << 'EOF'
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export function createClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  return { supabase, response };
}
EOF
fi

# Let's also create a temporary version of app/page.tsx that doesn't require auth
echo "Creating temporary app/page.tsx..."
cat > app/page.tsx << 'EOF'
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
EOF

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  echo "Creating .env.local with placeholder values..."
  cat > .env.local << 'EOF'
# Supabase - Get these from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Resend - Get from resend.com
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_VERSION=1.2.3
EOF
  echo ""
  echo "⚠️  Created .env.local with placeholder values"
  echo "   Please update it with your actual Supabase and Resend keys"
fi

echo ""
echo "✅ File structure fixed!"
echo ""
echo "Now checking if all directories exist..."

# Create all necessary directories
directories=(
  "app/(auth)/login"
  "app/(auth)/signup"
  "app/(auth)/verify"
  "app/(protected)/dashboard"
  "app/(protected)/setlists"
  "app/(protected)/calendar"
  "app/(protected)/members"
  "app/(protected)/profile"
  "app/(protected)/settings"
  "app/api/auth/callback"
  "components/ui"
  "components/auth"
  "components/bands"
  "components/layout"
  "hooks"
  "lib/email/templates"
  "lib/utils"
  "public"
  "supabase/migrations"
)

for dir in "${directories[@]}"; do
  mkdir -p "$dir"
done

echo "✅ All directories created"

# List the structure to verify
echo ""
echo "Current structure:"
echo "=================="
ls -la lib/supabase/
echo ""
echo "You can now run: npm run dev"
echo ""
echo "Note: The app will work but show placeholder content until you:"
echo "1. Add your Supabase credentials to .env.local"
echo "2. Set up your Supabase project with the migration"
echo "3. Add your Resend API key for email functionality"