# Band Roadie

A comprehensive band management app built with Next.js 14, Supabase, and TypeScript.

## Features

- 🎵 **Setlist Management** - Create and organize setlists for gigs and rehearsals
- 📅 **Calendar** - Track rehearsals, gigs, and events
- 👥 **Band Members** - Manage multiple bands and member invitations
- 🎸 **Song Database** - Store songs with BPM, tuning, and notes
- 🔐 **Magic Link Auth** - Passwordless authentication via email

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Supabase account and project

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SITE_URL` - Your site URL (e.g., `http://localhost:3000` for dev)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

### Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. **Configure Environment Variables** in Project Settings → Environment Variables:

```bash
# Production environment variables
NEXT_PUBLIC_SITE_URL=https://bandroadie.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> **Important:** `NEXT_PUBLIC_SITE_URL` must be set to your production domain for auth redirects to work correctly.

Alternatively, use the Vercel CLI:

```bash
vercel env add NEXT_PUBLIC_SITE_URL production
# Enter: https://bandroadie.com
```

4. Deploy!

### Supabase Configuration

Ensure your Supabase project has the correct redirect URLs configured:

1. Go to Authentication → URL Configuration
2. Add your Site URL: `https://bandroadie.com`
3. Add redirect URLs:
   - `https://bandroadie.com/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Auth & Database:** Supabase
- **Styling:** Tailwind CSS + Shadcn UI
- **State:** Zustand
- **TypeScript:** Strict mode

## License

MIT
