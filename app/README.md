# dedgram Android

dedgram is a native Android companion for collecting Instagram profile details and reel metrics. It places two distinct capture controls over Instagram, reads the active Instagram accessibility tree during a temporary capture session, and maintains separate searchable profile and reel catalogs.

## Current features

- The header identifies dedgram as **BOT SCRAPER** and shows total saved profiles and reels beneath the version number, independently of the selected catalog or search filter.
- The main screen contains a right-aligned **Capture session** switch, catalog tabs, collection actions and saved results. Tap the header's **ⓘ** icon once for all setup, collection, queue, availability, storage and privacy information.
- Turning the session switch on opens Android Accessibility settings for a fresh start request. Its checked state follows actual accessibility enablement. Turning it off stops capture and disables access; if the service cannot be reached, Android settings opens for manual disablement.

- The capture bubble appears only while Instagram is the active app.
- The profile control uses the historical rounded-square AInsta alien mark; the reel control uses the black-and-white dedgram target/logo mark.
- Drag the bubble to any position on the screen. Its position is remembered for later sessions.
- A tap and a drag are distinguished, so repositioning the bubble does not accidentally save a profile.
- Both controls use accessibility overlays; general draw-over-other-apps permission is no longer requested.
- Capture is a temporary session: start it from dedgram, enable access within two minutes, then open Instagram within 60 seconds of enabling access; leaving Instagram, locking the phone, pressing Stop, or reaching 30 minutes disables accessibility completely.
- Queued captures are canceled when the session ends. The service never searches background Instagram windows or injects coordinate gestures/global Back actions.
- Profile capture retries briefly when Instagram has not finished rendering the profile header.
- Username extraction accepts profile-shaped accessibility labels, profile descriptions, and Instagram profile URLs.
- Candidate validation rejects common UI labels and metric values such as `posts`, `followers`, and `1.2K followers` instead of treating them as usernames.
- Usernames are normalized case-insensitively. Repeat profile captures update the existing record and preserve its original first-seen timestamp.
- Successful saves show a toast and a left-to-right shimmer across the bubble.
- Already-saved profiles show a separate toast, pulse animation, and short vibration.
- While an Instagram profile is open, the capture bubble gets a thin silver outline when that username is already saved; the check is debounced and event-driven, without continuous polling.
- Capture or save failures show a separate toast, jitter animation, and warning vibration.
- The main app shows the actual Android accessibility enablement status and provides a complete Stop control in both catalog modes.
- The saved-profile catalog displays the username and its derived Instagram profile URL.
- Search matches usernames, `@username`, and Instagram profile URLs. It shows match counts and a no-match state.
- The search field has keyboard-aware insets: results stay above the keyboard, the catalog remains scrollable while the keyboard is open, and the previous scroll position is restored when it closes.
- The catalog has a fixed-height search field with spacing from the section heading and no decorative empty-state bar.
- The app has separate **PROFILE DETECTION** and **REEL COLLECTION** modes with visually distinct controls.
- The black alien profile control captures profile details, including About this account, independently of reel collection.
- The reel control is a separate dedgram target/logo control that stays visible alongside the alien profile control.
- Reel capture reads likes, comments, reposts, shares, saves, posted date, and UTF-8 caption text from the active reel.
- Reel capture uses Instagram's semantic likes-button action to open **Likes and plays** and reads the plays value there. If Instagram exposes no clickable control, it records an error instead of injecting a screen tap.
- Reel fields are saved independently with a `value` and `error`, so an unreadable field is never silently omitted.

## Capture setup

1. Install the APK and open dedgram. Catalog viewing needs no capture permissions.
2. Tap **ⓘ** for setup information, then turn on the **Capture session** switch. This opens accessibility settings and authorizes one start; enable the service within two minutes.
3. Enable **dedgram profile and reel capture**, then open Instagram within 60 seconds.
4. Open an individual Instagram profile or reel. Leave the reel in its normal viewing state; the reel control expands its caption automatically.
5. Tap the alien profile control or the dedgram reel control.
6. When finished, leave Instagram or turn the **Capture session** switch off in dedgram. Verify the switch is off before using Google Pay or another payment app. Starting another session requires returning to dedgram, turning the switch on to open accessibility settings, and enabling the service again. Direct enablement in Settings without this fresh start request is rejected.

Google Pay can block payments when it detects unknown apps with active accessibility access. A [reported payment-blocking issue with the original screenshot](issues/2026-10-31-google-pay-payments-blocked/README.md) prompted this change; the [investigation](issues/2026-10-31-google-pay-payments-blocked/INVESTIGATION.md) records evidence and verification limits. Disabling capture reduces this exposure, but does not guarantee that a previously triggered block is cleared. Follow [Google Pay's guidance](https://support.google.com/pay/india/answer/17165523?hl=en) for an existing block.

Reel records are stored at:

```text
Documents/dedgram/reels.json
```

The repository sample format for reel records is [`reel_capture.json`](reel_capture.json).

Reel collection reads the active reel, opens the caption through its accessible control, waits for a stable caption and publication footer, then dismisses that sheet through Instagram's own controls before opening **Likes and plays**. The capture stores the posting label verbatim (including relative ages and any displayed year), its UTC observation time, device timezone and locale; it does not invent an exact publication time. Metrics-sheet dismiss controls are preferred. The tested caption sheet requires one guarded Back action after its text and date match the capture; the reel identity is checked again before reading metrics. No coordinate gestures or background-window searches are used. Unknown selectors, unexposed metrics, and unsuccessful panel transitions remain explicit field errors. Owner-only likes are identified separately from extraction failures. A missing count is never assumed to be zero; an explicit empty comments message may establish zero comments.

The service captures only when the active accessibility root belongs to Instagram. Profile capture saves the fields described below; reel capture saves captions, dates, and visible metrics. Saved-profile highlighting inspects Instagram's tree automatically on relevant events. Profile capture takes a screenshot after the tap to crop the visible avatar; the full screenshot exists only in memory and is discarded. It does not collect other apps' text, screenshots, or direct messages.

## Catalog storage

The Android catalog is stored at the user-visible shared path:

```text
Documents/dedgram/profiles.json
```

Each saved entry preserves the captured username, its normalized username, and the first-seen timestamp. Version 2 captures also contain profile details and field availability. Existing username-only records remain readable and can be upgraded with another profile tap. The app derives the displayed `instagram.com/<username>/` URL from the normalized username. The file is outside private app storage, so it remains user-visible and normally survives an app uninstall.

### Profile details capture (2.5.0)

In 2.5.1, the profile catalog displays the captured avatar and each saved field directly below its username, with capture/finish/first-saved times in the device's local timezone. Verified unavailable fields say **Not shown**; extraction failures show **Failed** and their reason in red. Counts keep zero values and label rounded displays. **Show saved header** expands the original header text. Failed refreshes offer **Show previous successful capture**, keeping earlier observations separate from the latest failed attempt. Older username-only entries keep their existing prompt to capture details.

Open a profile at its header and tap the alien control once. Leave Instagram open until the status banner finishes; no other user taps are needed. The app verifies two stable header observations, expands a truncated bio, captures the avatar, opens Options then About this account, reads the stable account details, and returns using Instagram's Back control. If the Former usernames row has no readable count, it automatically opens that detail screen, verifies the matching account's count, then returns through About to the profile. Only a verified Options menu without About uses one guarded global Back. Reel URLs and reel details are outside this action.

Saved fields are `posts_count`, `followers_count`, `following_count`, `profile_header_text`, `fetched_at`, `bio`, `display_name`, `category`, `account_based_in`, `date_joined`, `profile_picture`, and `former_usernames_count`. `about_text` preserves the account panel evidence. The avatar is a PNG crop encoded as base64 inside `profile_picture`, with dimensions and `source: visible_header_crop`; it is not an original-resolution download or a guessed URL. Avatar capture requires Android 11 or newer. The floating controls are hidden briefly so they cannot cover the avatar in the crop.

Each field has `field_availability.<field>` with `status`, `evidence`, `observed_at`, and `error`:

- `available`: the value was read from the verified UI.
- `not_shown`: explicit Not shared text or a verified absent optional row; null values are unknown, never zero. A rounded posts count cannot establish an exact count: `posts_count` stays null and the displayed metric is retained as `posts_count_displayed`. Rounded followers/following retain `raw` and `approximate`.
- `failed`: unreadable visible values, unknown layout, failed expansion, screenshot failure, interrupted navigation, or unverified absence. These errors must be retried or inspected; they are never converted into unavailable data.

`capture_status: complete` means all requested Android profile fields are either captured or verified not shown. It does not mean the collector's profile-level completion rule (which includes the reel inventory) has been satisfied. Any extraction or navigation failure sets `capture_status: failed`, saves the diagnostic record and displays a red failure banner plus catalog warning. The banner also works when Android suppresses app toasts. A failed refresh preserves a previous successful capture under `last_successful_capture`.

Profile capture and reel capture cannot run simultaneously. Leaving Instagram or ending a session cancels pending work and saves a failed attempt when a profile has already been identified. Profile storage uses the existing scoped folder grant when available, keeps a private last-good backup, refuses malformed input files, and verifies writes. Research and connected-device evidence is in [profile capture investigation](research/profile-details-capture-2026-11-15.md).

## Build and test

Requirements: JDK 17, Android SDK platform 36, and Build Tools 36.

```powershell
cd app
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:assemblePreview
.\gradlew.bat :app:assembleRelease
```

Debug, optimized preview, and optimized release APKs are written under:

```text
app/build/outputs/apk/
```

Optimized APKs are the default delivery format for Android apps in this repository. The preview build enables R8 code shrinking and resource shrinking, is non-debuggable, and uses the generated debug signing key so it can upgrade the installed testing app without changing its package identity. A successful preview build also refreshes the repository artifact at `app/dedgram.apk`. Debug builds are reserved for development and tests. To install the optimized preview build on a connected device:

```powershell
adb install -r app\build\outputs\apk\preview\app-preview.apk
```

Reinstalling an APK can cause Android to reset the accessibility-service toggle. Upgrades remove the general overlay permission; the current app does not use a previous overlay grant. If the capture bubble disappears after reinstalling, check dedgram in Accessibility settings again.

## Platform limitation

A user-enabled `AccessibilityService` is required for this capture workflow. Its XML event filter includes only Instagram. A 250 ms session watchdog checks the active root's package without traversing foreign-app content, since the package filter suppresses other apps' events. A foreign/unknown foreground after Instagram ends the session. Screen-off/lock checks also stop capture. Each start requires a single-use request from the app, consumed before connecting, so service restarts cannot silently start another session. Accessibility disablement is asynchronous, so verify OFF before opening payment apps. This is not a bypass of payment-app security checks.

Instagram can change its UI structure and accessibility labels. If the profile header is ambiguous, inaccessible, or not yet rendered, dedgram refuses to guess and reports a capture failure instead.

### One-tap capture evidence (2.3.0)

`date_posted.value` preserves the displayed publication label. `publication_observation` stores `raw_text`, UTC `observed_at`, `observed_at_epoch_ms`, device `timezone`, `locale` and source. `exact_publication_time` stays null unless separately established; the app does not assume a year for labels without one or a rounding rule for relative ages. `caption_expanded` records successful expanded-caption verification, `likes_availability: owner_only` records explicit hidden-count evidence, and `navigation_error` records a failed sheet verification. Existing JSON records remain readable.

The app cannot guarantee fields Instagram does not expose. In particular, some reels expose no share/repost/save count, and ordinary FYP accessibility nodes may expose no reel URL/shortcode. Those captures do not gain a fabricated link or count. Exact shortcode matching remains unavailable in that case; timestamp-based record identity prevents overwriting a different reel.

## Pending reel queue (2.4.0)

Put a UTF-8 JSON document at `Documents/dedgram/pending_reels.json`. See [`pending_reels.example.json`](pending_reels.example.json). Use an object containing a `reels` array; each entry has an Instagram reel `url` and initially `status: null`. `expected_account` is recommended so a changed account or unrelated screen cannot silently supply a queued result. A top-level array is also accepted. Duplicate canonical URLs, invalid destinations and unsupported statuses are rejected before the run. Additional entry and document metadata is preserved.

In **REEL COLLECTION**, the queue card shows pending and total counts next to **START / RESUME**. Choose the exact **Documents/dedgram** folder once in Android's document picker and allow access. This persisted folder grant lets the app update computer-created files with their exact names; no broad storage permission is requested. If capture is off, Start/resume requests a fresh accessibility session. Enable the service when prompted; the first pending URL then opens in Instagram automatically. Do not press Back or switch apps during the run.

The runner opens one URL, waits for a stable matching account/render, invokes the existing caption/date/metrics capture pipeline, saves the result to the exact `reels.json`, verifies it, and only then checkpoints that queue entry. Saved records have the requested URL/shortcode and an explicit identity source; ordinary Instagram accessibility UI may not independently expose a shortcode, so the source distinguishes deep-link/account/render checks from directly exposed link data.

| Status | Meaning |
| --- | --- |
| `null` | Eligible for collection |
| `collected` | Requested fields captured or explicitly resolved, such as owner-only likes |
| `partial` | Result saved, with one or more requested fields still unreadable |
| `failed` | Load, identity or capture could not be verified |
| `deleted` | Instagram explicitly reported the reel unavailable; deletion versus archiving is not established |
| `needs_review` | An age, sensitive-content, login or other access gate needs inspection |
| `rate_limited` | A visible HTTP 429/throttle message stopped the run |

Each attempted entry receives `updated_at`, `captured_at` and an optional diagnostic `detail`. Only null-status entries are automatically attempted. To retry an earlier result, deliberately reset its status to JSON null; the result store de-duplicates by shortcode and preserves older valid field observations when the latest capture fails to replace them. Reused values carry their original capture time in `retained_observations`.

The Instagram queue overlay shows attempted progress and acts as **Stop**. Opening dedgram, leaving Instagram, locking the phone, expiry or Stop ends the existing capture session and pauses the batch; resume uses the saved statuses. During a queued deep-link transition only, an unknown active window is tolerated for at most eight seconds without traversing or acting on it. Other app foregrounds and the existing session deadlines still stop capture. A repeated caption alone is not used as a new-reel identity: visible metric observations also contribute to the render-change check.

Explicit access/throttle screens and unverified load timeouts stop the batch without retry. The app reads visible Instagram UI; it cannot inspect hidden HTTP responses in Instagram's network stack. It does not mark an empty or timed-out page deleted. Completed queue entries are not re-run automatically after a restart.

Results and queue updates keep last-good private backups before replacing their documents. Invalid or unwritable documents stop the run rather than silently starting an empty collection. Computer edits while a run is active are discouraged; a removed active URL stops checkpointing rather than overwriting the changed queue.

MediaStore's legacy path is still supported for ordinary captures without a folder grant, but renamed output files are rejected. Queue runs use the granted exact documents to avoid `reels (1).json` collisions.

In 2.4.1, the exact **Sensitive content / See reel** interstitial is handled with one semantic tap per queued reel, followed by verification that normal reel content loads. A persistent warning, missing control, age verification or login gate still stops for review. Rate-limit messages take priority and are never dismissed or retried. During live testing, do not use standard `uiautomator dump`: its automation connection suppresses other accessibility services. Monitor with file pulls, logs and screenshots instead.

In 2.4.2, a missing comments/reposts/shares/saves count can be resolved as `metric_availability.<field>.status: not_exposed` only when the exact action control and its next control bound an empty count region on two matching-account reel observations at least 500 ms apart, and caption/date plus likes/plays capture succeeds. Evidence records both observation times, the control boundary and the verification source. A present count or placeholder that cannot be parsed, missing controls, identity uncertainty, failed panel or navigation error remains partial. Explicit owner-only likes remain resolved separately. “Not exposed” describes the observed Android UI; it does not assert that Instagram can never expose the metric elsewhere. Historical partials without this evidence are not automatically upgraded. Earlier valid numbers remain visible with retained-observation timestamps, and existing record metadata is preserved when rewriting the file.
