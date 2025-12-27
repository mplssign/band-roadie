// Spotify Client Credentials Flow with token caching
// Token is cached in module-level variable with expiry tracking

interface SpotifyToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: SpotifyToken | null = null;

/**
 * Gets a valid Spotify access token, using cached value if still valid.
 * Uses Client Credentials flow for server-to-server auth.
 */
export async function getSpotifyToken(): Promise<string> {
  // Check if cached token is still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.accessToken;
}

/**
 * Makes an authenticated request to Spotify API with rate limit handling.
 * Retries once on 429, respecting Retry-After header.
 */
export async function spotifyFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getSpotifyToken();
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  let response = await fetch(url, { ...options, headers });

  // Handle rate limiting with retry
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
    console.log(`Spotify rate limited, retrying after ${retryAfter}s`);
    
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    response = await fetch(url, { ...options, headers });
  }

  return response;
}
