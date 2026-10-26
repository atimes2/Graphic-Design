import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "./store";
import { filterPlays, presetRange, previousRange, yearsIn, type TimeRange } from "./stats";
import type { ApiRange, Play } from "./types";

export type RangeValue = ApiRange | "all" | `${number}`;

export const API_RANGES: { value: ApiRange; label: string; preset: string }[] = [
  { value: "short_term", label: "4 weeks", preset: "4w" },
  { value: "medium_term", label: "6 months", preset: "6m" },
  { value: "long_term", label: "12 months", preset: "12m" },
];

export const isApiRange = (v: string): v is ApiRange => v === "short_term" || v === "medium_term" || v === "long_term";

export function rangeLabel(v: string): string {
  const api = API_RANGES.find((r) => r.value === v);
  if (api) return `last ${api.label}`;
  const preset = API_RANGES.find((r) => r.preset === v);
  if (preset) return `last ${preset.label}`;
  if (v === "all") return "all time";
  return v;
}

/** Range state kept in the URL (?range=) so back/forward and sharing keep it. */
export function useRange(defaultValue: RangeValue = "short_term") {
  const [params, setParams] = useSearchParams();
  const value = (params.get("range") as RangeValue) || defaultValue;
  const set = (v: string) =>
    setParams(
      (p) => {
        p.set("range", v);
        return p;
      },
      { replace: true },
    );
  return [value, set] as const;
}

export function useYears(): number[] {
  const { plays } = useStore();
  return useMemo(() => yearsIn(plays), [plays]);
}

/** Options for a range picker: Spotify's three windows, then lifetime + years from local history. */
export function useRangeOptions(includeApi = true) {
  const years = useYears();
  return useMemo(() => {
    const opts: ({ value: string; label: string } | "sep")[] = [];
    if (includeApi) opts.push(...API_RANGES.map(({ value, label }) => ({ value, label })), "sep");
    opts.push({ value: "all", label: "Lifetime" });
    for (const y of years.slice(0, 8)) opts.push({ value: String(y), label: String(y) });
    return opts;
  }, [years, includeApi]);
}

export function localRangeFor(v: string): TimeRange {
  const api = API_RANGES.find((r) => r.value === v);
  return presetRange(api ? api.preset : v);
}

/** Local plays in the range plus the previous range of equal length (for rank movement). */
export function useLocalPlays(v: string): { current: Play[]; previous: Play[] | null } {
  const { plays, minMs } = useStore();
  return useMemo(() => {
    const r = localRangeFor(v);
    const prev = previousRange(r);
    return {
      current: filterPlays(plays, r, minMs),
      previous: prev ? filterPlays(plays, prev, minMs) : null,
    };
  }, [plays, minMs, v]);
}
