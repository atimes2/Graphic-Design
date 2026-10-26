const nf = new Intl.NumberFormat();

export const num = (n: number) => nf.format(Math.round(n));

export const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const minutes = (ms: number) => Math.round(ms / 60_000);

/** "312 h" or "47 min" */
export function duration(ms: number): string {
  const m = ms / 60_000;
  if (m < 120) return `${Math.round(m)} min`;
  const h = m / 60;
  if (h < 48) return `${h.toFixed(1).replace(/\.0$/, "")} h`;
  return `${num(h)} h`;
}

/** Big-number form for stat tiles: hours, or minutes while it's under two hours. */
export function hoursValue(ms: number): { value: string; unit: string } {
  const m = ms / 60_000;
  if (m < 120) return { value: num(m), unit: Math.round(m) === 1 ? "minute" : "minutes" };
  return { value: num(m / 60), unit: "hours" };
}

/** "3:41" */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function ago(ts: number, now = Date.now()): string {
  const s = Math.round((ts - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), "day");
  return date(ts);
}

/** Compact relative time for tight spaces: "5m ago", "3h ago", "2d ago", else "Oct 2025". */
export function shortAgo(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ts) / 60_000));
  if (m < 60) return m < 1 ? "now" : `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  if (m < 30 * 1440) return `${Math.round(m / 1440)}d ago`;
  return monthYear(ts);
}

export const date = (ts: number) => new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export const monthYear = (ts: number) => new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short" });

export const time = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const hourLabel = (h: number) => {
  const d = new Date(2000, 0, 1, h);
  return d.toLocaleTimeString(undefined, { hour: "numeric" }).replace(":00", "");
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
