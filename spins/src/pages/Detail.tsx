import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Artwork } from "../components/Artwork";
import { BarChart } from "../components/Charts";
import { IconExternal } from "../components/icons";
import { BackButton, Empty, SectionHead, Stat, artistPath, trackPath } from "../components/ui";
import { enrich, pickImage } from "../lib/enrich";
import { date, duration, hourLabel, monthYear, num, shortAgo } from "../lib/format";
import { trackKey } from "../lib/importer";
import { byHour, byMonth, filterPlays, summarize, topArtists, topTracks } from "../lib/stats";
import { useAsync, useStore } from "../lib/store";
import { MiniList } from "./Insights";

function useSpotifyUrl(req: Parameters<typeof enrich>[1] | null) {
  const { api, mode } = useStore();
  const [url, setUrl] = useState<string>();
  const key = JSON.stringify(req);
  useEffect(() => {
    if (!req || mode !== "live") return;
    let alive = true;
    enrich(api, req).then((e) => alive && setUrl(e.url));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mode]);
  return url;
}

function MonthlyChart({ plays }: { plays: Parameters<typeof byMonth>[0] }) {
  const months = byMonth(plays);
  if (months.length < 2) return null;
  return (
    <>
      <SectionHead title="Streams over time" />
      <div className="panel">
        <BarChart
          ariaLabel="Streams per month"
          data={months.map((m) => ({ label: new Date(m.start).toLocaleDateString(undefined, { month: "narrow" }), value: m.count, tip: `${num(m.count)} streams · ${monthYear(m.start)}` }))}
          tickEvery={Math.max(1, Math.ceil(months.length / 24))}
        />
      </div>
    </>
  );
}

export function ArtistPage() {
  const { name = "" } = useParams();
  const { plays, minMs, api } = useStore();
  const key = name.toLowerCase();

  const s = useMemo(() => {
    const all = filterPlays(plays, {}, minMs);
    const mine = all.filter((p) => p.artist.toLowerCase() === key);
    const rank = topArtists(all).findIndex((a) => a.key === key);
    return { mine, summary: summarize(mine), tracks: topTracks(mine), rank, hours: byHour(mine), albums: new Set(mine.map((p) => p.album).filter(Boolean)).size };
  }, [plays, minMs, key]);

  const sample = s.tracks.find((t) => t.trackId);
  const lookup = { kind: "artist" as const, artist: name, trackId: sample?.trackId, track: sample?.track };
  const url = useSpotifyUrl(lookup);

  // Live genres + rank from Spotify's own top lists, if the artist is in them.
  const top = useAsync(async () => {
    const [short, medium, long] = await Promise.all([api.topArtists("short_term"), api.topArtists("medium_term"), api.topArtists("long_term")]);
    const find = (l: typeof short) => l.findIndex((a) => a.name.toLowerCase() === key);
    const a = short.find((x) => x.name.toLowerCase() === key) ?? medium.find((x) => x.name.toLowerCase() === key) ?? long.find((x) => x.name.toLowerCase() === key);
    return { artist: a, ranks: [find(short), find(medium), find(long)] };
  }, [api, key]);
  const apiTracks = useAsync(() => api.topTracks("long_term"), [api]);
  const theirTopTracks = (apiTracks.data ?? []).filter((t) => t.artists.some((a) => a.name.toLowerCase() === key));

  const peakHour = s.hours.indexOf(Math.max(...s.hours));
  const ranks = top.data?.ranks ?? [-1, -1, -1];

  return (
    <>
      <BackButton />
      <div className="detail-hero">
        <Artwork name={name} round src={pickImage(top.data?.artist?.images, 300)} lookup={lookup} />
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Artist{s.rank >= 0 ? ` · #${s.rank + 1} all time` : ""}</div>
          <div className="detail-title">{name}</div>
          <div className="chips">
            {top.data?.artist?.genres?.slice(0, 5).map((g) => (
              <span key={g} className="pill" style={{ textTransform: "capitalize" }}>
                {g}
              </span>
            ))}
            {["4 weeks", "6 months", "12 months"].map((l, i) =>
              ranks[i] >= 0 ? (
                <span key={l} className="pill accent">
                  #{ranks[i] + 1} · {l}
                </span>
              ) : null,
            )}
            {url && (
              <a className="pill" href={url} target="_blank" rel="noreferrer">
                Open in Spotify <IconExternal width={12} height={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      {s.summary.streams > 0 ? (
        <>
          <div className="grid cols-4" style={{ marginTop: 26 }}>
            <Stat hero label="Streams" value={num(s.summary.streams)} note={`${duration(s.summary.ms)} listened`} />
            <Stat label="Tracks heard" value={num(s.summary.tracks)} note={`from ${num(s.albums)} albums`} />
            <Stat label="First listen" value={s.summary.first ? monthYear(s.summary.first) : "—"} note={s.summary.first ? date(s.summary.first) : undefined} />
            <Stat label="Last listen" value={s.summary.last ? shortAgo(s.summary.last) : "—"} note={`Usually around ${hourLabel(peakHour)}`} />
          </div>
          <MonthlyChart plays={s.mine} />
          <SectionHead title="Your top tracks by them" />
          <MiniList
            items={s.tracks.slice(0, 15).map((t) => ({
              key: t.key,
              title: t.track,
              sub: `${num(t.count)} streams · ${duration(t.ms)}`,
              to: trackPath(t.artist, t.track),
              lookup: { kind: "track" as const, trackId: t.trackId, track: t.track, artist: t.artist },
            }))}
          />
        </>
      ) : theirTopTracks.length > 0 ? (
        <>
          <SectionHead title="In your top tracks this year" />
          <MiniList
            items={theirTopTracks.map((t) => ({ key: t.id, title: t.name, sub: t.album.name, to: trackPath(t.artists[0].name, t.name), image: pickImage(t.album.images, 64) }))}
          />
        </>
      ) : (
        <div style={{ marginTop: 26 }}>
          <Empty title="No saved plays for this artist">Import your streaming history to see stream counts and a timeline for every artist you've played.</Empty>
        </div>
      )}
    </>
  );
}

export function TrackPage() {
  const { artist = "", track = "" } = useParams();
  const { plays, minMs, api } = useStore();
  const key = trackKey(artist, track);

  const s = useMemo(() => {
    const all = filterPlays(plays, {}, minMs);
    const mine = all.filter((p) => trackKey(p.artist, p.track) === key);
    const everything = plays.filter((p) => trackKey(p.artist, p.track) === key);
    const ranked = topTracks(all);
    const rank = ranked.findIndex((t) => t.key === key);
    const artistRank = topTracks(all.filter((p) => p.artist.toLowerCase() === artist.toLowerCase())).findIndex((t) => t.key === key);
    const skipped = everything.filter((p) => p.skipped).length;
    const skipKnown = everything.filter((p) => p.skipped !== undefined).length;
    let bestDay = { day: "", n: 0 };
    const days = new Map<string, number>();
    for (const p of mine) {
      const d = new Date(p.ts).toDateString();
      const n = (days.get(d) ?? 0) + 1;
      days.set(d, n);
      if (n > bestDay.n) bestDay = { day: d, n };
    }
    return { mine, summary: summarize(mine), rank, artistRank, skipped, skipKnown, bestDay, album: mine.find((p) => p.album)?.album, trackId: mine.find((p) => p.trackId)?.trackId };
  }, [plays, minMs, key, artist]);

  const lookup = { kind: "track" as const, trackId: s.trackId, track, artist };
  const url = useSpotifyUrl(lookup);
  const live = useAsync(async () => {
    const [short, medium, long] = await Promise.all([api.topTracks("short_term"), api.topTracks("medium_term"), api.topTracks("long_term")]);
    const find = (l: typeof short) => l.findIndex((t) => trackKey(t.artists[0]?.name ?? "", t.name) === key);
    const t = [...short, ...medium, ...long].find((x) => trackKey(x.artists[0]?.name ?? "", x.name) === key);
    return { track: t, ranks: [find(short), find(medium), find(long)] };
  }, [api, key]);
  const ranks = live.data?.ranks ?? [-1, -1, -1];
  const t = live.data?.track;

  return (
    <>
      <BackButton />
      <div className="detail-hero">
        <Artwork name={s.album ?? track} src={pickImage(t?.album.images, 300)} lookup={lookup} />
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Track{s.rank >= 0 ? ` · #${s.rank + 1} all time` : ""}</div>
          <div className="detail-title">{track}</div>
          <div className="champion-sub" style={{ marginBottom: 12 }}>
            <Link to={artistPath(artist)} className="link" style={{ color: "var(--ink)" }}>
              {artist}
            </Link>
            {(t?.album.name ?? s.album) && <span className="muted"> · {t?.album.name ?? s.album}</span>}
          </div>
          <div className="chips">
            {["4 weeks", "6 months", "12 months"].map((l, i) =>
              ranks[i] >= 0 ? (
                <span key={l} className="pill accent">
                  #{ranks[i] + 1} · {l}
                </span>
              ) : null,
            )}
            {s.artistRank >= 0 && <span className="pill">#{s.artistRank + 1} of {artist}'s songs for you</span>}
            {url && (
              <a className="pill" href={url} target="_blank" rel="noreferrer">
                Play on Spotify <IconExternal width={12} height={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      {s.summary.streams > 0 ? (
        <>
          <div className="grid cols-4" style={{ marginTop: 26 }}>
            <Stat hero label="Streams" value={num(s.summary.streams)} note={`${duration(s.summary.ms)} listened`} />
            <Stat label="First heard" value={s.summary.first ? monthYear(s.summary.first) : "—"} note={s.summary.first ? date(s.summary.first) : undefined} />
            <Stat label="Most in a day" value={num(s.bestDay.n)} unit="plays" note={s.bestDay.day ? date(Date.parse(s.bestDay.day)) : undefined} />
            <Stat label="Skipped" value={s.skipKnown ? `${Math.round((s.skipped / s.skipKnown) * 100)}%` : "—"} note={s.skipKnown ? `${num(s.skipped)} of ${num(s.skipKnown)} plays` : "Needs the extended export"} />
          </div>
          <MonthlyChart plays={s.mine} />
        </>
      ) : (
        <div style={{ marginTop: 26 }}>
          <Empty title="No saved plays of this track">Once you've played it a few times (or imported your history), its stream count and timeline show up here.</Empty>
        </div>
      )}
    </>
  );
}
