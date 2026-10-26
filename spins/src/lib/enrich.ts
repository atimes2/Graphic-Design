// Imported history has names but no artwork. Look artwork up lazily, one item at
// a time, and cache it forever in IndexedDB so each image costs one API call ever.
import { getEnrich, putEnrich } from "./db";
import type { SpotifyClient } from "./spotify";
import type { EnrichEntry, SpotifyImage } from "./types";

export type EnrichRequest =
  | { kind: "track"; trackId?: string; track: string; artist: string }
  | { kind: "album"; trackId?: string; track: string; artist: string; album: string }
  | { kind: "artist"; artist: string; trackId?: string; track?: string; artistId?: string };

export function enrichKey(req: EnrichRequest): string {
  switch (req.kind) {
    case "track":
      return req.trackId ? `t:${req.trackId}` : `ts:${req.artist.toLowerCase()}|${req.track.toLowerCase()}`;
    case "album":
      return `al:${req.artist.toLowerCase()}|${req.album.toLowerCase()}`;
    case "artist":
      return `a:${req.artist.toLowerCase()}`;
  }
}

/** Medium-sized image: big enough for a 2x thumbnail, not the 640px original. */
export function pickImage(images: SpotifyImage[] | undefined, min = 160): string | undefined {
  if (!images?.length) return undefined;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= min) ?? sorted[sorted.length - 1]).url;
}

const memory = new Map<string, EnrichEntry>();
const inflight = new Map<string, Promise<EnrichEntry>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
const CONCURRENCY = 2;
const STALE = 60 * 86_400_000;

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    active++;
    job().finally(() => {
      active--;
      pump();
    });
  }
}

async function lookup(api: SpotifyClient, req: EnrichRequest, key: string): Promise<EnrichEntry> {
  const base = { key, at: Date.now() };
  try {
    if (req.kind === "track" || req.kind === "album") {
      const t = req.trackId ? await api.track(req.trackId) : await api.searchTrack(req.track, req.artist);
      if (!t) return { ...base, missing: true };
      return {
        ...base,
        image: pickImage(t.album.images),
        trackId: t.id,
        artistId: t.artists[0]?.id,
        url: req.kind === "album" ? t.album.external_urls?.spotify : t.external_urls?.spotify,
      };
    }
    let id = req.artistId;
    if (!id && req.trackId) id = (await api.track(req.trackId))?.artists[0]?.id;
    const a = id ? await api.artist(id) : await api.searchArtist(req.artist);
    if (!a) return { ...base, missing: true };
    return { ...base, image: pickImage(a.images), artistId: a.id, url: a.external_urls?.spotify };
  } catch (e) {
    // Quota / rate limits: don't cache the failure, just give up for this session.
    const err = e as { kind?: string };
    if (err.kind === "quota" || err.kind === "rate" || err.kind === "auth") return { ...base, missing: true, at: 0 };
    return { ...base, missing: true };
  }
}

export function peekEnrich(req: EnrichRequest): EnrichEntry | undefined {
  return memory.get(enrichKey(req));
}

export function enrich(api: SpotifyClient, req: EnrichRequest): Promise<EnrichEntry> {
  const key = enrichKey(req);
  const mem = memory.get(key);
  if (mem) return Promise.resolve(mem);
  const running = inflight.get(key);
  if (running) return running;

  const p = (async () => {
    const stored = await getEnrich(key);
    if (stored && (stored.missing ? Date.now() - stored.at < 7 * 86_400_000 : Date.now() - stored.at < STALE)) {
      memory.set(key, stored);
      return stored;
    }
    const result = await new Promise<EnrichEntry>((resolve) => {
      queue.push(async () => resolve(await lookup(api, req, key)));
      pump();
    });
    memory.set(key, result);
    if (result.at > 0) await putEnrich(result);
    return result;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
