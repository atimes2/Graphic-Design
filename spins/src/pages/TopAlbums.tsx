import { useMemo } from "react";
import { Empty, ErrorNotice, ListSkeleton, PageHead, Segmented, artistPath, type RankItem } from "../components/ui";
import { pickImage } from "../lib/enrich";
import { isApiRange, rangeLabel, useLocalPlays, useRange, useRangeOptions } from "../lib/ranges";
import { indexByKey, movement, topAlbums } from "../lib/stats";
import { useAsync, useStore } from "../lib/store";
import type { ApiRange, SpotifyTrack } from "../lib/types";
import { NoHistory, Ranked } from "./TopTracks";

export function TopAlbumsPage() {
  const [range, setRange] = useRange();
  const options = useRangeOptions();
  return (
    <>
      <PageHead eyebrow="Top albums" title="Front to back" />
      <div className="controls">
        <Segmented label="Time range" options={options} value={range} onChange={setRange} />
      </div>
      {isApiRange(range) ? <ApiAlbums range={range} /> : <LocalAlbums range={range} />}
    </>
  );
}

/**
 * Spotify has no "top albums" endpoint, so rank albums by how many of your top
 * 50 tracks they hold, weighted by how high those tracks sit.
 */
export function albumsFromTopTracks(tracks: SpotifyTrack[]) {
  const m = new Map<string, { album: SpotifyTrack["album"]; score: number; tracks: number }>();
  tracks.forEach((t, i) => {
    const e = m.get(t.album.id) ?? { album: t.album, score: 0, tracks: 0 };
    e.score += tracks.length - i;
    e.tracks++;
    m.set(t.album.id, e);
  });
  return [...m.values()].sort((a, b) => b.score - a.score);
}

function ApiAlbums({ range }: { range: ApiRange }) {
  const { api } = useStore();
  const { data, error, loading } = useAsync(() => api.topTracks(range), [api, range]);
  const local = useLocalPlays(range).current;
  const counts = useMemo(() => new Map(topAlbums(local).map((a) => [a.key, a])), [local]);

  if (error) return <ErrorNotice error={error} />;
  if (loading && !data) return <ListSkeleton />;
  if (!data?.length) return <Empty title="Nothing yet">Spotify hasn't ranked anything for this period yet.</Empty>;

  const items: RankItem[] = albumsFromTopTracks(data).map(({ album, tracks }) => {
    const artist = album.artists[0]?.name ?? "";
    const c = counts.get(`${artist.toLowerCase()}\u0000${album.name.toLowerCase()}`);
    return {
      key: album.id,
      title: album.name,
      subtitle: `${album.artists.map((a) => a.name).join(", ")} · ${tracks} of your top ${data.length}`,
      image: pickImage(album.images, 300),
      to: artistPath(artist),
      count: c?.count,
      ms: c?.ms,
    };
  });
  return <Ranked items={items} label={`Your #1 album · ${rangeLabel(range)}`} />;
}

function LocalAlbums({ range }: { range: string }) {
  const { current, previous } = useLocalPlays(range);
  const { playsLoaded } = useStore();
  const items = useMemo(() => {
    const prevIdx = previous?.length ? indexByKey(topAlbums(previous)) : null;
    return topAlbums(current).map<RankItem>((a, i) => ({
      key: a.key,
      title: a.album,
      subtitle: `${a.artist} · ${a.tracks} ${a.tracks === 1 ? "track" : "tracks"}`,
      lookup: { kind: "album", trackId: a.sampleTrackId, track: a.sampleTrack, artist: a.artist, album: a.album },
      to: artistPath(a.artist),
      count: a.count,
      ms: a.ms,
      move: movement(a.key, i, prevIdx),
    }));
  }, [current, previous]);
  if (!playsLoaded) return <ListSkeleton />;
  if (!items.length) return <NoHistory what="albums" />;
  return <Ranked items={items} label={`Your #1 album · ${rangeLabel(range)}`} />;
}
