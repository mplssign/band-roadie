# BandRoadie Knowledge Base

> **Living Document** — Last updated: December 13, 2025

This document captures everything known about the BandRoadie Flutter application. Update it as the project evolves.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication](#5-authentication)
6. [Band Isolation](#6-band-isolation)
7. [App States](#7-app-states)
8. [Theme & Design](#8-theme--design)
9. [Models](#9-models)
10. [Repositories](#10-repositories)
11. [State Management](#11-state-management)
12. [Copy & Tone](#12-copy--tone)
13. [Platform Configuration](#13-platform-configuration)
14. [Environment Setup](#14-environment-setup)
15. [Known Issues & TODOs](#15-known-issues--todos)

---

## 1. Product Overview

**BandRoadie** is a lightweight mobile app that helps bands manage rehearsals, gigs, and band logistics.

### Core Personality
- A trusted roadie
- Slightly sarcastic
- Musically aware
- Calm, fast, and reliable
- Built by someone who has been in bands — not someone who has read about them

### What BandRoadie Is NOT
- A social network
- A task manager
- A bloated "everything app"
- Serious business software

### Priorities
1. Speed
2. Clarity
3. Humor
4. Strong band-scoped data isolation
5. Minimal friction

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Flutter 3.10+ |
| UI System | Material 3 (dark mode only) |
| State Management | Riverpod 3.x |
| Backend | Supabase |
| Authentication | Supabase Magic Link (email-only) |
| Database | PostgreSQL (via Supabase) |
| Deep Linking | Custom scheme `bandroadie://` |

### Dependencies (pubspec.yaml)
```yaml
dependencies:
  flutter_riverpod: ^3.0.3
  supabase_flutter: ^2.12.0
  go_router: ^17.0.1
  flutter_svg: ^2.2.3
  google_fonts: ^6.3.3
  intl: ^0.20.2
```

---

## 3. Project Structure

```
lib/
├── main.dart                          # App entry point
├── app/
│   ├── supabase_config.dart           # Credential validation
│   ├── theme/
│   │   └── app_theme.dart             # Material 3 dark theme
│   ├── models/
│   │   ├── models.dart                # Barrel export
│   │   ├── band.dart
│   │   ├── band_member.dart
│   │   ├── band_invitation.dart
│   │   ├── gig.dart
│   │   ├── gig_response.dart
│   │   ├── rehearsal.dart
│   │   └── user_profile.dart
│   └── services/
│       └── supabase_client.dart       # Single supabase getter
├── features/
│   ├── auth/
│   │   ├── auth_gate.dart             # Auth state listener
│   │   └── login_screen.dart          # Magic link login
│   ├── bands/
│   │   ├── active_band_controller.dart # Riverpod notifier
│   │   └── band_repository.dart
│   ├── gigs/
│   │   └── gig_repository.dart
│   ├── rehearsals/
│   │   └── rehearsal_repository.dart
│   └── home/
│       ├── home_screen.dart           # Main dashboard
│       └── widgets/
│           ├── no_band_state.dart
│           ├── empty_home_state.dart
│           ├── empty_section_card.dart
│           ├── potential_gig_card.dart
│           └── quick_actions_row.dart
docs/
└── auth.md                            # Auth setup documentation
```

---

## 4. Database Schema

### Tables

#### `bands`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| name | text | Required |
| image_url | text | Optional |
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
| setlist_name | text | Denormalized for display |
| is_potential | boolean | **true = needs RSVP approval** |
| notes | text | |

#### `gig_responses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gig_id | uuid | FK → gigs |
| user_id | uuid | FK → auth.users |
| response | text | 'yes' or 'no' only |

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

#### `users` (app profile, not auth.users)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, FK → auth.users |
| email | text | Unique |
| first_name | text | |
| last_name | text | |
| phone | text | |
| address, city, zip | text | |
| birthday | date | |
| roles | text[] | Array |
| profile_completed | boolean | |

#### Other Tables (not yet modeled)
- `setlists` — band setlists
- `setlist_songs` — songs in a setlist (with position)
- `songs` — song library (title, artist, BPM, tuning, lyrics, etc.)
- `song_notes` — band-specific notes on songs
- `block_dates` — dates a member is unavailable
- `profiles` — avatar/bio (separate from users)

---

## 5. Authentication

### Method
- **Magic Link only** (no passwords)
- Email sent via Supabase Auth
- Deep link callback: `bandroadie://login-callback/`

### Session Behavior
- Session persists indefinitely (until explicit logout)
- `supabase_flutter` handles token refresh automatically
- No forced re-authentication

### Flow
1. User enters email on `LoginScreen`
2. `signInWithOtp()` sends magic link
3. User clicks link on **same device**
4. App receives callback via deep link
5. `AuthGate` detects session → navigates to `HomeScreen`

### Supabase Dashboard Config
Add to **Authentication → URL Configuration → Redirect URLs**:
```
bandroadie://login-callback/
```

### Code Location
- `lib/features/auth/auth_gate.dart` — auth state listener
- `lib/features/auth/login_screen.dart` — email input + send
- `lib/app/services/supabase_client.dart` — `supabase` getter

---

## 6. Band Isolation

### Principle (NON-NEGOTIABLE)
> All data is strictly band-scoped. No data leakage across bands.

### Enforcement Layers

1. **Supabase RLS** — Database policies restrict access
2. **Repository checks** — All queries require `bandId`
3. **Active band controller** — Single source of truth for current band
4. **UI guards** — Screens check for active band before rendering

### Rules
- Users may belong to multiple bands
- Only one band is "active" at a time
- Switching bands resets all band-scoped state
- Repositories throw `NoBandSelectedError` if `bandId` is null

### Code
```dart
// In gig_repository.dart
if (bandId == null || bandId.isEmpty) {
  throw NoBandSelectedError();
}
```

---

## 7. App States

### State Machine (Home Screen)

```
┌─────────────────┐
│   Logged Out    │ ── Login ──▶ ┌─────────────────┐
└─────────────────┘              │  Loading Bands  │
                                 └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
          ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
          │    No Band      │   │   Empty Home    │   │  Content Home   │
          │  (no membership)│   │  (band, no data)│   │  (has gigs etc) │
          └─────────────────┘   └─────────────────┘   └─────────────────┘
```

### State Widgets
| State | Widget | Condition |
|-------|--------|-----------|
| No Band | `NoBandState` | `userBands.isEmpty` |
| Empty Home | `EmptyHomeState` | Has band, no rehearsals/gigs |
| Content | Full scaffold | Has data to display |

---

## 8. Theme & Design

### Colors
| Purpose | Hex | Usage |
|---------|-----|-------|
| Primary | `#F43F5E` | Buttons, accents, active nav |
| Background | `#1E1E1E` | Scaffold background |
| Surface | `#252525` | Cards, inputs |
| Card | `#2A2A2A` | Elevated surfaces |

### Theme File
`lib/app/theme/app_theme.dart`

### Key Settings
```dart
ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.fromSeed(
    seedColor: Color(0xFFF43F5E),
    brightness: Brightness.dark,
  ),
  scaffoldBackgroundColor: Color(0xFF1E1E1E),
)
```

### Component Styling
- **FilledButton**: Full-width, 52px height, 12px radius
- **TextField**: Dark filled, rose focus border
- **AppBar**: Flat, centered title, rose icons
- **Cards**: 16px radius, no elevation

---

## 9. Models

All models in `lib/app/models/`:

| Model | File | Key Properties |
|-------|------|----------------|
| `Band` | band.dart | id, name, avatarColor, imageUrl |
| `BandMember` | band_member.dart | bandId, userId, role (enum) |
| `BandInvitation` | band_invitation.dart | email, token, status, expiresAt |
| `Gig` | gig.dart | name, date, location, **isPotential** |
| `GigResponse` | gig_response.dart | gigId, userId, response (yes/no) |
| `Rehearsal` | rehearsal.dart | date, location, startTime, endTime |
| `UserProfile` | user_profile.dart | email, firstName, lastName, profileCompleted |

### Potential vs Confirmed Gig
```dart
// Gig.isPotential == true  → Needs RSVP approval
// Gig.isPotential == false → Confirmed, scheduled
```

---

## 10. Repositories

| Repository | File | Band Isolation |
|------------|------|----------------|
| `BandRepository` | bands/band_repository.dart | Fetches via band_members join |
| `GigRepository` | gigs/gig_repository.dart | **Requires bandId** |
| `RehearsalRepository` | rehearsals/rehearsal_repository.dart | **Requires bandId** |

### Key Methods
```dart
// BandRepository
fetchUserBands() → List<Band>           // All bands user belongs to
fetchBandById(bandId) → Band?           // Single band (with membership check)

// GigRepository
fetchGigsForBand(bandId) → List<Gig>    // All gigs
fetchPotentialGigs(bandId) → List<Gig>  // is_potential = true
fetchConfirmedGigs(bandId) → List<Gig>  // is_potential = false
fetchUpcomingGigs(bandId) → List<Gig>   // date >= now

// RehearsalRepository
fetchRehearsalsForBand(bandId) → List<Rehearsal>
fetchUpcomingRehearsals(bandId) → List<Rehearsal>
fetchNextRehearsal(bandId) → Rehearsal?
```

---

## 11. State Management

### Riverpod Providers

```dart
// Band state
activeBandProvider        → ActiveBandState (userBands, activeBand, isLoading)
activeBandIdProvider      → String? (convenience)
hasBandsProvider          → bool (convenience)
bandRepositoryProvider    → BandRepository
```

### Active Band Controller
- Located: `lib/features/bands/active_band_controller.dart`
- Uses Riverpod 2.0+ `Notifier` pattern
- Auto-selects first band on load
- `reset()` clears state on logout

---

## 12. Copy & Tone

### Voice
- Focused
- Friendly
- Slightly sarcastic
- Self-aware
- Never cruel

### Examples (Encouraged)
> "Your drummer still hasn't responded. Shocking."
> "No gigs yet. The world clearly isn't ready."
> "Still no rehearsal scheduled. Rock history is on hold."

### Not Allowed
- Shaming
- Insults
- Condescension
- Corporate filler

### Rule of Thumb
> If a band member laughs and nods, it's right.
> If they feel defensive, it's wrong.

---

## 13. Platform Configuration

### iOS (`ios/Runner/Info.plist`)
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>bandroadie</string>
    </array>
  </dict>
</array>
```

### macOS (`macos/Runner/Info.plist`)
Same as iOS.

### macOS Entitlements
Both `DebugProfile.entitlements` and `Release.entitlements` include:
```xml
<key>com.apple.security.network.client</key>
<true/>
```

### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data
    android:scheme="bandroadie"
    android:host="login-callback"
    android:pathPattern=".*"/>
</intent-filter>
```

---

## 14. Environment Setup

### Supabase Credentials
**Never hardcode credentials.** Use `--dart-define`:

```bash
flutter run -d macos \
  --dart-define=SUPABASE_URL=https://xxx.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

### VS Code Launch Config
Template at `.vscode/launch.template.json`. Copy to `.vscode/launch.json` (gitignored) and add real credentials.

### Validation
`lib/app/supabase_config.dart` throws a boxed error if credentials are missing.

---

## 15. Known Issues & TODOs

### Current Limitations
- [ ] Placeholder flags still control some UI states (need real data)
- [ ] Magic link "Invalid Error" if redirect URL not in Supabase dashboard
- [ ] No real gig/rehearsal data wired to UI yet

### Future Work
- [ ] Implement gig RSVP flow (yes/no responses)
- [ ] Add band switching UI
- [ ] Create band flow
- [ ] Invite members flow
- [ ] Setlist management
- [ ] Song library
- [ ] Calendar view
- [ ] Push notifications

### Technical Debt
- [ ] Move placeholder booleans to Riverpod providers
- [ ] Add error handling/retry for network failures
- [ ] Add loading states throughout UI

---

## Appendix: Quick Commands

```bash
# Run on macOS
flutter run -d macos --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...

# Clean rebuild
flutter clean && flutter pub get

# Check for errors
flutter analyze
```

---

*This document is the source of truth for BandRoadie development. Keep it updated.*
