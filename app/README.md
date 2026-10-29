# dedgram Android

dedgram is a native Android companion for collecting Instagram profile usernames and reel metrics. It places two distinct capture controls over Instagram, reads the visible accessibility tree only after the matching control is tapped, and maintains separate searchable profile and reel catalogs.

## Current features

- The capture bubble appears only while Instagram is the active app.
- The profile control uses the historical rounded-square AInsta alien mark; the reel control uses the black-and-white dedgram target/logo mark.
- Drag the bubble to any position on the screen. Its position is remembered for later sessions.
- A tap and a drag are distinguished, so repositioning the bubble does not accidentally save a profile.
- The bubble uses an accessibility overlay when available and falls back to an accessibility-service overlay when needed.
- Profile capture retries briefly when Instagram has not finished rendering the profile header.
- Username extraction accepts profile-shaped accessibility labels, profile descriptions, and Instagram profile URLs.
- Candidate validation rejects common UI labels and metric values such as `posts`, `followers`, and `1.2K followers` instead of treating them as usernames.
- Usernames are normalized case-insensitively and duplicate profiles are not added.
- Successful saves show a toast and a left-to-right shimmer across the bubble.
- Already-saved profiles show a separate toast, pulse animation, and short vibration.
- While an Instagram profile is open, the capture bubble gets a thin silver outline when that username is already saved; the check is debounced and event-driven, without continuous polling.
- Capture or save failures show a separate toast, jitter animation, and warning vibration.
- The main app shows permission status for overlay access and accessibility access.
- The saved-profile catalog displays the username and its derived Instagram profile URL.
- Search matches usernames, `@username`, and Instagram profile URLs. It shows match counts and a no-match state.
- The search field has keyboard-aware insets: results stay above the keyboard, the catalog remains scrollable while the keyboard is open, and the previous scroll position is restored when it closes.
- The catalog has a fixed-height search field with spacing from the section heading and no decorative empty-state bar.
- The app has separate **PROFILE DETECTION** and **REEL COLLECTION** modes with visually distinct controls.
- The original black profile control remains available over Instagram unchanged.
- The reel control is a separate dedgram target/logo control that stays visible alongside the alien profile control.
- Reel capture reads likes, comments, reposts, shares, saves, posted date, and UTF-8 caption text from the active reel.
- Reel capture taps the visible likes count to open Instagram's **Likes and plays** panel and reads the exact plays value there.
- Reel fields are saved independently with a `value` and `error`, so an unreadable field is never silently omitted.

## Capture setup

1. Install the APK.
2. Open dedgram and grant **Overlay permission**.
3. Open Android **Accessibility settings** and enable **dedgram profile capture**.
4. Open an individual Instagram profile or reel.
5. Tap the alien profile control for profile detection, or the dedgram logo control for reel collection.

Reel records are stored at:

```text
Documents/dedgram/reels.json
```

The repository sample format for reel records is [`reel_capture.json`](reel_capture.json).

Reel collection does not navigate to the poster's profile. It works from the active reel UI, expands the caption when needed, taps the reel's likes count, waits for **Likes and plays**, and records field-level errors if Instagram does not expose a requested value.

The service only attempts capture when the active accessibility window belongs to Instagram. It stores the username after successful validation; it does not save screenshots, captions, bios, follower counts, post counts, direct messages, or surrounding UI text.

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

The preview build enables R8 code shrinking and resource shrinking, is non-debuggable, and uses the generated debug signing key so it can upgrade the installed testing app without changing its package identity. A successful preview build also refreshes the repository artifact at `app/dedgram.apk`. To install the optimized preview build on a connected device:

```powershell
adb install -r app\build\outputs\apk\preview\app-preview.apk
```

Reinstalling an APK can cause Android to reset the accessibility-service toggle. If the capture bubble disappears after reinstalling, check dedgram in Accessibility settings again.

## Platform limitation

An ordinary Android overlay cannot inspect Instagram's page text. A user-enabled `AccessibilityService` is therefore required for the tap-to-capture workflow. The service is restricted to Instagram's package and reads the active UI only after the bubble is tapped.

Instagram can change its UI structure and accessibility labels. If the profile header is ambiguous, inaccessible, or not yet rendered, dedgram refuses to guess and reports a capture failure instead.
