package com.dedgram.collector;

import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class ReelMetricAvailabilityTest {
    private Reel missingShare() {
        Reel r=PendingReelsTest.complete();r.shares=null;r.sharesError="Could not read shares";r.captureStage="finished";return r;
    }
    private static AccessibilityNodeInfo node(String text,String id) {
        AccessibilityNodeInfo n=AccessibilityNodeInfo.obtain();n.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);
        n.setText(text);n.setVisibleToUser(true);if(id!=null)n.setViewIdResourceName("com.instagram.android:id/"+id);return n;
    }
    private ReelAccessibilityExtractor.Snapshot grid(String count) {
        AccessibilityNodeInfo root=node("",null);
        shadowOf(root).addChild(node("owner","clips_author_username"));
        shadowOf(root).addChild(node("Repost",null));shadowOf(root).addChild(node("1","repost_count"));
        shadowOf(root).addChild(node("Share","direct_share_button"));
        if(count!=null)shadowOf(root).addChild(node(count,"ufi_text_component"));
        shadowOf(root).addChild(node("Save","save_button"));shadowOf(root).addChild(node("1","save_count"));
        shadowOf(root).addChild(node("More","clips_ufi_more_button_component"));
        return ReelAccessibilityExtractor.snapshot(root);
    }
    private void observeTwice(Reel r,String secondCount) {
        ReelMetricAvailability.observe(r,grid(null),true);
        ReelMetricAvailability.observe(r,grid(secondCount),false);
        r.confirmedMetricObservationAt=r.initialMetricObservationAt+1000;
    }
    @Test public void verifiedAbsentCountIsResolvedAndNeverFabricatedAsZero()throws Exception {
        Reel r=missingShare();observeTwice(r,null);ReelMetricAvailability.resolve(r);
        assertNull(r.shares);assertNull(r.sharesError);assertTrue(r.metricNotExposed("shares"));
        assertEquals("collected",PendingReels.outcome(r));
        Reel copy=Reel.fromJson(r.toJson());assertTrue(copy.metricNotExposed("shares"));assertEquals("collected",PendingReels.outcome(copy));
    }
    @Test public void malformedOrPresentCountCannotBecomeNotExposed() {
        for(String count:new String[]{"not readable","12",""}) {
            Reel r=missingShare();observeTwice(r,count);ReelMetricAvailability.resolve(r);
            assertFalse(r.metricNotExposed("shares"));assertNotNull(r.sharesError);assertEquals("partial",PendingReels.outcome(r));
        }
    }
    @Test public void failedPanelAndNavigationCannotResolveAbsence() {
        Reel r=missingShare();observeTwice(r,null);r.viewsOrPlaysError="Panel failed";
        ReelMetricAvailability.resolve(r);assertFalse(r.metricNotExposed("shares"));
        r.viewsOrPlaysError=null;r.navigationError="Wrong sheet";
        ReelMetricAvailability.resolve(r);assertEquals("partial",PendingReels.outcome(r));
    }
    @Test public void singleOrTooCloseObservationIsInsufficient() {
        Reel r=missingShare();ReelMetricAvailability.observe(r,grid(null),true);
        ReelMetricAvailability.resolve(r);assertFalse(r.metricNotExposed("shares"));
        ReelMetricAvailability.observe(r,grid(null),false);r.confirmedMetricObservationAt=r.initialMetricObservationAt+100;
        ReelMetricAvailability.resolve(r);assertFalse(r.metricNotExposed("shares"));
    }
    @Test public void missingControlsAreNotEvidence() {
        AccessibilityNodeInfo root=node("owner","clips_author_username");
        assertNull(ReelAccessibilityExtractor.snapshot(root).absentCountControl("share"));
    }
    @Test public void oldErrorsDoNotGainUnavailabilityWithoutNewEvidence()throws Exception {
        Reel r=Reel.fromJson(missingShare().toJson());ReelMetricAvailability.resolve(r);
        assertFalse(r.metricNotExposed("shares"));assertEquals("partial",PendingReels.outcome(r));
        JSONObject legacy=r.toJson().put("capture_method","manual_adb_ui_capture_after_user_navigation");
        assertEquals(legacy.getString("capture_method"),Reel.fromJson(legacy).toJson().getString("capture_method"));
    }
    @Test public void validOlderMetricIsRetainedWithTimeEvenWhenCurrentlyUnexposed()throws Exception {
        Reel old=PendingReelsTest.complete();old.capturedAt="100";old.shares=99L;
        Reel latest=missingShare();observeTwice(latest,null);ReelMetricAvailability.resolve(latest);latest.retainMissingFrom(old);
        assertEquals(Long.valueOf(99),latest.shares);assertEquals("100",latest.retainedObservations.getJSONObject("shares").getString("captured_at"));
        assertEquals("collected",PendingReels.outcome(latest));
    }
}
