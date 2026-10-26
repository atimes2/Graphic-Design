import { useMemo, useRef, useState, type ReactNode } from "react";
import { WEEKDAYS, hourLabel, num } from "../lib/format";

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

export interface BarDatum {
  label: string;
  value: number;
  /** Tooltip content; defaults to "label: value". */
  tip?: ReactNode;
  highlight?: boolean;
}

/**
 * Vertical bars, one series. Thin rounded data-ends on a recessive grid,
 * per-bar hover tooltip with hit areas wider than the bar.
 */
export function BarChart({
  data,
  height = 180,
  format = num,
  tickEvery = 1,
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  format?: (v: number) => string;
  tickEvery?: number;
  ariaLabel: string;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = 600;
  const padL = 34;
  const padB = 22;
  const H = height;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const innerW = W - padL;
  const innerH = H - padB - 6;
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(slot - 2, slot * 0.68));
  const ticks = [0, max / 2, max];

  return (
    <div className="chart" ref={wrap} onMouseLeave={() => (setTip(null), setActive(null))}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none" style={{ height }}>
        <g className="axis">
          {ticks.map((t) => {
            const y = 6 + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line className="grid-line" x1={padL} x2={W} y1={y} y2={y} />
                <text x={padL - 6} y={y + 3} textAnchor="end">
                  {format(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) =>
            i % tickEvery === 0 ? (
              <text key={i} x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </g>
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = 6 + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i}>
              <rect
                className="hit"
                x={padL + i * slot}
                y={0}
                width={slot}
                height={H - padB}
                onMouseMove={(e) => {
                  const box = wrap.current!.getBoundingClientRect();
                  setActive(i);
                  setTip({ x: e.clientX - box.left, y: (y / H) * box.height, content: d.tip ?? <><b>{format(d.value)}</b> · {d.label}</> });
                }}
              />
              {h > 0 && (
                <path
                  className={`bar ${active === i || d.highlight ? "on" : ""}`}
                  d={`M${x},${6 + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${6 + innerH} Z`}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}

/** Opacity steps of the accent: one hue, light→dark = less→more. */
function heatColor(v: number, max: number) {
  if (v <= 0 || max <= 0) return "var(--surface-2)";
  const pct = Math.round(10 + (v / max) * 90);
  return `color-mix(in oklab, var(--accent) ${pct}%, var(--surface-2))`;
}

export function HeatLegend({ max, unit = "streams" }: { max: number; unit?: string }) {
  return (
    <div className="legend-scale">
      <span>Less</span>
      {[0, 0.15, 0.4, 0.7, 1].map((t) => (
        <i key={t} style={{ background: heatColor(t * max, max) }} />
      ))}
      <span>More</span>
      <span style={{ marginLeft: "auto" }}>
        max {num(max)} {unit}
      </span>
    </div>
  );
}

/** Weekday × hour grid. */
export function WeekHourHeat({ grid }: { grid: number[][] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const max = Math.max(...grid.flat());
  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setTip(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 6, alignItems: "center" }}>
        {grid.map((row, d) => (
          <div key={d} style={{ display: "contents" }}>
            <span className="mono small muted">{WEEKDAYS[d]}</span>
            <div className="heat" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
              {row.map((v, h) => (
                <div
                  key={h}
                  className="heat-cell"
                  style={{ background: heatColor(v, max) }}
                  onMouseMove={(e) => {
                    const box = wrap.current!.getBoundingClientRect();
                    const cell = (e.target as HTMLElement).getBoundingClientRect();
                    setTip({
                      x: cell.left - box.left + cell.width / 2,
                      y: cell.top - box.top,
                      content: (
                        <>
                          <b>{num(v)}</b> streams · {WEEKDAYS[d]} {hourLabel(h)}
                        </>
                      ),
                    });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <span />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 3 }} className="mono small muted">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ fontSize: 10, textAlign: "center" }}>
              {h % 6 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
        </div>
      </div>
      <HeatLegend max={max} />
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}

/** GitHub-style calendar for one year. */
export function CalendarHeat({ year, days }: { year: number; days: Map<string, number> }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { weeks, max, months } = useMemo(() => {
    const start = new Date(year, 0, 1);
    const offset = (start.getDay() + 6) % 7;
    const cells: { key: string; date: Date; v: number }[] = [];
    let max = 0;
    for (let d = new Date(start); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      const key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const v = days.get(key) ?? 0;
      max = Math.max(max, v);
      cells.push({ key, date: new Date(d), v });
    }
    const weeks: ({ key: string; date: Date; v: number } | null)[][] = [];
    const padded = [...Array(offset).fill(null), ...cells];
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
    const months: { label: string; col: number }[] = [];
    weeks.forEach((w, i) => {
      const firstOfMonth = w.find((c) => c?.date.getDate() === 1);
      if (firstOfMonth) months.push({ label: firstOfMonth.date.toLocaleDateString(undefined, { month: "short" }), col: i });
    });
    return { weeks, max, months };
  }, [year, days]);

  const cell = 12;
  const gap = 3;
  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setTip(null)}>
      <div className="cal">
        <svg width={weeks.length * (cell + gap) + 30} height={7 * (cell + gap) + 18} role="img" aria-label={`Streams per day in ${year}`}>
          <g className="axis">
            {months.map((m) => (
              <text key={m.col} x={30 + m.col * (cell + gap)} y={10}>
                {m.label}
              </text>
            ))}
            {[0, 2, 4].map((d) => (
              <text key={d} x={0} y={18 + d * (cell + gap) + 10}>
                {WEEKDAYS[d]}
              </text>
            ))}
          </g>
          {weeks.map((w, wi) =>
            w.map(
              (c, di) =>
                c && (
                  <rect
                    key={c.key}
                    x={30 + wi * (cell + gap)}
                    y={18 + di * (cell + gap)}
                    width={cell}
                    height={cell}
                    rx={3}
                    style={{ fill: heatColor(c.v, max) }}
                    onMouseMove={(e) => {
                      const box = wrap.current!.getBoundingClientRect();
                      const r = (e.target as SVGElement).getBoundingClientRect();
                      setTip({
                        x: r.left - box.left + r.width / 2,
                        y: r.top - box.top,
                        content: (
                          <>
                            <b>{num(c.v)}</b> streams · {c.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </>
                        ),
                      });
                    }}
                  />
                ),
            ),
          )}
        </svg>
      </div>
      <HeatLegend max={max} />
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}

/** Horizontal share bars for small categorical breakdowns. */
export function HBarList({ items, format = num }: { items: { label: string; value: number; note?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="hbar-list">
      {items.map((i) => (
        <div className="hbar" key={i.label} title={`${i.label}: ${format(i.value)}`}>
          <span className="hbar-label">{i.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="mono small muted tnum">
            {format(i.value)} · {Math.round((i.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
