# Spins

An ad-free, private take on stats.fm: your Spotify top tracks, artists, albums and genres, a full listening log, and lifetime insights built from your Spotify data export.

There's no server. Your browser talks straight to Spotify with your own developer key, and everything Spins saves stays in this browser's storage (IndexedDB). No ads, no analytics, no accounts.

## What it does

| | Source |
|---|---|
| **Top tracks / artists / albums** for 4 weeks, 6 months, 12 months | Spotify Web API (live) |
| **Top genres** (weighted from your top 50 artists' tags) | Spotify Web API (live) |
| **Now playing** + **recently played** | Spotify Web API (live) |
| **Lifetime / per-year top lists with stream counts, minutes and rank movement (▲▼ NEW)** | Your imported history |
| **Insights**: hours per month, time of day, day of week, a weekday × hour heatmap, a daily calendar, streaks, biggest day, skip rate, devices, countries, your #1 artist per year | Your imported history + plays Spins saved |
| **Artist and track pages**: streams, first listen, timeline, top songs, current Spotify ranks | Both |

Spotify only lets apps see your **last 50 plays**. Spins saves them every time it opens (and every 10 minutes while open), so your log keeps growing as long as you open it about once a day. For everything before you started using Spins, import your data export (below).

## Setup (about 3 minutes)

1. **Run it** (or deploy it, see below):
   ```bash
   cd spins
   npm install
   npm run dev        # → http://127.0.0.1:5173
   ```
2. **Create a Spotify app** at <https://developer.spotify.com/dashboard> → *Create app*.
   - Redirect URI: the address Spins shows you on its first screen, e.g. `http://127.0.0.1:5173/` locally or `https://your-site.example/` when deployed. It has to match exactly, trailing slash included. Spotify no longer accepts `localhost`, so use `127.0.0.1`.
   - APIs used: tick **Web API**.
3. Copy the app's **Client ID** into Spins and press **Connect Spotify**. No client secret is needed (Spins uses PKCE).

Spotify's rules for apps in Development Mode: the app owner needs **Spotify Premium**, and only accounts you add under **User Management** (up to 5) can log in. That's plenty for personal use. To share with friends, add their Spotify emails there.

You can also bake the Client ID into a build so nobody has to paste it: copy `.env.example` to `.env.local` and set `VITE_SPOTIFY_CLIENT_ID`.

Want to look around first? Press **Explore the demo** on the first screen. It loads three years of made-up listening.

## Importing your full history

1. Go to <https://www.spotify.com/account/privacy/>, tick **Extended streaming history** and request it. (The basic "Account data" export only covers the last year. Both formats work.)
2. Confirm the email. The export usually arrives within a few days (Spotify says up to 30).
3. In Spins → **Import history**, drop the `my_spotify_data.zip`. No need to unzip.

Re-importing is safe: plays are deduplicated, including against the ones Spins already saved live. Podcasts and audiobooks are skipped. Artwork for imported tracks is looked up one item at a time and cached forever, so it costs very little of Spotify's API quota.

**Settings → Export backup** downloads everything as JSON. It re-imports the same way, which is how you move to another browser or device.

## Deploying

It's a static site (`npm run build` → `dist/`), so any static host works. Remember to add the deployed URL as a Redirect URI in your Spotify app.

- **Vercel / Netlify / Cloudflare Pages**: set the root directory to `spins`, build command `npm run build`, output `dist`.
- **GitHub Pages**: run the *Deploy Spins to GitHub Pages* workflow from the Actions tab (it builds with the right sub-path). Enable Pages → *GitHub Actions* as the source first. Pages on a private repo needs a paid GitHub plan.

Once deployed, open it on your phone and use *Add to Home Screen*. It installs like an app and opens offline with your saved stats.

## Development

```bash
npm run dev         # dev server
npm test            # unit tests (importer, stats engine, storage)
npm run typecheck
npm run build
```

```
src/
  lib/
    auth.ts       PKCE login, token refresh
    spotify.ts    Web API client (retries, 429/quota handling, small cache)
    importer.ts   Spotify export parser (.zip / extended / basic / Spins backup)
    stats.ts      pure aggregation: rankings, buckets, streaks, dedupe
    db.ts         IndexedDB storage
    sync.ts       saves recently-played on every open
    enrich.ts     lazy, cached artwork lookup for imported plays
    demo.ts       deterministic fake history for demo mode
    store.tsx     app state (mode, plays, sync)
  pages/          Overview, Top lists, Genres, Recent, Insights, Detail, Import, Settings, Onboarding
  components/     Layout, charts, artwork (with generated sleeves), list UI
```

Spotify API notes (as of Oct 2026): Development Mode apps can't call the batch endpoints (`/tracks?ids=`, `/artists?ids=`), artist top tracks, or read `popularity`/`followers`. Spins only uses single-item lookups, top items, recently played, currently playing and search (limit 1).

Spins isn't affiliated with Spotify.
