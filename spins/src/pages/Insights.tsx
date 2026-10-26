import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Artwork } from "../components/Artwork";
import { BarChart, CalendarHeat, HBarList, WeekHourHeat } from "../components/Charts";
import { PageHead, SectionHead, Segmented, Stat, artistPath, trackPath } from "../components/ui";
import type { EnrichRequest } from "../lib/enrich";
import { WEEKDAYS, date, duration, hourLabel, hoursValue, minutes, monthYear, num } from "../lib/format";
import { localRangeFor, rangeLabel, useLocalPlays, useRange, useRangeOptions, useYears } from "../lib/ranges";
import { breakdown, byDay, byHour, byMonth, byWeekday, filterPlays, longestStreak, summarize, topArtists, topTracks, weekHourGrid } from "../lib/stats";
import { useStore } from "../lib/store";
import { NoHistory } from "./TopTracks";

export function InsightsPage() {
  const [range, setRange] = useRange("all");
  const options = useRangeOptions(false);
  const extra = [
    { value: "4w", label: "4 weeks" },
    { value: "6m", label: "6 months" },
    { value: "12m", label: "12 months" },
  ];
  const { playsLoaded } = useStore();
  const { current } = useLocalPlays(range);

  return (
    <>
      <PageHead eyebrow="Insights" title="How you listen" />
      <div className="controls">
        <Segmented label="Time range" options={[...extra, "sep", ...options]} value={range} onChange={setRange} />
      </div>
      {playsLoaded && current.length === 0 ? <NoHistory what="deep stats" /> : <InsightsBody range={range} />}
    </>
  );
}

function InsightsBody({ range }: { range: string }) {
  const { plays, minMs } = useStore();
  const { current } = useLocalPlays(range);
  const years = useYears();
  const r = localRangeFor(range);

  const s = useMemo(() => {
    const summary = summarize(current);
    const days = byDay(current);
    const months = byMonth(current);
    const hours = byHour(current);
    const weekdays = byWeekday(current);
    const grid = weekHourGrid(current);
    const streak = longestStreak(days.keys());
    let bestDay = { key: "", count: 0 };
    for (const [key, count] of days) if (count > bestDay.count) bestDay = { key, count };
    const tracks = topTracks(current);
    const artists = topArtists(current);
    return {
      summary,
      days,
      months,
      hours,
      weekdays,
      grid,
      streak,
      bestDay,
      platforms: breakdown(current, "platform"),
      countries: breakdown(current, "country"),
      tracks,
      artists,
    };
  }, [current]);

  // Number one per year, for the lifetime view.
  const perYear = useMemo(() => {
    if (range !== "all") return [];
    return years.map((y) => {
      const yp = filterPlays(plays, localRangeFor(String(y)), minMs);
      return { year: y, artist: topArtists(yp)[0], track: topTracks(yp)[0], ms: yp.reduce((a, p) => a + p.ms, 0) };
    });
  }, [range, years, plays, minMs]);

  const isYear = /^\d{4}$/.test(range);
  const [calYear, setCalYear] = useState<number>(() => (isYear ? Number(range) : years[0] ?? new Date().getFullYear()));
  const shownCalYear = isYear ? Number(range) : calYear;
  const calDays = useMemo(
    () => (isYear ? s.days : byDay(filterPlays(plays, localRangeFor(String(shownCalYear)), minMs))),
    [isYear, s.days, plays, shownCalYear, minMs],
  );

  const sum = s.summary;
  const spanDays = Math.max(1, Math.round(((r.to ?? sum.last ?? Date.now()) - (r.from ?? sum.first ?? Date.now())) / 86_400_000));
  const peakHour = s.hours.indexOf(Math.max(...s.hours));
  const peakDay = s.weekdays.indexOf(Math.max(...s.weekdays));
  const skipRate = sum.skipKnown ? sum.skips / sum.skipKnown : null;
  const useDaily = s.months.length <= 2;

  const timeline = useDaily
    ? (() => {
        const out: { label: string; value: number; tip: string }[] = [];
        const start = new Date(r.from ?? sum.first ?? Date.now());
        start.setHours(0, 0, 0, 0);
        const end = Math.min(r.to ?? Date.now(), Date.now());
        for (const d = new Date(start); d.getTime() < end; d.setDate(d.getDate() + 1)) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const v = s.days.get(key) ?? 0;
          out.push({ label: String(d.getDate()), value: v, tip: `${num(v)} streams · ${date(d.getTime())}` });
        }
        return out;
      })()
    : s.months.map((m) => ({
        label: new Date(m.start).toLocaleDateString(undefined, { month: "narrow" }),
        value: minutes(m.ms) / 60,
        tip: `${duration(m.ms)} · ${num(m.count)} streams · ${monthYear(m.start)}`,
      }));

  return (
    <>
      <div className="grid cols-4" style={{ marginTop: 18 }}>
        <Stat hero label="Time listened" {...hoursValue(sum.ms)} note={`${num(minutes(sum.ms))} minutes`} />
        <Stat label="Streams" value={num(sum.streams)} note={`${num(sum.streams / spanDays)} a day on average`} />
        <Stat label="Tracks" value={num(sum.tracks)} note={`by ${num(sum.artists)} artists`} />
        <Stat label="Longest streak" value={num(s.streak.days)} unit="days" note={s.streak.start ? `${s.streak.start} → ${s.streak.end}` : undefined} />
        <Stat label="Biggest day" value={num(s.bestDay.count)} unit="streams" note={s.bestDay.key ? date(new Date(s.bestDay.key + "T12:00").getTime()) : undefined} />
        <Stat label="Peak hour" value={hourLabel(peakHour)} note={`${WEEKDAYS[peakDay]}s are your busiest day`} />
        <Stat label="Albums" value={num(sum.albums)} note={`on ${num(sum.activeDays)} active days`} />
        <Stat label="Skip rate" value={skipRate === null ? "—" : `${Math.round(skipRate * 100)}%`} note={skipRate === null ? "Needs the extended history export" : `${num(sum.skips)} skipped`} />
      </div>

      <SectionHead title={useDaily ? "Streams per day" : "Hours per month"} />
      <div className="panel">
        <BarChart
          data={timeline}
          ariaLabel={useDaily ? "Streams per day" : "Hours listened per month"}
          format={(v) => (useDaily ? num(v) : `${num(v)}h`)}
          tickEvery={Math.max(1, Math.ceil(timeline.length / 24))}
        />
      </div>

      <div className="grid cols-2">
        <div>
          <SectionHead title="Time of day" />
          <div className="panel">
            <BarChart
              data={s.hours.map((v, h) => ({ label: h % 3 === 0 ? hourLabel(h) : "", value: v, tip: `${num(v)} streams · ${hourLabel(h)}` }))}
              ariaLabel="Streams by hour of day"
              height={160}
            />
          </div>
        </div>
        <div>
          <SectionHead title="Day of week" />
          <div className="panel">
            <BarChart data={s.weekdays.map((v, d) => ({ label: WEEKDAYS[d], value: v, tip: `${num(v)} streams · ${WEEKDAYS[d]}` }))} ariaLabel="Streams by day of week" height={160} />
          </div>
        </div>
      </div>

      <SectionHead title="Your listening week" />
      <div className="panel">
        <WeekHourHeat grid={s.grid} />
      </div>

      <div className="section-head">
        <h2 className="section-title">Every day of {shownCalYear}</h2>
        {!isYear && years.length > 1 && (
          <select className="select" value={calYear} onChange={(e) => setCalYear(Number(e.target.value))} aria-label="Calendar year">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="panel">
        <CalendarHeat year={shownCalYear} days={calDays} />
      </div>

      {perYear.length > 1 && (
        <>
          <SectionHead title="Your number ones, year by year" />
          <div className="stack" style={{ gap: 8 }}>
            {perYear.map((y) => (
              <Link key={y.year} to={`/insights?range=${y.year}`} className="rank-row" style={{ gridTemplateColumns: "80px 52px minmax(0,1fr) auto" }}>
                <span className="mono" style={{ fontSize: 22, fontFamily: "var(--display)", fontWeight: 800 }}>
                  {y.year}
                </span>
                {y.artist ? (
                  <Artwork name={y.artist.artist} round lookup={{ kind: "artist", artist: y.artist.artist, trackId: y.artist.sampleTrackId, track: y.artist.sampleTrack }} />
                ) : (
                  <span />
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="rank-title">{y.artist?.artist ?? "—"}</div>
                  <div className="rank-sub">{y.track ? `Top track: ${y.track.track}` : ""}</div>
                </div>
                <div className="rank-metric">{duration(y.ms)}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="grid cols-2">
        {s.platforms.length > 0 && (
          <div>
            <SectionHead title="Where you listen" />
            <div className="panel">
              <HBarList items={s.platforms.slice(0, 8).map((p) => ({ label: p.label, value: p.count }))} />
            </div>
          </div>
        )}
        {s.countries.length > 0 && (
          <div>
            <SectionHead title="Countries" />
            <div className="panel">
              <HBarList items={s.countries.slice(0, 8).map((p) => ({ label: countryName(p.label), value: p.count }))} />
            </div>
          </div>
        )}
      </div>

      <div className="grid cols-2">
        <div>
          <SectionHead title="Top artists" link={{ to: `/artists?range=${toTopRange(range)}`, label: "All" }} />
          <MiniList
            items={s.artists.slice(0, 5).map((a) => ({
              key: a.key,
              title: a.artist,
              sub: `${num(a.count)} streams · ${duration(a.ms)}`,
              to: artistPath(a.artist),
              round: true,
              lookup: { kind: "artist" as const, artist: a.artist, trackId: a.sampleTrackId, track: a.sampleTrack },
            }))}
          />
        </div>
        <div>
          <SectionHead title="Top tracks" link={{ to: `/tracks?range=${toTopRange(range)}`, label: "All" }} />
          <MiniList
            items={s.tracks.slice(0, 5).map((t) => ({
              key: t.key,
              title: t.track,
              sub: `${t.artist} · ${num(t.count)} streams`,
              to: trackPath(t.artist, t.track),
              lookup: { kind: "track" as const, trackId: t.trackId, track: t.track, artist: t.artist },
            }))}
          />
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 28 }}>
        Showing {rangeLabel(range)}. A play counts as a
        stream once it passes {minMs / 1000}s — change that in Settings.
      </p>
    </>
  );
}

const toTopRange = (r: string) => ({ "4w": "short_term", "6m": "medium_term", "12m": "long_term" })[r] ?? r;

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function MiniList({ items }: { items: { key: string; title: string; sub: string; to: string; round?: boolean; image?: string; lookup?: EnrichRequest }[] }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      {items.map((it, i) => (
        <Link key={it.key} to={it.to} className="rank-row" style={{ gridTemplateColumns: "24px 44px minmax(0,1fr)", animationDelay: `${i * 30}ms` }}>
          <span className="rank-num">{i + 1}</span>
          <Artwork name={it.title} src={it.image} round={it.round} lookup={it.lookup} />
          <div style={{ minWidth: 0 }}>
            <div className="rank-title">{it.title}</div>
            <div className="rank-sub">{it.sub}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
