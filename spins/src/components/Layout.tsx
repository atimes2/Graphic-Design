import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { pickImage } from "../lib/enrich";
import { ago } from "../lib/format";
import { useStore } from "../lib/store";
import type { NowPlaying as NowPlayingT } from "../lib/types";
import { Artwork } from "./Artwork";
import { BrandMark, IconAlbum, IconArtist, IconChart, IconClock, IconGenre, IconHome, IconSettings, IconTrack, IconUpload } from "./icons";
import { trackPath } from "./ui";

const MAIN = [
  { to: "/", label: "Overview", icon: IconHome, end: true },
  { to: "/tracks", label: "Tracks", icon: IconTrack },
  { to: "/artists", label: "Artists", icon: IconArtist },
  { to: "/albums", label: "Albums", icon: IconAlbum },
  { to: "/genres", label: "Genres", icon: IconGenre },
];
const MORE = [
  { to: "/recent", label: "Recently played", icon: IconClock },
  { to: "/insights", label: "Insights", icon: IconChart },
  { to: "/import", label: "Import history", icon: IconUpload },
  { to: "/settings", label: "Settings", icon: IconSettings },
];
const TABS = [
  { to: "/", label: "Home", icon: IconHome, end: true },
  { to: "/tracks", label: "Tracks", icon: IconTrack },
  { to: "/artists", label: "Artists", icon: IconArtist },
  { to: "/insights", label: "Insights", icon: IconChart },
  { to: "/settings", label: "More", icon: IconSettings },
];

function NowPlaying() {
  const { api, mode } = useStore();
  const [now, setNow] = useState<NowPlayingT | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.nowPlaying().then((n) => alive && setNow(n), () => alive && setNow(null));
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, mode]);

  if (!now?.item) return null;
  const t = now.item;
  return (
    <Link to={trackPath(t.artists[0]?.name ?? "", t.name)} className={`now ${now.is_playing ? "" : "paused"}`} title="Now playing">
      <Artwork name={t.album.name} src={pickImage(t.album.images, 64)} round />
      <div className="now-text">
        <b>{t.name}</b>
        <span>{t.artists.map((a) => a.name).join(", ")}</span>
      </div>
      {now.is_playing && (
        <span className="eq" aria-label="Playing">
          <i />
          <i />
          <i />
        </span>
      )}
    </Link>
  );
}

function SyncLine() {
  const { sync, mode } = useStore();
  if (mode === "demo") return <span className="pill accent">Demo mode</span>;
  if (sync.running) return <span className="row small"><span className="spinner" /> Saving recent plays…</span>;
  if (sync.error) return <span className="small" style={{ color: "var(--bad)" }}>Sync failed</span>;
  if (sync.at) return <span className="small">Synced {ago(sync.at)}</span>;
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { mode, exitDemo } = useStore();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <BrandMark /> Spins
        </Link>
        <nav className="nav" aria-label="Main">
          {MAIN.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon /> {label}
            </NavLink>
          ))}
          <div className="nav-label">Your history</div>
          {MORE.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <SyncLine />
          {mode === "demo" && (
            <button className="btn small ghost" onClick={exitDemo}>
              Leave demo
            </button>
          )}
          <span style={{ color: "var(--faint)" }}>No ads. No tracking. Your data stays on this device.</span>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <Link to="/" className="brand mobile-brand">
            <BrandMark /> Spins
          </Link>
          <div className="spacer" />
          <NowPlaying />
        </div>
        {children}
      </main>

      <nav className="tabbar" aria-label="Tabs">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
