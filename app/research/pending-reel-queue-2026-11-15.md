# Pending reel queue: 2.4.0 validation

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
