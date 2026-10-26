import { trackKey } from "./importer";
import type { Play } from "./types";

export interface TimeRange {
  from?: number;
  to?: number;
}

export interface TrackStat {
  key: string;
  track: string;
  artist: string;
  album?: string;
  trackId?: string;
  count: number;
  ms: number;
  first: number;
  last: number;
}

export interface ArtistStat {
  key: string;
  artist: string;
  count: number;
  ms: number;
  tracks: number;
  first: number;
  last: number;
  /** A track id by this artist, used to look up artwork. */
  sampleTrackId?: string;
  sampleTrack: string;
}

export interface AlbumStat {
  key: string;
  album: string;
  artist: string;
  count: number;
  ms: number;
  tracks: number;
  sampleTrackId?: string;
  sampleTrack: string;
}

export interface Summary {
  streams: number;
  ms: number;
  tracks: number;
  artists: number;
  albums: number;
  activeDays: number;
  first?: number;
  last?: number;
  skips: number;
  /** Plays that carry a skipped flag at all (only the extended export does). */
  skipKnown: number;
}

const rank = <T extends { count: number; ms: number }>(a: T, b: T) => b.count - a.count || b.ms - a.ms;

/**
 * The same listen can arrive twice: once from live sync and again from a data
 * export, or from both the basic and extended exports. Merge near-identical plays
 * from different sources, keeping whichever carries more detail.
 */
export function dedupe(plays: Play[]): Play[] {
  const sorted = [...plays].sort((a, b) => a.ts - b.ts);
  const lastByKey = new Map<string, number>();
  const out: Play[] = [];
  const richness = (p: Play) => (p.source === "import" ? 2 : 0) + (p.trackId ? 1 : 0) + (p.platform ? 1 : 0);
  for (const p of sorted) {
    const k = trackKey(p.artist, p.track);
    const idx = lastByKey.get(k);
    if (idx !== undefined) {
      const prev = out[idx];
      const differentFormat = prev.source !== p.source || Boolean(prev.trackId) !== Boolean(p.trackId) || Boolean(prev.platform) !== Boolean(p.platform);
      if (differentFormat && Math.abs(p.ts - prev.ts) <= 75_000) {
        if (richness(p) > richness(prev)) out[idx] = { ...p, album: p.album ?? prev.album, trackId: p.trackId ?? prev.trackId };
        else if (!prev.trackId && p.trackId) out[idx] = { ...prev, trackId: p.trackId };
        continue;
      }
    }
    lastByKey.set(k, out.length);
    out.push(p);
  }
  return out;
}

/** Plays inside the range that are long enough to count as a stream. */
export function filterPlays(plays: Play[], range: TimeRange, minMs: number): Play[] {
  const from = range.from ?? -Infinity;
  const to = range.to ?? Infinity;
  return plays.filter((p) => p.ts >= from && p.ts < to && p.ms >= minMs);
}

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function summarize(plays: Play[]): Summary {
  const tracks = new Set<string>();
  const artists = new Set<string>();
  const albums = new Set<string>();
  const days = new Set<string>();
  let ms = 0;
  let skips = 0;
  let skipKnown = 0;
  let first: number | undefined;
  let last: number | undefined;
  for (const p of plays) {
    ms += p.ms;
    tracks.add(trackKey(p.artist, p.track));
    artists.add(p.artist.toLowerCase());
    if (p.album) albums.add(`${p.artist.toLowerCase()}\u0000${p.album.toLowerCase()}`);
    days.add(dayKey(p.ts));
    if (p.skipped !== undefined) {
      skipKnown++;
      if (p.skipped) skips++;
    }
    if (first === undefined || p.ts < first) first = p.ts;
    if (last === undefined || p.ts > last) last = p.ts;
  }
  return { streams: plays.length, ms, tracks: tracks.size, artists: artists.size, albums: albums.size, activeDays: days.size, first, last, skips, skipKnown };
}

export function topTracks(plays: Play[]): TrackStat[] {
  const m = new Map<string, TrackStat>();
  for (const p of plays) {
    const key = trackKey(p.artist, p.track);
    const s = m.get(key);
    if (s) {
      s.count++;
      s.ms += p.ms;
      if (p.ts < s.first) s.first = p.ts;
      if (p.ts > s.last) s.last = p.ts;
      s.trackId ??= p.trackId;
      s.album ??= p.album;
    } else {
      m.set(key, { key, track: p.track, artist: p.artist, album: p.album, trackId: p.trackId, count: 1, ms: p.ms, first: p.ts, last: p.ts });
    }
  }
  return [...m.values()].sort(rank);
}

export function topArtists(plays: Play[]): ArtistStat[] {
  const m = new Map<string, ArtistStat & { trackSet: Set<string> }>();
  for (const p of plays) {
    const key = p.artist.toLowerCase();
    let s = m.get(key);
    if (!s) {
      s = { key, artist: p.artist, count: 0, ms: 0, tracks: 0, first: p.ts, last: p.ts, sampleTrack: p.track, trackSet: new Set() };
      m.set(key, s);
    }
    s.count++;
    s.ms += p.ms;
    s.trackSet.add(p.track.toLowerCase());
    if (p.ts < s.first) s.first = p.ts;
    if (p.ts > s.last) s.last = p.ts;
    if (!s.sampleTrackId && p.trackId) {
      s.sampleTrackId = p.trackId;
      s.sampleTrack = p.track;
    }
  }
  return [...m.values()]
    .map(({ trackSet, ...s }) => ({ ...s, tracks: trackSet.size }))
    .sort(rank);
}

export function topAlbums(plays: Play[]): AlbumStat[] {
  const m = new Map<string, AlbumStat & { trackSet: Set<string> }>();
  for (const p of plays) {
    if (!p.album) continue;
    const key = `${p.artist.toLowerCase()}\u0000${p.album.toLowerCase()}`;
    let s = m.get(key);
    if (!s) {
      s = { key, album: p.album, artist: p.artist, count: 0, ms: 0, tracks: 0, sampleTrack: p.track, trackSet: new Set() };
      m.set(key, s);
    }
    s.count++;
    s.ms += p.ms;
    s.trackSet.add(p.track.toLowerCase());
    if (!s.sampleTrackId && p.trackId) {
      s.sampleTrackId = p.trackId;
      s.sampleTrack = p.track;
    }
  }
  return [...m.values()].map(({ trackSet, ...s }) => ({ ...s, tracks: trackSet.size })).sort(rank);
}

/** Streams per local hour of day. */
export function byHour(plays: Play[]): number[] {
  const h = new Array(24).fill(0);
  for (const p of plays) h[new Date(p.ts).getHours()]++;
  return h;
}

/** Streams per weekday, Monday first. */
export function byWeekday(plays: Play[]): number[] {
  const w = new Array(7).fill(0);
  for (const p of plays) w[(new Date(p.ts).getDay() + 6) % 7]++;
  return w;
}

/** [weekday Monday-first][hour] stream counts. */
export function weekHourGrid(plays: Play[]): number[][] {
  const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const p of plays) {
    const d = new Date(p.ts);
    g[(d.getDay() + 6) % 7][d.getHours()]++;
  }
  return g;
}

export interface Bucket {
  key: string;
  start: number;
  count: number;
  ms: number;
}

/** Contiguous monthly buckets from first to last play (empty months included). */
export function byMonth(plays: Play[]): Bucket[] {
  if (plays.length === 0) return [];
  const m = new Map<string, Bucket>();
  let min = Infinity;
  let max = -Infinity;
  for (const p of plays) {
    const d = new Date(p.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let b = m.get(key);
    if (!b) {
      b = { key, start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), count: 0, ms: 0 };
      m.set(key, b);
    }
    b.count++;
    b.ms += p.ms;
    min = Math.min(min, p.ts);
    max = Math.max(max, p.ts);
  }
  const out: Bucket[] = [];
  const cur = new Date(new Date(min).getFullYear(), new Date(min).getMonth(), 1);
  const end = new Date(new Date(max).getFullYear(), new Date(max).getMonth(), 1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    out.push(m.get(key) ?? { key, start: cur.getTime(), count: 0, ms: 0 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** Stream count per local day. */
export function byDay(plays: Play[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of plays) {
    const k = dayKey(p.ts);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface Streak {
  days: number;
  start?: string;
  end?: string;
}

/** Longest run of consecutive days with at least one stream. */
export function longestStreak(days: Iterable<string>): Streak {
  const sorted = [...days].sort();
  let best: Streak = { days: 0 };
  let runStart = "";
  let run = 0;
  let prev: number | null = null;
  for (const k of sorted) {
    const [y, mo, d] = k.split("-").map(Number);
    const t = Date.UTC(y, mo - 1, d) / 86_400_000;
    if (prev !== null && t === prev + 1) run++;
    else {
      run = 1;
      runStart = k;
    }
    if (run > best.days) best = { days: run, start: runStart, end: k };
    prev = t;
  }
  return best;
}

export function yearsIn(plays: Play[]): number[] {
  const s = new Set<number>();
  for (const p of plays) s.add(new Date(p.ts).getFullYear());
  return [...s].sort((a, b) => b - a);
}

export interface Slice {
  label: string;
  count: number;
  ms: number;
}

export function breakdown(plays: Play[], field: "platform" | "country" | "reasonEnd"): Slice[] {
  const m = new Map<string, Slice>();
  for (const p of plays) {
    const label = p[field];
    if (!label) continue;
    const s = m.get(label) ?? { label, count: 0, ms: 0 };
    s.count++;
    s.ms += p.ms;
    m.set(label, s);
  }
  return [...m.values()].sort(rank);
}

/** Previous range of the same length, for "up 3 / new" rank movement. */
export function previousRange(r: TimeRange): TimeRange | null {
  if (r.from === undefined || r.to === undefined) return null;
  const len = r.to - r.from;
  return { from: r.from - len, to: r.from };
}

export type Movement = { kind: "new" } | { kind: "up" | "down"; by: number } | { kind: "same" };

export function movement(key: string, index: number, previousKeys: Map<string, number> | null): Movement | null {
  if (!previousKeys) return null;
  const prev = previousKeys.get(key);
  if (prev === undefined) return { kind: "new" };
  if (prev === index) return { kind: "same" };
  return prev > index ? { kind: "up", by: prev - index } : { kind: "down", by: index - prev };
}

export const indexByKey = <T extends { key: string }>(list: T[]) => new Map(list.map((x, i) => [x.key, i]));

/** Calendar-year / rolling presets for local-history stats. */
export function presetRange(preset: string, now = Date.now()): TimeRange {
  const day = 86_400_000;
  switch (preset) {
    case "4w":
      return { from: now - 28 * day, to: now + 1 };
    case "6m":
      return { from: now - 182 * day, to: now + 1 };
    case "12m":
      return { from: now - 365 * day, to: now + 1 };
    case "all":
      return {};
    default: {
      const y = Number(preset);
      if (Number.isFinite(y)) return { from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime() };
      return {};
    }
  }
}
