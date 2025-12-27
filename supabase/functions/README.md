# Supabase Edge Functions

This directory contains Edge Functions for BandRoadie.

## Functions

### `spotify_search`
Searches Spotify for tracks matching a query.

**Input:**
```json
{
  "query": "string (required, min 2 chars)",
  "limit": "number (optional, default 10, max 20)"
}
```

**Output:**
```json
{
  "ok": true,
  "data": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "spotify_id": "spotify_track_id",
      "duration_seconds": 210,
      "album_artwork": "https://..."
    }
  ],
  "error": null
}
```

### `spotify_audio_features`
Gets audio features (BPM/tempo) for a Spotify track.

**Input:**
```json
{
  "spotify_id": "string (required)"
}
```

**Output:**
```json
{
  "ok": true,
  "data": {
    "bpm": 120
  },
  "error": null
}
```

### `musicbrainz_search`
Fallback search using MusicBrainz (no auth required).

**Input:**
```json
{
  "query": "string (required, min 2 chars)",
  "limit": "number (optional, default 10, max 20)"
}
```

**Output:**
```json
{
  "ok": true,
  "data": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "musicbrainz_id": "uuid",
      "duration_seconds": 210,
      "album_artwork": null
    }
  ],
  "error": null
}
```

## Environment Variables

Set these in your Supabase project settings under Edge Functions > Secrets:

| Variable | Description |
|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Spotify Developer App Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify Developer App Client Secret |

### Getting Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Copy the Client ID and Client Secret
4. Add them to Supabase Edge Function secrets

## Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy individual function
supabase functions deploy spotify_search
supabase functions deploy spotify_audio_features
supabase functions deploy musicbrainz_search

# Set secrets
supabase secrets set SPOTIFY_CLIENT_ID=your_client_id
supabase secrets set SPOTIFY_CLIENT_SECRET=your_client_secret
```

## Testing Locally

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# Test spotify_search
curl -X POST http://localhost:54321/functions/v1/spotify_search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"query": "Blackbird Beatles"}'
```
