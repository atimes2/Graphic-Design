/** One listen, normalised from any source (Spotify data export, live sync, demo). */
export interface Play {
  /** Unique key, used to dedupe re-imports. */
  id: string;
  /** When the play ended, epoch ms. */
  ts: number;
  /** How long it actually played, ms. */
  ms: number;
  track: string;
  artist: string;
  album?: string;
  /** Spotify track id (no `spotify:track:` prefix), when known. */
  trackId?: string;
  source: "import" | "sync" | "demo";
  skipped?: boolean;
  shuffle?: boolean;
  platform?: string;
  country?: string;
  reasonEnd?: string;
}

export type ApiRange = "short_term" | "medium_term" | "long_term";

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
  external_urls?: { spotify?: string };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date?: string;
  artists: { id: string; name: string }[];
  external_urls?: { spotify?: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  explicit?: boolean;
  album: SpotifyAlbum;
  artists: { id: string; name: string }[];
  external_urls?: { spotify?: string };
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  images?: SpotifyImage[];
  external_urls?: { spotify?: string };
}

export interface RecentItem {
  played_at: string;
  track: SpotifyTrack;
}

export interface NowPlaying {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
}

/** Cached artwork / ids looked up for imported plays. */
export interface EnrichEntry {
  key: string;
  image?: string;
  trackId?: string;
  artistId?: string;
  url?: string;
  /** Set when the lookup failed so we don't retry forever. */
  missing?: boolean;
  at: number;
}
