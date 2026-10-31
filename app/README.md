# dedgram Android

dedgram is a native Android companion for collecting Instagram profile usernames and reel metrics. It places two distinct capture controls over Instagram, reads the active Instagram accessibility tree during a temporary capture session, and maintains separate searchable profile and reel catalogs.

## Current features

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
- Usernames are normalized case-insensitively and duplicate profiles are not added.
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
- The original black profile control remains available over Instagram unchanged.
- The reel control is a separate dedgram target/logo control that stays visible alongside the alien profile control.
- Reel capture reads likes, comments, reposts, shares, saves, posted date, and UTF-8 caption text from the active reel.
- Reel capture uses Instagram's semantic likes-button action to open **Likes and plays** and reads the plays value there. If Instagram exposes no clickable control, it records an error instead of injecting a screen tap.
- Reel fields are saved independently with a `value` and `error`, so an unreadable field is never silently omitted.

## Capture setup

1. Install the APK and open dedgram. Catalog viewing needs no capture permissions.
2. Read the **Capture session** notice and tap **Open accessibility settings**. This authorizes one start; enable the service within two minutes.
3. Enable **dedgram profile and reel capture**, then open Instagram within 60 seconds.
4. Open an individual Instagram profile or reel. Expand a truncated reel caption before capturing.
5. Tap the alien profile control or the dedgram reel control.
6. When finished, leave Instagram or use **Stop capture and turn access off** in dedgram. Verify the status is **OFF** before using Google Pay or another payment app. Starting another session requires returning to dedgram, opening accessibility settings from its session control, and enabling the service again. Direct enablement in Settings without this fresh start request is rejected.

Google Pay can block payments when it detects unknown apps with active accessibility access. A [reported payment-blocking issue with the original screenshot](issues/2026-10-31-google-pay-payments-blocked/README.md) prompted this change; the [investigation](issues/2026-10-31-google-pay-payments-blocked/INVESTIGATION.md) records evidence and verification limits. Disabling capture reduces this exposure, but does not guarantee that a previously triggered block is cleared. Follow [Google Pay's guidance](https://support.google.com/pay/india/answer/17165523?hl=en) for an existing block.

Reel records are stored at:

```text
Documents/dedgram/reels.json
```

The repository sample format for reel records is [`reel_capture.json`](reel_capture.json).

Reel collection uses the active reel UI and its accessible likes-count action, waits for **Likes and plays**, and records field-level errors when Instagram does not expose a value or semantic click. Expand captions before capture; dedgram does not automatically close panels or navigate Back. Close the panel yourself after capture.

The service captures only when the active accessibility root belongs to Instagram. Profile capture saves usernames and timestamps; reel capture also saves captions, dates, and visible metrics. Saved-profile highlighting inspects Instagram's tree automatically on relevant events. It does not collect other apps' text, screenshots, or direct messages.

## Catalog storage

The Android catalog is stored at the user-visible shared path:

```text
Documents/dedgram/profiles.json
```

Each saved entry contains the captured username, its normalized username, and the first-seen timestamp. The app derives the displayed `instagram.com/<username>/` URL from the normalized username. The file is outside private app storage, so it remains user-visible and normally survives an app uninstall. The app also de-duplicates and validates entries when reading the file.

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
