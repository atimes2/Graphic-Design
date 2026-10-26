import { useMemo, useState } from "react";
import { Champion, Empty, ErrorNotice, ListSkeleton, PageHead, RankList, Segmented, Tiles, artistPath, type RankItem } from "../components/ui";
import { pickImage } from "../lib/enrich";
import { isApiRange, rangeLabel, useLocalPlays, useRange, useRangeOptions } from "../lib/ranges";
import { indexByKey, movement, topArtists } from "../lib/stats";
import { useAsync, useStore } from "../lib/store";
import type { ApiRange } from "../lib/types";
import { NoHistory } from "./TopTracks";

type View = "grid" | "list";

export function TopArtistsPage() {
  const [range, setRange] = useRange();
  const options = useRangeOptions();
  const [view, setView] = useState<View>(() => (localStorage.getItem("spins.artistView") as View) || "grid");
  const changeView = (v: View) => {
    localStorage.setItem("spins.artistView", v);
    setView(v);
  };
  return (
    <>
      <PageHead eyebrow="Top artists" title="Heavy rotation" />
      <div className="controls">
        <Segmented label="Time range" options={options} value={range} onChange={setRange} />
        <div className="spacer" />
        <Segmented<View> label="Layout" options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} value={view} onChange={changeView} />
      </div>
      {isApiRange(range) ? <ApiArtists range={range} view={view} /> : <LocalArtists range={range} view={view} />}
    </>
  );
}

function ApiArtists({ range, view }: { range: ApiRange; view: View }) {
  const { api } = useStore();
  const { data, error, loading } = useAsync(() => api.topArtists(range), [api, range]);
  const local = useLocalPlays(range).current;
  const counts = useMemo(() => new Map(topArtists(local).map((a) => [a.key, a])), [local]);

  if (error) return <ErrorNotice error={error} />;
  if (loading && !data) return <ListSkeleton />;
  if (!data?.length) return <Empty title="Nothing yet">Spotify hasn't ranked any artists for this period yet.</Empty>;

  const items: RankItem[] = data.map((a) => {
    const c = counts.get(a.name.toLowerCase());
    return {
      key: a.id,
      title: a.name,
      subtitle: a.genres?.slice(0, 3).join(" · ") || undefined,
      image: pickImage(a.images, 300),
      round: true,
      to: artistPath(a.name),
      count: c?.count,
      ms: c?.ms,
    };
  });
  return <ArtistsView items={items} view={view} label={`Your #1 artist · ${rangeLabel(range)}`} />;
}

function LocalArtists({ range, view }: { range: string; view: View }) {
  const { current, previous } = useLocalPlays(range);
  const { playsLoaded } = useStore();
  const items = useMemo(() => {
    const prevIdx = previous?.length ? indexByKey(topArtists(previous)) : null;
    return topArtists(current).map<RankItem>((a, i) => ({
      key: a.key,
      title: a.artist,
      subtitle: `${a.tracks} ${a.tracks === 1 ? "track" : "tracks"}`,
      lookup: { kind: "artist", artist: a.artist, trackId: a.sampleTrackId, track: a.sampleTrack },
      round: true,
      to: artistPath(a.artist),
      count: a.count,
      ms: a.ms,
      move: movement(a.key, i, prevIdx),
    }));
  }, [current, previous]);
  if (!playsLoaded) return <ListSkeleton />;
  if (!items.length) return <NoHistory what="artists" />;
  return <ArtistsView items={items} view={view} label={`Your #1 artist · ${rangeLabel(range)}`} />;
}

function ArtistsView({ items, view, label }: { items: RankItem[]; view: View; label: string }) {
  const [shown, setShown] = useState(50);
  return (
    <>
      <Champion item={items[0]} label={label} />
      {view === "grid" ? <Tiles items={items.slice(1, shown)} start={2} /> : <RankList items={items.slice(1, shown)} start={2} />}
      {items.length > shown && (
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          <button className="btn" onClick={() => setShown((s) => s + 50)}>
            Show more
          </button>
        </div>
      )}
    </>
  );
}
