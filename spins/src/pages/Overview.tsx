import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Artwork } from "../components/Artwork";
import { BarChart } from "../components/Charts";
import { IconUpload } from "../components/icons";
import { ErrorNotice, ListSkeleton, SectionHead, Stat, TileCard, artistPath, trackPath } from "../components/ui";
import { pickImage } from "../lib/enrich";
import { ago, duration, hoursValue, monthYear, num } from "../lib/format";
import { trackKey } from "../lib/importer";
import { byMonth, filterPlays, presetRange, summarize, topArtists, topTracks } from "../lib/stats";
import { useAsync, useStore } from "../lib/store";
import { MiniList } from "./Insights";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function OverviewPage() {
  const { api, plays, minMs, playsLoaded, mode } = useStore();
  const me = useAsync(() => api.me(), [api]);
  const artists = useAsync(() => api.topArtists("short_term"), [api]);
  const tracks = useAsync(() => api.topTracks("short_term"), [api]);
  const recent = useAsync(() => api.recent(), [api]);

  const hasImport = useMemo(() => plays.some((p) => p.source !== "sync"), [plays]);
  const life = useMemo(() => {
    const counted = filterPlays(plays, {}, minMs);
    const year = new Date().getFullYear();
    const thisYear = filterPlays(counted, presetRange(String(year)), 0);
    const month = filterPlays(counted, { from: new Date(year, new Date().getMonth(), 1).getTime() }, 0);
    return {
      all: summarize(counted),
      year,
      thisYear: summarize(thisYear),
      month: summarize(month),
      yearTopArtist: topArtists(thisYear)[0],
      yearTopTrack: topTracks(thisYear)[0],
      months: byMonth(counted).slice(-24),
    };
  }, [plays, minMs]);
  const localCounts = useMemo(() => new Map(topTracks(filterPlays(plays, presetRange("4w"), minMs)).map((t) => [t.key, t.count])), [plays, minMs]);

  const name = me.data?.display_name?.split(" ")[0];

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {me.data && <Artwork name={me.data.display_name ?? "You"} src={pickImage(me.data.images, 64)} round size={64} />}
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1 className="page-title">{name ? `${name}'s spins` : "Your spins"}</h1>
        </div>
      </header>

      {me.error && <div style={{ marginTop: 18 }}><ErrorNotice error={me.error} /></div>}

      {playsLoaded && life.all.streams > 0 && (
        <div className="grid cols-4" style={{ marginTop: 26 }}>
          <Stat hero label="Lifetime listening" {...hoursValue(life.all.ms)} note={life.all.first ? `since ${monthYear(life.all.first)}` : undefined} />
          <Stat label="Lifetime streams" value={num(life.all.streams)} note={`${num(life.all.tracks)} different tracks`} />
          <Stat label={`${life.year} so far`} {...hoursValue(life.thisYear.ms)} note={`${num(life.thisYear.streams)} streams`} />
          <Stat label="This month" {...hoursValue(life.month.ms)} note={`${num(life.month.artists)} artists`} />
        </div>
      )}

      {playsLoaded && !hasImport && mode === "live" && (
        <div className="notice accent" style={{ marginTop: 22 }}>
          <IconUpload />
          <div className="notice-body">
            <b>Unlock lifetime stats.</b> Spotify's live API only shares rankings and your last 50 plays. Import your full streaming history to get stream
            counts, minutes, streaks and year-by-year charts going back to day one.{" "}
            <Link to="/import" className="link">
              Import history
            </Link>
          </div>
        </div>
      )}

      <SectionHead title="Top artists · 4 weeks" link={{ to: "/artists", label: "See all" }} />
      {artists.error && <ErrorNotice error={artists.error} />}
      {artists.loading && !artists.data && <div className="skeleton" style={{ height: 200 }} />}
      {artists.data && (
        <div className="scroller">
          {artists.data.slice(0, 12).map((a, i) => (
            <TileCard key={a.id} rank={i + 1} delay={i} item={{ key: a.id, title: a.name, subtitle: a.genres?.[0], image: pickImage(a.images, 300), round: true, to: artistPath(a.name) }} />
          ))}
        </div>
      )}

      <div className="grid cols-2">
        <div>
          <SectionHead title="Top tracks · 4 weeks" link={{ to: "/tracks", label: "See all" }} />
          {tracks.error && <ErrorNotice error={tracks.error} />}
          {tracks.loading && !tracks.data && <ListSkeleton rows={5} />}
          {tracks.data && (
            <MiniList
              items={tracks.data.slice(0, 6).map((t) => {
                const artist = t.artists[0]?.name ?? "";
                const c = localCounts.get(trackKey(artist, t.name));
                return {
                  key: t.id,
                  title: t.name,
                  sub: c ? `${t.artists.map((a) => a.name).join(", ")} · ${num(c)} streams` : t.artists.map((a) => a.name).join(", "),
                  to: trackPath(artist, t.name),
                  image: pickImage(t.album.images, 64),
                };
              })}
            />
          )}
        </div>
        <div>
          <SectionHead title="Recently played" link={{ to: "/recent", label: "Full log" }} />
          {recent.error && <ErrorNotice error={recent.error} />}
          {recent.loading && !recent.data && <ListSkeleton rows={5} />}
          {recent.data && (
            <div className="stack" style={{ gap: 4 }}>
              {recent.data.slice(0, 6).map((r) => (
                <Link key={r.played_at} to={trackPath(r.track.artists[0]?.name ?? "", r.track.name)} className="rank-row" style={{ gridTemplateColumns: "44px minmax(0,1fr) auto" }}>
                  <Artwork name={r.track.album.name} src={pickImage(r.track.album.images, 64)} />
                  <div style={{ minWidth: 0 }}>
                    <div className="rank-title">{r.track.name}</div>
                    <div className="rank-sub">{r.track.artists.map((a) => a.name).join(", ")}</div>
                  </div>
                  <span className="rank-metric muted">{ago(Date.parse(r.played_at))}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {life.thisYear.streams > 0 && (
        <>
          <SectionHead title={`${life.year}, so far`} link={{ to: `/insights?range=${life.year}`, label: "Full recap" }} />
          <Link to={`/insights?range=${life.year}`} className="recap" style={{ display: "block" }}>
            <div className="row wrap" style={{ alignItems: "flex-end", gap: 28 }}>
              <div className="recap-year">{life.year}</div>
              <div className="stack" style={{ gap: 6, flex: 1, minWidth: 220 }}>
                <span className="eyebrow">Top artist</span>
                <span style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 800, lineHeight: 1.05 }}>{life.yearTopArtist?.artist}</span>
                <span className="eyebrow" style={{ marginTop: 10 }}>
                  Top track
                </span>
                <span style={{ fontWeight: 700, fontSize: 17 }}>
                  {life.yearTopTrack?.track} <span className="muted">· {life.yearTopTrack?.artist}</span>
                </span>
              </div>
              <div className="stack" style={{ gap: 2, textAlign: "right" }}>
                <span className="stat-value">{duration(life.thisYear.ms)}</span>
                <span className="muted small">{num(life.thisYear.streams)} streams</span>
              </div>
            </div>
          </Link>
        </>
      )}

      {life.months.length > 2 && (
        <>
          <SectionHead title="Hours per month" link={{ to: "/insights", label: "Insights" }} />
          <div className="panel">
            <BarChart
              ariaLabel="Hours listened per month"
              data={life.months.map((m) => ({ label: new Date(m.start).toLocaleDateString(undefined, { month: "narrow" }), value: m.ms / 3_600_000, tip: `${duration(m.ms)} · ${monthYear(m.start)}` }))}
              format={(v) => `${num(v)}h`}
            />
          </div>
        </>
      )}
    </>
  );
}
