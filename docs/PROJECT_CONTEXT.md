# BandRoadie Project Context

> **Single Source of Truth** — Last updated: December 18, 2025
>
> This document captures everything required to fully understand, rebuild, or continue the BandRoadie project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Design System & UX Philosophy](#3-design-system--ux-philosophy)
4. [App Navigation & Screens](#4-app-navigation--screens)
5. [Data Model](#5-data-model)
6. [Security & RLS](#6-security--rls)
7. [Supabase RPCs & Migrations](#7-supabase-rpcs--migrations)
8. [State Management & Architecture](#8-state-management--architecture)
9. [Known Constraints & Decisions](#9-known-constraints--decisions)
10. [Current Status](#10-current-status)

---

## 1. Project Overview

### What BandRoadie Is

BandRoadie is a lightweight mobile/desktop app that helps bands manage rehearsals, gigs, setlists, and band logistics. It is designed by someone who has *been* in bands — not someone who has read about them.

### Target Users

| User Type | Description |
|-----------|-------------|
| **User** | Anyone with an account (can belong to 0+ bands) |
| **Band Member** | User who belongs to a band (roles: owner, admin, member) |
| **Band Admin/Owner** | Can invite members, edit band, manage content |

### Core Problems Solved

1. **Coordination** — Scheduling rehearsals and gigs without endless group texts
2. **Setlists** — Building, organizing, and sharing setlists with song metadata
3. **Availability** — Tracking member availability for potential gigs
4. **Catalog** — Band-private master song list with BPM, key, tuning, duration
5. **Communication** — One source of truth for band logistics

### Core Personality

- A trusted roadie
- Slightly sarcastic
- Musically aware
- Calm, fast, and reliable
- Never cruel, never corporate

### What BandRoadie Is NOT

- A social network
- A task manager
- A bloated "everything app"
- Serious business software

---

## 2. Tech Stack

### Frontend

| Component | Technology |
|-----------|------------|
| Framework | Flutter 3.10+ |
| UI System | Material 3 (dark mode only) |
| State Management | Riverpod 3.x (NotifierProvider pattern) |
| Navigation | go_router |
| Icons | flutter_svg, custom icons |
| Typography | Google Fonts (via `google_fonts` package) |
| Animations | Physics-based, custom curves |

### Backend

| Component | Technology |
|-----------|------------|
| Platform | Supabase |
| Database | PostgreSQL |
| Auth | Magic Link (email-only) |
| Storage | Supabase Storage (band avatars, uploads) |
| Real-time | Supabase Realtime (for live updates) |

### Key Dependencies

```yaml
dependencies:
  flutter_riverpod: ^3.0.3
  supabase_flutter: ^2.12.0
  go_router: ^17.0.1
  flutter_svg: ^2.2.3
  google_fonts: ^6.3.3
  intl: ^0.20.2
  shared_preferences: (for band persistence)
```

### Auth Flow

1. User enters email on `LoginScreen`
2. `signInWithOtp()` sends magic link via Supabase
3. User clicks link on **same device**
4. Deep link callback: `bandroadie://login-callback/`
5. `AuthGate` detects session → navigates to `HomeScreen`
6. Session persists indefinitely (until explicit logout)

---

## 3. Design System & UX Philosophy

### Color Palette

| Purpose | Hex Code | CSS/Tailwind | Usage |
|---------|----------|--------------|-------|
| **Primary Accent** | `#F43F5E` | rose-500 | Buttons, active nav, accents |
| Scaffold Background | `#1E1E1E` | brand-hover | Main background |
| App Bar | `#1E293B` | gray-800 | Top navigation |
| Surface Dark | `#1E293B` | gray-800 | Cards, inputs |
| Card Elevated | `#252525` | — | Elevated surfaces |
| Nav Background | `#020617` | gray-950 | Bottom nav |
| Text Primary | `#FFFFFF` | white | Primary text |
| Text Secondary | `#94A3B8` | gray-400 | Secondary text |
| Text Muted | `#64748B` | gray-500 | Disabled/muted |
| Success | `#22C55E` | green-500 | Confirmation |
| Warning | `#F59E0B` | amber-500 | Warnings |
| Error | `#EF4444` | red-500 | Errors |

### Theme Rules

- **Dark mode only** — no light theme, ever
- **Rose/500 is the accent** — used for all interactive elements
- Design tokens defined in `lib/app/theme/design_tokens.dart`

### Motion Principles

| Principle | Implementation |
|-----------|----------------|
| Physics-based | Custom `rubberband` curve with controlled overshoot |
| Micro-interactions | Tap scale (0.98→1.0), hover feedback, haptic |
| Entrance animations | 400ms with `easeOutQuart` |
| Rubber-banding | Slight overshoot then settle |
| Smooth | No jarring linear tweens |

### Animation Tokens

```dart
// Durations
instant: 100ms
fast: 180ms
normal: 250ms
medium: 350ms
slow: 500ms
entrance: 400ms

// Curves
ease: easeOutCubic
overshoot: elasticOut
slideIn: easeOutQuart
bounce: bounceOut
rubberband: custom (controlled overshoot)
```

### Typography Expectations

- Font: System default via Material 3 (or Google Fonts if specified)
- Match Figma font sizes, weights, and casing exactly
- No approximations

### Humor & Copy Tone

**Voice:** Focused, friendly, slightly sarcastic, self-aware, never cruel

**Examples (encouraged):**
> "Your drummer still hasn't responded. Shocking."
> "No gigs yet. The world clearly isn't ready."
> "Still no rehearsal scheduled. Rock history is on hold."

**Not allowed:** Shaming, insults, condescension, corporate filler

**Rule:** If a band member laughs and nods, it's right. If they feel defensive, it's wrong.

---

## 4. App Navigation & Screens

### Navigation Structure

```
AuthGate (auth state listener)
├── LoginScreen (logged out)
└── HomeScreen (logged in)
    ├── Bottom Nav
    │   ├── Dashboard (index 0)
    │   ├── Calendar (index 1)
    │   ├── Setlists (index 2)
    │   └── Profile (index 3)
    └── Side Drawer
        ├── Band Switcher
        ├── Create Band
        ├── Band Settings
        ├── Members
        └── Profile
```

### Screen States

#### Home/Dashboard States

| State | Condition | Widget |
|-------|-----------|--------|
| No Band | `userBands.isEmpty` | `NoBandState` |
| Empty Home | Has band, no gigs/rehearsals | `EmptyHomeState` |
| Content | Has data | Full dashboard |

#### Auth Flow

1. `LoginScreen` — Email input + send magic link
2. Deep link callback
3. `AuthGate` → `HomeScreen`

### Key Screens

| Screen | Path | Description |
|--------|------|-------------|
| Dashboard | `/` | Main home with upcoming gigs/rehearsals |
| Calendar | `/calendar` | Full calendar view |
| Setlists | `/setlists` | List of band setlists |
| Setlist Detail | `/setlists/:id` | Songs in a setlist |
| Profile | `/profile` | User profile editing |
| Create Band | `/bands/create` | Band creation flow |
| Edit Band | `/bands/:id/edit` | Band editing |
| Members | `/members` | Band member management |

---

## 5. Data Model

### Core Tables

#### `bands`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| name | text | Required |
| image_url | text | Optional (Supabase Storage) |
| created_by | uuid | FK → auth.users |
| avatar_color | text | Default: 'bg-red-600' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `band_members`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| band_id | uuid | FK → bands |
| user_id | uuid | FK → auth.users |
| role | text | 'member', 'admin', 'owner' |
| joined_at | timestamptz | |

#### `band_invitations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| band_id | uuid | FK → bands |
| email | text | Invitee email |
| invited_by | uuid | FK → auth.users |
| status | text | 'pending', 'accepted', 'declined', 'expired' |
| token | text | Unique invite token |
| expires_at | timestamptz | Default: 30 days |

#### `gigs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| band_id | uuid | FK → bands |
| name | text | Gig/event name |
| date | date | |
| start_time | text | e.g., "7:30 PM" |
| end_time | text | e.g., "10:30 PM" |
| location | text | Venue name/address |
| setlist_id | uuid | Optional FK → setlists |
| is_potential | boolean | **true = needs RSVP** |
| notes | text | |

#### `rehearsals`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| band_id | uuid | FK → bands |
| date | date | |
| start_time | text | |
| end_time | text | |
| location | text | |
| notes | text | |
| setlist_id | uuid | Optional |

#### `songs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| band_id | uuid | FK → bands (band-scoped) |
| title | text | Song title |
| artist | text | Original artist |
| bpm | int | Tempo |
| duration_seconds | int | Length in seconds |
| tuning | text | Guitar tuning |
| key | text | Musical key |
| album_artwork | text | URL to artwork |

#### `setlists`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| band_id | uuid | FK → bands |
| name | text | Setlist name |
| is_catalog | boolean | Default catalog setlist |
| created_at | timestamptz | |

#### `setlist_songs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| setlist_id | uuid | FK → setlists |
| song_id | uuid | FK → songs |
| position | int | Order in setlist |
| bpm | int | Override (nullable) |
| duration_seconds | int | Override (nullable) |
| tuning | text | Override (nullable) |

### Many-to-Many Relationships

- **Users ↔ Bands:** via `band_members` (user can belong to many bands)
- **Songs ↔ Setlists:** via `setlist_songs` (song can be in many setlists)

### Setlist Rules (CRITICAL)

1. Every band has a default **"Catalog"** setlist (`is_catalog = true`)
2. Adding a song to ANY setlist also adds it to Catalog
3. Removing from a non-Catalog setlist does NOT delete the song
4. Removing from Catalog removes the song from ALL setlists
5. Deletions must confirm intent clearly

### Override System

`setlist_songs` can override song properties per-setlist:
- `bpm` — Different tempo for this setlist
- `duration_seconds` — Different arrangement length
- `tuning` — Different tuning for this performance

Models track overrides via: `hasBpmOverride`, `hasDurationOverride`, `hasTuningOverride`

---

## 6. Security & RLS

### Band Isolation (NON-NEGOTIABLE)

> **All data is strictly band-scoped. No data leakage across bands. Ever.**

### Enforcement Layers

1. **Supabase RLS** — Database policies restrict access at query level
2. **Repository checks** — All queries require `bandId`
3. **Active band controller** — Single source of truth for current band
4. **UI guards** — Screens check for active band before rendering

### RLS Helper Functions

```sql
-- Check if user is a member of a band
is_band_member(band_id uuid) RETURNS boolean

-- Check if user is an admin or owner
is_band_admin(band_id uuid) RETURNS boolean
```

### RLS Policy Pattern

```sql
-- Example: songs table
CREATE POLICY "Users can view songs in their bands"
ON songs FOR SELECT
USING (is_band_member(band_id));

CREATE POLICY "Admins can insert songs"
ON songs FOR INSERT
WITH CHECK (is_band_admin(band_id));
```

### Client-Side Rules

- Supabase is used **client-side with publishable key only**
- **Never** use `service_role` key in client code
- Assume hostile input
- Never trust the client

### Multi-Band Scoping

- Users can belong to multiple bands
- Only ONE band is "active" at a time
- Switching bands resets all band-scoped state
- All repositories throw `NoBandSelectedError` if `bandId` is null

---

## 7. Supabase RPCs & Migrations

### RPCs That Exist

| RPC | Purpose | Parameters |
|-----|---------|------------|
| `create_band` | Atomically creates band + owner membership | name, avatar_color, user_id |
| `delete_band` | Cascade deletes band and all related data | band_id |
| `reorder_setlist_songs` | Updates positions atomically | setlist_id, song_ids[] |

### Migration Files

Located in `supabase/migrations/`:

| Migration | Purpose |
|-----------|---------|
| `001_initial_schema.sql` | Core tables |
| `012_add_invite_tokens.sql` | Invitation system |
| `013_delete_band_function.sql` | Band deletion RPC |
| `014_add_multi_band_scoping.sql` | Multi-band support |
| `015_potential_gig_enhancements.sql` | RSVP flow |
| `018_create_song_notes_table.sql` | Song notes |
| `019_fix_reorder_positions_constraint.sql` | Setlist reorder fix |
| `020_fix_rls_infinite_recursion.sql` | RLS recursion fix |
| `030_rls_complete_schema.sql` | Complete RLS |
| `040-045` | Songs band-scoping |
| `050_create_band_rpc.sql` | Create band RPC |
| `051_band_roles_table.sql` | Role enhancements |

### Known Failure Modes

| Error | Cause | Fix |
|-------|-------|-----|
| `infinite recursion` | RLS policy self-referencing | Use security definer functions |
| `duplicate key` | Position constraint on reorder | Use upsert or clear first |
| `foreign key violation` | Deleting referenced row | Cascade delete or handle |

---

## 8. State Management & Architecture

### Riverpod Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         PROVIDERS                           │
├─────────────────────────────────────────────────────────────┤
│  activeBandProvider → ActiveBandState                       │
│  activeBandIdProvider → String? (convenience)               │
│  hasBandsProvider → bool (convenience)                      │
│  bandRepositoryProvider → BandRepository                    │
│  gigRepositoryProvider → GigRepository                      │
│  rehearsalRepositoryProvider → RehearsalRepository          │
│  setlistRepositoryProvider → SetlistRepository              │
│  setlistDetailControllerProvider(id) → SetlistDetailState   │
└─────────────────────────────────────────────────────────────┘
```

### Controller/Repository Pattern

| Layer | Responsibility |
|-------|---------------|
| **Controller** | UI state, optimistic updates, orchestration |
| **Repository** | Supabase queries, data mapping, error handling |
| **Model** | Data structures, fromSupabase factories |

### Active Band Controller

- Located: `lib/features/bands/active_band_controller.dart`
- Uses Riverpod `Notifier` pattern
- Persists active band ID to `SharedPreferences`
- Auto-selects first band on load
- `reset()` clears state on logout

### Band Switching

1. User selects band from Band Switcher
2. `setActiveBand(bandId)` called on controller
3. Band ID persisted to SharedPreferences
4. All band-scoped providers refresh
5. UI rebuilds with new band data

### Auth State Handling

- `AuthGate` listens to Supabase auth state
- On sign-out: navigate to LoginScreen, reset band controller
- On sign-in: fetch bands, auto-select, navigate to Home

---

## 9. Known Constraints & Decisions

### "Do Not Change" Rules

1. **Band isolation is absolute** — All tables have `band_id`, all queries are scoped
2. **RLS is mandatory** — No exceptions, no bypasses
3. **Dark theme only** — No light mode, ever
4. **Rose/500 is the accent** — #F43F5E everywhere
5. **Catalog setlist rules** — Adding/removing follows strict rules
6. **Figma is law** — If code doesn't match Figma, code is wrong

### Tradeoffs Made

| Decision | Reason |
|----------|--------|
| Magic link only (no passwords) | Simpler, more secure, less friction |
| Band-scoped songs (no global library) | Privacy, isolation, simplicity |
| Optimistic updates | Better UX, faster perceived performance |
| Riverpod over BLoC | Less boilerplate, better DX |
| SharedPreferences for band persistence | Simple, synchronous, reliable |

### Long-Term Stability Choices

- Use Supabase RPCs for atomic operations (create_band, delete_band)
- Validate inputs before persistence
- Normalize data consistently
- Log errors with code, message, and hint
- Never swallow errors silently

---

## 10. Current Status

### ✅ Implemented

| Feature | Status |
|---------|--------|
| Auth (Magic Link) | Complete |
| Band Creation | Complete |
| Band Editing | Complete |
| Band Switching | Complete |
| Band Member Invitations | Complete |
| Gigs (Create/Edit/List) | Complete |
| Rehearsals (Create/Edit/List) | Complete |
| Setlists List | Complete |
| Setlist Detail | Complete |
| Setlist Song Reordering | Complete |
| Inline Song Editing (BPM, Duration, Tuning) | Complete |
| Tuning Picker (grouped, physics-based) | Complete |
| Profile Editing | Complete |
| Empty States | Complete |
| Side Drawer | Complete |
| Bottom Navigation | Complete |
| RLS Policies | Complete |

### 🚧 In Progress

| Feature | Notes |
|---------|-------|
| Add/Remove Songs from Setlist | UI in progress |
| Gig RSVP Flow | Backend ready, UI pending |

### ⏳ Out of Scope (For Now)

| Feature | Reason |
|---------|--------|
| Push Notifications | Phase 2 |
| Song Lyrics Editor | Phase 2 |
| Music Service Integration | Phase 2 |
| Offline Mode | Complexity |
| Light Theme | Not wanted |
| Password Auth | Security/UX decision |

---

## Appendix: Quick Commands

```bash
# Run on macOS
flutter run -d macos --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...

# Clean rebuild
flutter clean && flutter pub get

# Analyze for errors
flutter analyze

# Analyze specific feature
flutter analyze lib/features/setlists/

# Format Dart files
dart format lib/
```

---

## Appendix: File Locations

| Purpose | Path |
|---------|------|
| Theme | `lib/app/theme/app_theme.dart` |
| Design Tokens | `lib/app/theme/design_tokens.dart` |
| Models | `lib/app/models/` |
| Supabase Client | `lib/app/services/supabase_client.dart` |
| Auth | `lib/features/auth/` |
| Bands | `lib/features/bands/` |
| Gigs | `lib/features/gigs/` |
| Rehearsals | `lib/features/rehearsals/` |
| Setlists | `lib/features/setlists/` |
| Home | `lib/features/home/` |
| Profile | `lib/features/profile/` |
| Docs | `docs/` |
| Migrations | `supabase/migrations/` |

---

## Appendix: Figma Reference

**Figma File:** https://www.figma.com/design/EuPVyFVDYXYUl2RNWMkOai/BandRoadie

When implementing any screen:
1. Identify the exact artboard name
2. Match it pixel-for-pixel as closely as Flutter allows
3. Use design tokens from `design_tokens.dart`
4. If something is ambiguous, **stop and ask**

---

*This document is the single source of truth for BandRoadie development. Keep it updated.*
