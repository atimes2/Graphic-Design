import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { parseFiles, parseHistoryJson, tidyPlatform } from "../importer";
import type { Play } from "../types";

const extended = [
  {
    ts: "2024-03-01T10:00:00Z",
    ms_played: 200000,
    master_metadata_track_name: "Song A",
    master_metadata_album_artist_name: "Artist 1",
    master_metadata_album_album_name: "Album X",
    spotify_track_uri: "spotify:track:abc123",
    platform: "iOS 17.2 (iPhone15,2)",
    conn_country: "CA",
    reason_end: "trackdone",
    shuffle: false,
    skipped: false,
  },
  {
    ts: "2024-03-01T11:00:00Z",
    ms_played: 1000,
    master_metadata_track_name: null,
    master_metadata_album_artist_name: null,
    master_metadata_album_album_name: null,
    spotify_track_uri: null,
    episode_name: "Some podcast",
  },
];

const account = [
  { endTime: "2023-12-31 23:59", artistName: "Artist 2", trackName: "Song B", msPlayed: 180000 },
  { endTime: "2023-12-31 23:50", artistName: "Unknown Artist", trackName: "Unknown Track", msPlayed: 1000 },
];

class FakeFile {
  constructor(private bytes: Uint8Array, public name: string) {}
  async text() {
    return new TextDecoder().decode(this.bytes);
  }
  async arrayBuffer() {
    return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength);
  }
}
const file = (name: string, content: string | Uint8Array) => new FakeFile(typeof content === "string" ? strToU8(content) : content, name) as unknown as File;

describe("parseHistoryJson", () => {
  it("reads the extended export and skips podcasts", () => {
    const out: Play[] = [];
    const r = parseHistoryJson(JSON.stringify(extended), out);
    expect(r).toEqual({ skipped: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      ts: Date.parse("2024-03-01T10:00:00Z"),
      ms: 200000,
      track: "Song A",
      artist: "Artist 1",
      album: "Album X",
      trackId: "abc123",
      platform: "iOS",
      country: "CA",
      skipped: false,
      source: "import",
    });
  });

  it("reads the basic account-data export as UTC", () => {
    const out: Play[] = [];
    parseHistoryJson(JSON.stringify(account), out);
    expect(out).toHaveLength(1);
    expect(out[0].ts).toBe(Date.UTC(2023, 11, 31, 23, 59));
    expect(out[0].trackId).toBeUndefined();
  });

  it("rejects unrelated JSON", () => {
    expect(parseHistoryJson(JSON.stringify([{ foo: 1 }]), [])).toBeNull();
    expect(parseHistoryJson("{not json", [])).toBeNull();
    expect(parseHistoryJson(JSON.stringify({ a: 1 }), [])).toBeNull();
  });

  it("round-trips a Spins backup", () => {
    const out: Play[] = [];
    parseHistoryJson(JSON.stringify(extended), out);
    const again: Play[] = [];
    parseHistoryJson(JSON.stringify(out), again);
    expect(again).toEqual(out);
  });
});

describe("parseFiles", () => {
  it("unzips Spotify's export and ignores non-history files", async () => {
    const zip = zipSync({
      "Spotify Extended Streaming History/Streaming_History_Audio_2024.json": strToU8(JSON.stringify(extended)),
      "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": strToU8("pdf"),
      "Spotify Account Data/StreamingHistory_music_0.json": strToU8(JSON.stringify(account)),
      "Spotify Account Data/Userdata.json": strToU8(JSON.stringify({ username: "x" })),
    });
    const r = await parseFiles([file("my_spotify_data.zip", zip)]);
    expect(r.files).toBe(2);
    expect(r.plays).toHaveLength(2);
    expect(r.skippedNonMusic).toBe(1);
  });

  it("reports files it can't use", async () => {
    const r = await parseFiles([file("notes.txt", "hi"), file("Userdata.json", JSON.stringify({ a: 1 }))]);
    expect(r.files).toBe(0);
    expect(r.ignoredFiles).toEqual(["notes.txt", "Userdata.json"]);
  });
});

describe("tidyPlatform", () => {
  it.each([
    ["Android OS 13 API 33 (Google, Pixel 7)", "Android"],
    ["iOS 16.1 (iPhone14,5)", "iOS"],
    ["OS X 13.0.0 [x86 8]", "macOS"],
    ["Windows 10 (10.0.19045; x64)", "Windows"],
    ["WebPlayer (websocket RFC6455)", "Web player"],
    ["google_cast_tv", "Cast"],
    [null, undefined],
  ])("%s → %s", (raw, expected) => {
    expect(tidyPlatform(raw)).toBe(expected);
  });
});
