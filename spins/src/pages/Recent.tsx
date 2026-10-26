import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Artwork } from "../components/Artwork";
import { IconRefresh } from "../components/icons";
import { Empty, ErrorNotice, ListSkeleton, PageHead, artistPath, trackPath } from "../components/ui";
import { pickImage } from "../lib/enrich";
import { ago, clock, date, plural, time } from "../lib/format";
import { dayKey, dedupe } from "../lib/stats";
import { useAsync, useStore } from "../lib/store";
import { recentToPlay } from "../lib/sync";
import type { Play } from "../lib/types";

const PAGE = 150;

export function RecentPage() {
  const { api, plays, sync, syncNow, mode } = useStore();
  const { data, error, loading } = useAsync(() => api.recent(), [api, sync.at]);
  const [shown, setShown] = useState(PAGE);

  // Saved plays (newest first) merged with whatever Spotify reports right now.
  const { log, images } = useMemo(() => {
    const images = new Map<string, string | undefined>();
    const ids = new Set(plays.map((p) => p.id));
    const fresh: Play[] = [];
    for (const it of data ?? []) {
      const p = recentToPlay(it);
      if (it.track.id) images.set(it.track.id, pickImage(it.track.album.images, 64));
      if (!ids.has(p.id)) fresh.push(p);
    }
    // Fresh API plays may already be stored under an imported id; dedupe merges those.
    const log = (fresh.length ? dedupe([...plays, ...fresh]) : plays).slice().sort((a, b) => b.ts - a.ts);
    return { log, images };
  }, [plays, data]);

  const groups = useMemo(() => {
    const out: { day: string; ts: number; plays: Play[] }[] = [];
    for (const p of log.slice(0, shown)) {
      const k = dayKey(p.ts);
      if (out[out.length - 1]?.day !== k) out.push({ day: k, ts: p.ts, plays: [] });
      out[out.length - 1].plays.push(p);
    }
    return out;
  }, [log, shown]);

  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);

  return (
    <>
      <PageHead eyebrow="Recently played" title="The log">
        <div className="controls">
          {mode === "live" && (
            <button className="btn small" onClick={syncNow} disabled={sync.running}>
              <IconRefresh /> {sync.running ? "Syncing…" : "Sync now"}
            </button>
          )}
          {sync.at && mode === "live" && <span className="muted small">Last saved {ago(sync.at)}</span>}
        </div>
      </PageHead>

      {sync.gap && (
        <div className="notice accent" style={{ marginBottom: 16 }}>
          <div className="notice-body">
            <b>Heads up: there may be a gap.</b> Spotify only remembers your last 50 plays, and you've played more than that since Spins last opened. Import
            your data export to fill it in.
          </div>
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      {loading && !log.length && <ListSkeleton />}
      {!loading && !log.length && <Empty title="Nothing played yet">Play something on Spotify and it'll show up here.</Empty>}

      {groups.map((g) => (
        <section key={g.day}>
          <div className="day-head">
            <span>{g.day === today ? "Today" : g.day === yesterday ? "Yesterday" : new Date(g.ts).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</span>
            <span>{plural(g.plays.length, "play")}</span>
          </div>
          {g.plays.map((p) => (
            <div key={p.id} className="log-row">
              <Artwork
                name={p.album ?? p.track}
                src={p.trackId ? images.get(p.trackId) : undefined}
                lookup={{ kind: "track", trackId: p.trackId, track: p.track, artist: p.artist }}
              />
              <div style={{ minWidth: 0 }}>
                <Link to={trackPath(p.artist, p.track)} className="rank-title" style={{ display: "block" }}>
                  {p.track}
                </Link>
                <Link to={artistPath(p.artist)} className="rank-sub" style={{ display: "block" }}>
                  {p.artist}
                </Link>
              </div>
              <div className="rank-metric">
                {time(p.ts)}
                <span className="muted">{p.skipped ? "skipped" : clock(p.ms)}</span>
              </div>
            </div>
          ))}
        </section>
      ))}

      {log.length > shown && (
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          <button className="btn" onClick={() => setShown((s) => s + PAGE)}>
            Older plays
          </button>
          <span className="muted small">showing back to {date(log[shown - 1].ts)}</span>
        </div>
      )}
    </>
  );
}
