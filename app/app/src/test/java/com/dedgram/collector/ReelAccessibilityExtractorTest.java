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

    private static AccessibilityNodeInfo reel(String packageName) {
        AccessibilityNodeInfo root = node(packageName, "", false);
        shadowOf(root).addChild(node(packageName, "like", false));
        return root;
    }

    private static AccessibilityNodeInfo node(String packageName, String text, boolean clickable) {
        AccessibilityNodeInfo node = AccessibilityNodeInfo.obtain();
        node.setPackageName(packageName);
        node.setText(text);
        node.setClickable(clickable);
        shadowOf(node).setOnPerformActionListener((action, arguments) -> true);
        return node;
    }
}
