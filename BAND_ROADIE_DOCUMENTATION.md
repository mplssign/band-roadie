# Band Roadie - Complete Application Documentation

## Application Overview

**Band Roadie** is a comprehensive Progressive Web Application (PWA) designed for band management and coordination. Built with Next.js 14.2.33, TypeScript, and Supabase, it provides bands with tools to manage rehearsals, gigs, setlists, member coordination, and more.

### Core Identity
- **Name:** Band Roadie
- **Version:** 1.2.3
- **Tagline:** "Ultimate Band Management"
- **Description:** Manage your band's rehearsals, gigs, and setlists

## Technology Stack

### Frontend
- **Framework:** Next.js 14.1.0 with App Router
- **Language:** TypeScript
- **UI Components:** Radix UI primitives, Custom components
- **Styling:** Tailwind CSS with custom dark theme
- **State Management:** Zustand for band state
- **Animation:** Framer Motion
- **PWA Support:** next-pwa for offline capability

### Backend & Database
- **Backend:** Supabase (PostgreSQL + Auth + Real-time)
- **Authentication:** Supabase Auth with PKCE flow and magic links
- **Database:** PostgreSQL via Supabase
- **Email:** Resend for transactional emails
- **File Storage:** Supabase Storage

### Key Dependencies
- React 18.2.0, React DOM 18.2.0
- @supabase/ssr, @supabase/supabase-js
- @dnd-kit/* for drag-and-drop functionality
- @mui/material, @mui/x-date-pickers for advanced components
- date-fns, dayjs for date handling
- lucide-react for icons
- zod for validation

## Application Architecture

### Directory Structure
```
band-roadie/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication route group
│   │   ├── auth/callback/        # Magic link callbacks
│   │   ├── login/                # Login page
│   │   ├── logout/               # Logout page
│   │   └── signup/               # Signup page
│   ├── (protected)/              # Protected routes requiring authentication
│   │   ├── layout.tsx            # Auth wrapper with profile validation
│   │   ├── bands/                # Band management
│   │   ├── calendar/             # Event calendar
│   │   ├── dashboard/            # Main dashboard
│   │   ├── gigs/                 # Gig management
│   │   ├── invite/               # Band invitation handling
│   │   ├── members/              # Member management
│   │   ├── profile/              # User profile
│   │   ├── rehearsals/           # Rehearsal scheduling
│   │   ├── setlists/             # Setlist creation/management
│   │   └── settings/             # Application settings
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── bands/                # Band CRUD operations
│   │   ├── invitations/          # Invitation system
│   │   ├── profile/              # Profile management
│   │   ├── setlists/             # Setlist operations
│   │   ├── songs/                # Song management
│   │   └── users/                # User operations
│   ├── auth/callback/            # Server-side auth callback
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (redirects to login)
├── components/                   # Reusable UI components
│   ├── auth/                     # Authentication components
│   ├── bands/                    # Band-specific components
│   ├── dashboard/                # Dashboard components
│   ├── layout/                   # Layout components
│   ├── members/                  # Member management components
│   ├── navigation/               # Navigation components
│   ├── setlists/                 # Setlist components
│   └── ui/                       # Base UI components
├── contexts/                     # React contexts
├── hooks/                        # Custom React hooks
├── lib/                          # Utility libraries
│   ├── email/                    # Email templates
│   ├── server/                   # Server utilities
│   ├── supabase/                 # Supabase client configuration
│   ├── utils/                    # General utilities
│   ├── constants.ts              # Application constants
│   └── types.ts                  # TypeScript type definitions
├── migrations/                   # Database migrations
└── public/                       # Static assets
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
- **Song Library:** Maintain band's song repertoire
- **Drag-and-Drop Ordering:** Intuitive song arrangement
- **BPM Tracking:** Monitor song tempo for smooth transitions
- **Tuning Information:** Track instrument tunings per song
- **Performance Notes:** Add performance-specific notes

### 6. Member Coordination
- **Invitation System:** Email-based band invitations
- **Member Directory:** View all band members and their roles
- **Role Management:** Assign and manage member roles (vocals, guitar, etc.)
- **Contact Information:** Access to member contact details
- **Attendance Tracking:** Monitor member availability for events

### 7. Profile Management
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
- **Middleware Protection:** Route-level authentication checking
- **Profile Validation:** Ensures complete profiles before access

### State Management
- **Zustand Store:** Band state management (current band, band list)
- **React Hooks:** Custom hooks for bands, authentication, UI state
- **Supabase Real-time:** Live updates for collaborative features
- **Local State:** Component-level state for UI interactions

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
setlists           # Song collections for performances
songs              # Individual song information

-- Additional Features
roles              # Custom role definitions
tunings           # Instrument tuning information
notifications     # User notifications
```

### API Architecture
- **RESTful Endpoints:** Standard HTTP methods for CRUD operations
- **Route Handlers:** Next.js 14 route handlers in `/api/` directory
- **Server Actions:** Server-side form handling
- **Real-time Subscriptions:** Supabase real-time for live updates

## PWA Features

### Mobile Experience
- **Responsive Design:** Optimized for mobile devices
- **Touch Interactions:** Mobile-friendly touch targets
- **Bottom Navigation:** Mobile-first navigation pattern
- **Standalone Mode:** Full-screen app experience when installed

### Offline Capability
- **Service Worker:** Caches critical resources
- **Offline Fallbacks:** Graceful degradation when offline
- **Background Sync:** Sync data when connection restored

### Installation
- **Web App Manifest:** PWA installation prompts
- **App Icons:** Branded icons for home screen
- **Splash Screen:** Custom loading experience

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
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key
RESEND_API_KEY=                  # Resend email API key
NEXT_PUBLIC_APP_URL=             # Application base URL
```

### Testing Strategy
- **Unit Tests:** Jest for component and utility testing
- **Integration Tests:** API endpoint testing
- **E2E Testing:** User flow validation
- **ESLint:** Code quality and consistency

## Current State & Known Issues

### Recent Development
- **Authentication Flow:** Implemented magic link system with profile validation
- **Dashboard Redesign:** Modern dark theme with improved UX
- **Profile Management:** Complete profile setup and editing
- **Invitation System:** Email-based band invitations with custom templates

### Active Issues
- **Supabase Connection Timeouts:** Intermittent connection issues causing authentication delays
- **Rate Limiting:** Magic link generation can be rate-limited during testing

### Planned Enhancements
- **Calendar Integration:** Visual calendar for events
- **Advanced Setlist Features:** Tempo mapping, key changes
- **Mobile App:** Native iOS/Android applications
- **Payment Integration:** Premium features and subscriptions

## Support & Documentation

### User Support
- **In-App Guidance:** Contextual help and onboarding
- **Error Handling:** Graceful error messages and recovery
- **Responsive Design:** Works across all device sizes

### Developer Resources
- **TypeScript:** Full type safety throughout application
- **Component Library:** Reusable UI components
- **API Documentation:** Documented endpoints and data structures
- **Database Migrations:** Version-controlled schema changes

This comprehensive documentation provides everything needed to understand, develop, and maintain the Band Roadie application. The app represents a complete band management solution with modern web technologies and user-centered design.