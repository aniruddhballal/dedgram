package com.dedgram.collector;

import android.os.Handler;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.function.BiConsumer;

/** One automatic Share/Copy link sequence, followed by verification of the original reel. */
public final class ReelLinkCapture {
    public interface Host {
        AccessibilityNodeInfo root();
        void clipboard(long copyIssuedAt,BiConsumer<String,String> result);
        void finished(String url,String error,boolean returned,long copiedAt);
    }
    private final Host host;private final Handler handler;private final String expected;
    private boolean running=true;private int attempts;private String previous="",url,error;private long copiedAt;
    public ReelLinkCapture(Handler handler,Host host,String fingerprint){this.handler=handler;this.host=host;expected=fingerprint;}
    public void start(){initial();}
    public void cancel(){running=false;}
    private void later(Runnable action){handler.postDelayed(()->{if(running)action.run();},550L);}
    private void initial(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<6)later(this::initial);else finish(null,"Reel disappeared before link capture.",false);return;}
        String now=ReelLink.fingerprint(root);
        if(expected.isEmpty() || !expected.equals(now)){root.recycle();finish(null,"Reel identity changed before opening Share.",false);return;}
        if(!now.equals(previous)){previous=now;root.recycle();later(this::initial);return;}
        boolean opened=ReelLink.share(root);root.recycle();
        if(!opened){finish(null,"The reel's Share control could not be opened.",true);return;}
        attempts=0;later(this::sheet);
    }
    private void sheet(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::sheet);else finish(null,"Share sheet did not load.",false);return;}
        if(!ReelLink.hasCopy(root)){
            if(++attempts<8){root.recycle();later(this::sheet);return;}
            error="Copy link control was not exposed in the reel's Share sheet.";
            if(ReelLink.hasShareSheet(root))ReelLink.dismiss(root);
            root.recycle();attempts=0;later(this::returned);return;
        }
        copiedAt=System.currentTimeMillis();boolean copied=ReelLink.copy(root);root.recycle();
        if(!copied){error="The visible Copy link control could not be activated.";attempts=0;later(this::returned);return;}
        host.clipboard(copiedAt,(link,failure)->{
            if(!running)return;
            url=link;error=failure;attempts=0;later(this::returned);
        });
    }
    private void returned(){
        AccessibilityNodeInfo root=host.root();
        if(root==null){if(++attempts<8)later(this::returned);else finish(null,"Could not return to the captured reel after Copy link.",false);return;}
        if(ReelLink.hasShareSheet(root)){
            boolean dismissed=ReelLink.dismiss(root);root.recycle();
            if(dismissed && ++attempts<8){later(this::returned);return;}
            finish(null,"Could not dismiss the reel Share sheet.",false);return;
        }
        boolean same=expected.equals(ReelLink.fingerprint(root));root.recycle();
        if(!same){finish(null,"Reel identity changed during link capture; copied URL was discarded.",false);return;}
        finish(url,error,true);
    }
    private void finish(String link,String failure,boolean returned){if(!running)return;running=false;host.finished(link,failure,returned,copiedAt);}
}
