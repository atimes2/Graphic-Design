import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { addPlays, allPlays, clearPlays, countPlays } from "../db";
import type { Play } from "../types";

const p = (id: string, ts: number, source: Play["source"] = "import"): Play => ({ id, ts, ms: 1000, track: "t", artist: "a", source });

describe("db", () => {
  it("skips plays it already has and returns them oldest first", async () => {
    expect(await addPlays([p("b", 2), p("a", 1)])).toBe(2);
    expect(await addPlays([p("a", 1), p("c", 3, "sync")])).toBe(1);
    expect((await allPlays()).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("clears by source", async () => {
    await clearPlays("sync");
    expect(await countPlays()).toBe(2);
    await clearPlays();
    expect(await countPlays()).toBe(0);
  });
});
