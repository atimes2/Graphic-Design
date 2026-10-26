import { Link } from "react-router-dom";
import { Artwork } from "../components/Artwork";
import { Empty, ErrorNotice, ListSkeleton, PageHead, Segmented, artistPath } from "../components/ui";
import { pickImage } from "../lib/enrich";
import { API_RANGES, isApiRange, useRange } from "../lib/ranges";
import { useAsync, useStore } from "../lib/store";
import type { SpotifyArtist } from "../lib/types";

export function genresFromArtists(artists: SpotifyArtist[]) {
  const m = new Map<string, { genre: string; score: number; artists: SpotifyArtist[] }>();
  artists.forEach((a, i) => {
    for (const g of a.genres ?? []) {
      const e = m.get(g) ?? { genre: g, score: 0, artists: [] };
      e.score += artists.length - i;
      e.artists.push(a);
      m.set(g, e);
    }
  });
  return [...m.values()].sort((a, b) => b.score - a.score);
}

export function GenresPage() {
  const [rawRange, setRange] = useRange();
  const range = isApiRange(rawRange) ? rawRange : "short_term";
  const { api } = useStore();
  const { data, error, loading } = useAsync(() => api.topArtists(range), [api, range]);

  const genres = data ? genresFromArtists(data) : [];
  const total = genres.reduce((a, g) => a + g.score, 0) || 1;
  const max = genres[0]?.score ?? 1;

  return (
    <>
      <PageHead eyebrow="Top genres" title="Your sound" />
      <div className="controls">
        <Segmented label="Time range" options={API_RANGES.map(({ value, label }) => ({ value, label }))} value={range} onChange={setRange} />
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Worked out from the genres Spotify tags on your top 50 artists, weighted by rank.
      </p>
      {error && <ErrorNotice error={error} />}
      {loading && !data && <ListSkeleton />}
      {data && genres.length === 0 && (
        <Empty title="No genre tags">Spotify didn't return genre tags for your top artists in this period. That happens for newer or niche artists.</Empty>
      )}
      <ol className="rank-list" style={{ gap: 6 }}>
        {genres.slice(0, 40).map((g, i) => (
          <li key={g.genre} className="rank-row" style={{ gridTemplateColumns: "44px minmax(0,1fr) auto", animationDelay: `${Math.min(i, 20) * 18}ms` }}>
            <div className="rank-num">{i + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div className="rank-title" style={{ textTransform: "capitalize", fontSize: i < 3 ? 20 : 15, fontFamily: i < 3 ? "var(--display)" : undefined }}>
                {g.genre}
              </div>
              <div className="hbar-track" style={{ margin: "8px 0", maxWidth: 520 }}>
                <div className="hbar-fill" style={{ width: `${(g.score / max) * 100}%` }} />
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {g.artists.slice(0, 6).map((a) => (
                  <Link key={a.id} to={artistPath(a.name)} className="pill" title={a.name}>
                    <Artwork name={a.name} src={pickImage(a.images, 64)} round size={18} />
                    {a.name}
                  </Link>
                ))}
                {g.artists.length > 6 && <span className="pill">+{g.artists.length - 6}</span>}
              </div>
            </div>
            <div className="rank-metric">{Math.round((g.score / total) * 100)}%</div>
          </li>
        ))}
      </ol>
    </>
  );
}
