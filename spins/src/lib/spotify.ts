import { accessToken, logout } from "./auth";
import type { ApiRange, NowPlaying, RecentItem, SpotifyArtist, SpotifyTrack, SpotifyUser } from "./types";

const API = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: "auth" | "quota" | "rate" | "forbidden" | "other" = "other",
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, attempt = 0): Promise<T | null> {
  const token = await accessToken(attempt > 0);
  if (!token) throw new SpotifyError("Not logged in", 401, "auth");

  const res = await fetch(path.startsWith("http") ? path : API + path, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204) return null;
  if (res.ok) return (await res.json()) as T;

  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText;

  if (res.status === 401) {
    if (attempt === 0) return request<T>(path, 1);
    logout();
    throw new SpotifyError("Your Spotify session expired. Log in again.", 401, "auth");
  }
  if (res.status === 429) {
    const reason = JSON.stringify(body).includes("QUOTA_EXCEEDED");
    if (reason) throw new SpotifyError("This app's Spotify quota is used up for now. Try again later.", 429, "quota");
    const wait = Math.min(Number(res.headers.get("Retry-After") ?? "2"), 30);
    if (attempt < 3) {
      await sleep(wait * 1000);
      return request<T>(path, attempt + 1);
    }
    throw new SpotifyError("Spotify is rate limiting requests. Give it a minute.", 429, "rate");
  }
  if (res.status === 403) {
    throw new SpotifyError(
      "Spotify refused this request. In Development Mode your account must be added under User Management in the Spotify dashboard.",
      403,
      "forbidden",
    );
  }
  throw new SpotifyError(msg || `Spotify error ${res.status}`, res.status);
}

// Tiny in-memory cache so flipping between tabs doesn't burn quota.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearApiCache() {
  cache.clear();
}

const MIN = 60_000;

export const spotify = {
  me: () => cached("me", 30 * MIN, async () => (await request<SpotifyUser>("/me"))!),

  topTracks: (range: ApiRange) =>
    cached(`tt:${range}`, 10 * MIN, async () => (await request<{ items: SpotifyTrack[] }>(`/me/top/tracks?time_range=${range}&limit=50`))!.items),

  topArtists: (range: ApiRange) =>
    cached(`ta:${range}`, 10 * MIN, async () => (await request<{ items: SpotifyArtist[] }>(`/me/top/artists?time_range=${range}&limit=50`))!.items),

  recent: (after?: number) =>
    request<{ items: RecentItem[] }>(`/me/player/recently-played?limit=50${after ? `&after=${after}` : ""}`).then((r) => r?.items ?? []),

  nowPlaying: () => request<NowPlaying>("/me/player/currently-playing").then((r) => (r?.item ? r : null)),

  track: (id: string) => cached(`t:${id}`, 60 * MIN, async () => (await request<SpotifyTrack>(`/tracks/${id}`))!),

  artist: (id: string) => cached(`a:${id}`, 60 * MIN, async () => (await request<SpotifyArtist>(`/artists/${id}`))!),

  /** Development Mode caps search at 10 results; we only need the best match. */
  searchTrack: async (track: string, artist: string) => {
    const q = encodeURIComponent(`track:${track} artist:${artist}`);
    const r = await request<{ tracks: { items: SpotifyTrack[] } }>(`/search?type=track&limit=1&q=${q}`);
    return r?.tracks.items[0] ?? null;
  },

  searchArtist: async (name: string) => {
    const r = await request<{ artists: { items: SpotifyArtist[] } }>(`/search?type=artist&limit=1&q=${encodeURIComponent(name)}`);
    return r?.artists.items[0] ?? null;
  },
};

export type SpotifyClient = typeof spotify;
