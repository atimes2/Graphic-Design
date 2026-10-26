import { useEffect, useState, type CSSProperties } from "react";
import { enrich, peekEnrich, type EnrichRequest } from "../lib/enrich";
import { useStore } from "../lib/store";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTES = [
  ["#ff5a24", "#1a0a03", "#f3eee4"],
  ["#2f4bff", "#f3eee4", "#0d0c0a"],
  ["#e9d9b6", "#1b1915", "#ff5a24"],
  ["#1d6b52", "#f1e6c8", "#0d0c0a"],
  ["#f3c83c", "#14120f", "#d6452b"],
  ["#b7a6ff", "#14120f", "#f3eee4"],
  ["#d6452b", "#f3eee4", "#14120f"],
  ["#24211c", "#ff5a24", "#c9c1b3"],
  ["#8fd3c7", "#0d0c0a", "#f3eee4"],
  ["#f0a1b5", "#2a0f17", "#f3eee4"],
];

/** A generated "record sleeve" for anything without real artwork. */
export function Sleeve({ name, round }: { name: string; round?: boolean }) {
  const h = hash(name);
  const [bg, fg, accent] = PALETTES[h % PALETTES.length];
  const variant = (h >>> 4) % 4;
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const r = (n: number) => ((h >>> n) % 100) / 100;
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={name}>
      <rect width="100" height="100" fill={bg} />
      {variant === 0 &&
        [0, 1, 2, 3, 4].map((i) => <circle key={i} cx={30 + r(i) * 40} cy={70} r={60 - i * 11} fill="none" stroke={fg} strokeOpacity={0.25 + i * 0.1} strokeWidth="1.2" />)}
      {variant === 1 && (
        <>
          <rect x={-20} y={40 + r(3) * 20} width="140" height="22" fill={accent} transform={`rotate(${-20 + r(5) * 40} 50 50)`} />
          <rect x={-20} y={10 + r(7) * 20} width="140" height="6" fill={fg} opacity=".6" transform={`rotate(${-20 + r(5) * 40} 50 50)`} />
        </>
      )}
      {variant === 2 && (
        <>
          <circle cx={50} cy={50} r={34} fill={accent} />
          <circle cx={50 + (r(2) - 0.5) * 30} cy={50 + (r(6) - 0.5) * 30} r={18} fill={bg} />
        </>
      )}
      {variant === 3 && Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 17} y={100 - (20 + r(i * 3) * 70)} width="12" height="100" fill={i % 2 ? fg : accent} opacity={i % 2 ? 0.5 : 0.9} />)}
      {!round && (
        <text x="8" y="92" fill={fg} fontFamily="Unbounded, sans-serif" fontWeight="800" fontSize="15" letterSpacing="-0.5">
          {initials}
        </text>
      )}
      {round && (
        <text x="50" y="57" textAnchor="middle" fill={fg} fontFamily="Unbounded, sans-serif" fontWeight="800" fontSize="20">
          {initials}
        </text>
      )}
    </svg>
  );
}

interface Props {
  name: string;
  src?: string;
  round?: boolean;
  size?: number | string;
  /** Look the image up (and cache it) when no src is given. */
  lookup?: EnrichRequest;
  className?: string;
  style?: CSSProperties;
}

export function Artwork({ name, src, round, size, lookup, className = "", style }: Props) {
  const { api, mode } = useStore();
  const [found, setFound] = useState<string | undefined>(() => (lookup ? peekEnrich(lookup)?.image : undefined));
  const [broken, setBroken] = useState(false);
  const lookupKey = lookup ? JSON.stringify(lookup) : "";

  useEffect(() => {
    setBroken(false);
    setFound(lookup ? peekEnrich(lookup)?.image : undefined);
    if (src || !lookup || mode !== "live") return;
    let alive = true;
    enrich(api, lookup).then((e) => alive && setFound(e.image));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, lookupKey, mode]);

  const url = !broken ? src ?? found : undefined;
  return (
    <div className={`art ${round ? "round" : ""} ${className}`} style={{ width: size, ...style }}>
      {url ? <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} /> : <Sleeve name={name} round={round} />}
    </div>
  );
}
