package com.dedgram.collector;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

/** One edge handle at rest; a non-focusable fan menu exists only while explicitly expanded. */
final class QuickBallOverlay {
    interface Actions { void profile(TextView source);void reel(TextView source);void analysis(); }
    private final Context context;
    private final WindowManager windows;
    private final Handler handler;
    private final Actions actions;
    private final SharedPreferences preferences;
    final TextView profileButton,reelButton,analysisButton;
    final TextView handle;
    private final QuickBallDrawable handleIcon=new QuickBallDrawable(QuickBallDrawable.HANDLE);
    private FrameLayout menu;
    private WindowManager.LayoutParams position;
    private boolean attached,right,saved,busy,hidden,disposed;
    private int width,height,generation;
    QuickBallOverlay(Context context,WindowManager windows,Handler handler,Actions actions){
        this.context=context;this.windows=windows;this.handler=handler;this.actions=actions;
        preferences=context.getSharedPreferences("quick_ball_position",Context.MODE_PRIVATE);
        right=preferences.getBoolean("right",false);
        handle=new TextView(context);handle.setBackground(handleIcon);
        handle.setContentDescription("dedgram quick menu. Tap to open; drag to move.");
        handle.setOnClickListener(v->expand());
        profileButton=button("Profile","Capture profile details",QuickBallDrawable.PROFILE);
        reelButton=button("Reel","Capture current reel details",QuickBallDrawable.REEL);
        analysisButton=button("Analyze","Complete analysis: profile and all reels",QuickBallDrawable.ANALYSIS);
        profileButton.setOnClickListener(v->choose(0));reelButton.setOnClickListener(v->choose(1));analysisButton.setOnClickListener(v->choose(2));
        installDrag();
    }
    private int dp(float value){return Math.round(value*context.getResources().getDisplayMetrics().density);}
    @android.annotation.SuppressLint("RtlHardcoded") // Docking is to the physical edge chosen by dragging, in every locale.
    private WindowManager.LayoutParams params(int w,int h,String title){
        WindowManager.LayoutParams p=new WindowManager.LayoutParams(w,h,WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,PixelFormat.TRANSLUCENT);
        p.gravity=Gravity.TOP|Gravity.LEFT;p.setTitle(title);return p;
    }
    private TextView button(String label,String description,int kind){
        TextView v=new TextView(context);v.setText(label);v.setTextSize(12);v.setTextColor(0xFFF2F5FA);
        v.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);v.setTypeface(android.graphics.Typeface.DEFAULT,android.graphics.Typeface.BOLD);
        v.setContentDescription(description);v.setCompoundDrawablePadding(dp(6));
        QuickBallDrawable icon=new QuickBallDrawable(kind);icon.setBounds(0,0,dp(48),dp(48));v.setCompoundDrawables(null,icon,null,null);
        v.setElevation(dp(6));v.setPadding(0,dp(2),0,0);
        v.setBackground(new QuickBallDrawable(QuickBallDrawable.LABEL));
        android.util.TypedValue ripple=new android.util.TypedValue();
        if(context.getTheme().resolveAttribute(android.R.attr.selectableItemBackgroundBorderless,ripple,true))v.setForeground(context.getDrawable(ripple.resourceId));
        return v;
    }
    void show(){
        if(disposed)return;
        int nextWidth=context.getResources().getDisplayMetrics().widthPixels,nextHeight=context.getResources().getDisplayMetrics().heightPixels;
        if(attached && nextWidth==width && nextHeight==height)return;
        if(attached){collapse();try{windows.removeView(handle);}catch(IllegalArgumentException ignored){}attached=false;}
        width=nextWidth;height=nextHeight;
        position=params(dp(24),dp(64),"dedgram quick ball");position.x=right?width-position.width:0;
        float fraction=preferences.getFloat("height_fraction",0.43f);
        position.y=bound(Math.round(height*fraction)-position.height/2,dp(88),Math.max(dp(88),height-dp(168)));
        try{
            windows.addView(handle,position);attached=true;state(saved,busy);handle.setVisibility(hidden?View.INVISIBLE:View.VISIBLE);
            // Reserve only this tiny handle, so dragging it cannot become Android's edge-Back gesture.
            if(android.os.Build.VERSION.SDK_INT>=29)handle.setSystemGestureExclusionRects(
                    java.util.Collections.singletonList(new android.graphics.Rect(0,0,position.width,position.height)));
        }
        catch(WindowManager.BadTokenException|SecurityException ignored){}
    }
    boolean expanded(){return menu!=null;}
    private static int bound(int value,int min,int max){return Math.max(min,Math.min(value,max));}
    void state(boolean saved,boolean busy){
        this.saved=saved;this.busy=busy;handleIcon.state(right,saved,busy);
        for(TextView v:new TextView[]{profileButton,reelButton,analysisButton}){v.setEnabled(!busy);v.setAlpha(busy?0.45f:1f);}
        ((QuickBallDrawable)profileButton.getCompoundDrawables()[1]).state(false,saved,busy);
    }
    void hidden(boolean hidden){this.hidden=hidden;if(hidden)collapse();handle.setVisibility(hidden?View.INVISIBLE:View.VISIBLE);}
    void expand(){
        if(!attached || disposed || hidden || menu!=null)return;
        FrameLayout panel=new FrameLayout(context);panel.setBackgroundColor(0x55000000);
        panel.setContentDescription("dedgram capture actions. Tap outside to close.");panel.setOnClickListener(v->collapse());
        int center=bound(position.y+position.height/2,dp(144),Math.max(dp(144),height-dp(176)));
        add(panel,profileButton,dp(82),center-dp(76));add(panel,reelButton,dp(130),center);add(panel,analysisButton,dp(82),center+dp(76));
        TextView close=new TextView(context);close.setBackground(new QuickBallDrawable(QuickBallDrawable.CLOSE));
        close.setContentDescription("Close capture menu");close.setOnClickListener(v->collapse());
        FrameLayout.LayoutParams hub=new FrameLayout.LayoutParams(dp(44),dp(44));hub.leftMargin=right?width-dp(44):0;hub.topMargin=center-dp(22);panel.addView(close,hub);
        try{
            windows.addView(panel,params(-1,-1,"dedgram quick menu"));menu=panel;handle.setVisibility(View.INVISIBLE);
            for(TextView v:new TextView[]{profileButton,reelButton,analysisButton}){
                v.setAlpha(0);v.setTranslationX(right?dp(18):-dp(18));
                v.animate().alpha(busy?0.45f:1f).translationX(0).setDuration(160).start();
            }
        }catch(WindowManager.BadTokenException|SecurityException ignored){detachButtons(panel);}
    }
    private void add(FrameLayout panel,TextView button,int distance,int center){
        FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(dp(84),dp(76));
        layout.leftMargin=right?width-distance-dp(42):distance-dp(42);layout.topMargin=center-dp(34);panel.addView(button,layout);
    }
    private void detachButtons(FrameLayout panel){
        for(TextView v:new TextView[]{profileButton,reelButton,analysisButton}){v.animate().cancel();panel.removeView(v);}
    }
    void collapse(){
        if(menu==null)return;FrameLayout old=menu;menu=null;detachButtons(old);
        try{windows.removeView(old);}catch(IllegalArgumentException ignored){}
        if(attached)handle.setVisibility(hidden?View.INVISIBLE:View.VISIBLE);
    }
    private void choose(int action){
        if(busy || disposed)return;collapse();final int token=++generation;
        // Remove the menu from Instagram's view and screenshot before starting navigation.
        handler.postDelayed(()->{
            if(disposed || generation!=token)return;
            if(action==0)actions.profile(profileButton);else if(action==1)actions.reel(reelButton);else actions.analysis();
        },100L);
    }
    @android.annotation.SuppressLint("ClickableViewAccessibility") // A non-drag ACTION_UP calls performClick; actions have explicit labels.
    private void installDrag(){
        handle.setOnTouchListener(new View.OnTouchListener(){
            float downX,downY;int startX,startY;boolean dragging;
            public boolean onTouch(View v,MotionEvent e){
                switch(e.getActionMasked()){
                    case MotionEvent.ACTION_DOWN:downX=e.getRawX();downY=e.getRawY();startX=position.x;startY=position.y;dragging=false;return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx=e.getRawX()-downX,dy=e.getRawY()-downY;
                        if(Math.hypot(dx,dy)>ViewConfiguration.get(context).getScaledTouchSlop())dragging=true;
                        if(dragging){position.x=bound(startX+Math.round(dx),0,width-position.width);position.y=bound(startY+Math.round(dy),dp(88),height-dp(168));update();}return true;
                    case MotionEvent.ACTION_UP:if(dragging)dock();else v.performClick();return true;
                    case MotionEvent.ACTION_CANCEL:if(dragging)dock();return true;
                    default:return true;
                }
            }
        });
    }
    private void dock(){
        right=position.x+position.width/2>width/2;position.x=right?width-position.width:0;handleIcon.state(right,saved,busy);update();
        preferences.edit().putBoolean("right",right).putFloat("height_fraction",(position.y+position.height/2f)/height).apply();
    }
    private void update(){if(attached)try{windows.updateViewLayout(handle,position);}catch(IllegalArgumentException ignored){}}
    void dispose(){
        disposed=true;generation++;collapse();
        if(attached)try{windows.removeView(handle);}catch(IllegalArgumentException ignored){}
        attached=false;
    }
}
