package com.dedgram.collector;

import android.view.accessibility.AccessibilityNodeInfo;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;

import java.util.Collections;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, shadows = ProfileAccessibilityServiceTest.CountingNodeShadow.class)
@LooperMode(LooperMode.Mode.PAUSED)
public final class ReelAccessibilityExtractorTest {
    private static final String INSTAGRAM = CaptureSession.INSTAGRAM_PACKAGE;
    private static final String FOREIGN = "com.example.payment";

    @Test
    public void clickableInstagramCountUsesNodeAction() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo count = node(INSTAGRAM, "125", true);
        shadowOf(root).addChild(count);

        assertTrue(ReelAccessibilityExtractor.clickLikesCount(root));

        assertEquals(Collections.singletonList(AccessibilityNodeInfo.ACTION_CLICK),
                shadowOf(count).getPerformedActions());
        // Confirms the traversal probe also observes ordinary extraction.
        assertTrue(ProfileAccessibilityServiceTest.CountingNodeShadow.treeReads > 0);
    }

    @Test
    public void foreignRootIsRejectedBeforeTraversalOrActions() {
        AccessibilityNodeInfo root = reel(FOREIGN);
        AccessibilityNodeInfo count = node(FOREIGN, "125", true);
        shadowOf(root).addChild(count);
        ProfileAccessibilityServiceTest.CountingNodeShadow.treeReads = 0;

        assertFalse(ReelAccessibilityExtractor.clickLikesCount(root));

        assertEquals(0, ProfileAccessibilityServiceTest.CountingNodeShadow.treeReads);
        assertTrue(shadowOf(count).getPerformedActions().isEmpty());
    }

    @Test
    public void foreignCountInsideInstagramRootCannotReceiveActions() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo count = node(FOREIGN, "125", true);
        shadowOf(root).addChild(count);

        assertFalse(ReelAccessibilityExtractor.clickLikesCount(root));

        assertTrue(shadowOf(count).getPerformedActions().isEmpty());
    }

    @Test
    public void unclickableCountDoesNotFallBackToAnActionOnForeignParent() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo parent = node(FOREIGN, "", true);
        AccessibilityNodeInfo count = node(INSTAGRAM, "125", false);
        shadowOf(root).addChild(parent);
        shadowOf(parent).addChild(count);

        assertFalse(ReelAccessibilityExtractor.clickLikesCount(root));

        assertTrue(shadowOf(count).getPerformedActions().isEmpty());
        assertTrue(shadowOf(parent).getPerformedActions().isEmpty());
    }

    @Test public void preservesRelativeLabelsAndYearWithoutMatchingCaptionProse() {
        AccessibilityNodeInfo root = node(INSTAGRAM, "", false);
        shadowOf(root).addChild(node(INSTAGRAM, "We met on 12 July 2020 and filmed this", false));
        AccessibilityNodeInfo date = node(INSTAGRAM, "16 hours ago", false);
        shadowOf(root).addChild(date);
        assertEquals("16 hours ago", ReelAccessibilityExtractor.snapshot(root).datePosted());
        date.setText("12 July 2023");
        assertEquals("12 July 2023", ReelAccessibilityExtractor.snapshot(root).datePosted());
        date.setText("2w");
        assertEquals("2w", ReelAccessibilityExtractor.snapshot(root).datePosted());
    }

    @Test public void readsIdentifiedPlaysWhenLikesAreHidden() {
        AccessibilityNodeInfo root = node(INSTAGRAM, "", false);
        shadowOf(root).addChild(node(INSTAGRAM, "Likes and plays", false));
        AccessibilityNodeInfo plays = node(INSTAGRAM, "137", false);
        plays.setViewIdResourceName("com.instagram.android:id/video_view_count_text");
        shadowOf(root).addChild(plays);
        shadowOf(root).addChild(node(INSTAGRAM, "Only author can see the total number of likes on this reel.", false));
        assertEquals(Long.valueOf(137), ReelAccessibilityExtractor.snapshot(root).playsFromSheet());
        assertTrue(ReelAccessibilityExtractor.snapshot(root).likesHidden());
    }

    @Test public void missingLikeDoesNotConsumeACommentCount() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        shadowOf(root).addChild(node(INSTAGRAM, "View likes", true));
        shadowOf(root).addChild(node(INSTAGRAM, "Comment", true));
        shadowOf(root).addChild(node(INSTAGRAM, "9", false));
        assertEquals(null, ReelAccessibilityExtractor.snapshot(root).metric("like"));
    }

    @Test public void publicationEvidenceSurvivesSerialization() throws Exception {
        Reel reel = new Reel();
        reel.datePosted = "16h";
        reel.captionExpanded = true;
        reel.publicationObservation = new org.json.JSONObject().put("raw_text", "16h").put("observed_at", "2026-11-14T10:00:00Z").put("timezone", "Asia/Kolkata");
        Reel copy = Reel.fromJson(reel.toJson());
        assertEquals("16h", copy.datePosted);
        assertTrue(copy.captionExpanded);
        assertEquals("Asia/Kolkata", copy.publicationObservation.getString("timezone"));
    }

    @Test public void shortCaptionWinsOverMediaPlaybackDescription() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo media = node(INSTAGRAM, "", false);
        media.setContentDescription("Reel by author. Double-tap to play or pause.");
        shadowOf(root).addChild(media);
        AccessibilityNodeInfo caption = node(INSTAGRAM, "", true);
        caption.setContentDescription("Brah \u2026"); shadowOf(root).addChild(caption);
        assertEquals("Brah \u2026", ReelAccessibilityExtractor.snapshot(root).caption());
        assertTrue(ReelAccessibilityExtractor.clickCaption(root));
    }

    @Test public void sheetDismissalIsScopedAndNeverClicksLike() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo like = node(INSTAGRAM, "Like", true); shadowOf(root).addChild(like);
        assertFalse(ReelAccessibilityExtractor.dismissSheet(root));
        assertTrue(shadowOf(like).getPerformedActions().isEmpty());
        AccessibilityNodeInfo dismiss = node(INSTAGRAM, "", true);
        dismiss.setContentDescription("Dismiss");shadowOf(root).addChild(dismiss);
        assertTrue(ReelAccessibilityExtractor.dismissSheet(root));
        assertTrue(shadowOf(like).getPerformedActions().isEmpty());
    }

    @Test public void usesSheetDismissActionWithoutGlobalNavigation() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo sheet = node(INSTAGRAM, "", false);
        sheet.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_DISMISS);shadowOf(root).addChild(sheet);
        assertTrue(ReelAccessibilityExtractor.dismissSheet(root));
        assertEquals(Collections.singletonList(AccessibilityNodeInfo.ACTION_DISMISS), shadowOf(sheet).getPerformedActions());
    }

    @Test public void panelNumbersWithoutMetricEvidenceAreNotGuessed() {
        AccessibilityNodeInfo root = node(INSTAGRAM, "", false);
        shadowOf(root).addChild(node(INSTAGRAM, "Likes and plays", false));
        shadowOf(root).addChild(node(INSTAGRAM, "42", false));
        shadowOf(root).addChild(node(INSTAGRAM, "999", false));
        assertEquals(null, ReelAccessibilityExtractor.snapshot(root).playsFromSheet());
    }

    @Test public void ignoresHiddenBackgroundPostCaptionAndDate() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);
        AccessibilityNodeInfo hidden = node(INSTAGRAM, "January 1 2020", true);
        hidden.setViewIdResourceName("com.instagram.android:id/caption");hidden.setVisibleToUser(false);
        shadowOf(root).addChild(hidden);
        AccessibilityNodeInfo caption = node(INSTAGRAM, "", true);caption.setContentDescription("Brah \u2026");shadowOf(root).addChild(caption);
        assertEquals("Brah \u2026", ReelAccessibilityExtractor.snapshot(root).caption());
        assertEquals("", ReelAccessibilityExtractor.snapshot(root).datePosted());
    }

    @Test public void recognizesReactionsAndPlaysTitle() {
        AccessibilityNodeInfo root = node(INSTAGRAM, "Reactions and plays", false);
        assertTrue(ReelAccessibilityExtractor.snapshot(root).hasLikesAndPlaysSheet());
    }

    @Test public void ignoresOffscreenNodesIncorrectlyMarkedVisible() {
        AccessibilityNodeInfo root = reel(INSTAGRAM);root.setBoundsInScreen(new android.graphics.Rect(0,0,1080,2400));
        AccessibilityNodeInfo hidden = node(INSTAGRAM, "January 1 2020", true);
        hidden.setBoundsInScreen(new android.graphics.Rect(-1080,100,-100,200));shadowOf(root).addChild(hidden);
        assertEquals("", ReelAccessibilityExtractor.snapshot(root).datePosted());
    }

    @Test public void queueDistinguishesCounter429FromAccessErrorsAndUnavailablePages() {
        AccessibilityNodeInfo root=node(INSTAGRAM,"429",false);
        assertEquals(null,ReelAccessibilityExtractor.snapshot(root).queueIssue());
        root.setText("HTTP 429");assertEquals("rate_limited",ReelAccessibilityExtractor.snapshot(root).queueIssue());
        root.setText("This page isn't available.");assertEquals("deleted",ReelAccessibilityExtractor.snapshot(root).queueIssue());
        root.setText("Sensitive content");assertEquals("needs_review",ReelAccessibilityExtractor.snapshot(root).queueIssue());
        root.setText("Age-restricted content");assertEquals("needs_review",ReelAccessibilityExtractor.snapshot(root).queueIssue());
    }

    private static AccessibilityNodeInfo reel(String packageName) {
        AccessibilityNodeInfo root = node(packageName, "", false);
        shadowOf(root).addChild(node(packageName, "like", false));
        return root;
    }

    private static AccessibilityNodeInfo node(String packageName, String text, boolean clickable) {
        AccessibilityNodeInfo node = AccessibilityNodeInfo.obtain();
        node.setPackageName(packageName);
        node.setText(text);
        node.setVisibleToUser(true);
        node.setClickable(clickable);
        shadowOf(node).setOnPerformActionListener((action, arguments) -> true);
        return node;
    }
}
