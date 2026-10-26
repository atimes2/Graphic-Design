// Spotify Authorization Code + PKCE, entirely in the browser. No server, no secret.
// Tokens live in localStorage on this device only.

const SCOPES = ["user-read-private", "user-top-read", "user-read-recently-played", "user-read-currently-playing"];

const K = {
  clientId: "spins.clientId",
  verifier: "spins.pkceVerifier",
  state: "spins.pkceState",
  token: "spins.token",
};

interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
}

export function getClientId(): string {
  return (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() || localStorage.getItem(K.clientId) || "";
}

export function setClientId(id: string) {
  localStorage.setItem(K.clientId, id.trim());
}

export function clientIdFromEnv(): boolean {
  return Boolean((import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim());
}

/** The exact URI that must be registered in the Spotify dashboard. */
export function redirectUri(): string {
  const { origin } = window.location;
  // Spotify no longer accepts "localhost"; loopback must be 127.0.0.1.
  const fixedOrigin = origin.replace("//localhost", "//127.0.0.1");
  return fixedOrigin + import.meta.env.BASE_URL;
}

function randomString(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function beginLogin() {
  const clientId = getClientId();
  if (!clientId) throw new Error("Add your Spotify Client ID first.");
  // Spotify rejects "localhost" redirects, so hop to 127.0.0.1 before starting:
  // the verifier must be stored on the same origin the callback lands on.
  if (window.location.hostname === "localhost") {
    window.location.replace(window.location.href.replace("//localhost", "//127.0.0.1"));
    return;
  }
  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem(K.verifier, verifier);
  sessionStorage.setItem(K.state, state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: await challengeFor(verifier),
    scope: SCOPES.join(" "),
    state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

function saveToken(json: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }, prevRefresh?: string) {
  const t: StoredToken = {
    access_token: json.access_token,
    // Spotify may or may not rotate the refresh token; keep the old one if not.
    refresh_token: json.refresh_token ?? prevRefresh,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
    scope: json.scope,
  };
  localStorage.setItem(K.token, JSON.stringify(t));
  return t;
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(K.token);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

/**
 * If the page was loaded as the OAuth callback, exchange the code for tokens and
 * clean the URL. Returns an error message when the callback failed.
 */
export async function handleCallback(): Promise<string | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (!code && !error) return null;

  const state = url.searchParams.get("state");
  const clean = () => window.history.replaceState({}, "", url.pathname + url.hash);

  if (error) {
    clean();
    return error === "access_denied" ? "You cancelled the Spotify login." : `Spotify said: ${error}`;
  }
  const expected = sessionStorage.getItem(K.state);
  const verifier = sessionStorage.getItem(K.verifier);
  sessionStorage.removeItem(K.state);
  sessionStorage.removeItem(K.verifier);
  clean();
  if (!verifier || !state || state !== expected) return "Login expired or came from another tab — please try again.";

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return `Couldn't finish login (${body.error_description || body.error || res.status}).`;
  }
  saveToken(await res.json());
  return null;
}

let refreshing: Promise<StoredToken | null> | null = null;

async function refresh(t: StoredToken): Promise<StoredToken | null> {
  if (!t.refresh_token) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
    }),
  });
  if (!res.ok) {
    // Refresh tokens expire (Spotify caps their lifetime); force a fresh login.
    localStorage.removeItem(K.token);
    return null;
  }
  return saveToken(await res.json(), t.refresh_token);
}

/** A valid access token, refreshing if needed; null when logged out. */
export async function accessToken(force = false): Promise<string | null> {
  const t = readToken();
  if (!t) return null;
  if (!force && t.expires_at > Date.now()) return t.access_token;
  refreshing ??= refresh(t).finally(() => (refreshing = null));
  const next = await refreshing;
  return next?.access_token ?? null;
}

export function isLoggedIn(): boolean {
  return readToken() !== null;
}

export function logout() {
  localStorage.removeItem(K.token);
}
