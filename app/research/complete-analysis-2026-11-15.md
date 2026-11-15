# Complete analysis - Android 2.6.0

## Workflow and UI

The third floating control is a native purple checklist/play mark. One tap from a profile header composes the existing profile capture, selects that profile's Reels tab, opens the first grid item, captures each reel with the existing canonical-link/caption/date/metrics pipeline, and advances through Instagram's reel viewer using accessibility paging. Pinned/displayed ordering is preserved. Each icon is draggable and retains its own position. All three controls are hidden briefly for the existing avatar crop; the progress panel is positioned outside that crop.

The progress panel shows the account, unique reels saved and any reel field errors. Tapping it is Stop and disables the existing capture session. The catalogs remain compact; analysis instructions live behind the existing info icon. A profile's collapsed bar shows a verified reel total or a separately labeled captured count. Its expanded details show analysis state, partial/confirmed count, field errors and update time.

## Observed Android controls

Research used the connected OnePlus CPH2467, Android API 35, with capture disabled during UI Automator dumps. The profile tab uses `profile_tab_icon_view` with description Reels. Its grid uses `clips_grid_recyclerview` and `preview_clip_thumbnail` cells. Previously retained grid scroll positions are rewound semantically before opening the first tile.

The viewer exposes `clips_viewer_view_pager` and a full-size RecyclerView. Accessibility collection metadata supplies item count and the active item's row index; matching view-scrolled events provide supplemental position evidence. On reposted, the collection consistently exposed count 11 and positions 0 through 10. Caption/metrics-sheet scroll events are excluded from this evidence.

The first full phone pass captured all 11 canonical reel records with zero field errors but correctly retained an unverified total: Instagram returned true for a forward action at the terminal item even though its next action was not advertised and the item did not change. End handling was corrected to require stable terminal metadata and an unavailable next action, independent of that misleading action return. A regression simulates the same behavior. A failed action before the last position still cannot establish completion.

Stopping in Share can cause Instagram to restore that sheet when the viewer is opened again later. A subsequent phone pass exposed this: the runner refused to treat a covered reel as a normal page and left the count partial. Known Share, caption and metrics panels are now recovered only after matching the expected account and collection context, then the normal viewer is verified before capturing. Share is dismissed through its own exact semantic control; no recipient action is selected. A matching known caption/metrics panel may use the existing guarded Back fallback.

## Count and completion invariants

- A reel is written to the existing reel catalog before its canonical shortcode is accepted into the unique count. Shortcode and URL must agree, owner must match, and a URL extraction error stops traversal. Reel payloads are not accumulated in the controller.
- Per-profile checkpoints keep `captured_count`, unique `captured_shortcodes`, covered `visited_positions`, profile/reel field-error state, phase and timestamps. In-progress reels are not counted.
- Both `complete_analysis.total_reels` and top-level `reels_count` remain null while the scan is unfinished. The confirmed total is not copied from profile posts count or a partially loaded collection count.
- Every collection position from zero through the terminal item must have a saved canonical identity. The account and terminal reel must remain unchanged, there must be no visible loading indicator, and end evidence is checked repeatedly. Missing metadata, gaps, unsupported actions, another owner, ads and access barriers leave the total unverified.
- An explicit empty Reels grid is checked on separate observations before storing zero. Loading placeholders cannot establish zero.
- `scan_complete` means the inventory end was verified. `status: complete` additionally requires successful profile and reel fields. A confirmed inventory can therefore retain its total with `status: partial` if fields failed.
- Stop, foreign-app transitions, screen lock and the existing 30-minute limit cancel pending work and checkpoint partial progress. Reentrant teardown does not initiate a second stop. A generation token prevents a prior reel's timeout from stopping a later reel.
- Another run begins at the first reel and updates existing shortcode records. It does not silently resume or mix an earlier partial run's progress into a new total.

## Phone Stop test

The progress panel was tapped while the next reel's Share pipeline was active. The profile then held `captured_count: 2`, `status: partial`, `scan_complete: false`, `total_reels: null` and the two saved shortcodes. Android's enabled-accessibility-services setting became null. Those reel records remained saved. This is separate from the regression for stopping during reel 8, which verifies a count/list of exactly seven and no confirmed total.

## Verification scope

The final installed build completed a single-tap run on reposted: profile capture succeeded, all 11 positions were visited and saved as 11 unique canonical reel records, and the stable terminal position was 10 of 11 with no next action. It persisted `status: complete`, `scan_complete: true`, `captured_count: 11`, `total_reels: 11`, top-level `reels_count: 11` and zero reel field errors. Every stored record's capture timestamp was newer than this run's start; every URL matched its shortcode, and all requested field errors were null. The catalog displayed both `@reposted · 11 reels` and `Complete analysis · Complete` / `Total reels · 11`. Capture was off after viewing the catalog.

All 127 tests pass. Debug, optimized preview and optimized release assembly pass; preview lint reports 0 errors and 29 warnings. Installed metadata confirms 2.6.0 / 20600. Repository and generated preview APK hashes match `CDFC7AB29C0AC6D37988EE0F1B522F48A695DCE5E2A4DB97F0A2DA5A4649F5CF`. Sanitized complete/stop checkpoints and per-reel verification are in `complete-analysis-evidence-2026-11-15.json`.

Regression coverage includes unique counting, mismatched owner/URL rejection, collection metadata restricted to active visible items, missing positions, missing metadata, failed durable saves/checkpoints, foreign account boundaries, explicit zero, stale timers, restored Share panels, field errors with a confirmed inventory, interrupted runs, and partial-versus-total UI labels. Existing profile, reel, canonical-link, pending-queue, session and catalog tests remain part of the suite.

No production coordinate gesture or background Instagram-window search is added. Unrecognized layouts fail closed with partial data. Private/unavailable content and session limits are not bypassed. Checkpoint counts describe saved observations, not unseen content. Research-only screenshots and intermediate pulls are kept under the ignored Android build directory; no share-recipient data is included in repository fixtures.
