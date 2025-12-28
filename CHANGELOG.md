## [1.3.1] - 2025-12-28

### Fixed
- fix(setlists): Restrict drag-to-reorder to grip icon area only
  - Users can now scroll through song lists without accidentally triggering drag mode
  - Drag handle covers left 36px of card (grip icon area)
- fix(setlists): BPM, Duration, and Tuning edits now work for legacy songs
  - Added `update_song_metadata` and `clear_song_metadata` RPC functions
  - Functions use SECURITY DEFINER to bypass RLS for NULL band_id songs
  - Repository uses RPC with fallback to direct update
- fix(setlists): Standard tuning sort mode now preserves user's custom order
  - Previously was sorting by tuning priority instead of respecting position

### Added
- feat(deployment): Flutter web app deployed to Vercel
  - Live at https://bandroadie.com
  - SPA routing configured for Flutter web

### Changed
- refactor(songs): ReorderableSongCard now accepts index parameter
  - Drag listener moved inside card component for better encapsulation

---

## [1.3.0] - 2025-12-23

### Added
- feat(songs): External Song Lookup via backend APIs
  - Search songs from online databases when not found in Catalog
  - Songs automatically added to Catalog when selected
  - BPM enriched automatically when available
- feat(edge-functions): New Supabase Edge Functions for external APIs
  - Token caching and rate limit handling
- feat(setlists): Edit icon to rename setlists from detail page
- feat(setlists): "+ New" button in Setlists header

### Changed
- refactor(song-lookup): Updated overlay to show "In Catalog" and "External Results" sections
- refactor(song-lookup): External results now show album artwork and BPM when available
- refactor(setlists): Removed FAB from Setlists screen, moved to header button

### Fixed
- fix(setlists): Setlist name now updates immediately after rename
- fix(setlists): Setlist cards now display correct song count and duration after mutations
  - Added database triggers to recompute `total_duration` on INSERT/UPDATE/DELETE
  - Flutter now refreshes setlist list after add, delete, bulk add, and undo operations
  - Migration backfills existing setlists with accurate duration stats

---

## [1.2.4] - 2025-10-17

### Added
- ui: add shadcn button & input (lowercase paths) (5408cd1)
- fix: add shadcn button + stabilize daysOfWeek in AddEventDrawer (5218a9b)
- feat(config): implement getBaseUrl() with Vercel preview support (1a31549)
- docs: add Vercel environment variables setup guide (c53c63c)
- chore: add local release script (59ea9b0)

### Changed
- chore: remove 51 dead files and duplicates (Phase 1 & 2) (e88542d)
- chore: remove debug routes (Phase 3) (8d1dc03)
- refactor(setlists): use next/dynamic + vercel.json + all jest deps (d4542c4)
- chore(tsconfig): include .next/types (Next.js auto-update) (ffc1531)
- chore: add local release script (59ea9b0)

### Fixed
- test(jest): fix passWithNoTests boolean in config (c03a7a5)
- fix: add shadcn button + stabilize daysOfWeek in AddEventDrawer (5218a9b)
- chore: remove debug routes (Phase 3) (8d1dc03)
- fix(auth): standardize magic-link redirect to /auth/callback (05e2a92)
- auth(login): use Rose 'Send Login Link', shared wordmark, domain shortcuts; fix magic-link callback to establish session and redirect new→profile, existing→dashboard; exclude callback from middleware (1d671ec)

---

# Changelog

