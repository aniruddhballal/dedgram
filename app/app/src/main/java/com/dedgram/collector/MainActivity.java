package com.dedgram.collector;

import android.app.Activity;
import android.app.AlertDialog;
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
import android.widget.Switch;

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
    private Switch captureToggle;
    private boolean updatingCaptureToggle;
    private int savedReelCount;
    private final Handler statusHandler = new Handler(Looper.getMainLooper());
    private final Runnable statusUpdate = new Runnable() {
        @Override public void run() {
            refreshCaptureStatus();
            if (android.os.SystemClock.elapsedRealtime() - pendingRefresh > 2000) refreshPendingQueue();
            statusHandler.postDelayed(this, 500L);
        }
    };
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
        profileModeButton = modeButton("PROFILES", false);
        reelModeButton = modeButton("REELS", true);
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
        return container;
    }

    private LinearLayout buildReelMode() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.addView(spacer(20));
        container.addView(UiStyles.utility(this, "PENDING REELS"));
        LinearLayout queueRow = new LinearLayout(this);queueRow.setGravity(Gravity.CENTER_VERTICAL);
        pendingCount = UiStyles.text(this, "No queue", 15, Color.BLACK, true);
        queueRow.addView(pendingCount,new LinearLayout.LayoutParams(0,-2,1));
        pendingStart = UiStyles.button(this, "START / RESUME", v -> startPendingQueue(), true);queueRow.addView(pendingStart);
        container.addView(queueRow,margin(0,10,0,0));
        container.addView(UiStyles.button(this,"CHOOSE DEDGRAM FOLDER",v -> choosePendingQueue(), false),margin(0,8,0,0));
        pendingProgress = UiStyles.text(this,"",12,0xFF555555,false);
        container.addView(pendingProgress,margin(0,8,0,0));
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
        return container;
    }

    private void refreshPendingQueue() {
        pendingRefresh=android.os.SystemClock.elapsedRealtime();if(pendingCount==null)return;
        try { PendingReels q=PendingReelStore.read(this);pendingCount.setText((q.reels.length()-q.done())+" pending / "+q.reels.length()+" total");pendingStart.setEnabled(q.next()!=null);pendingProgress.setText(PendingReelStore.progress(this)); }
        catch(Exception e){pendingCount.setText(SharedReelDocuments.folder(this)==null?"No queue":"Queue unavailable");pendingStart.setEnabled(false);pendingProgress.setText(SharedReelDocuments.folder(this)==null?"":e.getMessage());}
        pendingProgress.setVisibility(TextUtils.isEmpty(pendingProgress.getText())?View.GONE:View.VISIBLE);
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
        LinearLayout subtitle=new LinearLayout(this);subtitle.setGravity(Gravity.CENTER_VERTICAL);
        TextView subtitleLabel=UiStyles.utility(this,"BOT SCRAPER");
        subtitle.addView(subtitleLabel);
        TextView info=UiStyles.text(this,"ⓘ",12,Color.BLACK,false);
        info.setIncludeFontPadding(false);
        info.setGravity(Gravity.CENTER);info.setContentDescription("App information");
        info.setOnClickListener(v->showAppInformation());
        subtitle.addView(info,new LinearLayout.LayoutParams(UiStyles.dp(this,28),-1));
        subtitleLabel.measure(View.MeasureSpec.UNSPECIFIED,View.MeasureSpec.UNSPECIFIED);
        LinearLayout.LayoutParams subtitleParams=new LinearLayout.LayoutParams(-1,subtitleLabel.getMeasuredHeight());
        subtitleParams.topMargin=UiStyles.dp(this,3);brand.addView(subtitle,subtitleParams);
        // Keep the visual row as tall as its text, with a larger touch target in the header.
        header.addOnLayoutChangeListener((v,l,t,r,b,oldL,oldT,oldR,oldB)->{
            android.graphics.Rect hit=new android.graphics.Rect();info.getDrawingRect(hit);
            header.offsetDescendantRectToMyCoords(info,hit);
            int half=UiStyles.dp(this,24),centerX=hit.centerX(),centerY=hit.centerY();
            hit.set(Math.max(0,centerX-half),Math.max(0,centerY-half),
                    Math.min(header.getWidth(),centerX+half),Math.min(header.getHeight(),centerY+half));
            header.setTouchDelegate(new android.view.TouchDelegate(hit,info));
        });
        header.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));

        LinearLayout versionAndCount = new LinearLayout(this);
        versionAndCount.setGravity(Gravity.END);
        versionAndCount.setOrientation(LinearLayout.VERTICAL);
        TextView version = UiStyles.utility(this, "v" + BuildConfig.VERSION_NAME);
        version.setGravity(Gravity.END);
        version.setTextColor(0xFF555555);
        versionAndCount.addView(version);
        headerCount = UiStyles.text(this, "0 PROFILES / 0 REELS",9,Color.BLACK,true);
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
        captureToggle=new Switch(this);
        captureToggle.setContentDescription("Capture session");
        captureToggle.setShowText(false);
        captureToggle.setMinHeight(UiStyles.dp(this,48));
        captureToggle.setOnCheckedChangeListener((button,checked)->{
            if(updatingCaptureToggle)return;
            if(checked)openAccessibilitySettings();
            else if(!ProfileAccessibilityService.stopCapture() && isAccessibilityEnabled())openAccessibilitySettings();
            refreshCaptureStatus();
        });
        top.addView(captureToggle);
        row.addView(top);
        row.addView(UiStyles.rule(this, 0xFFDDDDDD, 1), ruleMargin(0xFFDDDDDD, 1, 0, 14, 0, 0));
        return row;
    }

    private void refreshScreen() {
        loadedProfiles = ProfileStore.read(this);
        updateHeaderCount();
        refreshCaptureStatus();
        renderProfiles();
        renderReels();
        refreshPendingQueue();
    }

    private void refreshCaptureStatus() {
        boolean enabled = isAccessibilityEnabled();
        if(captureToggle!=null){
            updatingCaptureToggle=true;
            captureToggle.setChecked(enabled);
            updatingCaptureToggle=false;
        }
    }

    private void updateHeaderCount(){
        if(headerCount!=null)headerCount.setText(loadedProfiles.size()+" PROFILES / "+savedReelCount+" REELS");
    }

    private void showAppInformation(){
        ScrollView scroll=new ScrollView(this);
        LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);
        int padding=UiStyles.dp(this,20);content.setPadding(padding,padding,padding,padding);scroll.addView(content);
        information(content,"Capture session","Turn on the Capture session switch to open Android Accessibility settings. Enable dedgram there within 2 minutes, then open Instagram within 60 seconds. The switch reflects Android's actual accessibility state; opening settings alone does not turn capture on. Turn the switch off to stop capture and disable access. If Android cannot stop it directly, the switch opens settings so you can disable it there.\n\nCapture stops when you leave Instagram, lock the phone, press Stop in the queue overlay, or reach 30 minutes. Return to dedgram to start another session. Payment apps such as Google Pay may block payments while accessibility is enabled. Stop capture and verify the switch is off before making payments.");
        information(content,"Profiles","Open an Instagram profile at its header and tap the alien control once. Keep Instagram open until capture finishes. The app expands the bio, captures counts and the visible profile picture, opens About this account and, if needed, Former usernames, then returns automatically. No further taps are needed. Reel URL discovery is not part of profile capture.\n\nUsernames are deduplicated. Another tap refreshes the existing record while preserving its first-saved time. Profiles already saved are highlighted while Instagram is open. Older username-only records can be upgraded with another capture.");
        information(content,"Reels","Open an individual Instagram reel and tap the dedgram target control. It expands the caption, preserves the displayed posting date and its observation time, and opens Likes and plays. Likes, comments, reposts, shares, saves and plays are recorded independently. Captions preserve their original Unicode text, including emojis and non-Latin scripts. Relative dates are kept as displayed rather than converted into invented publication times.");
        information(content,"Reading saved results","Each profile and reel starts as a compact entry bar. Tap its bar to expand or collapse the full saved details. Entries work independently, and each choice is remembered across searches, tab changes and reopening the app. An exclamation mark keeps capture failures visible even when collapsed.\n\nNot shown means the verified Instagram UI did not expose the value; missing values are unknown, never zero. Failed fields show the actual extraction error. Rounded counts are labeled. Captured, finished and first-saved times use the phone's local timezone.\n\nShow saved header reveals the profile's original header text. A failed refresh can show the previous successful capture separately, so older values are not confused with the latest attempt. Capture and storage failures also appear in Instagram's status banner.");
        information(content,"Pending reel queue","Put pending_reels.json in Documents/dedgram, then use Choose dedgram folder to grant access to that exact directory. Start / resume opens accessibility settings for a fresh session and processes eligible URLs one at a time. Instagram opens the first pending reel automatically after access is enabled.\n\nOnly entries whose status is null are attempted; saved results are skipped on resume. Stop from the queue overlay or leave Instagram to pause. Reset a result's status to null deliberately if you want to retry it. Do not edit the queue file while it is running.");
        information(content,"Storage and privacy","Profiles: "+ProfileStore.storageLocation()+"\nReels: "+ReelStore.storageLocation()+"\nQueue: Documents/dedgram/pending_reels.json\n\nThe files are user-visible JSON documents. Profile capture saves the bio and a PNG crop of the visible avatar. The temporary full screenshot is discarded; the app does not collect other apps' text, screenshots or direct messages. Avatar capture requires Android 11 or newer. Catalog viewing needs no capture permission.");
        new AlertDialog.Builder(this).setTitle("About dedgram").setView(scroll).setPositiveButton("DONE",null).show();
    }

    private void information(LinearLayout content,String title,String body){
        content.addView(UiStyles.text(this,title,16,Color.BLACK,true),margin(0,12,0,0));
        TextView text=UiStyles.text(this,body,13,0xFF555555,false);
        text.setTextIsSelectable(true);text.setLineSpacing(UiStyles.dp(this,3),1f);
        content.addView(text,margin(0,6,0,10));
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
        savedReelCount=reels.size();
        updateHeaderCount();
        if (reelCount != null) reelCount.setText(reels.size() + (reels.size() == 1 ? " REEL" : " REELS"));
        if (reels.isEmpty()) {
            reelList.addView(UiStyles.text(this, "Nothing saved yet", 24, 0xFF312E81, true), margin(0, 20, 0, 0));
            return;
        }
        for (Reel reel : reels) reelList.addView(buildReelRow(reel));
    }

    private View buildReelRow(Reel reel) {
        String identity=reel.shortcode.isEmpty()?"captured:"+reel.capturedAt+":"+reel.account:"shortcode:"+reel.shortcode;
        String account=reel.account.isEmpty()?"Reel":"@"+reel.account;
        String label=account+" · "+(reel.shortcode.isEmpty()?ProfileDetailsView.dateTime(reel.capturedAt):reel.shortcode);
        return CollapsibleEntryView.create(this,"reel:"+identity,label,"reel "+label,reel.hasErrors(),0xFF312E81,()->buildReelDetails(reel));
    }

    private View buildReelDetails(Reel reel) {
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
        return empty;
    }

    private View buildEmptyState() {
        LinearLayout empty = new LinearLayout(this);
        empty.setOrientation(LinearLayout.VERTICAL);
        empty.setPadding(0, UiStyles.dp(this, 22), 0, UiStyles.dp(this, 22));
        empty.addView(UiStyles.text(this, "Nothing saved yet", 24, Color.BLACK, true), margin(0, 20, 0, 0));
        return empty;
    }

    private View buildProfileRow(Profile profile) {
        return CollapsibleEntryView.create(this,"profile:"+profile.normalizedUsername,"@"+profile.username,
                "profile @"+profile.username,profile.captureFailed(),Color.BLACK,()->buildProfileDetails(profile));
    }

    private View buildProfileDetails(Profile profile) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, UiStyles.dp(this, 14), 0, UiStyles.dp(this, 14));
        String captureStatus = profile.details.optString("capture_status", "username_only");
        row.addView(UiStyles.text(this, "failed".equals(captureStatus) ? "Profile fetch failed"
                : "complete".equals(captureStatus) ? "Profile details saved"
                : "Username only", 12,
                profile.captureFailed() ? 0xFF9A3412 : 0xFF555555, true), margin(0, 5, 0, 0));
        row.addView(UiStyles.text(this, "instagram.com/" + profile.normalizedUsername + "/", 12, 0xFF555555, false), margin(0, 5, 0, 0));
        row.addView(ProfileDetailsView.create(this, profile), margin(0, 10, 0, 0));
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
