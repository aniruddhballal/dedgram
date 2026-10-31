# Investigation: accessibility exposure and Google Pay compatibility

Investigation date: 2026-10-31 (Asia/Calcutta). Intake commit: `338f85f`; repository version at intake: 2.2.1. See [the issue report and original screenshot](README.md) for the observed failure and recovery history.

## Finding and limits

There is a recent, concrete increase in accessibility capability: reel collection added device-level gesture dispatch on 2026-10-29. There is also a longstanding exposure: dedgram's accessibility service stayed enabled outside Instagram, and its system-level event subscription had included every app since 2026-10-18. Either is relevant to the reported warning. The screenshot alone does not identify dedgram, and the recovery involved several changes, so it cannot establish a single causal commit.

Google's [official explanation of this exact Google Pay warning](https://support.google.com/pay/india/answer/17165523?hl=en), checked 2026-10-31, says its protection can block payments when it identifies unknown or unauthorized apps with active accessibility permissions. It directs users to disable access for such apps and provides further recovery steps. This supports investigating enabled-service state, even if no capture is running. It does not disclose the classification rules or identify dedgram as the detected app. It also does not establish that changing dedgram alone clears a previously triggered block.

The available repository evidence supports fixing excessive access and unsafe action lifecycle. It does not establish that dedgram read payment data, stole a PIN, caused account compromise, or that Google Pay changed its rules yesterday. None of those claims should be inferred from this report.

## History evidence

Times below are commit times in IST (`+05:30`). Versions in the final column are the retrospective feature labels in `app/VERSION_HISTORY.md`, except where explicitly described as the actual build version.

| Commit and date | Evidence | Version context |
| --- | --- | --- |
| `203442f`, 2026-10-17 17:31 | Android shell already requested `SYSTEM_ALERT_WINDOW`. | Initial-release range; actual Gradle version `0.1.0`, code 1. |
| `3a4b580`, 2026-10-17 17:33 | Initial accessibility service declared window-content retrieval, interactive-window access, view IDs, and an Instagram-only `packageNames` event filter. | Initial-release range, documented as 1.0.0. |
| `5858f84`, 2026-10-18 10:19 | Removed `android:packageNames="com.instagram.android"`. Non-Instagram window events were used to hide the bubble after app switches. No replacement system-level package filter was added. | Documented 1.1.0; actual Gradle version `0.2.0`, code 2. |
| `25ce40d`, 2026-10-18 13:56 | Added automatic, event-driven profile-tree inspection to highlight already-saved usernames. UI reads were therefore not exclusively triggered by capture taps. | Documented 1.3.0. |
| `ba2833a`, 2026-10-23 07:13 | Changed Android application ID from `com.ainsta.collector` to `com.dedgram.collector`. | Documented 2.0.0; separate installed-package identity. |
| `9f0118e`, 2026-10-29 10:50 | Reel mode added `canPerformGestures="true"`, coordinate `dispatchGesture()`, `GLOBAL_ACTION_BACK`, a second bubble, delayed multi-step capture, and scans of interactive windows. | Documented 2.1.0; actual Gradle version still `0.2.0`, code 2 at this commit. |
| `c911084`, 2026-10-29 11:04 | Rounded/restored the historical profile-control artwork; no capability change. | Documented 2.2.0. |
| `61053cd`, 2026-10-29 11:08 | Introduced canonical semantic versioning and the retrospective feature history. | Canonical version 2.2.0. |
| `aab3f94`, 2026-10-29 14:35 | Enabled R8/resource shrinking, introduced the optimized preview variant, and replaced the shared APK with that variant. No service configuration or capture-code changes. | Canonical version 2.2.1. |

The gesture escalation precedes the reported onset on October 30 and is the strongest recent permission-level suspect. Broad event access predates the report by nearly two weeks and is a separate design problem. An optimization-only explanation has less direct support: the optimization commit did not request additional access. The exact APK installed on the affected phone remains unknown, and historical APKs can share the same `0.2.0` version label, making a version label alone insufficient to identify their source commit.

Reproduce this audit with `git log --follow -- app/app/src/main/res/xml/accessibility_service_config.xml`, then inspect `git show 5858f84`, `git show 9f0118e`, and `git show aab3f94`. The Android project lived under `android-app/` before the folder rename in `6acbc79`.

## Confirmed code defects at intake

1. **Enabled access outlived collection.** Removing bubbles did not disable the accessibility service. There was no complete in-app stop control, leaving uninstallation or Android settings as the practical escape path.
2. **System-level scope contradicted the documentation.** Java capture checks filtered Instagram roots, but the XML lacked a package filter. The app was not restricted to Instagram at the event-subscription level.
3. **A background window could qualify for reel actions.** `currentInstagramRoot()` searched all interactive windows before checking the active window. Finding an Instagram window did not establish that Instagram was currently foreground.
4. **Gesture coordinates and global Back could affect a different foreground app.** Reel clicks attempted device coordinates before semantic `ACTION_CLICK`, and Back is a global action. Root selection was not a sufficient action boundary.
5. **Pending work survived lifecycle boundaries.** Delayed reel retries were not canceled when Instagram lost focus, `onInterrupt()` did nothing, and teardown only removed the saved-profile update callback and bubbles.

These are independently actionable defects. Their existence is not proof that an unintended payment interaction occurred.

## Mitigation implemented in 2.2.2

- Restore the Instagram-only XML event filter and remove interactive-window access, gesture capability/dispatch, global Back actions, and the general overlay permission. Use the accessibility service's own overlay for the capture controls.
- Read only the active root, verify that it belongs to Instagram, and use semantic node clicks within that root. Do not search background windows or fall back to tapping screen coordinates.
- Cancel queued capture/visibility callbacks on interruption, departure, and teardown. Completely disable the service with `disableSelf()` when the capture session ends, with an explicit stop control in the app.
- Because the restored package filter suppresses other apps' events, add a 250 ms foreground watchdog while the session is enabled. Allow up to 60 seconds to enter Instagram after enablement; cap a session at 30 minutes. Leaving verified foreground Instagram ends the session rather than leaving access enabled indefinitely.
- Require a fresh, single-use start request from the dedgram app, valid for two minutes and consumed before connecting. Reject service rebinds/restarts without a new request so process death cannot reset the session limit.
- Keep catalog viewing available without enabling capture. Explain payment-app compatibility when enabling access. Captions requiring expansion must be expanded by the user before capture, since automatic global Back/navigation is removed.

This reduces access and makes stopping access concrete; it does not conceal capabilities or bypass Google Pay security. The intended tradeoff is that collection must be explicitly re-enabled for a later Instagram session.

## Validation record

Automated validation completed on 2026-10-31:

- `cd app; .\gradlew.bat :app:testDebugUnitTest :app:lintPreview :app:assemblePreview` succeeded.
- **32 tests passed**: 8 session-policy tests, 10 service lifecycle/foreground/start-request integration tests, 4 scoped reel-click tests, and 10 existing extractor/store tests. Robolectric integration tests use Android API 28; physical-device/OEM behavior remains unverified.
- Lint completed with **0 errors and 15 warnings** (locale, unused resources, accessibility/UI text, and synchronous preference persistence). The start request is persisted synchronously before leaving the app; consuming it must also persist before capture starts so a process restart cannot replay it.
- Optimized preview APK built with R8 and resource shrinking, signature verified with `apksigner`, and copied to `app/dedgram.apk`. Version name **2.2.2**, version code **20202**, package **com.dedgram.collector**.
- Inspected the actual APK with `aapt`: only `VIBRATE` is requested via `uses-permission`; no general overlay permission. Packaged accessibility XML has Instagram-only `packageNames`, no gesture capability, and only `flagReportViewIds` (no interactive-window flag). Window-content retrieval remains necessary for capture.
- Inspected packaged DEX: no `dispatchGesture` or `performGlobalAction` method references remain.
- Artifact size: **35,516 bytes**. SHA-256: `d4ffda0127be145c6d4eb47001f034da80fc467926c68b9cf5f59dd9ed782f31`. The repository APK matches the generated preview APK byte-for-byte.
- `git diff --check` passed. Profile/reel storage implementations were not changed.

Device acceptance: **not yet performed**. No connected ADB device was available during the investigation. A passing build cannot verify Google Pay recovery or Android/OEM service behavior.

| Device scenario | Expected result / evidence to record | Status |
| --- | --- | --- |
| Fresh install; open catalog without enabling accessibility | Existing/new catalogs can be viewed; no overlay setup request; capture service remains disabled in Android settings. | Pending |
| Upgrade from the affected APK with accessibility already enabled | Verify new capability list and removed overlay request in installed package; verify service lifecycle and whether an older overlay grant needs manual revocation. | Pending |
| Start from dedgram, enable within two minutes, and enter Instagram within 60 seconds | Controls appear only over verified active Instagram; profile capture and duplicate feedback work. | Pending |
| Start from dedgram and enable service, but remain in dedgram/settings | After the startup grace, Android reports the service disabled; no queued work or bubbles remain. | Pending |
| Instagram profile/reel, then Home, Recents, another app, notification shade, or lock screen | Capture work stops and bubbles disappear; service disables when foreground verification fails. Check OEM behavior for each transition. | Pending |
| Tap reel capture, then immediately switch to Google Pay | No delayed click, global Back, save callback, or overlay acts in Google Pay; verify service disabled independently in Android settings. Do not treat absence of a warning as proof of recovery from a prior block. | Pending |
| Reel with a full caption and semantically clickable likes count | Capture uses the active Instagram window; readable fields save; unclickable/unavailable fields produce explicit errors. | Pending |
| Reel with a truncated caption or nonclickable expansion/count | User expands caption before tapping; unavailable automation reports field errors without coordinate or global actions. | Pending |
| Explicit stop during capture/retries | Pending work is canceled, both controls disappear, Android service state becomes disabled, and saved catalog files remain intact. | Pending |
| Continuous Instagram session through maximum duration | Service disables at the 30-minute limit; no work resumes automatically. | Pending |
| Restart phone or reinstall/upgrade APK | Without a new start request from dedgram, the service must disable itself; verify actual Android toggle state and no resumed collection. | Pending |
| Affected phone with updated dedgram installed and capture disabled | Record phone/Android/Google Pay versions, APK hash, Android accessibility state, and whether the reported payment warning still appears. Any financial transaction requires the owner's normal deliberate action. | Pending |

## Remaining limitations

Foreground verification and a 250 ms watchdog are not an atomic boundary with an app switch. Android can delay callbacks while suspended, and an accessibility overlay can influence active-window reporting on different devices. Semantic clicks reduce the coordinate-targeting risk but still require device checks. The service may remain enabled briefly during transitions until Android processes disablement; this is not a guarantee that a payment app will never observe enabled accessibility.

Google Pay's classification and recovery policy are external to this repository. A prior block may persist after access is disabled, and installing a new APK is not proof that payment functionality is restored. Keep the issue open for affected-device verification and record whether the mitigation actually changes the reported outcome.
