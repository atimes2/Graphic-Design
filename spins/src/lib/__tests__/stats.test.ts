import { describe, expect, it } from "vitest";
import { trackKey } from "../importer";
import { byHour, byMonth, dedupe, filterPlays, longestStreak, movement, presetRange, previousRange, summarize, topAlbums, topArtists, topTracks } from "../stats";
import type { Play } from "../types";

let n = 0;
function play(p: Partial<Play> & { ts: number }): Play {
  const track = p.track ?? "T";
  const artist = p.artist ?? "A";
  return { id: `${p.ts}|${trackKey(artist, track)}|${n++}`, ms: 180_000, track, artist, source: "import", ...p };
}

const day = 86_400_000;
const t0 = new Date(2024, 0, 1, 12).getTime();

describe("dedupe", () => {
  it("merges the same listen coming from sync and from an import", () => {
    const a = play({ ts: t0, source: "sync", trackId: "x" });
    const b = play({ ts: t0 + 20_000, source: "import", trackId: "x", platform: "iOS" });
    const out = dedupe([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("import");
  });

  it("merges basic and extended exports of the same play", () => {
    const basic = play({ ts: t0 - 40_000 });
    const extended = play({ ts: t0, trackId: "x", platform: "iOS" });
    const out = dedupe([basic, extended]);
    expect(out).toHaveLength(1);
    expect(out[0].trackId).toBe("x");
  });

  it("keeps genuine repeat plays from the same source", () => {
    const out = dedupe([play({ ts: t0 }), play({ ts: t0 + 30_000 }), play({ ts: t0 + 60_000 })]);
    expect(out).toHaveLength(3);
  });

  it("keeps plays of different tracks at the same time", () => {
    expect(dedupe([play({ ts: t0, track: "A", source: "sync" }), play({ ts: t0, track: "B" })])).toHaveLength(2);
  });
});

describe("rankings", () => {
  const plays = [
    play({ ts: t0, track: "One", artist: "X", album: "Al1", ms: 100_000 }),
    play({ ts: t0 + 1, track: "One", artist: "X", album: "Al1", ms: 100_000 }),
    play({ ts: t0 + 2, track: "one", artist: "x", album: "Al1", ms: 100_000 }),
    play({ ts: t0 + 3, track: "Two", artist: "X", album: "Al2", ms: 200_000 }),
    play({ ts: t0 + 4, track: "Three", artist: "Y", album: "Al3", ms: 300_000 }),
    play({ ts: t0 + 5, track: "Three", artist: "Y", album: "Al3", ms: 300_000 }),
  ];

  it("ranks tracks by streams, merging case differences", () => {
    const t = topTracks(plays);
    expect(t.map((x) => [x.track, x.count])).toEqual([
      ["One", 3],
      ["Three", 2],
      ["Two", 1],
    ]);
  });

  it("ranks artists and counts distinct tracks", () => {
    const a = topArtists(plays);
    expect(a[0]).toMatchObject({ artist: "X", count: 4, tracks: 2, ms: 500_000 });
    expect(a[1]).toMatchObject({ artist: "Y", count: 2, tracks: 1 });
  });

  it("breaks ties by listening time", () => {
    const al = topAlbums([play({ ts: 1, album: "Short", ms: 1000 }), play({ ts: 2, album: "Long", ms: 9000 })]);
    expect(al.map((x) => x.album)).toEqual(["Long", "Short"]);
  });

  it("summarises", () => {
    const s = summarize(plays);
    expect(s).toMatchObject({ streams: 6, tracks: 3, artists: 2, albums: 3, activeDays: 1, ms: 1_100_000 });
  });
});

describe("filterPlays", () => {
  it("applies range and the minimum stream length", () => {
    const plays = [play({ ts: t0, ms: 10_000 }), play({ ts: t0, ms: 40_000 }), play({ ts: t0 + 10 * day, ms: 40_000 })];
    expect(filterPlays(plays, {}, 30_000)).toHaveLength(2);
    expect(filterPlays(plays, { from: t0, to: t0 + day }, 30_000)).toHaveLength(1);
    expect(filterPlays(plays, { from: t0, to: t0 + day }, 0)).toHaveLength(2);
  });
});

describe("time buckets", () => {
  it("fills empty months", () => {
    const months = byMonth([play({ ts: new Date(2024, 0, 5).getTime() }), play({ ts: new Date(2024, 3, 5).getTime() })]);
    expect(months.map((m) => [m.key, m.count])).toEqual([
      ["2024-01", 1],
      ["2024-02", 0],
      ["2024-03", 0],
      ["2024-04", 1],
    ]);
  });

  it("buckets by local hour", () => {
    const h = byHour([play({ ts: new Date(2024, 0, 1, 7, 30).getTime() }), play({ ts: new Date(2024, 0, 2, 7, 59).getTime() })]);
    expect(h[7]).toBe(2);
    expect(h.reduce((a, b) => a + b)).toBe(2);
  });

  it("finds the longest streak", () => {
    expect(longestStreak(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-05", "2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"])).toEqual({
      days: 4,
      start: "2024-02-28",
      end: "2024-03-02",
    });
    expect(longestStreak([])).toEqual({ days: 0 });
  });
});

describe("ranges and movement", () => {
  it("calendar year presets", () => {
    const r = presetRange("2023");
    expect(r.from).toBe(new Date(2023, 0, 1).getTime());
    expect(r.to).toBe(new Date(2024, 0, 1).getTime());
    expect(presetRange("all")).toEqual({});
  });

  it("previous range has the same length", () => {
    expect(previousRange({ from: 100, to: 150 })).toEqual({ from: 50, to: 100 });
    expect(previousRange({})).toBeNull();
  });

  it("movement", () => {
    const prev = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    expect(movement("b", 0, prev)).toEqual({ kind: "up", by: 1 });
    expect(movement("a", 1, prev)).toEqual({ kind: "down", by: 1 });
    expect(movement("c", 2, prev)).toEqual({ kind: "new" });
    expect(movement("a", 0, prev)).toEqual({ kind: "same" });
    expect(movement("a", 0, null)).toBeNull();
  });
});
