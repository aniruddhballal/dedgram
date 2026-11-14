# Pending reel queue: 2.4.0 validation

## 2.4.2 metric availability validation

The user clarified that a verified unexposed metric is resolved and must not hold completion back. A failed read alone is insufficient evidence of that absence. The app now records two matching action-strip observations, separated by at least 500 ms, with the visible control and next control bounding an absent count region. A present but unreadable count/placeholder, missing controls, failed caption/date/likes/plays pipeline or navigation error cannot resolve the field. The saved scope explicitly describes the observed Android UI rather than claiming no Instagram surface could ever expose the number.

`metric_availability` persists each field's status, source, observation times, sample count, successful-details check and control evidence. Resolved null values remain null and display Not exposed. Existing valid values retain their previous observation times when reused. The store also preserves additional record metadata, including the earlier manual capture provenance. Navigation errors now prevent a collected outcome even if all numeric fields have values.

All 71 unit tests passed; the optimized preview APK was built and installed as 2.4.2 / 20402. Added tests cover verified absence, malformed/present/empty count nodes, absent controls, failed panels, navigation failures, insufficient observations, historical errors without evidence, JSON round trips and retention of valid older counts.

A connected-device verification pass rechecked the 14 partial entries whose caption/date and likes/plays capture had succeeded. The first fun_fineee reel with an actual likes/plays extraction failure was left partial. All 14 rechecked entries gained confirmed availability evidence and became collected. The final phone queue is **25 collected, one partial, zero failed, zero pending**. The canonical results file contains 26 records with matching URL/captured_at checkpoints for all 26 queue entries. Evidence resolved 12 unexposed share counts, three comments counts, one repost count and one save count. The manually captured tankandoobrasil record retained its method and historical account metadata. No visible throttle or crash occurred in this pass.

The remaining partial is `De8VsImSFMm`: caption/date are saved, but likes/plays capture did not succeed. Its missing metrics have not been declared unavailable. These counts supersede earlier checkpoints below. No collector/website dataset or profile-completion status was changed; these results are in the phone's pending_reels.json and reels.json.

## Live monitoring precaution

Do not run the standard `adb shell uiautomator dump` while dedgram's accessibility capture is active. During the fresh 26-entry run, the system log at 00:35:17 showed registration of UiTestAutomationService with flags 0, immediately followed by removal of dedgram's overlay windows and service unbinding. This inspection interrupted the run after its first saved result; no dedgram crash occurred. Use shared-file pulls, logcat, dumpsys and screencap for live monitoring instead. Re-arm through the app and obtain the user's accessibility enablement to resume after this interruption. UI dumps are only used while capture is already off.

## Fresh run and 2.4.1 warning handling

After a user-performed app-data reset and restored folder/accessibility grants, the 26-entry queue was reset to null statuses and the canonical results file emptied. Following the monitoring correction above, it captured 24 reels without another service interruption, crash or visible rate limit. It then stopped on pichypeapp's Sensitive content / See reel interstitial. Direct screenshot inspection established the precise warning; the earlier generic review classification did not establish an age-verification gate.

Version 2.4.1 adds one semantic click on that exact dismissible interstitial, with a two-second clearing check. A warning that persists after the one click, a missing control, or an age/login gate still stops for review. Rate-limit classification takes priority over a simultaneously visible warning. All 64 unit tests passed and the optimized preview build was installed.

The connected-device follow-up captured `DejpZ6nostn` for pichypeapp after automatically clearing the warning: 484,085 likes, 6,952 comments, 8,667,238 plays, 273,369 shares, 17,512 reposts, 43,170 saves, expanded caption and the raw publication label 16 October. These are observations at capture time, not continuously current totals.

The last queued reel `Dd2L0NtPH4L` displayed tankandoobrasil rather than its historical expected account memesprcaf. The runner refused to attribute that account's metrics to the queued owner and stopped after its identity timeout. Copy link from the displayed reel independently exposed the requested shortcode, which supports an account-name change; final confirmation/capture remains pending. Automatic approval review rejected a subsequent direct command to reopen the URL, so the user was asked to navigate manually instead. No alternative automatic launcher was used to work around the rejection.

At that intermediate checkpoint, the phone queue had 10 collected, 15 partial and one failed identity-verification entry. The first fun_fineee reel still has unreadable likes/plays, with its caption/date saved; it has not been labelled hidden metrics or deleted.

### Final verified save

The user manually reopened the final reel and confirmed its account name. The visible username node established the exact spelling `tankandoobrasil`; the phone queue retains `memesprcaf` as `historical_expected_account` and records the copied-shortcode/user verification separately. The fresh manual capture session expired in Settings before the return to Instagram, so the final reel was captured through direct ADB UI inspection on the already-open screen, not through the queued app pipeline. No rejected URL launch was retried.

After pausing the video, the UI dump succeeded. The expanded caption node and 29 September footer were read directly; the Likes and plays panel exposed 238,501 likes and 8,182,603 plays. Reel nodes exposed 954 comments, 3,492 reposts, 55,914 shares and 6,307 saves. The saved result identifies its method as `manual_adb_ui_capture_after_user_navigation`, retains raw field observations and publication evidence, and replaces the earlier identity-timeout record. This is a manual completion, not evidence that the automated runner independently resolved a renamed account.

The canonical result file was saved and reread before the queue entry was marked collected. Final phone files have 26 unique results and matching captured_at checkpoints for all 26 entries: 11 collected, 15 partial, zero failed, zero pending. Accessibility is off. The 15 partial records retain actual field errors (mostly unreadable share counts); their missing metrics were not reclassified as hidden or unavailable. These final results supersede the earlier test counts below. Collector and website data remain unchanged.

Validated on the connected Oppo CPH2467 (ADB serial b78f7b32) using the optimized preview APK, versionName 2.4.0 and versionCode 20400. This extends the existing caption/date/metrics capture pipeline; it does not import phone results into collector or website datasets.

## Build and automated checks

- `:app:testDebugUnitTest :app:assemblePreview` completed successfully: 59 tests, zero failures or errors.
- Queue tests cover validation, metadata preservation, sequential capture, save-before-checkpoint ordering, storage failure, stopping and visible rate-limit handling. UI placement, bounded navigation grace, session expiration, retained observations and access-gate classification have regression coverage.
- `app/dedgram.apk` matches `app/app/build/outputs/apk/preview/app-preview.apk` byte for byte. SHA-256: `6DCAE06A165890D1D788F2D326C2D53D3F8765F0D68B03A17DFFDCAC59AA4DA7`.
- The installed package reports 2.4.0 / 20400. The existing preview task generated the tracked APK; no separate release signing procedure was introduced.

## Connected-device results

A 26-entry queue used existing partial/review reel URLs. The cumulative test includes interrupted and earlier development attempts, followed by consecutive captures on the corrected build. The phone files ended in this state:

| Queue status | Entries |
| --- | ---: |
| collected | 8 |
| partial | 13 |
| failed | 3 |
| needs_review | 1 |
| null (pending) | 1 |

The canonical `Documents/dedgram/reels.json` contains 25 records. Each of the 25 terminal queue entries matches a saved result by shortcode and captured_at. Partial results retain field errors instead of claiming missing metrics were collected. The three failures came from an interrupted launch and earlier load/identity verification timeouts; these are not deletion findings and remain terminal until deliberately reset.

The corrected runner advanced automatically through consecutive reels, including reels from the same account with repeated captions. It saved to the exact shared file and skipped already checkpointed entries on resume. The render fingerprint includes visible metric observations as well as account/caption; it still refuses an unverified transition rather than attaching stale content to a new URL.

At pichypeapp reel `DejpZ6nostn`, an age restriction produced `needs_review`, saved an issue record and stopped the queue. The final memesprcaf entry remained pending and was not opened by the runner. Accessibility was confirmed disabled after the stop. No real visible rate limit occurred during this test; rate-limit stopping was verified with automated tests. Native UI capture cannot inspect Instagram's hidden HTTP responses.

## Storage correction verified during testing

Android's legacy MediaStore route initially created numbered copies when the existing computer-created `reels.json` was not owned by the app. The test caught this before release. The app now requests a persisted grant to the exact Documents/dedgram folder and accesses its exact child documents. It rejects unexpected renamed output files.

Four numbered development outputs were backed up locally and their records recovered into the canonical file before those four copies were removed. The user-authorized old single capture was cleared before the queue test. Existing `profilesold.json` and `reelsold.json` were preserved. No collector or website data files were changed. Subsequent saves accumulated in the canonical file; no numbered copies remained. The folder grant survived an in-place APK upgrade.

## Interaction and remaining limits

Start/resume still requires a fresh user-enabled accessibility session. The cancelled request to extend sessions to an hour was not implemented: the existing 30-minute maximum, lock/foreign-app handling and explicit Stop remain. A queue-only unknown-window grace of at most eight seconds handles deep-link transitions without reading or acting on a foreign window.

Queue results record the requested URL and identity source. Instagram does not always expose an independent shortcode in accessibility nodes, so deep-link/account/render verification is not equivalent to independent URL confirmation. Age, sensitive-content and login gates are review states, not successful completion or missing-metric resolution. Failed and review entries are not retried automatically. Opening dedgram during collection ends the current capture session; saved statuses make a later resume possible.
