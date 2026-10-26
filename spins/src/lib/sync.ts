import { addPlays, getKV, setKV } from "./db";
import { trackKey } from "./importer";
import { spotify } from "./spotify";
import type { Play, RecentItem } from "./types";

const CURSOR = "sync.cursor";

export function recentToPlay(item: RecentItem): Play {
  const ts = Date.parse(item.played_at);
  const artist = item.track.artists[0]?.name ?? "Unknown";
  return {
    id: `${ts}|${trackKey(artist, item.track.name)}`,
    ts,
    // Spotify only lists plays of 30s+, and doesn't say how long; assume the whole track.
    ms: item.track.duration_ms,
    track: item.track.name,
    artist,
    album: item.track.album.name,
    trackId: item.track.id,
    source: "sync",
  };
}

/**
 * Spotify only ever exposes your last 50 plays, so Spins saves them every time
 * it opens. Open it at least every day or so and nothing is lost. `gap` is true
 * when even the oldest of those 50 is newer than the last play we saved.
 */
export async function syncRecent(): Promise<{ added: number; at: number; gap: boolean }> {
  const items = await spotify.recent();
  const cursor = (await getKV<number>(CURSOR)) ?? 0;
  const times = items.map((i) => Date.parse(i.played_at));
  const gap = cursor > 0 && items.length >= 50 && Math.min(...times) > cursor;
  const added = await addPlays(items.map(recentToPlay));
  const at = Date.now();
  await setKV(CURSOR, Math.max(cursor, ...times));
  await setKV("sync.lastRun", at);
  return { added, at, gap };
}
