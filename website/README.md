# dedgram atlas public preview

A static, self-contained Vercel site. It publishes an overall snapshot, detailed pages for saved records, a profile-level record for `illmisguideyou`, and records excluded after initial collection for usernames that became unavailable, age-restricted, or falsely identified. An unavailable username may represent either a deleted account or a username change; the evidence and timestamps are preserved without claiming which occurred. The public Profiles view emphasizes saved data and keeps future collection candidates behind an explicit disclosure. Partial reel coverage and pending reel-detail analysis are called out on the affected profile pages. No Instagram login, collector process, database, or server function is needed to serve it.

## Deploy on Vercel

Import this repository as a Vercel project and set **Root Directory** to `website`. The included `vercel.json` runs `npm run build` and serves `dist`. No environment variables are required. The deployment opens on the public overview at `/`; the profile directory is at `/profiles/`, and each published record has its own `/profiles/<username>/` page. `/overview/` remains available as a compatibility alias.

The committed `snapshot/` directory is the complete input for the Vercel build. The site serves the original profile, discovery, item, and run JSON files, CSV exports, and HTML collector reports under `/downloads/<profile>/`. It also includes local copies of available profile and reel thumbnails so signed Instagram image URLs do not determine whether the site renders.

## Update the snapshot

From this folder, run:

```powershell
npm run refresh
```

`sync` copies the current catalog and the published collector outputs from the parent repository into `snapshot/`, records account outcomes excluded after initial collection from `data/database/profiles/`, and refreshes thumbnails. `build` generates the static `dist/` site solely from `snapshot/`. Commit the refreshed snapshot to publish a new version. For a local preview, serve `dist` with any static file server, for example `npx serve dist`.

To sync using saved data and images without contacting Instagram, run `npm run sync -- --offline`, then `npm run build`. Offline sync copies locally saved profile avatars and preserves existing reel thumbnails. Profiles with only header details show reel discovery as not started; interrupted grids show their partial URL inventory without claiming a verified final reel count. The current publication lists include all 218 indexed profiles: 189 active records, 7 unavailable accounts with saved metrics retained for historical analysis (`jellyfish.m3mes`, `prxctm0l`, `coopyyz`, `extreme_laugh_07`, `dank.meemz420`, `bollyxedit.7`, and `funny.exe07`), and 22 excluded records. An unavailable account with retained metrics stays in historical engagement totals while further collection and retries are stopped.

The public preview opens with aggregate profile and reel statistics, the currently published profile records, and records excluded after initial collection for unavailable, age-restricted, or falsely identified accounts. The Profiles page initially shows the published records; the remaining indexed candidates can be revealed from the future-candidates disclosure. Adding another profile requires extending the published profile list and checking its saved data before publishing it.

Reel dates use the same parser in the collector and website. Saved metadata or a saved availability observation for the same reel fills a missing date without another request. Manually verified dates take priority, and calendar dates remain at day precision. From the repository root, `node collector/scripts/reconcile-reel-dates.mjs` repairs existing collector records and matching website snapshots using only saved evidence; it does not contact Instagram.

Website values are saved observations, not live counters. Sync fills missing fields from tracked collector history and the previous website snapshot, preserving source and observation time. Reel-grid views are displayed on profile pages and included in engagement totals even before reel-detail collection. Missing values stay unknown; saved zero values stay zero. Explicitly invalidated or corrected metric values are never restored from older snapshots. A reel whose unexposed metrics have been resolved with explicit visibility evidence or user assessment is marked `metrics_unavailable` and is not retried solely for those fields. Source JSON, CSV downloads, reports, and the public pages use the retained observations consistently.

Access restrictions and uncertain extraction are counted separately as review work; readable content alone does not prove that missing metrics are hidden.
