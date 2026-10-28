# deadgram atlas public preview

A static, self-contained Vercel site. It publishes an overall snapshot, detailed pages for saved records, a profile-level record for `illmisguideyou`, and resolved records for deleted, age-restricted, and false-identification outcomes. The public Profiles view emphasizes saved data and keeps future collection candidates behind an explicit disclosure. Partial reel coverage and pending reel-detail analysis are called out on the affected profile pages. No Instagram login, collector process, database, or server function is needed to serve it.

## Deploy on Vercel

Import this repository as a Vercel project and set **Root Directory** to `profile-showcase`. The included `vercel.json` runs `npm run build` and serves `dist`. No environment variables are required. The deployment provides `/` plus a profile page for each published record.

The committed `snapshot/` directory is the complete input for the Vercel build. The site serves the original profile, discovery, item, and run JSON files, CSV exports, and HTML collector reports under `/downloads/<profile>/`. It also includes local copies of available profile and reel thumbnails so signed Instagram image URLs do not determine whether the site renders.

## Update the snapshot

From this folder, run:

```powershell
npm run refresh
```

`sync` copies the current catalog and the published collector outputs from the parent repository into `snapshot/`, records resolved outcomes from `bot-info/database/profiles/`, and refreshes thumbnails. `build` generates the static `dist/` site solely from `snapshot/`. Commit the refreshed snapshot to publish a new version. For a local preview, serve `dist` with any static file server, for example `npx serve dist`.

The public preview includes an Overall tab with aggregate profile and reel statistics, the six full analysis records, `illmisguideyou` as profile-level complete with reel URLs pending individual detail analysis, and the 11 resolved records. The Profiles tab initially shows only those 18 public records; the remaining indexed candidates can be revealed from the future-candidates disclosure. Adding another profile requires extending the published profile list and checking its saved data before publishing it.
