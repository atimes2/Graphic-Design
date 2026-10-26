import { useState } from "react";
import { Link } from "react-router-dom";
import { Artwork } from "../components/Artwork";
import { IconAlbum, IconChart, IconClock, IconGenre, IconUpload } from "../components/icons";
import { PageHead, SectionHead, Segmented } from "../components/ui";
import { clientIdFromEnv, getClientId, redirectUri, setClientId } from "../lib/auth";
import { allPlays, wipeEverything } from "../lib/db";
import { pickImage } from "../lib/enrich";
import { num } from "../lib/format";
import { useAsync, useStore } from "../lib/store";

export function SettingsPage() {
  const { api, mode, logout, enterDemo, exitDemo, minMs, setMinMs, plays, reloadPlays } = useStore();
  const me = useAsync(() => api.me(), [api]);
  const [clientId, setId] = useState(getClientId());
  const [saved, setSaved] = useState(false);

  async function exportData() {
    const data = await allPlays();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spins-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHead eyebrow="Settings" title="More" />

      <nav className="grid cols-4" style={{ marginTop: 22 }} aria-label="More pages">
        {[
          { to: "/albums", label: "Top albums", icon: IconAlbum },
          { to: "/genres", label: "Top genres", icon: IconGenre },
          { to: "/recent", label: "Recently played", icon: IconClock },
          { to: "/insights", label: "Insights", icon: IconChart },
          { to: "/import", label: "Import history", icon: IconUpload },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="panel row" style={{ padding: 16, fontWeight: 700 }}>
            <Icon width={20} height={20} style={{ color: "var(--accent)" }} /> {label}
          </Link>
        ))}
      </nav>

      <SectionHead title="Account" />
      <div className="panel row wrap">
        {me.data && <Artwork name={me.data.display_name ?? "You"} src={pickImage(me.data.images, 64)} round size={48} />}
        <div style={{ minWidth: 0 }}>
          <b>{mode === "demo" ? "Demo mode" : me.data?.display_name ?? "Spotify account"}</b>
          <div className="muted small">{mode === "demo" ? "Exploring with made-up listening data." : "Connected to Spotify"}</div>
        </div>
        <div className="spacer" />
        {mode === "demo" ? (
          <button className="btn primary small" onClick={exitDemo}>
            Leave demo
          </button>
        ) : (
          <>
            <button className="btn small ghost" onClick={enterDemo}>
              Try demo
            </button>
            <button className="btn small" onClick={logout}>
              Log out
            </button>
          </>
        )}
      </div>

      <SectionHead title="What counts as a stream" />
      <div className="panel stack">
        <span className="muted small">Plays shorter than this are ignored in counts and rankings. Spotify's own threshold is 30 seconds.</span>
        <Segmented
          label="Minimum play length"
          options={[
            { value: "0", label: "Any" },
            { value: "10000", label: "10s" },
            { value: "30000", label: "30s" },
            { value: "60000", label: "60s" },
          ]}
          value={String(minMs)}
          onChange={(v) => setMinMs(Number(v))}
        />
      </div>

      <SectionHead title="Spotify app" />
      <div className="panel stack">
        <span className="muted small">
          Spins talks to Spotify through your own free developer app, so there's no middleman server. Redirect URI to register:
        </span>
        <code>{redirectUri()}</code>
        {clientIdFromEnv() ? (
          <span className="muted small">Client ID is set by this build.</span>
        ) : (
          <form
            className="copy-row"
            onSubmit={(e) => {
              e.preventDefault();
              setClientId(clientId);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            <input className="input" value={clientId} onChange={(e) => setId(e.target.value)} placeholder="Client ID" aria-label="Spotify Client ID" spellCheck={false} />
            <button className="btn" type="submit">
              {saved ? "Saved" : "Save"}
            </button>
          </form>
        )}
      </div>

      <SectionHead title="Your data" />
      <div className="panel stack">
        <span className="muted small">
          {num(plays.length)} plays are stored in this browser (IndexedDB). Nothing is sent anywhere except requests to Spotify itself. Export a backup before
          clearing browser data or switching devices.
        </span>
        <div className="row wrap">
          <button className="btn" onClick={exportData} disabled={mode === "demo"}>
            Export backup (.json)
          </button>
          <Link to="/import" className="btn ghost">
            Import
          </Link>
          <div className="spacer" />
          <button
            className="btn danger"
            disabled={mode === "demo"}
            onClick={async () => {
              if (!confirm("Erase every play, cached image and setting Spins stored on this device? This can't be undone.")) return;
              await wipeEverything();
              await reloadPlays();
            }}
          >
            Erase everything
          </button>
        </div>
        <span className="muted small">Backups re-import on the Import page like any Spotify export.</span>
      </div>

      <p className="muted small" style={{ marginTop: 32 }}>
        Spins is not affiliated with Spotify. No ads, no analytics, no accounts.
      </p>
    </>
  );
}
