import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EnrichEntry, Play } from "./types";

interface SpinsDB extends DBSchema {
  plays: { key: string; value: Play; indexes: { ts: number; source: string } };
  enrich: { key: string; value: EnrichEntry };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<SpinsDB>> | null = null;

function db() {
  dbp ??= openDB<SpinsDB>("spins", 1, {
    upgrade(d) {
      const plays = d.createObjectStore("plays", { keyPath: "id" });
      plays.createIndex("ts", "ts");
      plays.createIndex("source", "source");
      d.createObjectStore("enrich", { keyPath: "key" });
      d.createObjectStore("kv");
    },
  });
  return dbp;
}

/** Adds plays, skipping ones already stored. Returns how many were new. */
export async function addPlays(plays: Play[]): Promise<number> {
  const d = await db();
  const tx = d.transaction("plays", "readwrite");
  const existing = new Set(await tx.store.getAllKeys());
  let added = 0;
  for (const p of plays) {
    if (existing.has(p.id)) continue;
    existing.add(p.id);
    tx.store.put(p);
    added++;
  }
  await tx.done;
  return added;
}

export async function allPlays(): Promise<Play[]> {
  return (await db()).getAllFromIndex("plays", "ts");
}

export async function countPlays(): Promise<number> {
  return (await db()).count("plays");
}

export async function clearPlays(source?: Play["source"]) {
  const d = await db();
  if (!source) return d.clear("plays");
  const tx = d.transaction("plays", "readwrite");
  for (const key of await tx.store.index("source").getAllKeys(source)) tx.store.delete(key);
  await tx.done;
}

export async function getEnrich(key: string) {
  return (await db()).get("enrich", key);
}

export async function putEnrich(e: EnrichEntry) {
  return (await db()).put("enrich", e);
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db()).get("kv", key) as Promise<T | undefined>;
}

export async function setKV(key: string, value: unknown) {
  return (await db()).put("kv", value, key);
}

export async function wipeEverything() {
  const d = await db();
  await Promise.all([d.clear("plays"), d.clear("enrich"), d.clear("kv")]);
}
