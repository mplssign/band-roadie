# External Song Lookup Implementation

## Overview

This feature enables users to search for songs from external sources (Spotify, MusicBrainz) when a song is not found in their band's Catalog. External songs are automatically added to the Catalog when selected.

## Architecture

### Supabase Edge Functions

API secrets are kept secure in Supabase Edge Functions (not in the Flutter app):

1. **`spotify_search`** - Search Spotify tracks
   - Uses Client Credentials OAuth flow
   - Returns: `{ ok, data: [{ title, artist, spotify_id, duration_seconds, album_artwork }], error }`

2. **`spotify_audio_features`** - Get BPM from Spotify
   - Input: `{ spotify_id }`
   - Returns: `{ ok, data: { bpm }, error }`

3. **`musicbrainz_search`** - Fallback search
   - No auth required, uses User-Agent header
   - Returns same format as Spotify (but bpm/artwork typically null)

### Shared Utilities

- **`_shared/cors.ts`** - CORS headers for Edge Functions
- **`_shared/spotify_auth.ts`** - Spotify token caching + rate limit handling

### Flutter Components

1. **`ExternalSongLookupService`** (`lib/features/songs/external_song_lookup_service.dart`)
   - In-memory cache (5 minute TTL)
   - Debouncing
   - Spotify-first with MusicBrainz fallback

2. **`SongLookupOverlay`** (updated)
   - Shows "In Catalog" section for local matches
   - Shows "External Results" section with source badges (Spotify green, MusicBrainz pink)
   - Upserts external songs to Catalog when selected

3. **`SetlistRepository.upsertExternalSong()`**
   - Creates or updates song with conflict handling
   - Preserves existing data while filling in missing fields

## Deployment

### 1. Set Spotify API Secrets in Supabase

```bash
# Get your Spotify API credentials from https://developer.spotify.com/dashboard
supabase secrets set SPOTIFY_CLIENT_ID=your_client_id
supabase secrets set SPOTIFY_CLIENT_SECRET=your_client_secret
```

### 2. Deploy Edge Functions

```bash
cd /path/to/BandRoadie/supabase

# Deploy all functions
supabase functions deploy spotify_search
supabase functions deploy spotify_audio_features
supabase functions deploy musicbrainz_search
```

### 3. Verify Deployment

```bash
# Test Spotify search
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/spotify_search' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"query": "Purple Rain"}'
```

## Database Changes

### New columns in `songs` table:

```sql
ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS spotify_id TEXT,
ADD COLUMN IF NOT EXISTS musicbrainz_id TEXT;
```

These columns are already in the Song model and repository, but may need to be added to your database schema.

## UI Flow

1. User taps "+ Add" on a setlist
2. Song Lookup Overlay opens
3. User types a search query
4. **Catalog results** appear instantly (filtered from pre-loaded songs)
5. **External results** appear after 300ms debounce (from Spotify/MusicBrainz)
6. User taps an external song
7. Song is upserted to Catalog (creating if new, updating if exists)
8. Song is added to the setlist
9. Overlay closes with success message

## Rate Limits

- **Spotify**: Token-based rate limiting handled automatically (retry on 429)
- **MusicBrainz**: 1 request/second enforced by API, User-Agent header required

## Caching

- Client-side in-memory cache: 5 minute TTL
- Spotify token: Cached in Edge Function memory until expiry
- No server-side result caching (Supabase Edge Functions are stateless per invocation)

## Error Handling

- Network errors show "External search failed" with retry button
- Upsert failures show error toast
- Graceful degradation: If external search fails, Catalog results still work
