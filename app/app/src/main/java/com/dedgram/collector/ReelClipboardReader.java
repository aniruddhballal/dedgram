package com.dedgram.collector;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.TextView;
import java.util.function.BiConsumer;

/** Android permits clipboard reads only while focused; request focus briefly for this explicit copy. */
public final class ReelClipboardReader {
    private final Context context;private final WindowManager windows;private final Handler handler;
    private TextView focus;private long deadline,releaseUntil;
    public ReelClipboardReader(Context context,WindowManager windows,Handler handler){this.context=context;this.windows=windows;this.handler=handler;}
    public boolean active(){return focus!=null && SystemClock.elapsedRealtime()<deadline;}
    public boolean holdsFocus(){return focus!=null && SystemClock.elapsedRealtime()<deadline+300L;}
    public boolean restoringFocus(){return focus==null && SystemClock.elapsedRealtime()<releaseUntil;}
    public void close(){if(focus!=null){try{windows.removeView(focus);}catch(RuntimeException ignored){}focus=null;releaseUntil=SystemClock.elapsedRealtime()+500L;}}
    public void read(long copiedAt,BiConsumer<String,String> callback){
        if(Build.VERSION.SDK_INT<26){callback.accept(null,"Android cannot verify freshness of the copied link on this version.");return;}
        deadline=SystemClock.elapsedRealtime()+1800L;
        focus=new TextView(context);focus.setText("Reading reel link…");focus.setTextSize(14);focus.setTextColor(0xFFFFFFFF);focus.setBackgroundColor(0xFF202020);
        int padding=UiStyles.dp(context,12);focus.setPadding(padding,padding,padding,padding);focus.setFocusableInTouchMode(true);
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(-2,-2,WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL|WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM,PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL;params.y=UiStyles.dp(context,72);params.setTitle("dedgram copied reel link");
        try{windows.addView(focus,params);focus.requestFocus();handler.postDelayed(()->poll(copiedAt,callback),100L);}
        catch(RuntimeException failure){close();callback.accept(null,"Could not focus the copied-link reader.");}
    }
    static boolean fresh(long timestamp,long copiedAt,long now){return timestamp>=copiedAt && timestamp<=now;}
    @android.annotation.TargetApi(26)
    private void poll(long copiedAt,BiConsumer<String,String> callback){
        if(focus==null)return;
        if(!active()){close();callback.accept(null,"A fresh copied reel link was not readable; stale clipboard content was ignored.");return;}
        try{
            ClipboardManager clipboard=(ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE);
            ClipDescription description=focus.hasWindowFocus()?clipboard.getPrimaryClipDescription():null;
            if(description==null || !fresh(description.getTimestamp(),copiedAt,System.currentTimeMillis())){handler.postDelayed(()->poll(copiedAt,callback),150L);return;}
            ClipData data=clipboard.getPrimaryClip();
            if(data==null || data.getItemCount()!=1 || data.getItemAt(0).getText()==null)throw new Exception("Copied reel link is not plain text.");
            String text=data.getItemAt(0).getText().toString();if(text.length()>16384)throw new Exception("Copied reel link is unexpectedly large.");
            String canonical=ReelLink.canonical(text);close();callback.accept(canonical,null);
        }catch(Exception failure){close();callback.accept(null,"Copied reel URL could not be verified.");}
    }
}
