import { unzipSync, strFromU8 } from "fflate";
import type { Play } from "./types";

/** Row shape of Spotify's "Extended streaming history" export (Streaming_History_Audio_*.json). */
interface ExtendedRow {
  ts: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  platform?: string | null;
  conn_country?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
}

/** Row shape of the basic "Account data" export (StreamingHistory_music_*.json). */
interface AccountRow {
  endTime: string;
  artistName: string;
  trackName: string;
  msPlayed: number;
}

export interface ImportResult {
  plays: Play[];
  files: number;
  /** Podcast / audiobook / video rows we skipped. */
  skippedNonMusic: number;
  /** Files we looked at but didn't recognise. */
  ignoredFiles: string[];
}

export const trackKey = (artist: string, track: string) => `${artist.toLowerCase()}\u0000${track.toLowerCase()}`;

function playId(ts: number, artist: string, track: string) {
  return `${ts}|${trackKey(artist, track)}`;
}

/** Spotify's platform strings are noisy ("Android OS 13 API 33 (Google, Pixel 7)"). */
export function tidyPlatform(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const p = raw.toLowerCase();
  if (p.includes("ios") || p.includes("iphone") || p.includes("ipad")) return "iOS";
  if (p.includes("android")) return p.includes("tv") ? "Android TV" : "Android";
  if (p.includes("osx") || p.includes("os x") || p.includes("mac")) return "macOS";
  if (p.includes("windows")) return "Windows";
  if (p.includes("linux")) return "Linux";
  if (p.includes("cast")) return "Cast";
  if (p.includes("web") || p.includes("chrome") || p.includes("browser")) return "Web player";
  if (p.includes("sonos")) return "Sonos";
  if (p.includes("ps4") || p.includes("ps5") || p.includes("playstation")) return "PlayStation";
  if (p.includes("xbox")) return "Xbox";
  if (p.includes("tv") || p.includes("roku") || p.includes("tizen") || p.includes("webos")) return "TV";
  if (p.includes("car") || p.includes("auto")) return "Car";
  if (p.includes("echo") || p.includes("alexa") || p.includes("speaker") || p.includes("partner")) return "Speaker";
  return "Other";
}

function fromExtended(rows: ExtendedRow[], out: Play[]): number {
  let skipped = 0;
  for (const r of rows) {
    const track = r.master_metadata_track_name;
    const artist = r.master_metadata_album_artist_name;
    if (!track || !artist) {
      skipped++;
      continue;
    }
    const ts = Date.parse(r.ts);
    if (Number.isNaN(ts)) continue;
    out.push({
      id: playId(ts, artist, track),
      ts,
      ms: r.ms_played ?? 0,
      track,
      artist,
      album: r.master_metadata_album_album_name ?? undefined,
      trackId: r.spotify_track_uri?.startsWith("spotify:track:") ? r.spotify_track_uri.slice(14) : undefined,
      source: "import",
      skipped: r.skipped ?? undefined,
      shuffle: r.shuffle ?? undefined,
      platform: tidyPlatform(r.platform),
      country: r.conn_country ?? undefined,
      reasonEnd: r.reason_end ?? undefined,
    });
  }
  return skipped;
}

function fromAccount(rows: AccountRow[], out: Play[]) {
  for (const r of rows) {
    if (!r.trackName || !r.artistName || r.artistName === "Unknown Artist") continue;
    // "2023-04-01 18:22" is UTC.
    const ts = Date.parse(r.endTime.replace(" ", "T") + ":00Z");
    if (Number.isNaN(ts)) continue;
    out.push({
      id: playId(ts, r.artistName, r.trackName),
      ts,
      ms: r.msPlayed ?? 0,
      track: r.trackName,
      artist: r.artistName,
      source: "import",
    });
  }
}

/** Parses one JSON document. Returns null if it isn't a listening-history file. */
export function parseHistoryJson(text: string, out: Play[]): { skipped: number } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  if (data.length === 0) return { skipped: 0 };
  const first = data[0] as Record<string, unknown>;
  if ("ms_played" in first && "ts" in first) return { skipped: fromExtended(data as ExtendedRow[], out) };
  if ("endTime" in first && "trackName" in first) {
    fromAccount(data as AccountRow[], out);
    return { skipped: 0 };
  }
  if ("endTime" in first && "episodeName" in first) return { skipped: data.length };
  // A Spins backup (Settings → Export) is already in our own shape.
  if (typeof first.ts === "number" && "track" in first && "artist" in first && "id" in first) {
    for (const p of data as Play[]) if (p.track && p.artist && Number.isFinite(p.ts)) out.push({ ...p, source: p.source === "sync" ? "sync" : "import" });
    return { skipped: 0 };
  }
  return null;
}

const looksRelevant = (name: string) => /\.json$/i.test(name) && !/(^|\/)__MACOSX\//.test(name);

/** Accepts the .zip Spotify emails you, or the .json files inside it. */
export async function parseFiles(files: File[]): Promise<ImportResult> {
  const plays: Play[] = [];
  const ignoredFiles: string[] = [];
  let skippedNonMusic = 0;
  let count = 0;

  const handle = (name: string, text: string) => {
    const r = parseHistoryJson(text, plays);
    if (r) {
      count++;
      skippedNonMusic += r.skipped;
    } else {
      ignoredFiles.push(name.split("/").pop() ?? name);
    }
  };

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => looksRelevant(f.name) && /stream/i.test(f.name),
      });
      for (const [name, bytes] of Object.entries(entries)) handle(name, strFromU8(bytes));
    } else if (/\.json$/i.test(file.name)) {
      handle(file.name, await file.text());
    } else {
      ignoredFiles.push(file.name);
    }
  }
  return { plays, files: count, skippedNonMusic, ignoredFiles };
}
