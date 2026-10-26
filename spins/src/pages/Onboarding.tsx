import { useState } from "react";
import { BrandMark } from "../components/icons";
import { ErrorNotice } from "../components/ui";
import { beginLogin, clientIdFromEnv, getClientId, redirectUri, setClientId } from "../lib/auth";
import { useStore } from "../lib/store";

export function Onboarding() {
  const { enterDemo, authError, clearAuthError } = useStore();
  const [clientId, setId] = useState(getClientId());
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fromEnv = clientIdFromEnv();
  const uri = redirectUri();

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    clearAuthError();
    setErr(null);
    const id = clientId.trim();
    if (!fromEnv) {
      if (!/^[0-9a-f]{32}$/i.test(id)) {
        setErr("That doesn't look like a Client ID — it's a 32-character code from your app's Settings page.");
        return;
      }
      setClientId(id);
    }
    try {
      await beginLogin();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <div className="onboard">
      <section className="onboard-art">
        <div className="brand" style={{ color: "var(--accent-ink)", padding: 0 }}>
          <BrandMark /> Spins
        </div>
        <div className="vinyl" aria-hidden />
        <div className="big">
          Every
          <br />
          play,
          <br />
          counted.
        </div>
        <p>Your Spotify listening stats — top tracks, artists, genres and your whole streaming history. No ads, no tracking, nothing leaves your device.</p>
      </section>

      <section className="onboard-form">
        <div>
          <div className="eyebrow">Connect Spotify</div>
          <h1 className="page-title" style={{ fontSize: "clamp(28px,4vw,40px)" }}>
            One-time setup
          </h1>
        </div>

        {(authError || err) && <ErrorNotice error={(authError || err)!} />}

        {!fromEnv && (
          <ol className="steps">
            <li>
              <span>
                Go to the{" "}
                <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                  Spotify Developer Dashboard
                </a>{" "}
                and press <b>Create app</b>. Any name works (e.g. "My Spins").
              </span>
            </li>
            <li>
              <span>
                Add this exact <b>Redirect URI</b> and tick <b>Web API</b>:
                <span className="copy-row" style={{ marginTop: 8 }}>
                  <input className="input" readOnly value={uri} onFocus={(e) => e.target.select()} aria-label="Redirect URI" />
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      navigator.clipboard?.writeText(uri);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </span>
              </span>
            </li>
            <li>
              <span>
                Save, open the app's <b>Settings</b> and copy its <b>Client ID</b> into the box below. (No secret needed.)
              </span>
            </li>
          </ol>
        )}

        <form onSubmit={connect} className="stack">
          {!fromEnv && <input className="input" value={clientId} onChange={(e) => setId(e.target.value)} placeholder="Paste your Client ID" aria-label="Spotify Client ID" spellCheck={false} autoComplete="off" />}
          <button className="btn primary" type="submit" style={{ height: 50, fontSize: 15 }}>
            Connect Spotify
          </button>
        </form>

        <div className="row wrap" style={{ gap: 8 }}>
          <span className="muted small">Just looking?</span>
          <button className="btn small ghost" onClick={enterDemo}>
            Explore the demo
          </button>
        </div>

        <details className="panel">
          <summary>Why do I need my own Spotify app?</summary>
          <p className="muted small" style={{ marginBottom: 0 }}>
            It's what keeps Spins free of servers, ads and middlemen: your browser talks straight to Spotify with your own key. Spotify requires the app owner
            to have Premium, and lets you add up to 5 people (under <b>User Management</b>) if you want to share it with friends.
          </p>
        </details>
      </section>
    </div>
  );
}
