# Reel caption and posting-time investigation

Research date: 14 November 2026 (Asia/Kolkata). Research only; no APK built or installed, no capture code changed.

## Verification limits

The initial combined ADB command was rejected with "blocked by policy". After the user explicitly requested a retry, separate commands succeeded in opening a reel, taking screenshots, tapping the caption, dismissing its sheet, and opening Likes and plays. UI Automator could not obtain an idle state while the reel played, so semantic selectors remain unverified. No browser collector was restarted. The interaction sequence below has now been visually tested on one reel; recent relative-age formats and long-caption scrolling still require experiments.

## Web evidence

- [OnlineMarketing.de's firsthand test, 31 March 2025](https://onlinemarketing.de/social-media-marketing/instagram-zeigt-an-wann-reel-gepostet-wurde): reports posting dates at the end of reel captions, with its own screenshots showing a calendar date and a relative two-day label. This directly supports testing the caption footer, but does not establish universal age thresholds or this phone's controls.
- [Ben Grubb's own timestamp-extension description](https://bengrubb.com.au/2026/01/15/how-to-see-the-exact-time-an-instagram-post-was-published-chrome-extension/): describes exact timestamps in website metadata. This is a separate source from an Android UI observation; website precision must not be attributed to an app label.
- [Redact's description of its date tool](https://redact.dev/tools/instagram-date-extractor): describes relative day/week labels and older calendar dates. Its claim of exact time derived from identifiers is not independently validated here and is not adopted as publication-time evidence.

Search results also describe hour labels, including short forms, but no authoritative, universal switch table was established for minutes, hours, days, weeks, or older dates. App version, screen, language and rollout may differ. Do not implement an assumed rule that every post becomes a calendar date after 24 hours, or a week label after seven days.

## Existing app findings

- `ReelAccessibilityExtractor.DATE_PATTERN` matches only an English month and day. It does not preserve a trailing year and does not recognize relative ages.
- `datePosted()` scans entries for the first matching substring. A date inside caption prose could therefore be mistaken for the publication label.
- `caption()` selects a scored text candidate, rather than assembling and verifying an expanded caption from a dedicated surface.
- `captionLooksTruncated()` flags ellipses, which can also be intentional caption text.
- `captureCurrentReel()` reads the initial reel snapshot before opening Likes and plays. It does not expand the caption first.
- The record stores one capture timestamp as epoch-millisecond text, but lacks per-field observation time, timezone, locale and precision for publication-label evidence.

## Evidence to preserve in a future implementation

Illustrative schema, not an actual phone observation:

```json
{
  "publication_observation": {
    "raw_text": "16h",
    "observed_at": "2026-11-14T15:00:00+05:30",
    "timezone": "Asia/Kolkata",
    "locale": "en-IN",
    "source": "instagram_android_expanded_caption_footer",
    "kind": "relative",
    "relative_value": 16,
    "relative_unit": "hour",
    "rounding_rule": "unknown",
    "exact_publication_time": null
  }
}
```

Keep raw text even if parsing fails. A label such as `12 July` must retain its missing-year ambiguity; a year must not be silently invented. If an accessibility description exposes a fuller date than visible text, preserve both, with their sources.

At 15:00 IST, subtracting 16 hours gives 23:00 the previous day as a point estimate. If a UI is independently confirmed to floor elapsed hours, `16h` would imply an age between 16 and 17 hours, rather than an exact timestamp. Rounding behavior is unverified here. Store any derived estimate or bounds separately from observations, with explicit assumptions.

## Proposed one-tap state machine, pending phone validation

1. Confirm the current reel identity and collect exposed action counts.
2. Find the caption's semantic expansion action within this reel; do not use a fixed screen coordinate.
3. Expand, await stable caption content, and scroll only within that surface if needed.
4. Preserve the complete caption and publication footer verbatim, with separate observation times. Do not infer publication time from comments, caption prose, or repost age.
5. Dismiss only the caption surface opened by capture; verify the same reel is still active.
6. Open Likes and plays through its semantic control, await its counts, and capture them independently.
7. Save each field's evidence and errors. Access gates or unknown selectors remain reviewable; a missing read does not establish hidden data.
8. Restore the initial viewing state if safe and verifiable. Never like, follow, share, or comment as part of capture.

## Phone experiments still required

Test saved reels with short and long captions, an older calendar date, a year-bearing date, and newly posted reels covering minute/hour/day/week labels. The existing older review links alone cannot establish all recent-age formats.

For each, record: reel URL; app version and language; starting surface; expansion control text/resource ID/action; whether it opens inline or as a sheet; whether the date is initially visible or requires scrolling; raw date label and accessibility description; full caption boundary; dismissal action; whether Likes and plays still opens; reel identity before and after; observation times.

No selector, click sequence, or complete-caption guarantee should be considered verified until those experiments succeed on the phone.

## Successful phone retry: first visual experiment

Reel: https://www.instagram.com/reel/DddW5GHyKy_/ (`fun_fineee`).

- Opening the link directly in the Instagram Android app succeeded.
- The collapsed caption showed `CID funny` with emojis and an ellipsis.
- Tapping the caption text opened a combined caption/comments sheet. The complete short caption included additional lines, emojis and `daya`.
- The publication footer read exactly `19 September`, with no visible year or time. The sheet also explicitly said `No comments yet`. The caption itself contains literal ellipsis lines, confirming that ellipses alone do not reliably prove truncation.
- Android Back dismissed the caption/comments sheet and returned to the same reel.
- Tapping the `Likes` text (not the heart icon) then opened `Likes and plays`. It showed 137 plays and an explicit owner-only likes message. No like, follow, comment or share action was performed.
- Therefore caption expansion did not prevent opening Likes and plays when the first sheet was dismissed before opening the second.
- These were visual coordinate-based research taps, not verified accessibility selectors suitable for shipping in the app. Screenshots remain in the local temporary directory. No APK was built or installed. No collector record was promoted based on this experiment.

## One-tap implementation device tests (work in progress)

Tests use the actual installed app's target/logo button, not a direct call to its parser. The existing phone reel JSON was backed up locally before installation. No collector or website dataset is changed by these tests.

- `fun_fineee`: the initial implementation captured the expanded short caption and `19 September`, observation time, Asia/Kolkata timezone, en-GB locale, plays, and explicit owner-only likes. Found and fixed the accessibility `username said` caption prefix and an empty-comments detection gap.
- `shubham2peak`: displayed likes, comments, reposts, shares, saves and plays were captured, but the short `Brah ?` caption was missed. Added caption selection priority and a regression test excluding playback descriptions.
- `otakuoutfitops`: captured the full multi-paragraph caption and `17 hours ago`, with observation metadata. Caption sheet dismissal failed, so plays remained an explicit error. Added Instagram-scoped ACTION_DISMISS support, without global Back or injected coordinate gestures in the APK.
- `nmillz`: found hidden background-post accessibility nodes contaminating caption selection, plus a `Reactions and plays` title variant. Both have regression coverage in the next test build. This failed capture remains explicitly marked with field errors; it is not a verified complete record.

Latest local unit/build check at this stage: 42 tests passed; optimized preview APK built. Further device verification of the last fixes is required before final packaging.

## Final implementation verification

The final source passed icon-driven live captures on the connected phone (Instagram 456.0.0.0.42):

| Account | Caption/date result | Metrics result | Navigation |
| --- | --- | --- | --- |
| nicknilsson1 | Complete long multi-paragraph caption with URL and hashtags; raw `19 hours ago` | Likes 9,905; comments 170; plays 363,154; shares 3,175; reposts 76; saves 936 | Returned to the reel |
| avalonrivera | Complete short caption; raw `25 August` | Likes 16,430; comments 524; plays 321,217; shares 3,657; reposts 227; saves 3,992 | Returned to the reel |
| fun_fineee | Complete short caption including literal ellipsis lines; raw `19 September` | Plays 142; explicit zero comments; owner-only likes; unexposed shares/reposts/saves remain unreadable | Returned to the reel |

Each successful posting-label capture includes UTC observation time, epoch milliseconds, Asia/Kolkata timezone and en-GB locale. Observed counts are snapshots from these tests. No derived exact publication date was invented.

A temporary instrumentation-only UI probe was built outside the repository to inspect Instagram nodes after UI Automator repeatedly failed to reach an idle state. It read only an active Instagram root and was uninstalled after diagnosis. This established that some off-screen nodes have negative horizontal bounds despite `visible=true`, that caption expansion exposes a See more node action, and that the caption sheet exposes no working dismiss action on this layout. Screen intersection checks and guarded sheet-specific Back navigation address those findings. An intermediate selector also exposed a Windows text-encoding problem with literal ellipsis characters; regression fixtures and matching now use Java Unicode escapes.

Remaining limitations: age/security/sensitive restrictions were not exercised in these final live tests; very recent minute labels and weekly/year-bearing labels have parser coverage but were not all located live. FYP captures may still have an empty shortcode because the active UI does not expose a URL. Counts absent from Instagram's UI remain explicit errors. No production collector or website records were modified or promoted by the phone tests. The phone's earlier records were backed up to a local temporary JSON before testing.

Final packaging follows the root VERSION file, optimized preview build, repository `app/dedgram.apk`, and `adb install -r` upgrade convention. All work remains uncommitted pending user review.

Final release validation: VERSION 2.3.0, Android versionCode 20300; 43 Android unit tests passed and optimized preview build succeeded. The repository APK and preview output have identical SHA-256 E61E0CFA4E9D3180695B41F8A31CEDB5DC9E28421404E717F1BBAC97CAEF4AE6. The upgraded phone package reports versionName 2.3.0 and versionCode 20300. All 16 original phone reel records retain every original field unchanged; 9 test captures were appended. The final install left accessibility capture OFF as intended; a new session must be started in the app before the next capture.
