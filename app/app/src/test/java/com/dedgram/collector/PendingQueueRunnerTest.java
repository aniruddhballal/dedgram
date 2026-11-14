package com.dedgram.collector;
import android.content.*;import android.net.Uri;import android.os.*;import android.view.accessibility.AccessibilityNodeInfo;
import java.io.*;import java.nio.charset.StandardCharsets;import java.time.Duration;import java.util.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import static org.junit.Assert.*;import static org.robolectric.Shadows.shadowOf;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28) @LooperMode(LooperMode.Mode.PAUSED)
public class PendingQueueRunnerTest {
 private PendingQueueRunner runner;private Fake host;private Memory storage;
 @Before public void setup()throws Exception{storage=new Memory();host=new Fake();runner=new PendingQueueRunner(host,storage);}
 private class Memory implements PendingQueueRunner.Storage {
  String data="{\"reels\":[{\"url\":\"https://instagram.com/reel/ONE/\",\"status\":null,\"expected_account\":\"owner\"},{\"url\":\"https://instagram.com/reel/TWO/\",\"status\":null,\"expected_account\":\"owner\"}]}";
  public PendingReels read()throws Exception{return new PendingReels(data);}
  public void result(String u,String s,String d,String at)throws Exception{PendingReels q=read();q.result(u,s,d,at);data=q.document.toString();}
  public void progress(String s){}
 }
 @After public void cleanup(){runner.stop("test complete");}
 @Test public void sequentiallySavesThenCheckpointsEachUrl()throws Exception{runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(14));assertEquals(Arrays.asList("https://www.instagram.com/reel/ONE/","https://www.instagram.com/reel/TWO/"),host.opened);assertEquals(2,host.saved.size());assertEquals(2,storage.read().done());assertFalse(runner.isRunning());assertEquals("ONE",host.saved.get(0).shortcode);assertEquals("queue_deep_link_and_account_check",host.saved.get(0).identitySource);}
 @Test public void saveFailureDoesNotCheckpointOrAdvance()throws Exception{host.saveOk=false;runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(10));assertEquals(1,host.opened.size());assertEquals(0,storage.read().done());assertTrue(host.stopped);}
 @Test public void explicitStopLeavesUnattemptedStatusNull()throws Exception{runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(1));runner.stop("user stop");shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(10));assertEquals(0,storage.read().done());assertEquals(0,host.saved.size());}
 @Test public void visible429StopsWithoutOpeningNextUrl()throws Exception{host.block=true;runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(10));assertEquals(1,host.opened.size());assertEquals("rate_limited",storage.read().reels.getJSONObject(0).getString("status"));assertTrue(storage.read().reels.getJSONObject(1).isNull("status"));assertTrue(host.stopped);}
 @Test public void dismissibleSensitiveWarningContinuesCapture()throws Exception{host.sensitive=true;runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(16));assertEquals(1,host.confirmations);assertEquals(2,storage.read().done());assertFalse(host.stopped);}
 @Test public void persistentWarningIsClickedOnceThenStopsForReview()throws Exception{host.sensitive=true;host.stuckWarning=true;runner.start();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(10));assertEquals(1,host.confirmations);assertEquals("needs_review",storage.read().reels.getJSONObject(0).getString("status"));assertEquals(1,host.opened.size());assertTrue(host.stopped);}
 private class Fake implements PendingQueueRunner.Host {
  List<String> opened=new ArrayList<>();List<Reel> saved=new ArrayList<>();String caption="old";boolean stopped,saveOk=true,block,sensitive,stuckWarning;int confirmations;
  public AccessibilityNodeInfo root(){AccessibilityNodeInfo r=node("");if(sensitive&&!opened.isEmpty()){shadowOf(r).addChild(node("Sensitive content"));AccessibilityNodeInfo see=node("See reel");see.setClickable(true);shadowOf(see).setOnPerformActionListener((action,args)->{confirmations++;if(!stuckWarning)sensitive=false;return true;});shadowOf(r).addChild(see);return r;}if(block&&!opened.isEmpty()){shadowOf(r).addChild(node("HTTP 429 Too many requests"));return r;}for(String t:new String[]{"Repost","Share","Save"})shadowOf(r).addChild(node(t));AccessibilityNodeInfo author=node("owner");author.setViewIdResourceName("com.instagram.android:id/clips_author_username");shadowOf(r).addChild(author);AccessibilityNodeInfo text=node(caption+"...");text.setClickable(true);shadowOf(r).addChild(text);return r;}
  public void open(String u){opened.add(u);caption="Caption "+u.substring(u.lastIndexOf("/",u.length()-2)+1);}
  public void capture(){Reel r=PendingReelsTest.complete();runner.accept(r);}
  public void stopService(){stopped=true;}public void progress(String text){}
  public boolean save(Reel r){if(saveOk)saved.add(r);return saveOk;}
 }
 private static AccessibilityNodeInfo node(String text){AccessibilityNodeInfo n=AccessibilityNodeInfo.obtain();n.setPackageName(CaptureSession.INSTAGRAM_PACKAGE);n.setText(text);n.setVisibleToUser(true);return n;}
}
