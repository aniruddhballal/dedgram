package com.dedgram.collector;

import android.accessibilityservice.AccessibilityService;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;
import org.robolectric.annotation.LooperMode;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.shadows.ShadowAccessibilityNodeInfo;
import org.robolectric.shadows.ShadowAccessibilityService;
import org.robolectric.util.ReflectionHelpers;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

/** Exercises the service lifecycle and queued work, rather than only its session policy. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, shadows = {
        ProfileAccessibilityServiceTest.ForegroundServiceShadow.class,
        ProfileAccessibilityServiceTest.CountingNodeShadow.class
})
@LooperMode(LooperMode.Mode.PAUSED)
public final class ProfileAccessibilityServiceTest {
    private ServiceController<ProfileAccessibilityService> controller;
    private ProfileAccessibilityService service;
    private ForegroundServiceShadow serviceShadow;
    private Handler captureHandler;

    @Before
    public void connectService() {
        CountingNodeShadow.treeReads = 0;
        controller = Robolectric.buildService(ProfileAccessibilityService.class).create();
        service = controller.get();
        serviceShadow = Shadow.extract(service);
        shadowOf((KeyguardManager) service.getSystemService(Context.KEYGUARD_SERVICE))
                .setKeyguardLocked(false);
        shadowOf((PowerManager) service.getSystemService(Context.POWER_SERVICE))
                .setIsInteractive(true);
        ProfileAccessibilityService.prepareCaptureSession(service);
        service.onServiceConnected();
        // Capture retries and foreground checks share this private queue. A sentinel
        // verifies teardown removes all queued work, including anonymous callbacks.
        captureHandler = ReflectionHelpers.getField(service, "mainHandler");
    }

    @After
    public void destroyService() {
        if (controller != null) controller.destroy();
    }

    @Test
    public void interruptDisablesAccessibilityAndCancelsPendingWork() {
        AtomicInteger callbacks = enqueueDelayedWork();

        service.onInterrupt();

        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void unbindCancelsPendingWorkAndClearsStopHandle() {
        AtomicInteger callbacks = enqueueDelayedWork();

        service.onUnbind(new Intent());

        assertStoppedAndCancelled(callbacks, 0);
    }

    @Test
    public void destroyCancelsPendingWorkAndClearsStopHandle() {
        AtomicInteger callbacks = enqueueDelayedWork();

        controller.destroy();
        controller = null;

        assertStoppedAndCancelled(callbacks, 0);
    }

    @Test
    public void explicitStopDisablesAccessibilityAndCannotBeRepeatedThroughStaleHandle() {
        AtomicInteger callbacks = enqueueDelayedWork();

        assertTrue(ProfileAccessibilityService.stopCapture());

        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void screenOffBroadcastEndsSessionAndCancelsPendingWork() {
        AtomicInteger callbacks = enqueueDelayedWork();

        service.sendBroadcast(new Intent(Intent.ACTION_SCREEN_OFF));
        shadowOf(Looper.getMainLooper()).idle();

        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void foreignForegroundRejectsStaleInstagramEventWithoutTraversingItsContent() {
        enterInstagram();
        AtomicInteger callbacks = enqueueDelayedWork();
        serviceShadow.root = node("com.example.payment", "Sensitive payment information");
        CountingNodeShadow.treeReads = 0;

        // An Instagram event already queued before the app switch must not admit
        // the new foreground or keep a reel/profile continuation alive.
        sendInstagramWindowEvent();

        assertEquals(0, CountingNodeShadow.treeReads);
        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void watchdogStopsOnAppSwitchEvenWithoutAnotherInstagramEvent() {
        enterInstagram();
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(50));
        AtomicInteger callbacks = enqueueDelayedWork();
        serviceShadow.root = node("com.example.payment", "Payment screen");
        CountingNodeShadow.treeReads = 0;

        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250));

        assertEquals(0, CountingNodeShadow.treeReads);
        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void lockedDeviceStopsBeforeReadingForegroundContent() {
        enterInstagram();
        AtomicInteger callbacks = enqueueDelayedWork();
        shadowOf((KeyguardManager) service.getSystemService(Context.KEYGUARD_SERVICE))
                .setKeyguardLocked(true);
        CountingNodeShadow.treeReads = 0;

        sendInstagramWindowEvent();

        assertEquals(0, CountingNodeShadow.treeReads);
        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void serviceReconnectCannotReplayConsumedStartRequest() {
        AtomicInteger callbacks = enqueueDelayedWork();

        service.onServiceConnected();

        assertStoppedAndCancelled(callbacks, 1);
    }

    @Test
    public void expiredStartRequestCannotEnableAnotherSession() {
        service.onInterrupt();
        service.getSharedPreferences("capture_session_request", Context.MODE_PRIVATE).edit()
                .putLong("requested_at", System.currentTimeMillis() - 180_000L).commit();

        service.onServiceConnected();

        assertEquals(2, serviceShadow.disableCalls);
        assertFalse(ProfileAccessibilityService.stopCapture());
    }

    private void enterInstagram() {
        serviceShadow.root = node(CaptureSession.INSTAGRAM_PACKAGE, "Instagram");
        sendInstagramWindowEvent();
        assertEquals(0, serviceShadow.disableCalls);
    }

    private void sendInstagramWindowEvent() {
        AccessibilityEvent event = AccessibilityEvent.obtain(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED);
        event.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);
        service.onAccessibilityEvent(event);
        event.recycle();
    }

    private AtomicInteger enqueueDelayedWork() {
        AtomicInteger callbacks = new AtomicInteger();
        captureHandler.postDelayed(callbacks::incrementAndGet, 1_000L);
        return callbacks;
    }

    private void assertStoppedAndCancelled(AtomicInteger callbacks, int expectedDisableCalls) {
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2));
        assertEquals(0, callbacks.get());
        assertEquals(expectedDisableCalls, serviceShadow.disableCalls);
        assertFalse(ProfileAccessibilityService.stopCapture());
        assertTrue(serviceShadow.getGlobalActionsPerformed().isEmpty());
        assertTrue(serviceShadow.getGesturesDispatched().isEmpty());
    }

    private static AccessibilityNodeInfo node(String packageName, String text) {
        AccessibilityNodeInfo root = AccessibilityNodeInfo.obtain();
        root.setPackageName(packageName);
        root.setText(text);
        return root;
    }

    /** Supplies foreground windows and records actual calls to disableSelf(). */
    @Implements(AccessibilityService.class)
    public static class ForegroundServiceShadow extends ShadowAccessibilityService {
        AccessibilityNodeInfo root;
        int disableCalls;

        @Implementation
        protected AccessibilityNodeInfo getRootInActiveWindow() {
            return root == null ? null : AccessibilityNodeInfo.obtain(root);
        }

        @Implementation
        protected void disableSelf() {
            disableCalls++;
        }
    }

    /** Any extractor traversal must request child count, including leaf roots. */
    @Implements(AccessibilityNodeInfo.class)
    public static class CountingNodeShadow extends ShadowAccessibilityNodeInfo {
        static int treeReads;

        @Override
        @Implementation
        protected int getChildCount() {
            treeReads++;
            return super.getChildCount();
        }
    }
}
