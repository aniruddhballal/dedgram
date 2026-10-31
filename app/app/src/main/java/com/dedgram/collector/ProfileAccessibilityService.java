package com.dedgram.collector;

import android.accessibilityservice.AccessibilityService;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.PowerManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;
import android.widget.Toast;

import java.util.HashSet;
import java.util.Set;
import java.lang.ref.WeakReference;

public final class ProfileAccessibilityService extends AccessibilityService {
    private static final String INSTAGRAM_PACKAGE = CaptureSession.INSTAGRAM_PACKAGE;
    private static final long FOREGROUND_CHECK_INTERVAL_MS = 250L;
    private static final String SESSION_REQUEST_PREFS = "capture_session_request";
    private static final String REQUESTED_AT = "requested_at";
    private static final long REQUEST_VALIDITY_MS = 2 * 60_000L;
    private static WeakReference<ProfileAccessibilityService> activeService = new WeakReference<>(null);
    private static final String BUBBLE_POSITION_PREFS = "capture_bubble_position";
    private static final String REEL_BUBBLE_POSITION_PREFS = "reel_bubble_position";
    private static final String BUBBLE_X = "x";
    private static final String BUBBLE_Y = "y";
    private static final int MAX_CAPTURE_ATTEMPTS = 4;
    private static final int MAX_LIKES_SHEET_ATTEMPTS = 10;
    private static final long CAPTURE_RETRY_DELAY_MS = 350L;
    private static final long PROFILE_STATE_DELAY_MS = 40L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Set<String> savedUsernames = new HashSet<>();
    private final Runnable savedProfileStateUpdate = this::updateSavedProfileState;
    private final Runnable foregroundCheck = this::checkForeground;
    private CaptureSession session;
    private boolean reelCaptureInProgress;
    private boolean screenReceiverRegistered;
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) stopCaptureSession();
        }
    };
    private WindowManager windowManager;
    private TextView bubble;
    private TextView reelBubble;
    private boolean bubbleAttached;
    private boolean reelBubbleAttached;
    private String observedUsername = "";

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        clearSession();
        if (!consumeSessionRequest()) {
            disableSelf();
            return;
        }
        session = new CaptureSession(SystemClock.elapsedRealtime());
        activeService = new WeakReference<>(this);
        IntentFilter screenOff = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenReceiver, screenOff, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenReceiver, screenOff);
        }
        screenReceiverRegistered = true;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        refreshSavedUsernames();
        mainHandler.post(foregroundCheck);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || session == null || session.isStopped()) return;
        boolean instagramEvent = INSTAGRAM_PACKAGE.equals(String.valueOf(event.getPackageName()));
        if (instagramEvent) {
            syncBubbleVisibility();
            if (session.isStopped()) return;
            if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                mainHandler.removeCallbacks(savedProfileStateUpdate);
                mainHandler.post(savedProfileStateUpdate);
            } else {
                scheduleSavedProfileStateUpdate();
            }
        }
    }

    @Override
    public void onInterrupt() {
        stopCaptureSession();
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        clearSession();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        clearSession();
        super.onDestroy();
    }

    /** Called on the main thread by the catalog's stop control. */
    public static boolean stopCapture() {
        ProfileAccessibilityService service = activeService.get();
        if (service == null) return false;
        service.stopCaptureSession();
        return true;
    }

    /** A fresh user action in the app permits exactly one settings-enabled connection. */
    static void prepareCaptureSession(Context context) {
        context.getSharedPreferences(SESSION_REQUEST_PREFS, MODE_PRIVATE).edit()
                .putLong(REQUESTED_AT, System.currentTimeMillis()).commit();
    }

    private boolean consumeSessionRequest() {
        android.content.SharedPreferences preferences =
                getSharedPreferences(SESSION_REQUEST_PREFS, MODE_PRIVATE);
        long requestedAt = preferences.getLong(REQUESTED_AT, 0L);
        // Commit consumption before starting: process death must not replay the request.
        boolean consumed = preferences.edit().remove(REQUESTED_AT).commit();
        long age = System.currentTimeMillis() - requestedAt;
        return consumed && requestedAt > 0L && age >= 0L && age <= REQUEST_VALIDITY_MS;
    }

    private void stopCaptureSession() {
        clearSession();
        // Hiding overlays or stopSelf() would leave accessibility enabled.
        disableSelf();
    }

    private void clearSession() {
        if (session != null) session.stop();
        mainHandler.removeCallbacksAndMessages(null);
        reelCaptureInProgress = false;
        if (screenReceiverRegistered) {
            unregisterReceiver(screenReceiver);
            screenReceiverRegistered = false;
        }
        removeBubble();
        removeReelBubble();
        if (activeService.get() == this) activeService.clear();
    }

    private void checkForeground() {
        syncBubbleVisibility();
        if (session != null && !session.isStopped()) {
            mainHandler.postDelayed(foregroundCheck, FOREGROUND_CHECK_INTERVAL_MS);
        }
    }

    /** Never traverse a foreign app, and never fall back to a background Instagram window. */
    private AccessibilityNodeInfo currentInstagramRoot() {
        if (session == null || session.isStopped()) return null;
        KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        if ((keyguard != null && keyguard.isKeyguardLocked())
                || (power != null && !power.isInteractive())) {
            stopCaptureSession();
            return null;
        }
        AccessibilityNodeInfo root = getRootInActiveWindow();
        String packageName = root == null ? null : String.valueOf(root.getPackageName());
        if (session.observeForeground(packageName, SystemClock.elapsedRealtime())) return root;
        if (root != null) root.recycle();
        if (session.isStopped()) stopCaptureSession();
        return null;
    }

    private void showBubble() {
        if (bubbleAttached || windowManager == null) return;
        TextView view = new TextView(this);
        view.setText("");
        view.setTextColor(0xFF000000);
        view.setTextSize(16);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        view.setContentDescription("dedgram capture profile");
        view.setBackground(new CaptureBubbleDrawable(this));
        view.setElevation(dp(4));
        view.setOnClickListener(ignored -> captureCurrentProfile(view));

        final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                dp(44),
                dp(44),
                overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = clampPosition(savedBubblePosition(BUBBLE_X, dp(16)), maxBubbleX(params));
        params.y = clampPosition(savedBubblePosition(BUBBLE_Y, dp(220)), maxBubbleY(params));
        params.setTitle("dedgram capture bubble");
        view.setOnTouchListener(new View.OnTouchListener() {
            private final int touchSlop = ViewConfiguration.get(ProfileAccessibilityService.this).getScaledTouchSlop();
            private float downRawX;
            private float downRawY;
            private int startX;
            private int startY;
            private boolean dragging;

            @Override
            public boolean onTouch(View touchedView, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downRawX = event.getRawX();
                        downRawY = event.getRawY();
                        startX = params.x;
                        startY = params.y;
                        dragging = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float deltaX = event.getRawX() - downRawX;
                        float deltaY = event.getRawY() - downRawY;
                        if (!dragging && Math.hypot(deltaX, deltaY) > touchSlop) dragging = true;
                        if (dragging) {
                            params.x = clampPosition(startX + Math.round(deltaX), maxBubbleX(params));
                            params.y = clampPosition(startY + Math.round(deltaY), maxBubbleY(params));
                            updateBubblePosition(touchedView, params);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (dragging) {
                            saveBubblePosition(params);
                            dragging = false;
                            return true;
                        }
                        touchedView.performClick();
                        return true;
                    case MotionEvent.ACTION_CANCEL:
                        dragging = false;
                        return true;
                    default:
                        return true;
                }
            }
        });
        try {
            windowManager.addView(view, params);
            bubble = view;
            bubbleAttached = true;
            scheduleSavedProfileStateUpdate();
        } catch (WindowManager.BadTokenException | SecurityException ignored) {
            // The session may be ending; never fall back to a general application overlay.
        }
    }

    private void syncBubbleVisibility() {
        AccessibilityNodeInfo root = currentInstagramRoot();
        boolean instagramActive = root != null;
        if (root != null) root.recycle();
        if (instagramActive) {
            showBubble();
            showReelBubble();
        } else {
            removeBubble();
            removeReelBubble();
        }
    }

    private void showReelBubble() {
        if (reelBubbleAttached || windowManager == null) return;
        TextView view = new TextView(this);
        view.setText("");
        view.setGravity(Gravity.CENTER);
        view.setContentDescription("dedgram collect reel");
        view.setBackground(new ReelBubbleDrawable(this));
        view.setElevation(dp(5));
        view.setOnClickListener(ignored -> captureCurrentReel(view));

        final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                dp(52),
                dp(52),
                overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = clampPosition(savedReelBubblePosition("x", dp(16)), maxBubbleX(params));
        params.y = clampPosition(savedReelBubblePosition("y", dp(278)), maxBubbleY(params));
        params.setTitle("dedgram collect reel bubble");
        view.setOnTouchListener(new View.OnTouchListener() {
            private final int touchSlop = ViewConfiguration.get(ProfileAccessibilityService.this).getScaledTouchSlop();
            private float downRawX;
            private float downRawY;
            private int startX;
            private int startY;
            private boolean dragging;

            @Override
            public boolean onTouch(View touchedView, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downRawX = event.getRawX();
                        downRawY = event.getRawY();
                        startX = params.x;
                        startY = params.y;
                        dragging = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float deltaX = event.getRawX() - downRawX;
                        float deltaY = event.getRawY() - downRawY;
                        if (!dragging && Math.hypot(deltaX, deltaY) > touchSlop) dragging = true;
                        if (dragging) {
                            params.x = clampPosition(startX + Math.round(deltaX), maxBubbleX(params));
                            params.y = clampPosition(startY + Math.round(deltaY), maxBubbleY(params));
                            updateBubblePosition(touchedView, params);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (dragging) {
                            saveReelBubblePosition(params);
                            dragging = false;
                            return true;
                        }
                        touchedView.performClick();
                        return true;
                    case MotionEvent.ACTION_CANCEL:
                        dragging = false;
                        return true;
                    default:
                        return true;
                }
            }
        });
        try {
            windowManager.addView(view, params);
            reelBubble = view;
            reelBubbleAttached = true;
        } catch (WindowManager.BadTokenException | SecurityException ignored) {
            // The system may be tearing the accessibility service down.
        }
    }

    private int overlayType() {
        return WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
    }

    private void captureCurrentProfile(TextView source) {
        captureCurrentProfile(source, 0);
    }

    private void scheduleSavedProfileStateUpdate() {
        mainHandler.removeCallbacks(savedProfileStateUpdate);
        mainHandler.postDelayed(savedProfileStateUpdate, PROFILE_STATE_DELAY_MS);
    }

    private void updateSavedProfileState() {
        if (bubble == null || !bubbleAttached) return;
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (root == null || !INSTAGRAM_PACKAGE.equals(String.valueOf(root.getPackageName()))) {
            if (root != null) root.recycle();
            observedUsername = "";
            setBubbleAlreadySaved(false);
            return;
        }
        String username = InstagramUsernameExtractor.extract(root);
        root.recycle();
        if (username.equals(observedUsername)) return;
        observedUsername = username;
        setBubbleAlreadySaved(!username.isEmpty() && savedUsernames.contains(username));
    }

    private void refreshSavedUsernames() {
        savedUsernames.clear();
        for (Profile profile : ProfileStore.read(getApplicationContext())) {
            if (!profile.normalizedUsername.isEmpty()) savedUsernames.add(profile.normalizedUsername);
        }
    }

    private void setBubbleAlreadySaved(boolean alreadySaved) {
        if (bubble == null) return;
        if (bubble.getBackground() instanceof CaptureBubbleDrawable) {
            ((CaptureBubbleDrawable) bubble.getBackground()).setAlreadySaved(alreadySaved);
        }
    }

    private void captureCurrentProfile(TextView source, int attempt) {
        if (session == null || session.isStopped()) return;
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (session.isStopped()) return;
        if (root == null || !INSTAGRAM_PACKAGE.equals(String.valueOf(root.getPackageName()))) {
            if (root != null) root.recycle();
            if (attempt < MAX_CAPTURE_ATTEMPTS) {
                mainHandler.postDelayed(() -> captureCurrentProfile(source, attempt + 1), CAPTURE_RETRY_DELAY_MS);
            } else {
                showCaptureFailure(source, "Open an Instagram profile first");
            }
            return;
        }
        String username = InstagramUsernameExtractor.extract(root);
        root.recycle();
        if (username.isEmpty()) {
            if (attempt < MAX_CAPTURE_ATTEMPTS) {
                mainHandler.postDelayed(() -> captureCurrentProfile(source, attempt + 1), CAPTURE_RETRY_DELAY_MS);
            } else {
                showCaptureFailure(source, "Could not identify this profile");
            }
            return;
        }
        ProfileStore.SaveResult result = ProfileStore.add(getApplicationContext(), username);
        if (result == ProfileStore.SaveResult.ADDED) {
            savedUsernames.add(username);
            setBubbleAlreadySaved(true);
            showMessage("Saved @" + username);
            if (source == bubble && source.getBackground() instanceof CaptureBubbleDrawable) {
                ((CaptureBubbleDrawable) source.getBackground()).startShimmer();
            }
        } else if (result == ProfileStore.SaveResult.ALREADY_PRESENT) {
            savedUsernames.add(username);
            setBubbleAlreadySaved(true);
            showMessage("Already saved @" + username);
            showAlreadySavedFeedback(source);
        } else {
            showCaptureFailure(source, "Could not save @" + username);
        }
    }

    private void captureCurrentReel(TextView source) {
        if (reelCaptureInProgress || session == null || session.isStopped()) return;
        reelCaptureInProgress = true;
        captureCurrentReel(source, 0);
    }

    private void captureCurrentReel(TextView source, int attempt) {
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (session == null || session.isStopped()) return;
        if (root == null || !INSTAGRAM_PACKAGE.equals(String.valueOf(root.getPackageName()))) {
            if (root != null) root.recycle();
            retryOrFailReel(source, attempt, "Open an Instagram reel first");
            return;
        }
        ReelAccessibilityExtractor.Snapshot snapshot = ReelAccessibilityExtractor.snapshot(root);
        if (!snapshot.isLikelyReel()) {
            root.recycle();
            retryOrFailReel(source, attempt, "Open an individual Instagram reel first");
            return;
        }
        Reel reel = buildReel(snapshot);
        // Node actions remain bound to Instagram; never inject a tap at screen coordinates.
        boolean openedLikesAndPlays = ReelAccessibilityExtractor.clickLikesCount(root);
        root.recycle();
        if (!openedLikesAndPlays) {
            reel.viewsOrPlaysError = "Could not open Likes and plays from this reel.";
            saveReel(source, reel);
            return;
        }
        mainHandler.postDelayed(() -> finishReelCapture(source, reel, 0), 700L);
    }

    private void finishReelCapture(TextView source, Reel reel, int attempt) {
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (session == null || session.isStopped()) return;
        if (root == null || !INSTAGRAM_PACKAGE.equals(String.valueOf(root.getPackageName()))) {
            if (root != null) root.recycle();
            if (attempt < MAX_CAPTURE_ATTEMPTS) {
                mainHandler.postDelayed(() -> finishReelCapture(source, reel, attempt + 1), CAPTURE_RETRY_DELAY_MS);
            } else {
                reel.viewsOrPlaysError = "The Likes and plays panel was not available after opening it.";
                saveReel(source, reel);
            }
            return;
        }
        ReelAccessibilityExtractor.Snapshot snapshot = ReelAccessibilityExtractor.snapshot(root);
        if (!snapshot.hasLikesAndPlaysSheet()) {
            root.recycle();
            if (attempt < MAX_CAPTURE_ATTEMPTS) {
                mainHandler.postDelayed(() -> finishReelCapture(source, reel, attempt + 1), CAPTURE_RETRY_DELAY_MS);
            } else {
                reel.viewsOrPlaysError = "The reel's Likes and plays panel did not finish loading.";
                saveReel(source, reel);
            }
            return;
        }
        Long plays = snapshot.playsFromSheet();
        if (plays == null && attempt < MAX_LIKES_SHEET_ATTEMPTS) {
            root.recycle();
            mainHandler.postDelayed(() -> finishReelCapture(source, reel, attempt + 1), CAPTURE_RETRY_DELAY_MS);
            return;
        }
        if (plays == null) reel.viewsOrPlaysError = "The Likes and plays panel loaded, but its plays value was unreadable.";
        else {
            reel.viewsOrPlays = plays;
            reel.viewsOrPlaysError = null;
        }
        if (reel.likes == null) reel.likes = snapshot.metric("like");
        root.recycle();
        saveReel(source, reel);
    }

    private Reel buildReel(ReelAccessibilityExtractor.Snapshot snapshot) {
        Reel reel = new Reel();
        reel.account = snapshot.account();
        reel.shortcode = snapshot.shortcode();
        reel.capturedAt = Long.toString(System.currentTimeMillis());
        reel.likes = snapshot.metric("like");
        reel.comments = snapshot.metric("comment");
        reel.reposts = snapshot.metric("repost");
        reel.shares = snapshot.metric("share");
        reel.saves = snapshot.metric("save");
        reel.datePosted = snapshot.datePosted();
        reel.caption = snapshot.caption();
        if (reel.likes == null) reel.likesError = "Could not read the likes count from the reel UI.";
        if (reel.comments == null) reel.commentsError = "Could not read the comments count from the reel UI.";
        if (reel.reposts == null) reel.repostsError = "Could not read the repost count from the reel UI.";
        if (reel.shares == null) reel.sharesError = "Could not read the shares count from the reel UI.";
        if (reel.saves == null) reel.savesError = "Could not read the saves count from the reel UI.";
        if (reel.datePosted.isEmpty()) reel.datePostedError = "Could not read the posted date from the reel UI.";
        if (reel.caption.isEmpty()) reel.captionError = "Could not read the caption from the reel UI.";
        else if (snapshot.captionLooksTruncated()) {
            reel.captionError = "Caption is truncated. Expand it in Instagram before capturing.";
        }
        if (reel.account.isEmpty()) reel.account = "Unknown";
        return reel;
    }

    private void retryOrFailReel(TextView source, int attempt, String message) {
        if (attempt < MAX_CAPTURE_ATTEMPTS) {
            mainHandler.postDelayed(() -> captureCurrentReel(source, attempt + 1), CAPTURE_RETRY_DELAY_MS);
        } else {
            Reel reel = new Reel();
            reel.capturedAt = Long.toString(System.currentTimeMillis());
            reel.viewsOrPlaysError = message;
            reel.likesError = message;
            reel.commentsError = message;
            reel.repostsError = message;
            reel.sharesError = message;
            reel.savesError = message;
            reel.datePostedError = message;
            reel.captionError = message;
            saveReel(source, reel);
        }
    }

    private void saveReel(TextView source, Reel reel) {
        reelCaptureInProgress = false;
        if (session == null || session.isStopped()) return;
        if (ReelStore.addOrReplace(getApplicationContext(), reel)) {
            if (reel.hasErrors()) showMessage("Reel saved with field errors");
            else showMessage("Reel saved");
            if (source == reelBubble) showReelSuccessFeedback();
        } else {
            showMessage("Could not save reel JSON");
            showReelFailureFeedback();
        }
    }

    private void showReelSuccessFeedback() {
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(45L, 90));
        else vibrator.vibrate(45L);
    }

    private void showReelFailureFeedback() {
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createWaveform(
                new long[]{0L, 45L, 45L, 45L}, new int[]{0, 100, 0, 100}, -1));
        else vibrator.vibrate(new long[]{0L, 45L, 45L, 45L}, -1);
    }

    private void showCaptureFailure(TextView source, String message) {
        showMessage(message);
        showCaptureFailureFeedback(source);
    }

    private void showCaptureFailureFeedback(TextView source) {
        if (source != bubble) return;
        if (source.getBackground() instanceof CaptureBubbleDrawable) {
            ((CaptureBubbleDrawable) source.getBackground()).startFailureFeedback();
        }
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(
                    new long[]{0L, 45L, 45L, 45L},
                    new int[]{0, 110, 0, 110},
                    -1
            ));
        } else {
            vibrator.vibrate(new long[]{0L, 45L, 45L, 45L}, -1);
        }
    }

    private void showAlreadySavedFeedback(TextView source) {
        if (source != bubble) return;
        if (source.getBackground() instanceof CaptureBubbleDrawable) {
            ((CaptureBubbleDrawable) source.getBackground()).startAlreadySavedFeedback();
        }
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(28L, 70));
        } else {
            vibrator.vibrate(28L);
        }
    }

    private void showMessage(String message) {
        Toast.makeText(getApplicationContext(), message, Toast.LENGTH_SHORT).show();
    }

    private int savedBubblePosition(String key, int fallback) {
        return getSharedPreferences(BUBBLE_POSITION_PREFS, MODE_PRIVATE).getInt(key, fallback);
    }

    private void saveBubblePosition(WindowManager.LayoutParams params) {
        getSharedPreferences(BUBBLE_POSITION_PREFS, MODE_PRIVATE)
                .edit()
                .putInt(BUBBLE_X, params.x)
                .putInt(BUBBLE_Y, params.y)
                .apply();
    }

    private int savedReelBubblePosition(String key, int fallback) {
        return getSharedPreferences(REEL_BUBBLE_POSITION_PREFS, MODE_PRIVATE).getInt(key, fallback);
    }

    private void saveReelBubblePosition(WindowManager.LayoutParams params) {
        getSharedPreferences(REEL_BUBBLE_POSITION_PREFS, MODE_PRIVATE)
                .edit()
                .putInt("x", params.x)
                .putInt("y", params.y)
                .apply();
    }

    private int maxBubbleX(WindowManager.LayoutParams params) {
        return Math.max(0, getResources().getDisplayMetrics().widthPixels - params.width);
    }

    private int maxBubbleY(WindowManager.LayoutParams params) {
        return Math.max(0, getResources().getDisplayMetrics().heightPixels - params.height);
    }

    private int clampPosition(int value, int maximum) {
        return Math.max(0, Math.min(value, maximum));
    }

    private void updateBubblePosition(View view, WindowManager.LayoutParams params) {
        if (!bubbleAttached || windowManager == null) return;
        try {
            windowManager.updateViewLayout(view, params);
        } catch (IllegalArgumentException ignored) {
            // The overlay may have been removed while the gesture was ending.
        }
    }

    private void removeBubble() {
        mainHandler.removeCallbacks(savedProfileStateUpdate);
        if (bubble != null && bubbleAttached && windowManager != null) {
            try {
                windowManager.removeView(bubble);
            } catch (IllegalArgumentException ignored) {
                // The window may already have been removed by the system.
            }
        }
        bubble = null;
        bubbleAttached = false;
        observedUsername = "";
    }

    private void removeReelBubble() {
        if (reelBubble != null && reelBubbleAttached && windowManager != null) {
            try {
                windowManager.removeView(reelBubble);
            } catch (IllegalArgumentException ignored) {
                // The window may already have been removed by the system.
            }
        }
        reelBubble = null;
        reelBubbleAttached = false;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
