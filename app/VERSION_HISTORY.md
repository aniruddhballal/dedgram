# Android app version history

The Android app uses semantic versioning. The canonical current version is stored in the repository-root `VERSION` file; Gradle reads that file for both `versionName` and the monotonically increasing `versionCode`.

## 2.7.0 - One curved Quick Ball handle for all capture actions

Replaced the three independent floating controls with one slim, curved edge handle. The crescent's hollow side faces its docked edge. Tap it to reveal a mirrored fan of Profile, Reel and Analyze actions, using new native outline icons and readable label backings. Outside taps and Close dismiss the menu without activating Instagram beneath it. A selection removes the menu before invoking its existing capture flow. Dragging docks to the nearest edge and persists edge/relative height; a narrowly scoped gesture exclusion prevents Android Back from intercepting a handle drag. Saved-profile highlighting, temporary-session restrictions, profile-avatar overlay hiding, queue and complete-analysis progress/Stop controls are preserved. Busy actions are disabled and pending selections are canceled on teardown. No general overlay permission or scraping/data-schema change is introduced. Version code is 20700; optimized preview assembly refreshes `app/dedgram.apk`.

Validation: 137 unit tests pass, including outside dismissal, collapse-before-dispatch for all three actions, canceling pending work on teardown, busy/avatar hiding and dock-position persistence. Preview/release builds and preview lint pass. Connected-phone research is recorded in [Quick Ball verification](research/quick-ball-2026-11-16.md).

On the connected phone, both docking directions and all three menu actions were verified. Analyze completed missp.riyax1's profile and all seven reels with clean canonical URLs, zero reel field errors and confirmed total seven. Preview lint reports zero errors / 28 warnings. Repository/preview APK SHA-256: `EC0491019E69B5F1920293557D6CD3352530C67AF4003DC5F4FBE07422143D56`.

## 2.6.1 - Keep About inspection inside the account page

Fixed Complete analysis selecting Instagram's outer navigation pager as an About-page scroll target. Short About pages now finish without scrolling unrelated containers, and invisible screens cannot supply selectors or receive capture actions. Increased the focused copied-link read window to six seconds for slow Android/Instagram animations, preserving clipboard freshness checks. Paging accepts live metric changes only when owner, caption, collection position and count still match; identical captions require changed collection-position evidence. Version code is 20601; optimized preview assembly refreshes `app/dedgram.apk`.

Validation: all 132 unit tests pass, including the connected-phone short-page fixture, refusal to scroll its navigation pager, and hidden-profile isolation. Preview/release builds pass; preview lint has zero errors and 29 warnings. See [About navigation investigation](research/about-navigation-fix-2026-11-16.md) for the reproduced failure and phone validation.

On the connected phone, one analysis tap completed missp.riyax1's profile and all seven reels, with seven confirmed in both total fields, all positions 0 through 6 covered, canonical URLs and zero reel field errors. Repository/preview APK SHA-256: `C8A6DCE3A8FA439D06E352DF461AE405C419770395DFA5D66D12AC9B1F0B1BFE`.

## 2.6.0 - Complete account analysis from one floating control

Added a draggable purple checklist/play control that composes profile capture, profile Reels-tab navigation and sequential full reel captures. Its live progress panel shows saved counts and provides Stop. Saves durable per-profile checkpoints and unique canonical shortcodes, distinguishes partial saved counts from a verified total, detects terminal collection positions, and does not mark stalled or interrupted scans complete. Confirmed totals and analysis results appear in both compact and expanded profile entries. Restored known reel panels from an interrupted run are dismissed only after verifying account and collection context. Existing temporary-session limits and mutually exclusive capture workflows are preserved. Version code is 20600; optimized preview assembly refreshes `app/dedgram.apk`.

Validation: all 127 tests pass; debug, preview and release builds pass; preview lint has zero errors. The connected phone completed reposted's profile and all 11 reels from one tap, saved both confirmed total fields as 11 with zero reel field errors, and displayed that total in the catalog. A separate Stop test retained two saved reels and a partial count of two without a total; a regression covers stopping during reel 8 with exactly seven saved. Repository/preview APK SHA-256 matches `CDFC7AB29C0AC6D37988EE0F1B522F48A695DCE5E2A4DB97F0A2DA5A4649F5CF`. See [Complete analysis research](research/complete-analysis-2026-11-15.md) for terminal-position evidence and safeguards.

## 2.5.4 - Automatic canonical URLs for individual reel captures

The reel icon now opens Share → Copy link automatically, reads a fresh copied URL through a brief focused accessibility overlay, strips tracking parameters/fragments, and verifies return to the original reel before continuing caption/date/metrics capture. Saves canonical URL, shortcode, URL verification evidence and explicit URL errors. Expanded reel entries expose the link and an Open reel action. Stale clipboard data, unknown destinations, missing controls and changed reel identity cannot silently supply a link. Existing queue URL capture is preserved. Version code is 20504; optimized preview assembly refreshes `app/dedgram.apk`.

Explicitly sponsored ads are skipped for ordinary icon capture; their alternate caption and metrics layouts are outside the requested feature.

Validation: all 108 tests pass; debug, preview and release builds pass; preview lint reports zero errors. On the connected phone, two normal reposted reels gained clean matching URLs and completed their existing detail capture. Reopening the links, including the new Open reel action, returned to the matching content. Installed package metadata confirms 2.5.4 / 20504. Repository/preview APK SHA-256 matches `5CA0CA46960C4B92244BA9180A385872064505D72C1F6E4BE0BCB466B2C6FF91`. See [reel URL capture research](research/reel-url-capture-2026-11-15.md) for evidence and limits.

## 2.5.3 - Independent collapsible catalog entries

Moved the info icon directly beside BOT SCRAPER. Each profile and reel now starts as a compact, single-line bar with an expand/collapse indicator. Tapping it shows the existing complete details, independently of other entries; choices persist across search, tab changes and reopening the app. Stable profile/reel identities keep each choice separate, failed captures retain a visible warning indicator, and details are created only when first expanded. Version code is 20503; optimized preview assembly refreshes `app/dedgram.apk`.

The info glyph is proportional to the subtitle and constrained to the text row's original height. A larger delegated touch area keeps it easy to tap without pushing the version or counts down. A layout regression checks that hiding the icon does not change header height or the right-hand block's position.

Validation: all 98 unit tests pass; debug, preview and release assembly pass; preview lint has zero errors. Connected-phone checks confirmed independent profile/reel expansion, full detail rendering, remembered choices across tab changes and app upgrade, compact header alignment, and opening info by tapping outside the small visible glyph within its larger touch area. The installed package is 2.5.3 / 20503. Repository and generated preview APK SHA-256 matches `4549A40E99B5F45BB6D0D2AAB48AFB1E7370E90DFD7DA013C6019CA89872083A`. Capture remained off during catalog testing.

## 2.5.2 - Balanced header and compact capture controls

Changed the header subtitle to BOT SCRAPER and added combined saved profile/reel totals beneath the version. Moved all collection instructions, storage notes and privacy guidance into a single scrollable information dialog behind the header's info icon. Both catalogs now lead with actions and saved data. Replaced the settings/stop button pair and textual access status with one right-aligned Capture session switch. Enabling opens Android settings with a fresh start request; disabling preserves the existing stop/disable behavior and settings fallback. Programmatic switch refreshes follow Android's actual state without launching settings or arming a new session. Version code is 20502; optimized preview assembly refreshes `app/dedgram.apk`.

Validation: all 93 unit tests pass, including guidance visibility, combined totals independent of search, settings launch without premature ON state, and disable fallback without arming another session. Debug, preview and release assembly pass; preview lint reports zero errors. Connected-phone checks confirmed both catalogs show 3 profiles / 27 reels, one info tap reveals guidance, switching on opens accessibility settings, and switching off disables an active service. Access was off at the end. The installed package is 2.5.2 / 20502; repository and generated preview APK SHA-256 matches `D0F14CE641DC5FC99CF0F14AC7B7D5935C0AFB4E42418EB3248878B09D10F3CE`.

## 2.5.1 - Show captured profile details in the catalog

Profile entries now show the captured avatar, counts, display name, bio, category, country, join date, former username count and observation timestamps. Each field distinguishes saved values, verified not-shown states and extraction failures with the actual reason. Rounded counts retain their displayed precision; zero stays a real value. Saved header text expands inline, and failed refreshes can reveal the previous successful capture separately. Username-only records remain supported. The optimized preview build refreshes `app/dedgram.apk`; version code is 20501.

Validation: all 89 unit tests pass, including four profile presentation regressions for failures, absence, rounded/zero counts, expandable sources/history, legacy timestamps and invalid images. Debug, preview and release builds pass; preview lint has zero errors. Connected-phone inspection confirmed the saved avatar, Unicode bio, account fields, unavailable states and header expansion. The installed package is 2.5.1 / 20501, and repository/preview APK SHA-256 matches `4E7BDE6E70A8367F44ECCE82B8A17E4E51D1A4306B1FBA3F9D164A0919015998`.

## 2.5.0 - Profile details and verified field availability

The alien profile control now captures header counts, expanded bio, display name, category, avatar PNG, country, join date and former username count. It opens About this account semantically and returns to the original profile. Exact post counts are distinguished from rounded displays. Each field records captured values, evidence-backed not-shown states, or extraction failures; genuine absence permits a successful save, while extraction/navigation failures persist diagnostics and show a red status banner and catalog warning. Repeated captures update the existing username record while preserving first-seen time and the prior successful observation on failed refreshes.

Enabled nonimportant Instagram layout nodes needed to verify optional sections, plus screenshot capability for the avatar crop only. Capture remains temporary and Instagram-scoped; no reel inventory scan is added. Profile documents gain exact-folder access, last-good backup and readback verification. Existing records remain readable. Version code is 20500; the optimized preview build refreshes `app/dedgram.apk` for an in-place device upgrade. See the profile capture investigation for tests and limitations.

## 1.0.0 — Initial AInsta release

Commits from the buildable Android shell through the first packaged AInsta release established the app, profile storage, strict username extraction, the accessibility capture service, and the catalog screen.

Key range: `203442f` through `4277b7e`.

## 1.1.0 — Capture foundation hardening

Added broader device compatibility, profile edge-case handling, a draggable capture bubble, and Instagram-only visibility.

Key commits: `548557b`, `51d6d5c`, `f798860`, `5858f84`.

## 1.2.0 — AInsta capture identity and feedback

Added the pixel-alien identity, success/failure feedback, and stronger profile identity extraction.

Key commits: `d8abc91`, `358feac`, `0689b98`, `0961da5`, `e588abb`, `fe99c78`.

## 1.3.0 — Profile catalog refinements

Added profile search, keyboard-safe layout behavior, external catalog synchronization, stricter UI-label filtering, improved inset handling, and saved-profile highlighting.

Key range: `54dced9` through `8f94519`.

## 2.0.0 — dedgram rebrand

Renamed the application and package branding from AInsta to dedgram and introduced the dedgram visual identity.

Key commits: `ba2833a`, `a256880`, `d71c617`, `9fd197b`.

## 2.1.0 — Reel collection mode

Added the separate reel collection workflow, reel accessibility extraction, Likes and plays handling, UTF-8 caption capture, field-level errors, reel storage, and the dedgram reel control.

Key commit: `9f0118e`.

## 2.2.0 — Historical AInsta profile control restored

Restored the historical AInsta pixel-alien profile control and applied the current rounded-square presentation.

Key commit: `c911084`.

## 2.2.1 - Optimized installable build

Enabled R8 code shrinking and resource shrinking for optimized release/preview builds, added a debug-signed non-debuggable preview variant for device testing, and synchronized the repository APK from that optimized preview build.

## 2.2.2 - Bound accessibility sessions after Google Pay compatibility report

Recorded the [payment-blocking issue and original screenshot](issues/2026-10-31-google-pay-payments-blocked/README.md), with a [commit-level investigation](issues/2026-10-31-google-pay-payments-blocked/INVESTIGATION.md). Removed coordinate gesture capability, global Back actions, general overlay permission, and background interactive-window searches. Restored Instagram-only event filtering and added active-window checks, cancellation of pending work, and complete accessibility disablement when leaving Instagram, locking the phone, stopping capture, or reaching the session limit. Added an in-app stop control, single-use start requests to reject automatic service restarts, and payment compatibility guidance. Captions must be expanded before capture; unavailable semantic controls produce field errors. Google Pay recovery remains unverified on the affected phone.

## 2.3.0 - One-tap reel caption and publication evidence capture

The reel control now expands the current reel caption, reads the caption and publication footer, closes that verified sheet, opens Likes and plays (including the Reactions and plays variant), and restores the reel view. Publication labels are saved verbatim with UTC observation time, epoch milliseconds, device timezone and locale; relative ages are not converted into fabricated exact publication dates. Full calendar labels retain displayed years.

Fixed short-caption selection, accessibility author prefixes and non-breaking spaces in usernames, off-screen background nodes incorrectly marked visible, counts leaking into another metric, and hidden-likes panels containing a single plays count. Explicit owner-only likes and empty comments have separate handling; unreadable counts remain errors.

Instagram-scoped semantic dismiss controls remain preferred for metrics panels. Caption sheets on the tested phone expose no working dismiss action, so this version adds one guarded Back action only after matching the live Instagram sheet's caption and date to the captured record. Instagram-only capture sessions, foreground checks, expiration, lock handling and cancellation remain enforced; no coordinate gesture capability or background-window search is added.

Built and installed as an optimized, debug-signed preview through `:app:assemblePreview`, which synchronizes `app/dedgram.apk`. See the research notes for device-test evidence and remaining limitations. No payment-app recovery claim is made.

## 2.4.0 - Persistent pending-reel queue

Added the pending/total count and Start/resume CTA in Reel Collection, with one-time scoped Documents/dedgram folder selection. The app processes null-status URLs sequentially, captures through the existing reel pipeline, writes canonical reels.json and checkpoints collected/partial/failed/deleted/review/rate-limit outcomes back into pending_reels.json. Added a live progress/Stop overlay, resume without repeating completed entries, source URL/shortcode association, canonical document verification and preservation of earlier valid observations.

Visible rate-limit/access gates and load failures stop without retries. A bounded queue-only unknown-window navigation grace keeps normal Instagram deep-link transitions from ending the session; other app foregrounds, lock handling, explicit Stop and the existing 30-minute session deadline remain unchanged. This does not implement the previously cancelled one-hour session proposal.

The optimized preview APK is generated by the existing assemblePreview task, synchronized to app/dedgram.apk and installed by an in-place upgrade. Unit and connected-device evidence is recorded in the queue investigation notes.

## 2.4.1 - Continue dismissible sensitive-content warnings

The queue can semantically click the exact See reel control on a verified Sensitive content interstitial once, then verify the loaded reel before capturing. Persistent warnings and age/login gates remain review states; visible throttling takes priority over any warning. Added regression tests for successful confirmation, persistent warnings, unrelated/hidden controls and rate-limit priority. Documented that standard UI automation dumps suppress the app's accessibility service and must not be used during live capture monitoring.

## 2.4.2 - Distinguish verified unexposed counts from capture failures

Added per-metric availability evidence for comments/reposts/shares/saves when two intact action-strip observations show no count and the caption/date/likes/plays pipeline succeeds. Such null metrics are resolved and do not force partial status; unreadable nodes, placeholders, missing controls, failed panels and navigation errors remain blockers. The reel list labels verified absence Not exposed. Retained older numbers and additional record metadata survive rewrites. Existing partial records require new evidence before promotion.
