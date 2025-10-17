# Band Roadie — Copilot Coding Agent Instructions (Plain-English Friendly)

You convert the user's (Tony) plain-English requests into **clear, well-scoped tasks** and implement them with **small, reversible, production-safe diffs**. Favor **efficient, elegant, and UX-first** solutions. Keep dark mode only. Do **not** change features or visuals unless the request says so.

---

## Prime Directive — Efficient, Elegant, UX-First (No Bloat)
- Keep code **simple and readable**; prefer native APIs and tiny utilities.
- Minimize client JS. Prefer **Server Components**; add `"use client"` only for interactive parts (forms, gestures).
- Optimize for **fast loads** (no waterfalls), **smooth motion** (150–250ms, transform/opacity only), and **no layout shift**.
- Respect accessibility (focus rings, `prefers-reduced-motion`, tap targets ≥ 44px).
- Remove duplication and dead code; avoid unnecessary abstractions and new deps.

---

## Turn Plain English into a Task (always post this “Task Spec” in PR description)
1. **Problem** (1–2 sentences in Tony’s words)
2. **Goal** (what the user experiences)
3. **Scope** (pages/components/APIs/DB you will touch)
4. **Acceptance Criteria** (checklist that can be verified locally)
5. **Perf & UX Targets** (budgets below)
6. **Plan** (tiny steps, each builds green)
7. **Files to Change / Create** (explicit paths)
8. **Risks & Rollback** (1 line each)

Then implement with **small diffs** and clear Conventional Commit messages.

---

## Project Architecture & Key Concepts
- **Framework:** Next.js 14 App Router (`app/`), TypeScript, Tailwind (custom dark theme), Radix UI
- **Data & Auth:** Supabase (PostgreSQL, Auth, Storage). Use client/server Supabase utilities in `lib/supabase/`
- **State:** Zustand for band state; custom hooks in `hooks/`
- **API:** Next.js Route Handlers in `app/api/` (RESTful + server actions)
- **PWA:** Manifest + icons in `public/`, service worker (or next-pwa if present)
- **Icons/Animation:** `lucide-react` (per-icon imports), Framer Motion (sparingly)

**Major Domains**
- **Authentication:** Magic link/PKCE + profile completion  
  - Routes: `app/(auth)/*`, `app/(protected)/layout.tsx`
- **Band Management:** Multi-band, member invites, roles  
  - Routes: `app/(protected)/bands/`, `app/(protected)/members/`
- **Events:** Rehearsals, gigs, setlists, songs  
  - Routes: `app/(protected)/calendar/`, `app/(protected)/gigs/`, `app/(protected)/setlists/`
- **Profile:** User info, musical roles, custom roles  
  - Routes: `app/(protected)/profile/`

**Database/Schema conventions**
- Roles stored as `TEXT[]` on users; custom roles supported
- Band membership M:N via `band_members`; invitations via `band_invitations`
- Keep schema/migrations in `migrations/` (SQL). Validate logic against migrations **before** coding.

---

## Guardrails (Band Roadie specifics)
- **Routing:** Use route groups `(auth)` and `(protected)` exclusively; **do not** create duplicate trees like `app/auth` or `app/protected`.
- **Auth:** `/callback` is a **server-handled** callback route; middleware **must not** protect `/callback`. No client token exchanges if server flow exists. First-time → `/profile`, returning → `/dashboard`.
- **PWA:** Keep installability: valid `public/manifest.webmanifest`, **maskable** icons (192/512), `apple-touch-icon`, and a working service worker. **Do not** cache auth-mutating requests.
- **Env/Security:** No `SERVICE_ROLE` in client code. Read URLs from `NEXT_PUBLIC_SITE_URL`. Never commit secrets.
- **Styling:** Dark theme only. Use Tailwind classes; keep class strings static (don’t defeat purge).
- **State:** Use Zustand selectors to reduce re-renders; keep props stable; memoize only when it measurably helps.

---

## Performance & UX Budgets (enforce where relevant)
- **Initial route JS (gzip)** ≤ 180KB (aim ≤ 140KB)
- **LCP** ≤ 2.5s on mid-tier mobile (cold cache)
- **CLS** ≤ 0.1, **TTI** ≤ 3.5s
- **API p95 reads** ≤ 300ms; **DB hot queries p95** ≤ 50ms
- **Animations**: 150–250ms; transform/opacity only; ≥ 55fps; respect `prefers-reduced-motion`

**Common optimization moves**
- Server Components first; fetch on the server; parallelize awaits; kill waterfalls
- Dynamic import heavy/rare screens (`next/dynamic` + suspense), `ssr:false` only if safe
- `next/image` with width/height/sizes; `next/font` to prevent FOUT/CLS
- Debounce inputs (200–300ms); abort stale requests
- Import icons per-icon; tree-shake libraries
- Add `revalidate`/cache headers; use SWR patterns on read-most routes

---

## PWA Completeness (must remain green in Lighthouse)
- `public/manifest.webmanifest` includes: `name`, `short_name`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `theme_color`, `background_color`
- Icons: 192x192 and 512x512 **maskable** + `public/icons/apple-touch-icon.png` (180x180)
- `app/layout.tsx` includes `<link rel="manifest" href="/manifest.webmanifest" />`, `<meta name="theme-color" ... />`, and Apple meta
- Service worker:
  - Precache app shell & critical assets (login, callback, dashboard, setlists)
  - Runtime caching:
    - `/_next/static/**` → Cache First
    - same-origin GET JSON (read-most) → Stale-While-Revalidate
    - **never** cache auth-mutating requests or Supabase auth endpoints
  - Register once; use `skipWaiting()` + `clients.claim()`
- Provide a simple `/offline` fallback route

---

## Developer Workflows (use these commands)
- **Install:** `pnpm install`
- **Dev Server:** `pnpm dev` (or `npm run dev`)
- **Build:** `pnpm build`
- **Test:** `pnpm test` (Jest for unit/integration)
- **Typecheck/Lint:** `npx tsc --noEmit` and `pnpm lint`
- **Migrations:** SQL in `migrations/`, run via Supabase CLI
- **Env:** Keys in `.env.local` (see `BAND_ROADIE_DOCUMENTATION.md`)

**Key Files & Dirs**
- `app/` — all routes (grouped by domain)
- `app/api/` — API route handlers
- `components/` — reusable UI (keep small & tree-shakable)
- `hooks/` — custom React hooks (auth, bands, UI)
- `lib/` — utils, Supabase, types
- `migrations/` — schema changes
- `BAND_ROADIE_DOCUMENTATION.md` — full app & schema docs

---

## Sources the Agent MUST read before coding
- `BAND_ROADIE_DOCUMENTATION.md` — domain rules, flows, gotchas
- `migrations/` — schema truth (validate table/column names and constraints)
- (If present) **schema inventory CSV** — cross-check table/column names
- `folder-structure.txt` — current tree for paths and duplicates

---

## Integration Points
- **Supabase:** Auth, DB, Storage, realtime (`lib/supabase/`). Use anon key on client; server utilities for secure ops.
- **Email:** Resend for transactional emails (`lib/email/`)
- **PWA:** service worker / next-pwa (whichever the repo uses—ensure only one strategy is active)
- **UI/Animation:** `lucide-react` per-icon imports; Framer Motion used sparingly

---

## Examples (API patterns)
- **Profile Save:** `PATCH /api/profile` (roles as array)
- **Band Members:** `GET /api/bands/[bandId]/members` → user info + roles
- **Invitation Flow:** `POST /api/invitations/` → user completes profile → joins band

---

## Work Protocol (every task)
1. **Branch:** `task/<slug>` (e.g., `task/perf-setlist-open`)
2. **Plan:** Post the 8-part **Task Spec** in the PR description
3. **Change:** Apply tiny, safe diffs; after each step run:  
   `pnpm typecheck && pnpm build && pnpm lint` (or npm equivalents)  
   Fix before continuing.
4. **Verify:** Manually check acceptance criteria (include notes/screens)
5. **Commits:** Conventional Commits (e.g., `perf(client): code-split setlist modal`)
6. **PR Size:** Keep ≤ ~300 LOC diff unless tests/assets push it higher; otherwise split
7. **No Secrets:** Never commit secrets or service-role keys

---

## Acceptance Criteria Templates

**Auth flow**
- Visiting `/callback` via magic link completes server-side session exchange and redirects **once**:
  - first-time → `/profile`
  - returning → `/dashboard`
- `/callback` is unprotected by middleware; no 3xx loops

**PWA**
- Lighthouse: installable; manifest valid; icons present; SW active
- Offline fallback renders on network loss for key routes

**Setlist search UX**
- Typing does not block input (debounced 200–300ms)
- No layout shift; results appear with a 150–200ms fade (respect reduced motion)
- Network waterfalls eliminated; parallel server awaits

**Profile**
- Phone formats as `(123) 456-7890`
- Save updates user metadata; success toast (no `alert`)