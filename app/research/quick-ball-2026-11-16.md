# Quick Ball capture menu, 16 November 2026

## Interaction and visual design

Researched Xiaomi's Quick Ball pattern in its [official accessibility guide](https://www.mi.com/global/support/faq/details/KA-728047/) and MIUI-era user guides. The requested adaptation keeps three dedgram capture actions behind one docked control rather than reproducing the system's five shortcuts.

Collapsed: a thin concave crescent, hollow side facing the physical screen edge. Its 24 by 64 dp transparent window leaves Instagram touchable everywhere else. Green indicates an already-saved profile and blue indicates capture activity. Expanded: a non-focusable accessibility overlay with a mirrored fan, new outline Profile/Reel/Analyze glyphs, contrasting label backings and Close. Outside taps consume the dismissal gesture to avoid activating an Instagram control underneath. Selecting an action removes the menu and waits 100 ms before invoking its original capture entry point. Only explicit selection starts capture.

Dragging docks to either edge and stores relative height. Rotation/size changes close and reposition the menu within safe vertical margins. API 29+ excludes only the small handle from system edge-Back gestures. The first phone drag exposed Android Back intercepting an edge drag; this exclusion was added and the same cross-screen drag then stayed inside Instagram and docked on the other edge.

The menu does not take keyboard focus, request general overlay permission, alter Instagram scraping selectors, or change stored data schemas. Busy actions are disabled. Session teardown cancels delayed selections. Profile-avatar screenshots hide the complete control, including any open menu. Progress and Stop panels remain the existing controls.

The initial pill/dots draft was replaced, following user feedback, by the concave crescent visible on the phone. Dark backings behind the action labels preserve contrast over Instagram's text and buttons. All old floating-control drawables were removed.

## Automated checks

All 137 unit tests pass, including five new menu interaction tests covering outside dismissal/reopening, all three actions collapsing before dispatch, teardown canceling pending selection, busy-state/avatar hiding, and drag/dock persistence. Preview and release builds pass; preview lint has zero errors.

## Connected OnePlus / Android 15 checks

Verified collapsed size, both dock sides, inward-facing fan placement, label contrast, outside dismissal, and a drag that does not activate a capture or invoke system Back. Position survives APK upgrades/service recreation. A Profile menu capture on `missp.riyax1` saved complete profile data. One initial attempt correctly failed the avatar field because Instagram moved the header before screenshot verification; the stable retry completed with no failed fields. A Reel menu capture saved the expected canonical URL and all requested fields with no errors. The Analyze action was tested through the same fan menu, including automatic collapse and existing progress/Stop UI.

Temporary phone screenshots and raw JSON checks stay under ignored `app/app/build/`. No notification contents, avatars or signed-in account data are added to this research record.

Analyze completed the profile and every reel: seven fresh canonical reel captures, positions 0 through 6, zero reel field errors, `scan_complete: true`, and confirmed total seven in both profile and analysis metadata. The run started at epoch 1794843724492 and finished at 1794843853549. Both edge drags were verified on the phone, including the final crescent shape. Final release validation: 137 passing tests, zero preview lint errors / 28 warnings, optimized preview and release assembly successful. Repository APK SHA-256: `EC0491019E69B5F1920293557D6CD3352530C67AF4003DC5F4FBE07422143D56`.
