# Band Roadie - Complete Application Documentation

## Application Overview

**Band Roadie** is a comprehensive cross-platform application designed for band management and coordination. Built with Flutter and Supabase, it provides bands with tools to manage rehearsals, gigs, setlists, member coordination, and more. The app runs on iOS, Android, macOS, and Web.

### Core Identity
- **Name:** Band Roadie
- **Version:** 1.3.1
- **Tagline:** "Ultimate Band Management"
- **Description:** Manage your band's rehearsals, gigs, and setlists
- **Live Web App:** https://bandroadie.com

## Technology Stack

### Frontend
- **Framework:** Flutter 3.38.5 with Dart 3.10.4
- **State Management:** Riverpod for reactive state
- **UI Design:** Custom dark theme with Rose accent (#f43f5e)
- **Animation:** Flutter built-in animations + custom controllers
- **Platforms:** iOS, Android, macOS, Web

### Backend & Database
- **Backend:** Supabase (PostgreSQL + Auth + Real-time + Edge Functions)
- **Authentication:** Supabase Auth with PKCE flow and magic links
- **Database:** PostgreSQL via Supabase with Row Level Security (RLS)
- **Email:** Resend for transactional emails
- **File Storage:** Supabase Storage
- **Edge Functions:** Deno-based serverless functions for external API integrations

### Key Dependencies
- `flutter_riverpod` - State management
- `supabase_flutter` - Supabase SDK for Flutter
- `go_router` - Declarative routing
- `share_plus` - Native share sheet integration
- `url_launcher` - External URL handling
- `intl` - Internationalization and date formatting

## Application Architecture

### Directory Structure
```
band-roadie/
├── lib/                          # Flutter source code
│   ├── main.dart                 # App entry point
│   ├── app/                      # App configuration
│   │   ├── router/               # GoRouter configuration
│   │   └── theme/                # Design tokens and theming
│   ├── components/               # Shared UI components
│   │   └── ui/                   # Base UI components
│   ├── contexts/                 # App-wide contexts
│   ├── features/                 # Feature modules
│   │   ├── auth/                 # Authentication screens
│   │   ├── bands/                # Band management
│   │   ├── calendar/             # Calendar views
│   │   ├── gigs/                 # Gig management
│   │   ├── home/                 # Home/Dashboard
│   │   ├── members/              # Member management
│   │   ├── profile/              # User profile
│   │   ├── rehearsals/           # Rehearsal scheduling
│   │   └── setlists/             # Setlist management
│   │       ├── models/           # Data models
│   │       ├── services/         # Business logic
│   │       ├── tuning/           # Tuning helpers
│   │       └── widgets/          # UI components
│   └── shared/                   # Shared utilities
├── assets/                       # Static assets (images, fonts)
├── supabase/                     # Supabase configuration
│   ├── functions/                # Edge Functions
│   └── migrations/               # Database migrations
├── ios/                          # iOS platform code
├── android/                      # Android platform code
├── macos/                        # macOS platform code
├── web/                          # Web platform code
└── test/                         # Unit and widget tests
```

## Core Features

### 1. Authentication System
- **Magic Link Authentication:** Passwordless login via email
- **PKCE Flow:** Secure authentication flow
- **Profile Completion:** Required profile setup for new users
- **Session Management:** Persistent sessions with automatic refresh
- **Protected Routes:** Middleware-based route protection

### 2. Band Management
- **Multi-Band Support:** Users can belong to multiple bands
- **Band Creation:** Create new bands with member invitations
- **Band Switching:** Easy switching between bands
- **Member Management:** Invite, manage, and remove band members
- **Role-Based Access:** Different permission levels for band members

### 3. Dashboard
- **Centralized Hub:** Overview of upcoming events and quick actions
- **Next Rehearsal Display:** Shows upcoming rehearsal details
- **Potential Gig Alerts:** Highlights gigs needing confirmation
- **Quick Actions:** Fast access to create setlists, gigs, rehearsals
- **Welcome Screen:** Onboarding for new users without bands

### 4. Event Management
#### Rehearsals
- **Scheduling:** Create and manage rehearsal sessions
- **Location Tracking:** Venue and location management
- **Time Management:** Start and end time coordination
- **Notes:** Additional rehearsal information

#### Gigs
- **Gig Creation:** Schedule performances and shows
- **Venue Management:** Track performance locations
- **Potential Gigs:** Mark uncertain gigs for later confirmation
- **Member Responses:** Track who can/cannot attend
- **Setlist Assignment:** Link setlists to specific gigs

### 5. Setlist Management
- **Setlist Creation:** Build song lists for performances
- **Catalog:** Maintain band's master song repertoire (single source of truth)
- **Drag-and-Drop Ordering:** Intuitive song arrangement via drag handle
- **BPM Tracking:** Tap-to-edit BPM values with inline editing (20-300 range)
- **Duration Tracking:** Tap-to-edit duration in mm:ss format
- **Tuning Information:** Track instrument tunings per song with bottom sheet picker
- **Tuning Sort Modes:** Sort by tuning groups (Standard first, then Half-Step, etc.)
- **Custom Ordering:** Standard sort mode preserves user's custom song order
- **Song Metadata RPC:** Server-side functions bypass RLS for legacy song updates
- **Inline Editing:** Tap BPM, Duration, or Tuning badges to edit in place
- **Override Indicators:** Rose border on badges when song has custom values

### 6. Song Card UX
- **Drag Handle:** Reorder songs by dragging the grip icon on left side only
- **Scroll-Friendly:** Touching anywhere except drag handle scrolls normally
- **Card Layout:** Title, Artist, Delete button, and metrics row (BPM, Duration, Tuning)
- **Micro-Interactions:** Scale/opacity feedback on tap, elevation on drag
- **Save on Blur:** Editing automatically saves when focus leaves the field

### 7. Member Coordination
- **Invitation System:** Email-based band invitations
- **Member Directory:** View all band members and their roles
- **Role Management:** Assign and manage member roles (vocals, guitar, etc.)
- **Contact Information:** Access to member contact details
- **Attendance Tracking:** Monitor member availability for events

### 8. External Song Lookup
- **Search External APIs:** Find songs not in your Catalog from online databases
- **Auto-Add to Catalog:** Selected external songs are automatically added
- **BPM Enrichment:** BPM is pulled from external sources when available
- **Album Artwork:** External results display album art when available
- **Edge Functions:** Supabase Edge Functions handle API token caching and rate limits

### 9. Profile Management
- **Personal Information:** Name, phone, address, birthday
- **Musical Roles:** Assign and manage musical roles/instruments
- **Custom Roles:** Create custom roles beyond standard instruments
- **Profile Completion:** Required setup for new users
- **Settings:** User preferences and account settings

## User Experience Flow

### New User Journey
1. **Registration:** Email-based registration with magic link
2. **Profile Setup:** Required profile completion with personal info and roles
3. **Band Access:** Create new band or accept invitation
4. **Dashboard:** Access to main application features

### Existing User Journey
1. **Login:** Magic link authentication
2. **Dashboard:** Immediate access to band information
3. **Band Operations:** Manage rehearsals, gigs, setlists, members
4. **Multi-Band:** Switch between different bands if member of multiple

### Invitation Flow
1. **Invitation:** Band member sends email invitation
2. **Registration:** Recipient creates account via magic link
3. **Profile Setup:** Complete profile information
4. **Band Access:** Automatic addition to inviting band

## Technical Implementation Details

### Authentication Flow
- **Magic Links:** Passwordless authentication via email
- **PKCE:** Proof Key for Code Exchange for security
- **Session Management:** Supabase handles session persistence
- **Auth Gate:** App-level authentication checking with Riverpod
- **Profile Validation:** Ensures complete profiles before access

### State Management
- **Riverpod:** Application-wide state management with providers
- **StateNotifier:** Controllers for complex state (setlists, gigs, etc.)
- **AsyncValue:** Loading, error, and data states handled uniformly
- **Supabase Real-time:** Live updates for collaborative features

### Database Schema
```sql
-- Core Tables
users              # User profiles and authentication
bands              # Band information
band_members       # Many-to-many band membership
band_invitations   # Email invitations to join bands

-- Event Management
rehearsals         # Rehearsal scheduling
gigs               # Performance scheduling
gig_responses      # Member attendance responses
block_dates        # Member availability/unavailability

-- Setlist Management
setlists           # Song collections (including Catalog per band)
songs              # Individual song information
setlist_songs      # Many-to-many with position ordering

-- Additional Features
roles              # Custom role definitions
tunings            # Instrument tuning definitions
```

### RPC Functions (Supabase)
The app uses PostgreSQL functions with `SECURITY DEFINER` to handle operations that bypass Row Level Security:

```sql
-- Update song metadata (BPM, duration, tuning) for legacy songs
update_song_metadata(p_song_id, p_band_id, p_bpm, p_duration_seconds, p_tuning)

-- Clear song metadata fields
clear_song_metadata(p_song_id, p_band_id, p_clear_bpm, p_clear_duration, p_clear_tuning)
```

These RPCs are necessary because some legacy songs have `NULL` band_id values and would be blocked by RLS policies.

### Flutter Architecture
- **Feature-First:** Code organized by feature, not layer
- **Repository Pattern:** Data access abstracted behind repositories
- **Controllers:** StateNotifier classes manage feature state
- **Widgets:** Stateless where possible, stateful for animations/editing

## Cross-Platform Support

### Platforms
- **iOS:** Native iOS app via Flutter
- **Android:** Native Android app via Flutter
- **macOS:** Desktop app via Flutter
- **Web:** Progressive Web App deployed to Vercel

### Web Deployment (Vercel)
- **URL:** https://bandroadie.com
- **Build:** `flutter build web --release`
- **Hosting:** Vercel with SPA routing configuration
- **Caching:** Static assets cached with long TTLs

### Mobile-First Design
- **Responsive Design:** Optimized for mobile devices first
- **Touch Interactions:** Large touch targets (48px minimum)
- **Bottom Navigation:** Mobile-first navigation pattern
- **Gesture Support:** Swipe, drag, and tap gestures

## Security & Privacy

### Authentication Security
- **PKCE Flow:** Industry-standard secure authentication
- **Magic Links:** No password storage or transmission
- **Session Security:** Secure cookie handling
- **CSRF Protection:** Cross-site request forgery protection

### Data Protection
- **Supabase Security:** Row-level security policies
- **User Isolation:** Users only access their own data
- **Band Privacy:** Members only see their bands' information
- **Invitation Security:** Time-limited invitation links

## Development & Deployment

### Development Setup
```bash
# Install Flutter dependencies
flutter pub get

# Run on macOS
flutter run -d macos

# Run on iOS Simulator
flutter run -d ios

# Run on Chrome (Web)
flutter run -d chrome

# Build for web production
flutter build web --release

# Deploy to Vercel
cd build/web && vercel --prod
```

### Environment Variables
```
# Set in Supabase Dashboard and app configuration
SUPABASE_URL=              # Supabase project URL
SUPABASE_ANON_KEY=         # Supabase anonymous key
RESEND_API_KEY=            # Resend email API key (Edge Functions)
```

### Testing Strategy
- **Unit Tests:** Dart tests for models, utilities, and services
- **Widget Tests:** Flutter widget testing
- **Integration Tests:** End-to-end user flow testing
- **Analysis:** `flutter analyze` for static analysis

## Current State & Recent Changes

### Version 1.3.1 (December 2025)

#### Song Card Drag Handle Fix
- **Problem:** Touching anywhere on song cards would trigger drag-to-reorder, making scrolling difficult
- **Solution:** Restricted drag initiation to only the grip icon area (left 36px of card)
- **Files:** `reorderable_song_card.dart`, `setlist_detail_screen.dart`, `new_setlist_screen.dart`

#### Song Metadata RPC Functions
- **Problem:** BPM, Duration, and Tuning edits failed for legacy songs with NULL band_id due to RLS
- **Solution:** Created `update_song_metadata` and `clear_song_metadata` PostgreSQL functions with SECURITY DEFINER
- **Migration:** `064_update_song_metadata_rpc.sql`

#### Standard Sort Mode Fix
- **Problem:** "Standard" tuning sort mode was sorting songs instead of preserving user's custom order
- **Solution:** Standard mode now returns songs in their database position order (user's custom order)
- **File:** `setlist_detail_controller.dart`

### Version 1.3.0 (December 2025)
- External Song Lookup via Supabase Edge Functions
- Supabase Edge Functions for API token caching
- Edit icon to rename setlists from detail page
- "+ New" button in Setlists header
- Database triggers for accurate duration stats

### Bulk Add Songs Feature

The Bulk Add Songs feature allows users to quickly import multiple songs from a spreadsheet into their setlist and band Catalog.

**UI Flow:**
1. User taps "Bulk Paste" button on Setlist Detail screen
2. Modal overlay opens with multi-line text input
3. User pastes tab-delimited data (or 2+ space separated)
4. Live preview shows parsed rows with validation status
5. Invalid rows display inline error badges; warnings display inline warning badges
6. "Add Songs" button becomes enabled when valid rows exist
7. On submit: songs are created in Supabase and added to both Catalog and current setlist

**UI Copy:**
- Title: "Bulk Add Songs"
- Subtext Line 1: "Paste data from your Spreadsheet"
- Subtext Line 2: "Columns: ARTIST, SONG, BPM, TUNING"
- Helper: "You can also type song info by typing ARTIST, then hitting the Tab key, SONG, then Tab, BPM, then Tab, TUNING."

**Expected Input Format:**
```
ARTIST    SONG    BPM    TUNING
The Beatles    Come Together    82    Standard
Led Zeppelin    Whole Lotta Love    91    Drop D
```

**Row Limits:**
- Maximum 500 rows per paste
- If >500 rows pasted, shows error banner and processes only first 500

**Parsing Rules:**
- Columns: ARTIST, SONG (required), BPM (optional), TUNING (optional)
- Delimiter: TAB preferred, falls back to 2+ spaces
- BPM: Integer 1-300 or empty; invalid BPM → warning (row still valid, BPM set to null)
- Tuning normalization: Maps common variations to internal IDs
  - "Standard", "E Standard", "E", "Standard (E A D G B e)" → `standard_e`
  - "Half-Step", "Eb Standard", "E♭" → `half_step_down`
  - "Drop D", "Drop D tuning" → `drop_d`
  - "Drop C", "Drop B", "Drop A", etc.
  - "Open G", "Open G (D G D G B D)" → `open_g`
  - Parenthetical info and trailing "tuning" word are stripped before matching
  - Unknown tuning → warning (row still valid, tuning set to null)
- De-duplication: Same artist+song (case-insensitive) within batch → only first processed
- Missing song title → error (row invalid)

**Database Behavior:**
1. Ensures Catalog setlist exists for the band
2. For each valid row: Create/upsert song in `public.songs` (de-duped by band_id + title + artist)
3. Add song to Catalog setlist (always)
4. Add song to current setlist (if not already Catalog)
5. Duplicate inserts silently ignored (unique constraint)

**Files:**
- `lib/features/setlists/models/bulk_song_row.dart` - Parsed row model with warning support
- `lib/features/setlists/services/bulk_song_parser.dart` - Pure parsing logic with fuzzy tuning matching
- `lib/features/setlists/widgets/bulk_add_songs_overlay.dart` - Overlay UI with 500-row limit
- `lib/features/setlists/setlist_repository.dart` - `bulkAddSongs()` method

### Share Setlist Feature (Flutter App)

The Share Setlist feature allows users to share a plain-text version of their setlist via the native share sheet.

**UI Flow:**
1. User taps the Share icon (iOS share icon) in the Setlist Detail action buttons row
2. Native share sheet opens with formatted plain-text content
3. User can share via Messages, Mail, Notes, AirDrop, etc.

**Output Format:**
```
Setlist Name
49 songs • 1h 39m

Song Title
Artist Name                       125 BPM • Standard

Another Song
Another Artist                    - BPM • Drop D
```

**Formatting Rules:**
- **Header:** Setlist name on line 1, song count + total duration on line 2
- **Duration format:** `< 60 min` → "Xm" or "Xm Ys", `>= 60 min` → "Hh Mm"
- **Song block:** Title on first line, artist + BPM/tuning on second line
- **Two-column alignment:** Artist left-aligned, BPM/tuning right-aligned within 56-char width
- **BPM:** Shows "- BPM" if null/zero, otherwise "{bpm} BPM"
- **Tuning:** Uses short badge labels (Standard, Half-Step, Drop D, etc.)
- **Overflow handling:** If artist + metadata exceeds width, metadata wraps to indented next line

**Dependencies:**
- `share_plus: ^10.1.4` - Native share sheet integration

**Files:**
- `lib/features/setlists/setlist_detail_screen.dart` - `_handleShare()` and formatting helpers

### Active Issues
- **Supabase RLS:** Legacy songs with NULL band_id require RPC functions for updates

### Planned Enhancements
- **Calendar Integration:** Visual calendar for events
- **Advanced Setlist Features:** Tempo mapping, key changes
- **Native App Store Releases:** iOS App Store and Google Play
- **Payment Integration:** Premium features and subscriptions

## Key Files Reference

### Setlist Management
| File | Purpose |
|------|---------|
| `lib/features/setlists/setlist_repository.dart` | Database operations, RPC calls |
| `lib/features/setlists/setlist_detail_controller.dart` | State management, sorting logic |
| `lib/features/setlists/setlist_detail_screen.dart` | Main setlist UI screen |
| `lib/features/setlists/widgets/reorderable_song_card.dart` | Song card with inline editing |
| `lib/features/setlists/services/bulk_song_parser.dart` | Bulk paste parsing logic |
| `lib/features/setlists/tuning/tuning_helpers.dart` | Tuning normalization and display |

### Database Migrations
| Migration | Purpose |
|-----------|---------|
| `064_update_song_metadata_rpc.sql` | RPC functions for metadata updates |

## Support & Documentation

### User Support
- **In-App Guidance:** Contextual help and onboarding
- **Error Handling:** Graceful error messages with snackbar feedback
- **Responsive Design:** Works across all device sizes

### Developer Resources
- **Dart/Flutter:** Full type safety throughout application
- **Feature Modules:** Self-contained feature directories
- **Repository Pattern:** Clean data access abstraction
- **Database Migrations:** Version-controlled schema changes in `supabase/migrations/`

This comprehensive documentation provides everything needed to understand, develop, and maintain the Band Roadie application. The app represents a complete band management solution with modern cross-platform technologies and user-centered design.