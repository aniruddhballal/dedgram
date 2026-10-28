# deadgram

deadgram is a research toolkit for examining how Instagram profiles and reels are collected, classified, and preserved over time. The project began as a phone-assisted profile catalog and now includes a staged local collector plus a public, static research showcase.

The public project explores a question rather than asserting a conclusion: how much of the visible internet may be shaped by automated or bot-like accounts generating engagement for one another? deadgram records the profiles and reels that make up the current evidence set, one reel at a time.

## Project map

| Folder or file | What it does | Current role |
| --- | --- | --- |
| [`android-app/`](android-app/README.md) | Native Android app and accessibility service used to capture Instagram usernames from the visible profile screen. | Active profile discovery tool |
| [`bot-info/`](bot-info/) | Catalog indexes and the older split JSON data store used by the original dashboard workflow. | Shared catalog and legacy data |
| [`collector-v2/`](collector-v2/README.md) | Playwright-based local collector, local UI, staged runs, reports, retries, and immutable run history. | Current analysis workspace |
| [`profile-showcase/`](profile-showcase/README.md) | Static-site source, committed public snapshot, build scripts, and generated Vercel output. | Current public website |
| [`web-dashboard/`](web-dashboard/README.md) | Earlier React/Vite dashboard and loopback API backed by `bot-info/database/`. | Legacy analysis workflow |
| [`firefox-extension/`](firefox-extension/README.md) | Temporary Firefox DOM adapter that executes jobs from the legacy dashboard. | Legacy collector adapter |
| [`profiles.json`](profiles.json) | Repository copy or working export of the captured profile catalog. | Catalog handoff/reference file |
| [`dedgram.apk`](dedgram.apk) | APK snapshot for transferring or installing the Android collector. | Installation artifact |
| [`vercel.json`](vercel.json) | Root Vercel configuration. It builds `profile-showcase` and serves `profile-showcase/dist`. | Public deployment configuration |

The Android app, Collector v2, legacy dashboard, and public showcase have separate responsibilities. The public website is built from a snapshot; it does not run the collector or access Instagram.

## Current workflow

The recommended workflow is:

1. Capture candidate usernames with the Android app.
2. Copy or merge the phone catalog into the repository catalog when new captures are ready.
3. Run Collector v2 locally to collect profile information, reel URLs, and reel details.
4. Review saved JSON, CSV, HTML reports, progress, failures, and history in the local Collector UI.
5. Refresh the public snapshot and build the Vercel showcase when a new set of records is ready to publish.

The public showcase focuses on collected reel research. Profile post counts remain useful profile-level metadata, but individual post details and post-like totals are not part of the public analysis. Reel likes, comments, and views are collected when Instagram exposes them.

## 1. Capture profiles on Android

Install the app, grant overlay permission, enable the deadgram accessibility service, open an Instagram profile, and tap the capture bubble. The app validates the visible identity, rejects common interface labels, de-duplicates usernames, and saves successful captures to:

```text
Documents/dedgram/profiles.json
```

The service reads the active Instagram accessibility tree only after the user taps the bubble. It stores usernames and timestamps, not screenshots, bios, captions, follower counts, direct messages, or surrounding UI text.

See [`android-app/README.md`](android-app/README.md) for permissions, platform limitations, build commands, and device installation instructions.

## 2. Bring the phone catalog into the repository

There is no automatic phone-to-computer sync. Copy the phone catalog to the computer, then merge its `profiles` entries into the catalog used by the local tools, matching by `normalized_username` so existing records are not duplicated.

The repository catalog and database locations differ between the current and legacy workflows:

- Collector v2 reads the profile index at `bot-info/database/profiles/index.json`.
- The older dashboard imports from `bot-info/dedgram-catalog.json` and stores results under `bot-info/database/`.
- The Android app writes the user-visible phone file at `Documents/dedgram/profiles.json`.

## 3. Use Collector v2 locally

From the collector directory:

```powershell
cd collector-v2
npm install
npx playwright install chromium
npm run ui
```

Open `http://127.0.0.1:5174/`.

Collector v2 provides:

- Profile-level details, including bio, followers, following, country, join information, and the exact visible post count when available.
- Reel URL discovery, which scrolls the profile’s Reels grid and saves a finalized reel count only after the scan reaches a stable end.
- Reel-level detail collection, including dates, captions, hashtags, likes, comments, views, thumbnails, and source evidence when available.
- Individual profile-page reruns for profile details, reel URL discovery, reel details, or the complete profile/reel workflow.
- Filters for profiles missing profile data, missing reel counts, incomplete reel details, and failed or blocked runs.
- Live stage progress, current field/item information, remaining work, errors, and review states.
- Local profile reports, CSV exports, JSON records, and history snapshots.

The main collection order is:

```text
profile details → reel URLs and count → reel details
```

The local UI supports profile-only, reel-grid-only, reel-details-only, reels-only, depth-first, and breadth-first strategies. The post count is collected as a profile header value for ordering and context; post-level detail collection is not part of the current public analysis scope.

### Collector v2 commands

```powershell
cd collector-v2
npm run ui                 # local workspace at http://127.0.0.1:5174/
npm run login              # sign in through a persistent Chromium session
npm run import-firefox    # optionally import Instagram cookies from Firefox
npm run collect            # command-line collection for the default target
npm run status             # inspect one target’s saved state
npm run report             # regenerate its local report
npm test                   # run parser and browser-adapter tests
```

Useful command-line flags include `--username=NAME`, `--headless`, `--profile-only`, `--reel-grid-only`, `--reels-only`, `--skip-profile`, `--refresh`, and `--limit=N`. Credentials in `collector-v2/.auth/` are ignored and must not be committed.

### Collector v2 data model

Each profile directory under `collector-v2/data/<username>/` contains:

| File | Purpose |
| --- | --- |
| `profile.json` | Profile fields, raw profile evidence, exact-count evidence, issues, and timestamps. |
| `discovery.json` | Separate post/reel URL inventories, grid completeness, reel-grid view labels, and scan errors. |
| `items.json` | Saved item details, field sources, missing fields, retry state, and raw page evidence. Current public analysis uses reel items. |
| `run.json` | Current/last stage, status, progress, current URL, errors, and collection scope. |
| `profile.csv` | Flat profile export. |
| `items.csv` | Flat item export with displayed labels and manual-review reasons. |
| `report.html` | Standalone local report for manual review. |
| `history/<timestamp>-<phase>-<id>/` | Immutable before/after snapshots for reruns. |

Reruns merge new information into the current record without deleting older valid values. Before/after history snapshots preserve the state across repeated runs, including failed or blocked reruns. Missing fields remain `null` and are recorded with reasons rather than being converted to zero. Instagram’s abbreviated `K` and `M` labels are preserved; numeric conversions are marked approximate where the source label was abbreviated.

## 4. Public Vercel showcase

The public site is built from [`profile-showcase/snapshot/`](profile-showcase/snapshot/), not directly from a live collector process. It contains a curated public snapshot of profile records, reel records, resolved account outcomes, thumbnails, reports, and aggregate statistics.

Live site: [dedgram.vercel.app](https://dedgram.vercel.app/)

Current routes:

- `/` — public Overview, framed around “How dead is the internet? One reel at a time.”
- `/profiles/` — public profile catalog and future-candidate directory.
- `/profiles/<username>/` — individual published profile record.
- `/overview/` — compatibility alias for the Overview.

The public Overview includes profile performance, profile country and join information, reel counts, analyzed reel counts, total reel likes/comments/views, most-viewed reels, local reel cover images, and resolved deleted/age-restricted/false-identification records. Engagement totals are displayed compactly with hover text containing the full stored value. The public site hides uncollected candidates from its first view.

To refresh and build the showcase after new Collector v2 outputs are ready:

```powershell
cd profile-showcase
npm install
npm run refresh       # sync published data and build dist
npm run build         # build only from the committed snapshot
```

`profile-showcase/snapshot/` is the source committed for publication. `profile-showcase/dist/` is generated output. The root `vercel.json` runs the showcase build for Vercel. No Instagram login, browser session, database connection, or server function is used by the public site.

See [`profile-showcase/README.md`](profile-showcase/README.md) for the publication list, snapshot rules, thumbnail handling, and deployment details.

## Legacy workflow

The older local dashboard remains in `web-dashboard/`. It uses a React/Vite frontend and a loopback API at `http://127.0.0.1:4317`, with the UI at `http://127.0.0.1:5173`.

```powershell
cd web-dashboard
npm install
npm run dev
```

The companion [`firefox-extension/`](firefox-extension/) is loaded temporarily through `about:debugging` and executes only jobs explicitly queued by that dashboard. Its historical workflow includes surface analysis, post counts, reel counts, deep analysis, and separate post/reel detail scans. It is retained for older data and workflows; new collection work should use Collector v2.

## Privacy and operational boundaries

- Android reads Instagram’s visible accessibility tree only after an explicit capture tap.
- Collector v2 reads visible Instagram pages through a local browser session and does not use undocumented Instagram endpoints or bypass login, checkpoints, consent screens, rate limits, or age restrictions.
- The Firefox extension is local-only and acts only on dashboard-queued jobs.
- Browser credentials, authentication profiles, and temporary screenshots are ignored and must not be committed.
- Public Vercel files are static snapshots. They contain only the records intentionally copied into `profile-showcase/snapshot/`.
- Instagram’s UI and labels can change. When identity, counts, or item fields cannot be verified, the collectors preserve the issue instead of guessing.

## Android development

Requirements: JDK 17, Android SDK platform 36, and Build Tools 36.

```powershell
cd android-app
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:assembleRelease
```

Build outputs are written under `android-app/app/build/outputs/apk/`. The local release build uses the generated debug signing key and is intended for device testing. Detailed instructions are in [`android-app/README.md`](android-app/README.md).

## Repository conventions

- Keep source records and generated public snapshots separate.
- Prefer additive history snapshots over destructive overwrites when rerunning a profile.
- Review `run.json`, `discovery.json`, and `items.json` before publishing new records.
- Commit the data and code changes that are intended to become part of the public snapshot; do not commit browser credentials or temporary files.
- Update the folder-specific README when a tool’s behavior changes substantially, then update this root README if the project workflow or ownership changes.
