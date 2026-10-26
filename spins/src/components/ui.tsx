import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EnrichRequest } from "../lib/enrich";
import { duration, num } from "../lib/format";
import type { Movement } from "../lib/stats";
import { Artwork } from "./Artwork";
import { IconAlert, IconBack } from "./icons";

export interface RankItem {
  key: string;
  title: string;
  subtitle?: string;
  image?: string;
  lookup?: EnrichRequest;
  round?: boolean;
  to?: string;
  count?: number;
  ms?: number;
  move?: Movement | null;
}

export const artistPath = (name: string) => `/artist/${encodeURIComponent(name)}`;
export const trackPath = (artist: string, track: string) => `/track/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`;

function MoveBadge({ move }: { move?: Movement | null }) {
  if (!move) return null;
  if (move.kind === "new") return <span className="move new">NEW</span>;
  if (move.kind === "up") return <span className="move up">▲{move.by}</span>;
  if (move.kind === "down") return <span className="move down">▼{move.by}</span>;
  return <span className="move muted">–</span>;
}

function Metric({ count, ms }: { count?: number; ms?: number }) {
  if (count === undefined && ms === undefined) return null;
  return (
    <div className="rank-metric tnum">
      {count !== undefined && <>{num(count)} {count === 1 ? "stream" : "streams"}</>}
      {ms !== undefined && <span className="muted">{duration(ms)}</span>}
    </div>
  );
}

export function RankList({ items, start = 1 }: { items: RankItem[]; start?: number }) {
  return (
    <ol className="rank-list">
      {items.map((it, i) => {
        const body = (
          <>
            <div className="rank-num">
              <span>{start + i}</span>
              <MoveBadge move={it.move} />
            </div>
            <Artwork name={it.title} src={it.image} lookup={it.lookup} round={it.round} />
            <div style={{ minWidth: 0 }}>
              <div className="rank-title">{it.title}</div>
              {it.subtitle && <div className="rank-sub">{it.subtitle}</div>}
            </div>
            <Metric count={it.count} ms={it.ms} />
          </>
        );
        const style = { animationDelay: `${Math.min(i, 20) * 18}ms` };
        return (
          <li key={it.key}>
            {it.to ? (
              <Link to={it.to} className="rank-row" style={style}>
                {body}
              </Link>
            ) : (
              <div className="rank-row" style={style}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The #1 item, given the full-bleed treatment. */
export function Champion({ item, label }: { item: RankItem; label: string }) {
  const content = (
    <>
      <span className="champion-num" aria-hidden>
        1
      </span>
      <Artwork name={item.title} src={item.image} lookup={item.lookup} round={item.round} />
      <div className="champion-body">
        <span className="eyebrow">{label}</span>
        <div className="champion-title">{item.title}</div>
        {item.subtitle && <div className="champion-sub">{item.subtitle}</div>}
        {(item.count !== undefined || item.ms !== undefined) && (
          <div className="champion-metrics tnum">
            {item.count !== undefined && (
              <span>
                <b>{num(item.count)}</b> streams
              </span>
            )}
            {item.ms !== undefined && (
              <span>
                <b>{duration(item.ms)}</b> listened
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
  return item.to ? (
    <Link to={item.to} className="champion">
      {content}
    </Link>
  ) : (
    <div className="champion">{content}</div>
  );
}

export function Tiles({ items, start = 1 }: { items: RankItem[]; start?: number }) {
  return (
    <div className="tiles">
      {items.map((it, i) => (
        <TileCard key={it.key} item={it} rank={start + i} delay={i} />
      ))}
    </div>
  );
}

export function TileCard({ item, rank, delay = 0 }: { item: RankItem; rank?: number; delay?: number }) {
  const inner = (
    <>
      <Artwork name={item.title} src={item.image} lookup={item.lookup} round={item.round} />
      <div style={{ minWidth: 0 }}>
        <div className="tile-title">
          {rank !== undefined && <span className="tile-rank">{rank}</span>}
          {item.title}
        </div>
        <div className="tile-sub">
          {item.count !== undefined ? `${num(item.count)} streams` : item.subtitle}
        </div>
      </div>
    </>
  );
  const style = { animationDelay: `${Math.min(delay, 20) * 22}ms` };
  return item.to ? (
    <Link to={item.to} className="tile" style={style}>
      {inner}
    </Link>
  ) : (
    <div className="tile" style={style}>
      {inner}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ({ value: T; label: string } | "sep")[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o, i) =>
        o === "sep" ? (
          <span key={`sep${i}`} className="segmented-sep" />
        ) : (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ),
      )}
    </div>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1 className="page-title">{title}</h1>
      {children}
    </header>
  );
}

export function SectionHead({ title, link }: { title: string; link?: { to: string; label: string } }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      {link && <Link to={link.to}>{link.label} →</Link>}
    </div>
  );
}

export function ErrorNotice({ error }: { error: Error | string }) {
  return (
    <div className="notice error" role="alert">
      <IconAlert />
      <div className="notice-body">{typeof error === "string" ? error : error.message}</div>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 56, opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function BackButton() {
  const nav = useNavigate();
  return (
    <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/"))}>
      <IconBack width={16} height={16} /> Back
    </button>
  );
}

export function Stat({ label, value, unit, note, hero }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; hero?: boolean }) {
  return (
    <div className={`stat ${hero ? "hero" : ""}`}>
      <span className="eyebrow">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
