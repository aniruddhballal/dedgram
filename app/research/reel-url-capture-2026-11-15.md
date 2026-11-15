# Automatic reel URLs - Android 2.5.4

## Existing behavior

Queued captures already received canonical URLs from pending_reels.json. Ordinary floating-icon captures only obtained a shortcode if Instagram happened to expose one in its accessibility text; most ordinary records had no URL. They therefore could not reliably reopen the captured reel.

## Observed controls and implementation

Research on the connected OnePlus CPH2467 (Android API 35) confirmed a Share control with resource ID `direct_share_button`. Its Instagram sheet exposes a `button` whose description is exactly Copy link, and an equivalent `label`. `background_dimmer` with description Dismiss closes that sheet. Production selectors inspect only those exact controls; they never select share recipients or activate Send.

One reel-icon tap now records the original reel observations, checks their stability, opens Share and activates Copy link, reads the newly copied destination, returns to the original reel and verifies matching account/caption/count observations. Only then does the existing caption/date/Likes and plays pipeline continue. Changed reel observations discard the copied URL. URL errors are saved independently so an unreadable link cannot silently become a complete capture.

Android restricts background clipboard access. A visible, short-lived accessibility overlay requests focus to read the copied link; it is removed immediately afterward. The reader requires a clipboard timestamp at or after the issued Copy link action, rejects future/stale timestamps, accepts only one plain-text item, and canonicalizes the destination before returning it. The full clipboard text is not stored. A bounded exception to the active-root check covers only the app's own overlay and its focus-restoration gap; foreign-app roots still stop the session without traversal. The reader requires API 26 for timestamp verification. No coordinate taps, background Instagram root lookup, network scraping or app-to-contact messages are used in production.

Canonicalization accepts Instagram reel destinations, preserves the shortcode and produces `https://www.instagram.com/reel/<shortcode>/`. Tracking query strings, fragments and share prose are omitted. Ambiguous different destinations, lookalike hosts, unsupported paths and malformed URLs are rejected. The JSON adds nullable `url_error` and `url_observation` with copy/verification times and source. Existing queued URLs keep their original workflow. Legacy records are not given guessed links. Expanded catalog entries show the clean URL and an Open reel action.

## Device verification

- A single icon tap on the normal reposted reel DSuwCXpDJ_v saved `https://www.instagram.com/reel/DSuwCXpDJ_v/`, with source `instagram_copy_link_verified_reel`, no URL/navigation errors, expanded caption and 2,713 plays. Reopening the clean link returned to reposted's rug-shaving reel, matching the original author and caption.
- After the user excluded ads, no ad-specific capture work was pursued. A clearly sponsored reel is skipped for ordinary icon capture, using Instagram's explicit Sponsored Reel description rather than words in a caption. The agent-created ad test record was removed from the phone after backing up the current document; unrelated records were preserved.
- On the final optimized 2.5.4 build, a single icon tap on the different normal reposted reel DStZwcvDIWA saved `https://www.instagram.com/reel/DStZwcvDIWA/`, with no URL/navigation errors, expanded caption and 21,174 plays. This replaced the clipboard destination from the earlier reel, demonstrating that the earlier copied link was not reused.
- The final catalog's Open reel button reopened DStZwcvDIWA to reposted's octopus reel. Its visible caption, "Octopuses are among the most intelligent …", matched the captured full caption. The first normal reel's clean link also reopened its matching rug-shaving content. Capture was off at the end of testing.

Research-only UI dumps were taken with capture off. Live capture monitoring used shared-file pulls, logs and screenshots to avoid UI Automator disabling the accessibility service. The test fixture for the Share sheet contains only Copy link and Dismiss controls; recipient rows were excluded, and the raw share-sheet research dump was removed. Intermediate results remain under the ignored Android build directory.

## Validation

All 108 unit tests pass. New cases cover tracking removal, plural route normalization, untrusted/ambiguous URLs, stale/future clipboard timestamps, URL metadata/error round trips, unrelated share actions, changed reels before/after copying, normal single-start operation and explicit ad detection. Debug, optimized preview and optimized release assembly pass; preview lint has no errors. The repository APK is synchronized through assemblePreview and installed as an in-place upgrade.

Installed package metadata confirms 2.5.4 / 20504. Repository and preview APK SHA-256 is `5CA0CA46960C4B92244BA9180A385872064505D72C1F6E4BE0BCB466B2C6FF91`. Preview lint reports 0 errors and 27 warnings. Comparison of the backed-up and cleaned test documents verified unrelated record data was preserved when removing the agent-created ad test entry.
