import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getClientId, handleCallback, isLoggedIn, logout as authLogout } from "./auth";
import { allPlays, getKV } from "./db";
import { demoApi, demoWorld } from "./demo";
import { clearApiCache, spotify, SpotifyError, type SpotifyClient } from "./spotify";
import { dedupe } from "./stats";
import { syncRecent } from "./sync";
import type { Play } from "./types";

export type Mode = "loading" | "onboarding" | "live" | "demo";

export interface SyncState {
  at?: number;
  added?: number;
  gap?: boolean;
  error?: string;
  running: boolean;
}

interface Store {
  mode: Mode;
  api: SpotifyClient;
  /** Every saved play (imported + synced), deduped, oldest first. */
  plays: Play[];
  playsLoaded: boolean;
  minMs: number;
  setMinMs: (ms: number) => void;
  sync: SyncState;
  syncNow: () => Promise<void>;
  reloadPlays: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => void;
  logout: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

const Ctx = createContext<Store | null>(null);

const DEMO_FLAG = "spins.demo";
const MIN_MS = "spins.minMs";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [plays, setPlays] = useState<Play[]>([]);
  const [playsLoaded, setPlaysLoaded] = useState(false);
  const [minMs, setMinMsState] = useState(() => Number(localStorage.getItem(MIN_MS) ?? 30_000));
  const [sync, setSync] = useState<SyncState>({ running: false });
  const [authError, setAuthError] = useState<string | null>(null);
  const syncing = useRef(false);

  const api = mode === "demo" ? (demoApi as SpotifyClient) : spotify;

  const reloadPlays = useCallback(async () => {
    if (localStorage.getItem(DEMO_FLAG) === "1") {
      setPlays(demoWorld().plays);
    } else {
      setPlays(dedupe(await allPlays()));
    }
    setPlaysLoaded(true);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current || localStorage.getItem(DEMO_FLAG) === "1" || !isLoggedIn()) return;
    syncing.current = true;
    setSync((s) => ({ ...s, running: true, error: undefined }));
    try {
      const r = await syncRecent();
      setSync({ ...r, running: false });
      if (r.added > 0) await reloadPlays();
    } catch (e) {
      const err = e as SpotifyError;
      setSync((s) => ({ ...s, running: false, error: err.message }));
      if (err.kind === "auth") setMode("onboarding");
    } finally {
      syncing.current = false;
    }
  }, [reloadPlays]);

  // Boot: finish an OAuth redirect if there is one, then pick a mode.
  useEffect(() => {
    (async () => {
      const err = await handleCallback().catch((e: Error) => e.message);
      if (err) setAuthError(err);
      if (localStorage.getItem(DEMO_FLAG) === "1") setMode("demo");
      else if (isLoggedIn() && getClientId()) setMode("live");
      else setMode("onboarding");
      const last = await getKV<number>("sync.lastRun");
      if (last) setSync((s) => ({ ...s, at: last }));
      await reloadPlays();
    })();
  }, [reloadPlays]);

  // Keep saving recent plays while the app is open or comes back to the foreground.
  useEffect(() => {
    if (mode !== "live") return;
    syncNow();
    const id = window.setInterval(syncNow, 10 * 60_000);
    const onVis = () => document.visibilityState === "visible" && syncNow();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode, syncNow]);

  const value = useMemo<Store>(
    () => ({
      mode,
      api,
      plays,
      playsLoaded,
      minMs,
      setMinMs: (ms) => {
        localStorage.setItem(MIN_MS, String(ms));
        setMinMsState(ms);
      },
      sync,
      syncNow,
      reloadPlays,
      enterDemo: () => {
        localStorage.setItem(DEMO_FLAG, "1");
        clearApiCache();
        setMode("demo");
        reloadPlays();
      },
      exitDemo: () => {
        localStorage.removeItem(DEMO_FLAG);
        clearApiCache();
        setMode(isLoggedIn() && getClientId() ? "live" : "onboarding");
        reloadPlays();
      },
      logout: () => {
        authLogout();
        clearApiCache();
        setMode("onboarding");
      },
      authError,
      clearAuthError: () => setAuthError(null),
    }),
    [mode, api, plays, playsLoaded, minMs, sync, syncNow, reloadPlays, authError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Run an async loader against the current API; re-runs when deps change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: Error; loading: boolean } {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true }));
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (error: Error) => alive && setState({ error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
