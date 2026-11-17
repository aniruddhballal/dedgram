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
import android.view.View;
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
    private ReelLinkCapture reelLinkCapture;
    private ReelClipboardReader reelClipboard;
    private ProfileCaptureRunner profileCapture;
    private CompleteAnalysisRunner completeAnalysis;
    private TextView analysisBubble,analysisProgress;
    private boolean clearingSession;
    private TextView profileStatus;
    private final Runnable hideProfileStatus = this::removeProfileStatus;
    private PendingQueueRunner pendingQueue;
    private TextView queueBubble;
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
        if (PendingReelStore.consumeArm(this)) {
            pendingQueue = new PendingQueueRunner(this, new PendingQueueRunner.Host() {
                public AccessibilityNodeInfo root() { return currentInstagramRoot(); }
                public void open(String url) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    intent.setPackage(INSTAGRAM_PACKAGE); intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                }
                public void capture() { reelCaptureInProgress = true; captureCurrentReel(reelBubble, 0); }
                public void stopService() { stopCaptureSession(); }
                public boolean save(Reel reel) { return ReelStore.addOrReplace(getApplicationContext(), reel); }
                public void progress(String text) { updateQueueBubble(text); }
            });
            pendingQueue.start();
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || session == null || session.isStopped()) return;
        boolean instagramEvent = INSTAGRAM_PACKAGE.equals(String.valueOf(event.getPackageName()));
        if (instagramEvent) {
            if(completeAnalysis!=null && completeAnalysis.isRunning() && event.getEventType()==AccessibilityEvent.TYPE_VIEW_SCROLLED){
                AccessibilityNodeInfo source=event.getSource();
                if(source!=null){
                    String id=String.valueOf(source.getViewIdResourceName());
                    if(id.endsWith(":id/clips_viewer_view_pager")){
                        android.util.Log.i("dedgramAnalysis","scroll source="+id+" from="+event.getFromIndex()+" to="+event.getToIndex()+" count="+event.getItemCount());
                        completeAnalysis.observeScroll(event.getItemCount(),event.getFromIndex(),event.getToIndex());
                    }
                    source.recycle();
                }
            }
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
        if(clearingSession)return;
        clearingSession=true;
        try {
        if(completeAnalysis!=null)completeAnalysis.cancel("Capture session ended; scan is partial.");
        removeAnalysisProgress();
        if(reelLinkCapture!=null)reelLinkCapture.cancel();
        if(reelClipboard!=null)reelClipboard.close();
        if (profileCapture != null) profileCapture.cancel();
        removeProfileStatus();
        if (pendingQueue != null) pendingQueue.stop("Paused; start the queue again to resume null-status entries");
        removeQueueBubble();
        if (session != null) session.stop();
        mainHandler.removeCallbacksAndMessages(null);
        reelCaptureInProgress = false;
        if (screenReceiverRegistered) {
            unregisterReceiver(screenReceiver);
            screenReceiverRegistered = false;
        }
        removeBubble();
        removeReelBubble();
        removeAnalysisBubble();
        if (activeService.get() == this) activeService.clear();
        } finally {clearingSession=false;}
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
        if(reelClipboard!=null && (reelClipboard.holdsFocus() || reelClipboard.restoringFocus())
                && (getPackageName().equals(packageName) || packageName==null || "null".equals(packageName))
                && !session.expire(SystemClock.elapsedRealtime())){
            if(root!=null)root.recycle();return null; // Do not traverse our temporary clipboard-focus overlay.
        }
        if ((packageName == null || "null".equals(packageName)) && pendingQueue != null && pendingQueue.isNavigating()
                && !session.expire(SystemClock.elapsedRealtime())) {
            if(root != null)root.recycle();
            return null; // No traversal or action while Instagram replaces its window.
        }
        if (session.observeForeground(packageName, SystemClock.elapsedRealtime())) return root;
        if (root != null) root.recycle();
        if (session.isStopped()) stopCaptureSession();
        return null;
    }

    private QuickBallOverlay quickBall;
    private boolean quickBallSaved;

    private boolean captureBusy() {
        return reelCaptureInProgress || (profileCapture!=null && profileCapture.isRunning())
                || (completeAnalysis!=null && completeAnalysis.isRunning())
                || (pendingQueue!=null && pendingQueue.isRunning());
    }
    private void showBubble() {
        if(quickBall==null && windowManager!=null){
            quickBall=new QuickBallOverlay(this,windowManager,mainHandler,new QuickBallOverlay.Actions(){
                public void profile(TextView source){captureCurrentProfile(source);}
                public void reel(TextView source){captureCurrentReel(source);}
                public void analysis(){startCompleteAnalysis();}
            });
            bubble=quickBall.profileButton;reelBubble=quickBall.reelButton;analysisBubble=quickBall.analysisButton;
            bubbleAttached=true;scheduleSavedProfileStateUpdate();
        }
        if(quickBall!=null){quickBall.show();quickBall.state(quickBallSaved,captureBusy());}
    }

    private void syncBubbleVisibility() {
        AccessibilityNodeInfo root = currentInstagramRoot();
        boolean instagramActive = root != null;
        if (root != null) root.recycle();
        if(reelClipboard!=null && (reelClipboard.holdsFocus() || reelClipboard.restoringFocus()))return;
        if (instagramActive) {
            showBubble();
            if (pendingQueue != null && pendingQueue.isRunning()) updateQueueBubble(PendingReelStore.progress(this));
        } else {
            removeBubble();
            removeReelBubble();
            removeAnalysisBubble();
            removeQueueBubble();
        }
    }

    private int overlayType() {
        return WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
    }

    private void removeAnalysisBubble(){analysisBubble=null;}
    private void startCompleteAnalysis(){
        if(session==null || session.isStopped())return;
        if(reelCaptureInProgress || (profileCapture!=null && profileCapture.isRunning()) || (pendingQueue!=null && pendingQueue.isRunning()) || (completeAnalysis!=null && completeAnalysis.isRunning())){
            showProfileStatus("Capture is already running",false);return;
        }
        removeProfileStatus();
        completeAnalysis=new CompleteAnalysisRunner(mainHandler,new CompleteAnalysisRunner.Host(){
            public AccessibilityNodeInfo root(){return currentInstagramRoot();}
            public void profile(){captureCurrentProfile(analysisBubble,0);}
            public void reel(){reelCaptureInProgress=true;captureCurrentReel(analysisBubble,0);}
            public boolean back(){return performGlobalAction(GLOBAL_ACTION_BACK);}
            public boolean checkpoint(String username,org.json.JSONObject state){return ProfileStore.saveAnalysis(getApplicationContext(),username,state);}
            public void progress(String text){updateAnalysisProgress(text);}
            public void finished(String message,boolean complete){
                removeAnalysisProgress();
                if(reelCaptureInProgress && !clearingSession){stopCaptureSession();return;}
                showProfileStatus(message,!complete);
            }
        });completeAnalysis.start();
    }
    private void updateAnalysisProgress(String message){
        if(windowManager==null)return;
        if(analysisProgress==null){
            TextView view=new TextView(this);view.setTextSize(12);view.setTextColor(android.graphics.Color.WHITE);view.setBackgroundColor(0xEE312E81);
            view.setPadding(dp(12),dp(10),dp(12),dp(10));view.setContentDescription("Stop complete analysis");view.setOnClickListener(v->stopCaptureSession());
            WindowManager.LayoutParams params=new WindowManager.LayoutParams(dp(240),WindowManager.LayoutParams.WRAP_CONTENT,overlayType(),
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,PixelFormat.TRANSLUCENT);
            params.gravity=Gravity.TOP|Gravity.END;params.x=dp(12);params.y=dp(85);params.setTitle("dedgram complete analysis progress");
            try{windowManager.addView(view,params);analysisProgress=view;}catch(RuntimeException ignored){}
        }
        if(analysisProgress!=null)analysisProgress.setText("COMPLETE ANALYSIS\n"+message+"\nTAP TO STOP");
    }
    private void removeAnalysisProgress(){
        if(analysisProgress!=null && windowManager!=null)try{windowManager.removeView(analysisProgress);}catch(RuntimeException ignored){}
        analysisProgress=null;
    }

    private void captureCurrentProfile(TextView source) {
        if(completeAnalysis!=null && completeAnalysis.isRunning()){showProfileStatus("Complete analysis is running",false);return;}
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
        quickBallSaved=alreadySaved;
        if(quickBall!=null)quickBall.state(alreadySaved,captureBusy());
    }

    private void captureCurrentProfile(TextView source, int attempt) {
        if (session == null || session.isStopped()) return;
        if (reelCaptureInProgress || (pendingQueue != null && pendingQueue.isRunning())
                || (profileCapture != null && profileCapture.isRunning())) {
            showMessage("Capture is running; wait for it to finish"); return;
        }
        if(completeAnalysis==null || !completeAnalysis.isRunning())showProfileStatus("Capturing profile; keep Instagram open", false);
        profileCapture = new ProfileCaptureRunner(mainHandler, new ProfileCaptureRunner.Host() {
            public AccessibilityNodeInfo root() { return currentInstagramRoot(); }
            public boolean back() { return performGlobalAction(GLOBAL_ACTION_BACK); }
            public void picture(android.graphics.Rect bounds, String username, java.util.function.BiConsumer<Object,String> result) {
                captureProfilePicture(bounds, username, result);
            }
            public void finished(ProfileCaptureRecord record) {
                restoreProfileCaptureControls();
                boolean analysis=completeAnalysis!=null && completeAnalysis.awaitingProfile();
                if(analysis){
                    boolean saved=record!=null && ProfileStore.saveCapture(getApplicationContext(),record.finish());
                    if(saved){savedUsernames.add(record.username);setBubbleAlreadySaved(true);}
                    completeAnalysis.profileFinished(record,saved);return;
                }
                if (record == null) { showProfileStatus("Profile fetch failed: open a profile at its header first", true); showCaptureFailure(source, "Open an Instagram profile at its header first"); return; }
                Profile captured = record.finish();
                boolean saved = ProfileStore.saveCapture(getApplicationContext(), captured);
                if (!saved) { showProfileStatus("Could not save profile. Check document access and try again.", true); showCaptureFailure(source, "Could not save profile"); return; }
                savedUsernames.add(record.username);
                setBubbleAlreadySaved(true);
                if (record.hasFailures()) {
                    showProfileStatus("Profile fetch failed: " + record.failureSummary() + ". Open the quick menu and choose Profile to retry.", true);
                    showCaptureFailure(source, "Profile fetch failed: " + record.failureSummary());
                } else {
                    showProfileStatus("Saved profile @" + record.username, false);
                    showMessage("Saved profile @" + record.username);

                }
            }
        });
        profileCapture.start();
    }

    private void removeProfileStatus() {
        mainHandler.removeCallbacks(hideProfileStatus);
        if(profileStatus!=null && windowManager!=null)try{windowManager.removeView(profileStatus);}catch(RuntimeException ignored){}
        profileStatus=null;
    }

    private void showProfileStatus(String message, boolean failed) {
        removeProfileStatus();
        if(windowManager==null || session==null || session.isStopped())return;
        TextView view=new TextView(this);
        view.setText(message);view.setTextSize(14);view.setTextColor(android.graphics.Color.WHITE);
        view.setPadding(dp(16),dp(12),dp(16),dp(12));
        view.setBackgroundColor(failed?0xFF8B261C:0xFF202020);
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(
                getResources().getDisplayMetrics().widthPixels-dp(32),WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL;params.y=dp(72);
        params.setTitle("dedgram profile capture status");
        try{windowManager.addView(view,params);profileStatus=view;}catch(RuntimeException ignored){}
        mainHandler.postDelayed(hideProfileStatus,failed?15_000L:8_000L);
    }

    private void captureProfilePicture(android.graphics.Rect bounds, String username,
                                      java.util.function.BiConsumer<Object,String> result) {
        if (Build.VERSION.SDK_INT < 30) {
            result.accept(null,"Android 11 or newer is required to capture the visible profile picture."); return;
        }
        AccessibilityNodeInfo root = currentInstagramRoot();
        boolean verified = root != null && ProfileAccessibilityExtractor.snapshot(root).isHeader(username);
        if (root != null) root.recycle();
        if (!verified) { result.accept(null,"Profile identity changed before avatar capture."); return; }
        if(quickBall!=null)quickBall.hidden(true);
        mainHandler.postDelayed(() -> {
        if(session==null || session.isStopped())return;
        AccessibilityNodeInfo beforeScreenshot=currentInstagramRoot();
        ProfileAccessibilityExtractor.Snapshot beforeProfile=beforeScreenshot==null?null:ProfileAccessibilityExtractor.snapshot(beforeScreenshot);
        boolean stillProfile=beforeProfile!=null && beforeProfile.isHeader(username) && bounds.equals(beforeProfile.pictureBounds());
        if(beforeScreenshot!=null)beforeScreenshot.recycle();
        if(!stillProfile){restoreProfileCaptureControls();result.accept(null,"Profile moved before avatar capture.");return;}
        takeScreenshot(android.view.Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
            @Override public void onSuccess(ScreenshotResult screenshot) {
                restoreProfileCaptureControls();
                android.hardware.HardwareBuffer buffer = screenshot.getHardwareBuffer();
                android.graphics.Bitmap hardware = null, bitmap = null, avatar = null;
                try {
                    AccessibilityNodeInfo current = currentInstagramRoot();
                    ProfileAccessibilityExtractor.Snapshot currentProfile=current==null?null:ProfileAccessibilityExtractor.snapshot(current);
                    boolean same = currentProfile!=null && currentProfile.isHeader(username) && bounds.equals(currentProfile.pictureBounds());
                    if(current != null)current.recycle();
                    if(!same){result.accept(null,"Profile changed during avatar capture.");return;}
                    hardware=android.graphics.Bitmap.wrapHardwareBuffer(buffer,screenshot.getColorSpace());
                    if(hardware==null)throw new java.io.IOException("Screenshot bitmap unavailable");
                    bitmap=hardware.copy(android.graphics.Bitmap.Config.ARGB_8888,false);
                    if(bounds.left<0 || bounds.top<0 || bounds.right>bitmap.getWidth() || bounds.bottom>bitmap.getHeight())
                        throw new java.io.IOException("Avatar bounds outside screenshot");
                    avatar=android.graphics.Bitmap.createBitmap(bitmap,bounds.left,bounds.top,bounds.width(),bounds.height());
                    java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
                    if(!avatar.compress(android.graphics.Bitmap.CompressFormat.PNG,100,bytes))throw new java.io.IOException("PNG encoding failed");
                    org.json.JSONObject picture=new org.json.JSONObject();
                    picture.put("mime_type","image/png").put("source","visible_header_crop")
                            .put("width",avatar.getWidth()).put("height",avatar.getHeight())
                            .put("base64",android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP));
                    result.accept(picture,null);
                } catch(Exception error){result.accept(null,"Visible profile picture capture failed: "+error.getMessage());}
                finally {if(avatar!=null)avatar.recycle();if(bitmap!=null)bitmap.recycle();if(hardware!=null)hardware.recycle();buffer.close();}
            }
            @Override public void onFailure(int errorCode) {restoreProfileCaptureControls();result.accept(null,"Visible avatar screenshot failed, Android code "+errorCode);}
        });
        },120L);
    }

    private void restoreProfileCaptureControls() {
        if(quickBall!=null)quickBall.hidden(false);
    }

    private void captureCurrentReel(TextView source) {
        if(completeAnalysis!=null && completeAnalysis.isRunning()){showProfileStatus("Complete analysis is running",false);return;}
        if (pendingQueue != null && pendingQueue.isRunning()) { showMessage("Queue is running; use its Stop control to pause"); return; }
        if (reelCaptureInProgress || (profileCapture != null && profileCapture.isRunning()) || session == null || session.isStopped()) return;
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
        if((pendingQueue==null || !pendingQueue.isCapturing()) && ReelLink.isAd(root)){
            root.recycle();reelCaptureInProgress=false;showProfileStatus("Ad skipped",false);return;
        }
        Reel reel = buildReel(snapshot);
        ReelMetricAvailability.observe(reel, snapshot, true);
        if(pendingQueue!=null && pendingQueue.isCapturing()){
            root.recycle();beginReelDetails(source,reel);return;
        }
        String fingerprint=ReelLink.fingerprint(root);root.recycle();
        reel.urlError="Reel URL has not been verified.";reel.shortcode="";
        reelLinkCapture=new ReelLinkCapture(mainHandler,new ReelLinkCapture.Host(){
            public AccessibilityNodeInfo root(){return currentInstagramRoot();}
            public void clipboard(long copiedAt,java.util.function.BiConsumer<String,String> result){
                reelClipboard=new ReelClipboardReader(ProfileAccessibilityService.this,windowManager,mainHandler);
                reelClipboard.read(copiedAt,result);
            }
            public void finished(String url,String error,boolean returned,long copiedAt){
                if(session==null || session.isStopped())return;
                reel.urlError=error;
                if(url!=null && error==null){
                    try{
                        reel.url=PendingReels.canonicalUrl(url);reel.shortcode=PendingReels.shortcode(reel.url);
                        reel.identitySource="instagram_copy_link_verified_reel";
                        reel.urlObservation=new org.json.JSONObject().put("source","instagram_android_share_copy_link")
                                .put("copied_at_epoch_ms",copiedAt).put("verified_at_epoch_ms",System.currentTimeMillis())
                                .put("verification","matching_reel_before_and_after_copy").put("tracking_parameters_removed",true);
                    }catch(Exception invalid){reel.url="";reel.shortcode="";reel.urlError="Copied reel URL was invalid.";}
                }
                if(!returned){reel.navigationError=error;reel.captureStage="url_failed";saveReel(source,reel);return;}
                beginReelDetails(source,reel);
            }
        },fingerprint);
        reelLinkCapture.start();
    }

    private void beginReelDetails(TextView source,Reel reel){
        AccessibilityNodeInfo root=currentInstagramRoot();
        if(root==null)return;
        boolean expanded = ReelAccessibilityExtractor.clickCaption(root);
        root.recycle();
        reel.captureStage = "caption";
        if (expanded) mainHandler.postDelayed(() -> readExpandedCaption(source, reel, 0, ""), 700L);
        else {
            reel.captionError = "Could not open the full caption using its accessible control.";
            reel.datePostedError = "Publication footer was not exposed.";
            openReelMetrics(source, reel, 0);
        }
    }

    private void readExpandedCaption(TextView source, Reel reel, int attempt, String previous) {
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (root == null || session == null || session.isStopped()) { if (root != null) root.recycle(); return; }
        ReelAccessibilityExtractor.Snapshot snapshot = ReelAccessibilityExtractor.snapshot(root);
        String caption = snapshot.caption(), date = snapshot.datePosted();
        String observed = caption + "\n" + date;
        if (!date.isEmpty() && !caption.isEmpty() && observed.equals(previous)) {
            reel.caption = caption.startsWith(reel.account + " said ") ? caption.substring(reel.account.length() + 6) : caption; reel.captionError = null; reel.captionExpanded = true;
            reel.datePosted = date; reel.datePostedError = null;
            try {
                org.json.JSONObject evidence = new org.json.JSONObject();
                evidence.put("raw_text", date);
                java.text.SimpleDateFormat utc = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.ROOT);
                utc.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                evidence.put("observed_at", utc.format(new java.util.Date()));
                evidence.put("observed_at_epoch_ms", System.currentTimeMillis());
                evidence.put("timezone", java.util.TimeZone.getDefault().getID());
                evidence.put("locale", java.util.Locale.getDefault().toLanguageTag());
                evidence.put("source", "instagram_android_expanded_caption_footer");
                evidence.put("exact_publication_time", org.json.JSONObject.NULL);
                reel.publicationObservation = evidence;
            } catch (org.json.JSONException ignored) { }
            if (reel.comments == null && snapshot.noCommentsYet()) { reel.comments = 0L; reel.commentsError = null; }
            root.recycle();
            closeCapturedSheet(reel, true);
            mainHandler.postDelayed(() -> openReelMetrics(source, reel, 0), 500L);
            return;
        }
        if (attempt < 12) {
            if (attempt > 3 && date.isEmpty()) ReelAccessibilityExtractor.scrollCaption(root);
            root.recycle();
            mainHandler.postDelayed(() -> readExpandedCaption(source, reel, attempt + 1, observed), CAPTURE_RETRY_DELAY_MS);
            return;
        }
        reel.captionError = "Expanded caption could not be verified as complete.";
        reel.datePostedError = "Publication footer could not be read reliably.";
        boolean sheet = snapshot.hasCaptionSheet(); root.recycle();
        if (sheet) closeCapturedSheet(reel, true);
        mainHandler.postDelayed(() -> openReelMetrics(source, reel, 0), 500L);
    }

    private boolean closeCapturedSheet(Reel reel, boolean caption) {
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (root == null) return false;
        ReelAccessibilityExtractor.Snapshot state = ReelAccessibilityExtractor.snapshot(root);
        String currentCaption = state.caption();
        if (currentCaption.startsWith(reel.account + " said ")) currentCaption = currentCaption.substring(reel.account.length() + 6);
        boolean owned = caption ? reel.captionExpanded && (state.hasCaptionSheet() || !state.isLikelyReel())
                && currentCaption.equals(reel.caption) && state.datePosted().equals(reel.datePosted)
                : state.hasLikesAndPlaysSheet();
        if (!owned) {
            reel.navigationError = "Could not verify the opened " + (caption ? "caption" : "metrics") + " sheet before dismissal.";
            root.recycle(); return false;
        }
        boolean closed;
        if (caption) {
            if (reel.captionBackUsed) { root.recycle(); return false; }
            reel.captionBackUsed = true;
            closed = performGlobalAction(GLOBAL_ACTION_BACK);
        } else {
            closed = ReelAccessibilityExtractor.dismissSheet(root);
            if (!closed) closed = performGlobalAction(GLOBAL_ACTION_BACK);
        }
        root.recycle(); return closed;
    }

    private void openReelMetrics(TextView source, Reel reel, int attempt) {
        AccessibilityNodeInfo root = currentInstagramRoot();
        if (root == null || session == null || session.isStopped()) { if (root != null) root.recycle(); return; }
        ReelAccessibilityExtractor.Snapshot snapshot = ReelAccessibilityExtractor.snapshot(root);
        if (!snapshot.isLikelyReel()) {
            root.recycle();
            if (attempt < 4) mainHandler.postDelayed(() -> openReelMetrics(source, reel, attempt + 1), 350L);
            else { reel.viewsOrPlaysError = "Could not return to the original reel after caption capture."; saveReel(source, reel); }
            return;
        }
        String account = snapshot.account();
        if (!reel.account.equals("Unknown") && !account.equals(reel.account)) {
            root.recycle(); reel.viewsOrPlaysError = "Reel identity changed during capture; metrics were not read."; saveReel(source, reel); return;
        }
        reel.captureStage = "metrics";
        ReelMetricAvailability.observe(reel, snapshot, false);
        boolean opened = ReelAccessibilityExtractor.clickLikesCount(root); root.recycle();
        if (!opened) { reel.viewsOrPlaysError = "Could not open Likes and plays from this reel."; saveReel(source, reel); return; }
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
        if (snapshot.likesHidden()) { reel.likesAvailability = "owner_only"; reel.likesError = null; }
        else if (reel.likes == null) { reel.likes = snapshot.metric("like"); if (reel.likes != null) reel.likesError = null; }
        root.recycle();
        reel.captureStage = "finished";
        closeCapturedSheet(reel, false);
        ReelMetricAvailability.resolve(reel);
        mainHandler.postDelayed(() -> saveReel(source, reel), 350L);
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
            reel.urlError = message;
            saveReel(source, reel);
        }
    }

    private void saveReel(TextView source, Reel reel) {
        reelCaptureInProgress = false;
        if (session == null || session.isStopped()) return;
        if (pendingQueue != null && pendingQueue.isCapturing()) { pendingQueue.accept(reel); return; }
        if(completeAnalysis!=null && completeAnalysis.isCapturing()){
            completeAnalysis.reelFinished(reel,ReelStore.addOrReplace(getApplicationContext(),reel));return;
        }
        if (ReelStore.addOrReplace(getApplicationContext(), reel)) {
            if (reel.hasErrors()) showMessage("Reel saved with field errors");
            else showMessage("Reel saved");
            if (source == reelBubble) showReelSuccessFeedback();
        } else {
            showMessage("Could not save reel JSON");
            showReelFailureFeedback();
        }
    }

    private void updateQueueBubble(String text) {
        if (pendingQueue == null || !pendingQueue.isRunning()) { removeQueueBubble(); return; }
        AccessibilityNodeInfo visible = currentInstagramRoot();
        if (visible == null) { removeQueueBubble(); return; } visible.recycle();
        if (queueBubble == null && windowManager != null) {
            TextView view = new TextView(this);view.setTextSize(12);view.setTextColor(android.graphics.Color.WHITE);
            view.setBackgroundColor(0xEE312E81);view.setPadding(dp(10),dp(8),dp(10),dp(8));
            view.setContentDescription("Stop pending reel queue");view.setOnClickListener(v -> stopCaptureSession());
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(dp(190), -2,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL, PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.START;params.x = dp(16);params.y = dp(390);
            try { windowManager.addView(view,params);queueBubble=view; } catch (RuntimeException ignored) { }
        }
        if (queueBubble != null) queueBubble.setText(text+"\nTAP TO STOP");
    }
    private void removeQueueBubble() {
        if (queueBubble != null && windowManager != null) try { windowManager.removeView(queueBubble); } catch (RuntimeException ignored) { }
        queueBubble = null;
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

    private void removeBubble() {
        mainHandler.removeCallbacks(savedProfileStateUpdate);
        if(quickBall!=null)quickBall.dispose();quickBall=null;
        bubble=null;reelBubble=null;analysisBubble=null;bubbleAttached=false;
        observedUsername="";quickBallSaved=false;
    }
    private void removeReelBubble(){reelBubble=null;}

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
