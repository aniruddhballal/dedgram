package com.dedgram.collector;

/**
 * Bounds one user-enabled capture session. Callers supply monotonic elapsed time
 * and observe the foreground before reading content or performing any action.
 */
public final class CaptureSession {
    public static final String INSTAGRAM_PACKAGE = "com.instagram.android";

    private static final long STARTUP_GRACE_MS = 60_000L;
    private static final long MAX_SESSION_DURATION_MS = 30L * 60_000L;

    private final long startedAtMs;
    private boolean instagramObserved;
    private boolean stopped;

    public CaptureSession(long nowMs) {
        startedAtMs = nowMs;
    }

    /**
     * Returns true only while Instagram is foreground in a live session.
     * Startup allows time to leave Android settings and open Instagram; after
     * Instagram is first observed, any other or unknown foreground ends the
     * session permanently. Expiry is inclusive at both time limits.
     */
    public boolean observeForeground(String packageName, long nowMs) {
        if (stopped) return false;
        long elapsedMs = nowMs - startedAtMs;
        if (elapsedMs >= MAX_SESSION_DURATION_MS
                || (!instagramObserved && elapsedMs >= STARTUP_GRACE_MS)) {
            stop();
            return false;
        }
        if (INSTAGRAM_PACKAGE.equals(packageName)) {
            instagramObserved = true;
            return true;
        }
        if (instagramObserved) stop();
        return false;
    }

    public boolean isStopped() {
        return stopped;
    }

    public void stop() {
        stopped = true;
    }
}
