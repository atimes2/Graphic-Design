// A believable, entirely fictional listening history so the app can be explored
// without a Spotify account. Deterministic: the same seed gives the same history.
import type { ApiRange, NowPlaying, Play, RecentItem, SpotifyArtist, SpotifyTrack, SpotifyUser } from "./types";
import { filterPlays, presetRange, topArtists as rankArtists, topTracks as rankTracks } from "./stats";
import { trackKey } from "./importer";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARTISTS: [string, string[], string[]][] = [
  ["Velvet Static", ["dream pop", "shoegaze"], ["Low Tide Radio", "Glass Hours"]],
  ["Mara Okonkwo", ["neo soul", "r&b"], ["Honey Theory", "Second Language"]],
  ["The Paper Lanterns", ["indie rock"], ["Postcards From Nowhere", "Dial Tone"]],
  ["KILN", ["electronic", "house"], ["Heatmap", "Kiln II"]],
  ["Juniper Vale", ["folk", "indie folk"], ["Cedar & Smoke"]],
  ["Northbound Ghosts", ["post-rock"], ["Quiet Engines"]],
  ["Lux Avenue", ["synthpop"], ["Neon Lullabies", "After Hours Club"]],
  ["Dex Marlowe", ["hip hop", "rap"], ["Corner Store Prophet", "Deadstock"]],
  ["Saffron Coast", ["bossa nova", "jazz"], ["Rio Window"]],
  ["Halcyon Drive", ["alt pop"], ["Overpass", "Softcore Summer"]],
  ["Wren & The Wires", ["indie pop"], ["Static Bloom"]],
  ["Orbit Theory", ["electronic", "ambient"], ["Satellite Choir"]],
  ["Bianca Sol", ["latin pop", "reggaeton"], ["Calor"]],
  ["Grey Harbour", ["indie rock", "garage rock"], ["Saltwater Teeth"]],
  ["Ivy Kasumi", ["city pop", "j-pop"], ["Midnight Expressway"]],
  ["Cold Brew Collective", ["lo-fi", "chillhop"], ["Study Tapes Vol. 3", "Rainy Window"]],
  ["Atlas Mercer", ["country", "americana"], ["Gravel Roads"]],
  ["Sunday Riot", ["punk", "pop punk"], ["Bad Influence"]],
  ["Nadia Fern", ["singer-songwriter"], ["Kitchen Light"]],
  ["Tropic Unit", ["afrobeats"], ["Lagos Daylight"]],
  ["The Midnight Ferry", ["synthwave"], ["Outrun the Dawn"]],
  ["Polar Choir", ["chamber pop"], ["Hymns for Snow"]],
  ["Rook Valentine", ["alt r&b"], ["Velvet Rope"]],
  ["Moss Garden", ["ambient"], ["Slow Growth"]],
];

const WORDS = "Gold Static Satellite Honey Ghost Neon Paper River Echo Summer Velvet Midnight Glass Ocean Ember Wild Silver Hollow Signal Paradise Fever Cherry Lantern Orbit Blue Motel Tiger Cinema Daydream Comet Frost Telephone Mirror Vapor Golden Rose Thunder Lemon Cassette".split(" ");
const WORDS2 = "Lines Hours Heart Drive Hearts Days Lights Waves Talk Dreams Rain Bloom Season Club Theory Tape Arcade Machine Letters Youth Avenue Garden Weather Fire Static Signals Season Kids Tonight Again".split(" ");

interface DemoTrack {
  id: string;
  name: string;
  artistIdx: number;
  album: string;
  duration: number;
  weight: number;
}

interface DemoWorld {
  tracks: DemoTrack[];
  plays: Play[];
}

let world: DemoWorld | null = null;

export function demoWorld(now = Date.now()): DemoWorld {
  if (world) return world;
  const r = rng(20261031);
  const tracks: DemoTrack[] = [];
  const seen = new Set<string>();
  ARTISTS.forEach(([, , albums], ai) => {
    for (const album of albums) {
      const n = 4 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        let name = "";
        do {
          name = r() < 0.35 ? WORDS[Math.floor(r() * WORDS.length)] : `${WORDS[Math.floor(r() * WORDS.length)]} ${WORDS2[Math.floor(r() * WORDS2.length)]}`;
        } while (seen.has(name));
        seen.add(name);
        tracks.push({ id: `demo${tracks.length}`, name, artistIdx: ai, album, duration: 140_000 + Math.floor(r() * 150_000), weight: Math.pow(r(), 2.4) });
      }
    }
  });

  // Each artist has a "peak" moment; their pull fades with distance from it, so tops shift over time.
  const peaks = ARTISTS.map(() => r());
  const base = ARTISTS.map((_, i) => 1 / Math.pow(i + 1.5, 0.9));
  const start = new Date(now - 3.2 * 365 * 86_400_000).setHours(0, 0, 0, 0);
  const plays: Play[] = [];
  const hourShape = [2, 1, 0.6, 0.3, 0.2, 0.3, 1, 2.5, 4, 4.5, 4, 3.6, 3.8, 3.5, 3.4, 3.6, 4, 4.6, 5, 5.2, 5, 4.4, 3.6, 2.8];
  const hourTotal = hourShape.reduce((a, b) => a + b, 0);

  for (const cursor = new Date(start); cursor.getTime() < now; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getTime();
    const t = (day - start) / (now - start);
    const dow = new Date(day).getDay();
    const mood = 0.6 + r() * 0.9;
    const n = Math.floor((dow === 0 || dow === 6 ? 44 : 32) * mood * (0.75 + t * 0.5));
    if (r() < 0.03) continue; // the odd quiet day
    const artistW = ARTISTS.map((_, i) => base[i] * Math.exp(-Math.pow((t - peaks[i]) * 3.2, 2)) + base[i] * 0.15);
    const weights = tracks.map((tr) => artistW[tr.artistIdx] * (0.15 + tr.weight));
    const total = weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < n; k++) {
      let x = r() * total;
      let ti = 0;
      while (x > weights[ti] && ti < tracks.length - 1) x -= weights[ti++];
      const tr = tracks[ti];
      let h = r() * hourTotal;
      let hour = 0;
      while (h > hourShape[hour] && hour < 23) h -= hourShape[hour++];
      const ts = new Date(day).setHours(hour, Math.floor(r() * 60), Math.floor(r() * 60), 0);
      if (ts > now) continue;
      const skipped = r() < 0.14;
      const ms = skipped ? Math.floor(r() * 40_000) : tr.duration - Math.floor(r() * 3000);
      plays.push({
        id: `${ts}|${trackKey(ARTISTS[tr.artistIdx][0], tr.name)}`,
        ts,
        ms,
        track: tr.name,
        artist: ARTISTS[tr.artistIdx][0],
        album: tr.album,
        trackId: tr.id,
        source: "demo",
        skipped,
        shuffle: r() < 0.4,
        platform: ["iOS", "iOS", "iOS", "macOS", "Web player", "Speaker", "Car"][Math.floor(r() * 7)],
        country: r() < 0.93 ? "CA" : ["US", "GB", "MX"][Math.floor(r() * 3)],
        reasonEnd: skipped ? "fwdbtn" : "trackdone",
      });
    }
  }
  plays.sort((a, b) => a.ts - b.ts);
  world = { tracks, plays };
  return world;
}

const artistId = (i: number) => `demoartist${i}`;

function toArtist(i: number): SpotifyArtist {
  return { id: artistId(i), name: ARTISTS[i][0], genres: ARTISTS[i][1], images: [] };
}

function toTrack(t: DemoTrack): SpotifyTrack {
  const a = ARTISTS[t.artistIdx];
  return {
    id: t.id,
    name: t.name,
    duration_ms: t.duration,
    album: { id: `demoalbum-${t.album}`, name: t.album, images: [], artists: [{ id: artistId(t.artistIdx), name: a[0] }] },
    artists: [{ id: artistId(t.artistIdx), name: a[0] }],
  };
}

const RANGE_PRESET: Record<ApiRange, string> = { short_term: "4w", medium_term: "6m", long_term: "12m" };

export const demoApi = {
  me: async (): Promise<SpotifyUser> => ({ id: "demo", display_name: "Demo Listener", images: [] }),
  topTracks: async (range: ApiRange) => {
    const w = demoWorld();
    const byId = new Map(w.tracks.map((t) => [t.id, t]));
    return rankTracks(filterPlays(w.plays, presetRange(RANGE_PRESET[range]), 30_000))
      .slice(0, 50)
      .map((s) => toTrack(byId.get(s.trackId!)!));
  },
  topArtists: async (range: ApiRange) => {
    const w = demoWorld();
    return rankArtists(filterPlays(w.plays, presetRange(RANGE_PRESET[range]), 30_000))
      .slice(0, 50)
      .map((s) => toArtist(ARTISTS.findIndex((a) => a[0] === s.artist)));
  },
  recent: async (): Promise<RecentItem[]> => {
    const w = demoWorld();
    const byId = new Map(w.tracks.map((t) => [t.id, t]));
    return w.plays
      .filter((p) => p.ms >= 30_000)
      .slice(-50)
      .reverse()
      .map((p) => ({ played_at: new Date(p.ts).toISOString(), track: toTrack(byId.get(p.trackId!)!) }));
  },
  nowPlaying: async (): Promise<NowPlaying | null> => {
    const w = demoWorld();
    const t = w.tracks[7];
    return { is_playing: true, progress_ms: Math.floor(t.duration * 0.42), item: toTrack(t) };
  },
  track: async (id: string) => toTrack(demoWorld().tracks.find((t) => t.id === id)!),
  artist: async (id: string) => toArtist(Number(id.replace("demoartist", ""))),
  searchTrack: async (track: string, artist: string) => {
    const t = demoWorld().tracks.find((x) => x.name === track && ARTISTS[x.artistIdx][0] === artist);
    return t ? toTrack(t) : null;
  },
  searchArtist: async (name: string) => {
    const i = ARTISTS.findIndex((a) => a[0] === name);
    return i >= 0 ? toArtist(i) : null;
  },
};
