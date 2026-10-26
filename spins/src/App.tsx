import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useStore } from "./lib/store";
import { ArtistPage, TrackPage } from "./pages/Detail";
import { GenresPage } from "./pages/Genres";
import { ImportPage } from "./pages/Import";
import { InsightsPage } from "./pages/Insights";
import { Onboarding } from "./pages/Onboarding";
import { OverviewPage } from "./pages/Overview";
import { RecentPage } from "./pages/Recent";
import { SettingsPage } from "./pages/Settings";
import { TopAlbumsPage } from "./pages/TopAlbums";
import { TopArtistsPage } from "./pages/TopArtists";
import { TopTracksPage } from "./pages/TopTracks";

export function App() {
  const { mode } = useStore();
  if (mode === "loading") return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><span className="spinner" /></div>;
  if (mode === "onboarding") return <Onboarding />;
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/tracks" element={<TopTracksPage />} />
          <Route path="/artists" element={<TopArtistsPage />} />
          <Route path="/albums" element={<TopAlbumsPage />} />
          <Route path="/genres" element={<GenresPage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/artist/:name" element={<ArtistPage />} />
          <Route path="/track/:artist/:track" element={<TrackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
