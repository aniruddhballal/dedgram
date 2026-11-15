package com.dedgram.collector;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.text.InputType;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class MainActivity extends Activity {
    private LinearLayout profileList;
    private LinearLayout reelList;
    private LinearLayout profileModeContainer;
    private LinearLayout reelModeContainer;
    private TextView headerCount;
    private TextView profileCount;
    private TextView reelCount;
    private TextView pendingCount, pendingProgress, pendingStart;
    private long pendingRefresh;
    private boolean startAfterFolder;
    private static final int PICK_PENDING_REELS = 901;
    private TextView profileModeButton;
    private TextView reelModeButton;
    private TextView accessibilityStatus;
    private TextView stopCaptureButton;
    private final Handler statusHandler = new Handler(Looper.getMainLooper());
    private final Runnable statusUpdate = new Runnable() {
        @Override public void run() {
            refreshCaptureStatus();
            if (android.os.SystemClock.elapsedRealtime() - pendingRefresh > 2000) refreshPendingQueue();
            statusHandler.postDelayed(this, 500L);
        }
    };
    private TextView storageStatus;
    private EditText searchInput;
    private List<Profile> loadedProfiles = new ArrayList<>();
    private boolean keyboardVisible;
    private int scrollBeforeKeyboard;
    private boolean reelMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        setContentView(buildScreen());
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (profileList != null) refreshScreen();
        statusHandler.post(statusUpdate);
    }

    @Override
    protected void onPause() {
        statusHandler.removeCallbacksAndMessages(null);
        super.onPause();
    }

    private View buildScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.WHITE);
        scroll.setClipToPadding(true);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int horizontalPadding = UiStyles.dp(this, 20);
        int baseTopPadding = UiStyles.dp(this, 10);
        int baseBottomPadding = UiStyles.dp(this, 14);
        content.setPadding(horizontalPadding, baseTopPadding, horizontalPadding, baseBottomPadding);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            int topInset;
            int bottomInset;
            boolean imeVisible;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                android.graphics.Insets ime = insets.getInsets(android.view.WindowInsets.Type.ime());
                topInset = bars.top;
                bottomInset = Math.max(bars.bottom, ime.bottom);
                imeVisible = ime.bottom > bars.bottom;
            } else {
                topInset = insets.getSystemWindowInsetTop();
                bottomInset = insets.getSystemWindowInsetBottom();
                imeVisible = bottomInset > UiStyles.dp(this, 160);
            }
            view.setPadding(0, topInset, 0, bottomInset);
            content.setPadding(horizontalPadding, baseTopPadding, horizontalPadding, baseBottomPadding);
            updateKeyboardState(scroll, imeVisible);
            return insets;
        });
        scroll.addView(content);
        scroll.post(scroll::requestApplyInsets);

        content.addView(buildHeader());
        content.addView(UiStyles.rule(this, Color.BLACK, 1));
        content.addView(buildCaptureSessionControls(), margin(0, 16, 0, 0));
        content.addView(buildModeSwitcher(), margin(0, 16, 0, 0));
        profileModeContainer = buildProfileMode();
        reelModeContainer = buildReelMode();
        content.addView(profileModeContainer);
        content.addView(reelModeContainer);
        applyMode();
        return scroll;
    }

    private LinearLayout buildModeSwitcher() {
        LinearLayout switcher = new LinearLayout(this);
        switcher.setOrientation(LinearLayout.HORIZONTAL);
        switcher.setPadding(0, 0, 0, UiStyles.dp(this, 2));
        profileModeButton = modeButton("PROFILE DETECTION", false);
        reelModeButton = modeButton("REEL COLLECTION", true);
        profileModeButton.setOnClickListener(ignored -> {
            reelMode = false;
            applyMode();
        });
        reelModeButton.setOnClickListener(ignored -> {
            reelMode = true;
            applyMode();
        });
        switcher.addView(profileModeButton, new LinearLayout.LayoutParams(0, UiStyles.dp(this, 48), 1));
        switcher.addView(reelModeButton, new LinearLayout.LayoutParams(0, UiStyles.dp(this, 48), 1));
        return switcher;
    }

    private TextView modeButton(String label, boolean reel) {
        TextView button = UiStyles.text(this, label, 10, reel ? Color.WHITE : Color.BLACK, true);
        button.setGravity(Gravity.CENTER);
        button.setLetterSpacing(0.06f);
        button.setContentDescription(label);
        button.setBackground(UiStyles.outline(this, reel ? 0xFF4F46E5 : Color.WHITE, reel ? 0xFFFBBF24 : Color.BLACK));
        return button;
    }

    private LinearLayout buildProfileMode() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.addView(spacer(20));
        container.addView(UiStyles.utility(this, "PROFILE CATALOG"));
        TextView title = UiStyles.text(this, "Capture profiles", 24, Color.BLACK, true);
        title.setLetterSpacing(-0.02f);
        container.addView(title, margin(0, 5, 0, 0));
        TextView description = UiStyles.text(this, "Save profile counts, bio, account details and picture. Tap the alien control at the top of a profile; it opens About this account and returns automatically. Keep Instagram open until capture finishes.", 15, Color.BLACK, false);
        description.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        container.addView(description, margin(0, 10, 0, 0));
        container.addView(spacer(20));
        container.addView(UiStyles.utility(this, "CAPTURE SETUP"));
        container.addView(UiStyles.text(this, "Enable a capture session above, open Instagram, then tap the alien profile control. Saved profiles are highlighted while Instagram is open.", 12, 0xFF555555, false));
        container.addView(spacer(22));
        LinearLayout heading = new LinearLayout(this);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        TextView saved = UiStyles.text(this, "Saved profiles", 24, Color.BLACK, true);
        saved.setLetterSpacing(-0.02f);
        heading.addView(saved, new LinearLayout.LayoutParams(0, -2, 1));
        profileCount = UiStyles.utility(this, "0 PROFILES");
        heading.addView(profileCount);
        container.addView(heading);
        searchInput = buildSearchInput();
        LinearLayout.LayoutParams searchParams = new LinearLayout.LayoutParams(-1, UiStyles.dp(this, 56));
        searchParams.setMargins(0, UiStyles.dp(this, 10), 0, 0);
        container.addView(searchInput, searchParams);
        profileList = new LinearLayout(this);
        profileList.setOrientation(LinearLayout.VERTICAL);
        container.addView(profileList, margin(0, 10, 0, 0));
        container.addView(spacer(18));
        container.addView(UiStyles.rule(this, Color.BLACK, 1));
        storageStatus = UiStyles.text(this, "Stored in Documents/dedgram/profiles.json", 11, 0xFF555555, false);
        storageStatus.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        container.addView(storageStatus, margin(0, 10, 0, 0));
        TextView privacy = UiStyles.text(this, "Profile mode does not save screenshots, captions, bios, or direct messages.", 11, 0xFF555555, false);
        privacy.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        container.addView(privacy, margin(0, 4, 0, 0));
        return container;
    }

    private LinearLayout buildReelMode() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.addView(spacer(20));
        container.addView(UiStyles.utility(this, "REEL COLLECTION"));
        TextView title = UiStyles.text(this, "Capture reels", 24, 0xFF312E81, true);
        title.setLetterSpacing(-0.02f);
        container.addView(title, margin(0, 5, 0, 0));
        TextView description = UiStyles.text(this, "Open an individual reel in Instagram, then tap the dedgram logo control. Reel mode opens Likes and plays and records every requested field separately.", 15, Color.BLACK, false);
        description.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        container.addView(description, margin(0, 10, 0, 0));
        container.addView(spacer(20));
        container.addView(UiStyles.utility(this, "REEL CAPTURE SETUP"));
        container.addView(UiStyles.text(this, "Enable a capture session above, then tap the reel control. It expands the caption, records the displayed posting date with its observation time, and opens Likes and plays. Unreadable fields are saved with errors.", 12, 0xFF555555, false));
        container.addView(spacer(22));
        container.addView(UiStyles.utility(this, "PENDING REEL QUEUE"));
        LinearLayout queueRow = new LinearLayout(this);queueRow.setGravity(Gravity.CENTER_VERTICAL);
        pendingCount = UiStyles.text(this, "Choose pending_reels.json", 15, Color.BLACK, true);
        queueRow.addView(pendingCount,new LinearLayout.LayoutParams(0,-2,1));
        pendingStart = UiStyles.button(this, "START / RESUME", v -> startPendingQueue(), true);queueRow.addView(pendingStart);
        container.addView(queueRow,margin(0,10,0,0));
        container.addView(UiStyles.button(this,"CHOOSE DEDGRAM FOLDER",v -> choosePendingQueue(), false),margin(0,8,0,0));
        pendingProgress = UiStyles.text(this,"Documents/dedgram/pending_reels.json",12,0xFF555555,false);
        container.addView(pendingProgress,margin(0,8,0,0));
        container.addView(UiStyles.text(this,"Processes null-status entries one at a time. Saved results are skipped on resume. Stop from the queue overlay in Instagram; leaving Instagram also pauses this session.",12,0xFF555555,false),margin(0,8,0,0));
        container.addView(spacer(22));
        LinearLayout heading = new LinearLayout(this);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        TextView saved = UiStyles.text(this, "Saved reels", 24, 0xFF312E81, true);
        saved.setLetterSpacing(-0.02f);
        heading.addView(saved, new LinearLayout.LayoutParams(0, -2, 1));
        reelCount = UiStyles.utility(this, "0 REELS");
        heading.addView(reelCount);
        container.addView(heading);
        reelList = new LinearLayout(this);
        reelList.setOrientation(LinearLayout.VERTICAL);
        container.addView(reelList, margin(0, 10, 0, 0));
        container.addView(spacer(18));
        container.addView(UiStyles.rule(this, 0xFF4F46E5, 1));
        TextView storage = UiStyles.text(this, "Stored in " + ReelStore.storageLocation(), 11, 0xFF555555, false);
        storage.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        container.addView(storage, margin(0, 10, 0, 0));
        TextView privacy = UiStyles.text(this, "Captions are stored as UTF-8, including non-Latin scripts, emojis, and special characters.", 11, 0xFF555555, false);
        privacy.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        container.addView(privacy, margin(0, 4, 0, 0));
        return container;
    }

    private void refreshPendingQueue() {
        pendingRefresh=android.os.SystemClock.elapsedRealtime();if(pendingCount==null)return;
        try { PendingReels q=PendingReelStore.read(this);pendingCount.setText((q.reels.length()-q.done())+" pending / "+q.reels.length()+" total");pendingStart.setEnabled(q.next()!=null);pendingProgress.setText(PendingReelStore.progress(this)); }
        catch(Exception e){pendingCount.setText("Queue unavailable");pendingStart.setEnabled(false);pendingProgress.setText(e.getMessage());}
    }
    private void choosePendingQueue() {
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        if(Build.VERSION.SDK_INT>=26)intent.putExtra("android.provider.extra.INITIAL_URI",android.net.Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fdedgram"));
        startActivityForResult(intent,PICK_PENDING_REELS);
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==PICK_PENDING_REELS&&result==RESULT_OK&&data!=null&&data.getData()!=null){try{SharedReelDocuments.choose(this,data.getData());if(startAfterFolder){startAfterFolder=false;startPendingQueue();}}catch(Exception e){startAfterFolder=false;android.widget.Toast.makeText(this,e.getMessage(),android.widget.Toast.LENGTH_LONG).show();}refreshPendingQueue();}
    }
    private void startPendingQueue() {
        try {if(SharedReelDocuments.folder(this)==null){startAfterFolder=true;choosePendingQueue();return;}if(PendingReelStore.read(this).next()==null)return;
            ProfileAccessibilityService.stopCapture();
            ProfileAccessibilityService.prepareCaptureSession(this);PendingReelStore.arm(this);
            PendingReelStore.progress(this,"Waiting for accessibility permission; Instagram will open the first pending URL automatically");
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        }catch(Exception e){android.widget.Toast.makeText(this,e.getMessage(),android.widget.Toast.LENGTH_LONG).show();}
    }

    private void applyMode() {
        if (profileModeContainer == null || reelModeContainer == null) return;
        profileModeContainer.setVisibility(reelMode ? View.GONE : View.VISIBLE);
        reelModeContainer.setVisibility(reelMode ? View.VISIBLE : View.GONE);
        if (profileModeButton != null) {
            profileModeButton.setTextColor(reelMode ? Color.BLACK : Color.WHITE);
            profileModeButton.setBackground(UiStyles.outline(this, reelMode ? Color.WHITE : Color.BLACK, Color.BLACK));
        }
        if (reelModeButton != null) {
            reelModeButton.setTextColor(reelMode ? Color.WHITE : 0xFF312E81);
            reelModeButton.setBackground(UiStyles.outline(this, reelMode ? 0xFF4F46E5 : Color.WHITE, 0xFFFBBF24));
        }
        if (reelMode) renderReels();
    }

    private void updateKeyboardState(ScrollView scroll, boolean nowVisible) {
        if (nowVisible == keyboardVisible) return;
        keyboardVisible = nowVisible;
        if (nowVisible) {
            scrollBeforeKeyboard = scroll.getScrollY();
            scroll.postDelayed(() -> {
                if (!keyboardVisible || searchInput == null) return;
                int target = Math.max(0, searchInput.getTop() - UiStyles.dp(this, 100));
                scroll.smoothScrollTo(0, target);
            }, 100L);
        } else {
            scroll.postDelayed(() -> {
                if (!keyboardVisible) scroll.smoothScrollTo(0, scrollBeforeKeyboard);
            }, 100L);
        }
    }

    private View buildHeader() {
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.BOTTOM);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setPadding(0, 0, 0, UiStyles.dp(this, 12));

        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.VERTICAL);
        TextView wordmark = UiStyles.text(this, "dedgram", 30, Color.BLACK, true);
        wordmark.setLetterSpacing(-0.05f);
        brand.addView(wordmark);
        brand.addView(UiStyles.utility(this, "PROFILE COLLECTOR"), margin(0, 3, 0, 0));
        header.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));

        LinearLayout versionAndCount = new LinearLayout(this);
        versionAndCount.setGravity(Gravity.END);
        versionAndCount.setOrientation(LinearLayout.VERTICAL);
        TextView version = UiStyles.utility(this, "v" + BuildConfig.VERSION_NAME);
        version.setGravity(Gravity.END);
        version.setTextColor(0xFF555555);
        versionAndCount.addView(version);
        headerCount = UiStyles.utility(this, "0 PROFILES");
        headerCount.setGravity(Gravity.END);
        versionAndCount.addView(headerCount, margin(0, 3, 0, 0));
        header.addView(versionAndCount);
        return header;
    }

    private View buildCaptureSessionControls() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, UiStyles.dp(this, 14), 0, UiStyles.dp(this, 14));
        row.setBackgroundColor(Color.WHITE);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = UiStyles.text(this, "CAPTURE SESSION", 15, Color.BLACK, true);
        title.setLetterSpacing(0.02f);
        top.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        TextView status = UiStyles.utility(this, "CHECKING");
        top.addView(status);
        accessibilityStatus = status;
        row.addView(top);

        TextView copy = UiStyles.text(this, "Payment apps such as Google Pay may block payments while accessibility is enabled. Stop capture and verify it is OFF before making payments.\n\nStart here, enable dedgram in Accessibility settings within 2 minutes, then open Instagram within 60 seconds. Capture turns off when you leave Instagram, lock your phone, or reach 30 minutes. Return here to start another session.", 12, 0xFF555555, false);
        copy.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        row.addView(copy, margin(0, 5, 0, 10));
        row.addView(UiStyles.button(this, "OPEN ACCESSIBILITY SETTINGS", ignored ->
                openAccessibilitySettings(), true), new LinearLayout.LayoutParams(-1, UiStyles.dp(this, 48)));
        stopCaptureButton = UiStyles.button(this, "STOP CAPTURE AND TURN ACCESS OFF", ignored -> {
            if (!ProfileAccessibilityService.stopCapture() && isAccessibilityEnabled()) {
                openAccessibilitySettings();
            }
            refreshCaptureStatus();
        }, false);
        row.addView(stopCaptureButton, margin(0, 8, 0, 0));
        row.addView(UiStyles.rule(this, 0xFFDDDDDD, 1), ruleMargin(0xFFDDDDDD, 1, 0, 14, 0, 0));
        return row;
    }

    private void refreshScreen() {
        loadedProfiles = ProfileStore.read(this);
        String count = loadedProfiles.size() + (loadedProfiles.size() == 1 ? " PROFILE" : " PROFILES");
        if (headerCount != null) headerCount.setText(count);
        refreshCaptureStatus();
        if (storageStatus != null) storageStatus.setText("Stored in " + ProfileStore.storageLocation());
        renderProfiles();
        renderReels();
        refreshPendingQueue();
    }

    private void refreshCaptureStatus() {
        boolean enabled = isAccessibilityEnabled();
        if (accessibilityStatus != null) accessibilityStatus.setText(enabled ? "ACCESS ON" : "OFF");
        if (stopCaptureButton != null) stopCaptureButton.setEnabled(enabled);
    }

    private EditText buildSearchInput() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setTextSize(15);
        input.setTextColor(Color.BLACK);
        input.setHintTextColor(0xFF777777);
        input.setHint("Search username or profile URL");
        input.setContentDescription("Search saved profiles");
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setPadding(UiStyles.dp(this, 14), 0, UiStyles.dp(this, 14), 0);
        input.setBackground(UiStyles.outline(this, Color.WHITE, Color.BLACK));
        input.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence text, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence text, int start, int before, int count) {
                renderProfiles();
            }

            @Override
            public void afterTextChanged(Editable editable) {
            }
        });
        return input;
    }

    private void renderProfiles() {
        if (profileList == null) return;
        profileList.removeAllViews();
        if (loadedProfiles.isEmpty()) {
            if (profileCount != null) profileCount.setText("0 PROFILES");
            profileList.addView(buildEmptyState());
            return;
        }

        String query = searchInput == null ? "" : searchInput.getText().toString().trim().toLowerCase(Locale.ROOT);
        query = normalizeSearchQuery(query);
        List<Profile> matches = new ArrayList<>();
        for (Profile profile : loadedProfiles) {
            String url = "instagram.com/" + profile.normalizedUsername + "/";
            String searchable = ("@" + profile.username + " " + profile.normalizedUsername + " " + url)
                    .toLowerCase(Locale.ROOT);
            if (query.isEmpty() || searchable.contains(query)) matches.add(profile);
        }

        if (profileCount != null) {
            if (query.isEmpty()) {
                profileCount.setText(loadedProfiles.size() + (loadedProfiles.size() == 1 ? " PROFILE" : " PROFILES"));
            } else {
                profileCount.setText(matches.size() + (matches.size() == 1 ? " MATCH" : " MATCHES"));
            }
        }
        if (matches.isEmpty()) {
            profileList.addView(buildNoMatchesState());
            return;
        }
        for (Profile profile : matches) profileList.addView(buildProfileRow(profile));
    }

    private void renderReels() {
        if (reelList == null) return;
        reelList.removeAllViews();
        List<Reel> reels = ReelStore.read(this);
        if (reelCount != null) reelCount.setText(reels.size() + (reels.size() == 1 ? " REEL" : " REELS"));
        if (reels.isEmpty()) {
            reelList.addView(UiStyles.text(this, "Nothing saved yet", 24, 0xFF312E81, true), margin(0, 20, 0, 0));
            reelList.addView(UiStyles.text(this, "Open an Instagram reel, then tap the dedgram logo control.", 15, Color.BLACK, false), margin(0, 10, 0, 0));
            return;
        }
        for (Reel reel : reels) reelList.addView(buildReelRow(reel));
    }

    private View buildReelRow(Reel reel) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, UiStyles.dp(this, 16), 0, UiStyles.dp(this, 16));
        String title = reel.shortcode.isEmpty() ? "Reel capture" : reel.shortcode;
        row.addView(UiStyles.text(this, title, 17, 0xFF312E81, true));
        String account = reel.account.isEmpty() ? "Account unavailable" : "@" + reel.account;
        row.addView(UiStyles.text(this, account, 12, 0xFF555555, false), margin(0, 4, 0, 0));
        String summary = "Likes " + metric(reel, "likes", reel.likes, reel.likesError)
                + "  ·  Plays " + metric(reel, "views_or_plays", reel.viewsOrPlays, reel.viewsOrPlaysError)
                + "  ·  Comments " + metric(reel, "comments", reel.comments, reel.commentsError);
        row.addView(UiStyles.text(this, summary, 13, Color.BLACK, true), margin(0, 10, 0, 0));
        String caption = reel.caption.isEmpty() ? (reel.captionError == null ? "Caption unavailable" : reel.captionError) : reel.caption;
        TextView captionView = UiStyles.text(this, caption, 14, Color.BLACK, false);
        captionView.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
        row.addView(captionView, margin(0, 8, 0, 0));
        String details = "Date " + (reel.datePosted.isEmpty() ? (reel.datePostedError == null ? "Unavailable" : "ERROR") : reel.datePosted)
                + "  ·  Shares " + metric(reel, "shares", reel.shares, reel.sharesError)
                + "  ·  Reposts " + metric(reel, "reposts", reel.reposts, reel.repostsError)
                + "  ·  Saves " + metric(reel, "saves", reel.saves, reel.savesError);
        row.addView(UiStyles.text(this, details, 11, 0xFF555555, false), margin(0, 8, 0, 0));
        if (reel.hasErrors()) {
            TextView warning = UiStyles.text(this, "Some fields contain capture errors; inspect reels.json for field-level details.", 11, 0xFF9A3412, true);
            warning.setLineSpacing(UiStyles.dp(this, 2), 1.0f);
            row.addView(warning, margin(0, 8, 0, 0));
        }
        row.addView(UiStyles.rule(this, 0xFFE0E0E0, 1), ruleMargin(0xFFE0E0E0, 1, 0, 14, 0, 0));
        return row;
    }

    private String metric(Reel reel, String field, Long value, String error) {
        if (value != null) return Long.toString(value);
        if (reel.metricNotExposed(field)) return "Not exposed";
        if (field.equals("likes") && "owner_only".equals(reel.likesAvailability)) return "Hidden";
        return error == null ? "Unavailable" : "ERROR";
    }

    private String normalizeSearchQuery(String query) {
        String normalized = query.trim();
        if (normalized.startsWith("@")) normalized = normalized.substring(1);
        if (normalized.startsWith("https://")) normalized = normalized.substring(8);
        else if (normalized.startsWith("http://")) normalized = normalized.substring(7);
        if (normalized.startsWith("www.")) normalized = normalized.substring(4);
        return normalized;
    }

    private View buildNoMatchesState() {
        LinearLayout empty = new LinearLayout(this);
        empty.setOrientation(LinearLayout.VERTICAL);
        empty.setPadding(0, UiStyles.dp(this, 22), 0, UiStyles.dp(this, 22));
        empty.addView(UiStyles.text(this, "No matching profile", 24, Color.BLACK, true), margin(0, 20, 0, 0));
        empty.addView(UiStyles.text(this, "Try a username, @username, or Instagram profile URL.", 15, Color.BLACK, false), margin(0, 10, 0, 0));
        return empty;
    }

    private View buildEmptyState() {
        LinearLayout empty = new LinearLayout(this);
        empty.setOrientation(LinearLayout.VERTICAL);
        empty.setPadding(0, UiStyles.dp(this, 22), 0, UiStyles.dp(this, 22));
        empty.addView(UiStyles.text(this, "Nothing saved yet", 24, Color.BLACK, true), margin(0, 20, 0, 0));
        empty.addView(UiStyles.text(this, "Open an Instagram profile at its header, then tap the alien control to save its details.", 15, Color.BLACK, false), margin(0, 10, 0, 0));
        return empty;
    }

    private View buildProfileRow(Profile profile) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, UiStyles.dp(this, 14), 0, UiStyles.dp(this, 14));
        row.addView(UiStyles.text(this, "@" + profile.username, 16, Color.BLACK, true));
        String captureStatus = profile.details.optString("capture_status", "username_only");
        row.addView(UiStyles.text(this, "failed".equals(captureStatus) ? "Profile fetch failed - tap the profile icon again to retry"
                : "complete".equals(captureStatus) ? "Profile details saved - unavailable fields recorded separately"
                : "Username only - tap the profile control again to capture details", 12,
                profile.captureFailed() ? 0xFF9A3412 : 0xFF555555, true), margin(0, 5, 0, 0));
        row.addView(UiStyles.text(this, "instagram.com/" + profile.normalizedUsername + "/", 12, 0xFF555555, false), margin(0, 5, 0, 0));
        row.addView(UiStyles.rule(this, 0xFFDDDDDD, 1), ruleMargin(0xFFDDDDDD, 1, 0, 14, 0, 0));
        return row;
    }

    private void openAccessibilitySettings() {
        if (!isAccessibilityEnabled()) ProfileAccessibilityService.prepareCaptureSession(this);
        startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
    }

    private boolean isAccessibilityEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (TextUtils.isEmpty(enabled)) return false;
        ComponentName expected = new ComponentName(this, ProfileAccessibilityService.class);
        for (String service : enabled.split(":")) {
            if (expected.equals(ComponentName.unflattenFromString(service))) return true;
        }
        return false;
    }

    private View spacer(int height) {
        View view = new View(this);
        view.setLayoutParams(new LinearLayout.LayoutParams(1, UiStyles.dp(this, height)));
        return view;
    }

    private LinearLayout.LayoutParams margin(int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(UiStyles.dp(this, left), UiStyles.dp(this, top), UiStyles.dp(this, right), UiStyles.dp(this, bottom));
        return params;
    }

    private LinearLayout.LayoutParams ruleMargin(int color, int height, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, UiStyles.dp(this, height));
        params.setMargins(UiStyles.dp(this, left), UiStyles.dp(this, top), UiStyles.dp(this, right), UiStyles.dp(this, bottom));
        return params;
    }
}
