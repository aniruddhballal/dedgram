package com.dedgram.collector;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public final class CaptureSessionTest {
    private static final long START = 10_000L;
    private static final long MINUTE = 60_000L;
    private static final String INSTAGRAM = CaptureSession.INSTAGRAM_PACKAGE;

    @Test
    public void startupGraceDoesNotPermitCaptureOutsideInstagram() {
        CaptureSession session = new CaptureSession(START);

        assertFalse(session.observeForeground("com.android.settings", START));
        assertFalse(session.observeForeground(null, START + 10_000L));
        assertFalse(session.observeForeground("com.android.launcher", START + MINUTE - 1));
        assertFalse(session.isStopped());
        assertTrue(session.observeForeground(INSTAGRAM, START + MINUTE - 1));
    }

    @Test
    public void startupGraceExpiresAtSixtySeconds() {
        CaptureSession session = new CaptureSession(START);

        assertFalse(session.observeForeground("com.android.settings", START + MINUTE));
        assertTrue(session.isStopped());
        assertFalse(session.observeForeground(INSTAGRAM, START + MINUTE + 1));
    }

    @Test
    public void firstInstagramObservationAtStartupDeadlineCannotReviveSession() {
        CaptureSession session = new CaptureSession(START);

        assertFalse(session.observeForeground(INSTAGRAM, START + MINUTE));
        assertTrue(session.isStopped());
    }

    @Test
    public void hardDeadlineIsMeasuredFromConstruction() {
        CaptureSession session = new CaptureSession(START);

        assertTrue(session.observeForeground(INSTAGRAM, START + MINUTE - 1));
        assertTrue(session.observeForeground(INSTAGRAM, START + 30 * MINUTE - 1));
        assertFalse(session.observeForeground(INSTAGRAM, START + 30 * MINUTE));
        assertTrue(session.isStopped());
        assertFalse(session.observeForeground(INSTAGRAM, START + 30 * MINUTE + 1));
    }

    @Test
    public void switchingToAnotherAppStopsPermanently() {
        CaptureSession session = new CaptureSession(START);

        assertTrue(session.observeForeground(INSTAGRAM, START));
        assertFalse(session.observeForeground("com.example.payment", START + 1));
        assertTrue(session.isStopped());
        assertFalse(session.observeForeground(INSTAGRAM, START + 2));
    }

    @Test
    public void unknownForegroundAfterInstagramStopsPermanently() {
        CaptureSession session = new CaptureSession(START);

        assertTrue(session.observeForeground(INSTAGRAM, START));
        assertFalse(session.observeForeground(null, START + 1));
        assertTrue(session.isStopped());
        assertFalse(session.observeForeground(INSTAGRAM, START + 2));
    }

    @Test
    public void explicitStopInvalidatesDelayedCallbacksAndIsIdempotent() {
        CaptureSession session = new CaptureSession(START);

        assertTrue(session.observeForeground(INSTAGRAM, START));
        session.stop();
        session.stop();
        assertTrue(session.isStopped());
        assertFalse(session.observeForeground(INSTAGRAM, START + 1));
        assertFalse(session.observeForeground(INSTAGRAM, START));
    }

    @Test
    public void freshSessionRequiresNewInstanceAfterStop() {
        CaptureSession previous = new CaptureSession(START);
        previous.stop();
        CaptureSession current = new CaptureSession(START + 1);

        assertTrue(current.observeForeground(INSTAGRAM, START + 2));
        assertFalse(previous.observeForeground(INSTAGRAM, START + 2));
    }
}
