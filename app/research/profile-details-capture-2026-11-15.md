# One-tap Android profile details capture - 2026-11-15

## Observed phone UI

Research used the connected OnePlus CPH2467 (Android API 35) and the installed Instagram app. Research-only coordinate taps and UI Automator dumps established the selectors. UI dumps were taken with dedgram capture off: UI Automator suppresses other accessibility services. Live captures were monitored with screenshots, logcat and shared-file pulls instead.

The profile action-bar title identifies the account. `row_profile_header` contains the avatar, optional `profile_header_full_name_above_vanity`, `profile_header_metrics_full_width`, and optional `profile_user_info_compose_view`. The familiar metric value IDs expose posts, followers and following separately. Zero is a genuine count when the control says 0. Rounded followers retain raw text and approximation; a rounded posts display does not establish an exact post count.

Compose bio text can end with an ellipsis plus `more`. Clicking its accessible parent expands it in place. The category precedes the bio; music and personal prompts can appear below the bio in the same container and must not be treated as categories. `AI-generated profile` is also separate from category. One observed account omits its display name, and two omit their category.

The avatar node exposes a label and bounds, not an original image URL. The app uses Android's accessibility screenshot API only after a profile tap, hides both capture controls briefly, rechecks active Instagram identity and avatar bounds, crops the avatar PNG, and discards the full screenshot. The encoded crop, dimensions and source are saved in the record. Android below API 30 cannot perform this capture and receives an extraction error.

The top-right `Options` control opens a menu containing `About this account`. Its page exposes account identity, a standard authenticity explanation, and separate Date joined, Account based in and Former usernames rows. The observed country values included explicit `Not shared` and `Tajikistan`. Former username counts of 28, 10 and 18 were directly readable in About. Clicking the row also opens a Former usernames screen whose sentence reads the matching account's change count. The fallback opens this automatically if About's row has no readable count; it verifies two stable detail observations and returns through both Back controls. A count absent from the UI is never assumed zero.

## Implementation and availability

The user taps only the alien icon. `ProfileCaptureRunner` owns all subsequent expansion, Options, About, optional Former usernames, bounded About scrolling and return actions. It serializes against reel capture and the pending queue, checks active Instagram roots, and cancels with the existing temporary session. No production coordinate taps are used. One guarded global Back is allowed only to dismiss a fully verified Options menu when About is absent; normal About and Former usernames returns use semantic Back controls.

The default accessibility tree omitted the nonimportant profile layout containers even though research dumps included them. `flagIncludeNotImportantViews` is therefore required to establish the known layout and optional-field absence; assuming the UI Automator hierarchy matched the original service was caught by live testing.

`field_availability` distinguishes available values, evidence-backed not-shown fields, and failed extraction. Two stable observations at least 600 ms apart establish header and About evidence. Unrecognized layouts, unreadable values, still-truncated bios, failed image capture, identity changes, unfinished page inspection and navigation failures cannot become not-shown states. A complete Android detail capture does not claim the collector's full profile-level completion, which additionally requires reel discovery.

Repeated taps update one normalized username record and preserve first-seen time. A failed refresh retains a previous complete observation separately; a successful refresh clears stale failure/retention data. Existing username-only records and unknown record metadata survive reads and rewrites. Profile writes use the existing exact-folder grant when present, refuse malformed input, keep a private last-good backup and verify readback.

The phone suppressed app toasts through NotificationService. A visible accessibility status banner now reports progress, success and capture failure independently; the profile catalog also displays failed state.

## Device results

- `reposted`: one icon tap captured posts 11, followers 77, following 0, name Reposted, original bio, 222 x 222 avatar crop, join date November 2025 and former username count 28. Missing category and explicit Not shared country were not-shown states and the result was complete.
- `illmisguideyou`: one icon tap expanded the Japanese bio, captured the Reel creator category, counts, avatar, December 2022 join date and former username count 10. Missing display name and Not shared country permitted complete status.
- `edlt.shox`: one icon tap captured zero posts, rounded 26K followers with approximation retained, following 46, the crown display name, expanded Japanese bio, avatar, Tajikistan, September 2026 and former username count 18. Research caught music being mistaken for category; the positional fix and music fixture regression prevent that, and the refreshed category is correctly not shown.
- An intentional Back press during the automatic About transition produced `capture_status: failed` and field errors for the unread account details. The red failure banner was visually confirmed. The previous complete observation remained retained. A subsequent single-tap retry returned to complete, cleared the navigation error, preserved the original first-seen timestamp and kept exactly three unique profiles.

Sanitized field evidence is recorded in `profile-capture-evidence-2026-11-15.json`. Full local screenshots and intermediate file pulls are retained only under the ignored `app/build/profile-capture-evidence` directory. Public profile UI trees used by regression tests are under `app/src/test/resources/profiles` relative to this Android project.

## Validation and scope

The final validation includes unit tests, debug/optimized preview/optimized release assembly and preview lint. The root VERSION is 2.5.0, versionCode 20500. `assemblePreview` synchronizes the optimized debug-signed APK to repository `app/dedgram.apk`; installation uses `adb install -r` to preserve data. The installed version and repository/preview APK hashes are checked.

Final results: all 85 unit tests pass; debug, preview and release assembly pass; preview lint reports 0 errors and 25 warnings. Installed package metadata confirms 2.5.0 / 20500. Both repository and generated preview APK have SHA-256 `A3B6DA9FC6FBEB4480BA50F1C760CB83F97272CF3BDADE9FBC687E3D96E3E083`. A single profile-icon tap on the final installed APK refreshed edlt.shox successfully, retained its first-seen timestamp, captured the avatar, kept category correctly not shown, and removed stale failure history.

A reel regression smoke test on the final installed APK captured reposted reel DSuwCXpDJ_v through the existing icon: expanded caption, 26 December 2025 date, 17 likes, 1 comment and 2,710 plays, with no navigation error. This confirms the additional accessibility layout nodes did not break that tested reel flow. Capture was then stopped by opening dedgram and accessibility disablement was checked.

Fourteen profile regressions use actual phone trees, including Unicode bio, optional name/category, explicit country absence, numeric country-page evidence, unreadable counts, rounded exact-post unavailability, unexpanded bio, metadata preservation, navigation failure, music/prompt exclusion, complete automatic returns, a menu without About, and automatic Former usernames fallback from one start. These complement the existing reel/session/queue tests.

The real phone exposed former counts directly on About; fallback navigation with an unreadable About count is tested using the real screens and simulated semantic actions. Unsupported Instagram layouts/localized labels fail explicitly. No claim is made that an original avatar URL, hidden precise metric, exact join day, or absent field was recovered. This change does not scan reel URLs or import Android profiles into the website collector.
