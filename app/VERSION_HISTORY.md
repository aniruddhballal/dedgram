# Android app version history

The Android app uses semantic versioning. The canonical current version is stored in the repository-root `VERSION` file; Gradle reads that file for both `versionName` and the monotonically increasing `versionCode`.

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
