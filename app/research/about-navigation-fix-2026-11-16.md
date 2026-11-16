# About-page navigation failure, 16 November 2026

## Reproduction and exact cause

Complete analysis on `missp.riyax1` stopped before reel traversal, with `About screen identity or stable content could not be verified.` Country, join date and former username availability were failed rather than absent.

The diagnostic phone run first accepted About: at 20:17:03.916 the title, target username and authenticity explanation matched; at 20:17:04.569 the same content was stable. After the next scroll, the first title belonged to the signed-in account instead. All eight subsequent About checks failed. Thus loading or a missing About identity was not the original cause.

The old selectors searched the entire Instagram window for any scrollable node. This short About screen exposes a scrollable `swipeable_nav_view_pager_inner_recycler_view`, an ancestor of its `bloks_container`. The actual About content has no scrollable descendant. The generic scroll acted on the outer navigation pager and changed Instagram tabs. Other previously tested About fixtures had no scrollable outer navigation container, so their tests did not exercise this path. The live accessibility window can also retain invisible screens; those are absent from the UIAutomator fixture.

## Correction

Only visible descendants of About's `bloks_container` can receive About scroll actions. No scrollable node in that scope means the short page is fully inspected. Snapshot traversal and action lookup exclude invisible subtrees. The target username and About title remain required; missing controls are not silently accepted.

The real sanitized phone fixture `about-missp.xml` verifies country India, join date October 2026, and former usernames not shown. A regression makes every scroll action succeed but asserts that the outer navigation pager is never called. Another regression places a hidden profile ahead of About and verifies it cannot supply the title.

The first fixed phone run completed the profile with no navigation error and opened its reel viewer. It then exposed a separate copied-link timeout: the focus event arrived about 1.2 seconds after overlay creation, and main-thread processing exceeded the old 1.8-second deadline. The bounded read window now allows six seconds, retaining the strict after-copy timestamp check.

Diagnostic full-window logging was removed; no signed-in account data is stored in this document or test fixture.

## Paging guard follow-up

After the focus timeout adjustment, a run saved three reels without field errors, then stopped with `Reel changed before automatic paging.` The paging fingerprint includes live like/comment counts, which can change while details are being captured. Advancing now also accepts an unchanged owner/caption with the same explicit collection index and count; it still rejects changed content or owner. Identical adjacent captions can advance only when collection metadata proves a different expected position. Canonical URL verification and unique-shortcode coverage remain required for every saved reel and final total. Two added regressions cover count changes during capture and identical captions across distinct positions.

## Final connected-phone verification

The optimized 2.6.1 build completed `missp.riyax1` from one analysis tap: profile complete, India and October 2026 captured, former usernames correctly not shown, seven canonical reel URLs with zero reel field errors, and confirmed total seven. Every collection position 0 through 6 was saved. The terminal action remained unavailable across repeated stable observations. The saved analysis and profile total both equal seven. All 132 tests pass; preview/release builds pass and preview lint reports zero errors / 29 warnings. Aggregate evidence is in `about-navigation-evidence-2026-11-16.json`.
