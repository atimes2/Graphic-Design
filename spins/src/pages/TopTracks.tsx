import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Champion, Empty, ErrorNotice, ListSkeleton, PageHead, RankList, Segmented, trackPath, type RankItem } from "../components/ui";
import { pickImage } from "../lib/enrich";
import { trackKey } from "../lib/importer";
import { isApiRange, rangeLabel, useLocalPlays, useRange, useRangeOptions } from "../lib/ranges";
import { indexByKey, movement, topTracks } from "../lib/stats";
import { useAsync, useStore } from "../lib/store";
import type { ApiRange } from "../lib/types";

export function NoHistory({ what }: { what: string }) {
  return (
    <Empty title="No listening history here yet" action={<Link to="/import" className="btn primary">Import your history</Link>}>
      Spotify only shares rankings for the last 4 weeks, 6 months and 12 months. For {what} with stream counts across all time, import your Spotify data
      export — it takes a minute once you have it.
    </Empty>
  );
}

export function TopTracksPage() {
  const [range, setRange] = useRange();
  const options = useRangeOptions();
  return (
    <>
      <PageHead eyebrow="Top tracks" title="On repeat" />
      <div className="controls">
        <Segmented label="Time range" options={options} value={range} onChange={setRange} />
      </div>
      {isApiRange(range) ? <ApiTracks range={range} /> : <LocalTracks range={range} />}
    </>
  );
}

function ApiTracks({ range }: { range: ApiRange }) {
  const { api } = useStore();
  const { data, error, loading } = useAsync(() => api.topTracks(range), [api, range]);
  const local = useLocalPlays(range).current;
  const counts = useMemo(() => new Map(topTracks(local).map((t) => [t.key, t])), [local]);

  if (error) return <ErrorNotice error={error} />;
  if (loading && !data) return <ListSkeleton />;
  if (!data?.length) return <Empty title="Nothing yet">Spotify hasn't ranked any tracks for this period. Listen a bit more and check back.</Empty>;

  const items: RankItem[] = data.map((t) => {
    const artist = t.artists[0]?.name ?? "";
    const key = trackKey(artist, t.name);
    const c = counts.get(key);
    return {
      key: t.id,
      title: t.name,
      subtitle: t.artists.map((a) => a.name).join(", "),
      image: pickImage(t.album.images, 300),
      to: trackPath(artist, t.name),
      count: c?.count,
      ms: c?.ms,
    };
  });
  return <Ranked items={items} label={`Your #1 track · ${rangeLabel(range)}`} />;
}

function LocalTracks({ range }: { range: string }) {
  const { current, previous } = useLocalPlays(range);
  const { playsLoaded } = useStore();
  const items = useMemo(() => {
    const prevIdx = previous?.length ? indexByKey(topTracks(previous)) : null;
    return topTracks(current).map<RankItem>((t, i) => ({
      key: t.key,
      title: t.track,
      subtitle: t.artist,
      lookup: { kind: "track", trackId: t.trackId, track: t.track, artist: t.artist },
      to: trackPath(t.artist, t.track),
      count: t.count,
      ms: t.ms,
      move: movement(t.key, i, prevIdx),
    }));
  }, [current, previous]);
  if (!playsLoaded) return <ListSkeleton />;
  if (!items.length) return <NoHistory what="tracks" />;
  return <Ranked items={items} label={`Your #1 track · ${rangeLabel(range)}`} />;
}

export function Ranked({ items, label, page = 50 }: { items: RankItem[]; label: string; page?: number }) {
  const [shown, setShown] = useState(page);
  return (
    <>
      <Champion item={items[0]} label={label} />
      <RankList items={items.slice(1, shown)} start={2} />
      {items.length > shown && (
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          <button className="btn" onClick={() => setShown((s) => s + page)}>
            Show more
          </button>
        </div>
      )}
    </>
  );
}
