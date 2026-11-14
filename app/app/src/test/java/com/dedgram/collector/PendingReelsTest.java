package com.dedgram.collector;
import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import org.json.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class PendingReelsTest {
 @Test public void preservesOrderAndMetadataWhileSkippingFinishedEntries()throws Exception{
  PendingReels q=new PendingReels("{\"note\":\"keep\",\"reels\":[{\"url\":\"https://instagram.com/reel/ONE/\",\"status\":\"partial\"},{\"url\":\"https://instagram.com/reel/TWO/\",\"status\":null,\"username\":\"owner\"}]}");
  assertEquals(1,q.done());assertTrue(q.next().getString("url").contains("TWO"));q.result(q.next().getString("url"),"collected",null,"123");
  PendingReels reread=new PendingReels(q.document.toString());assertNull(reread.next());assertEquals("keep",reread.document.getString("note"));assertEquals("owner",reread.reels.getJSONObject(1).getString("username"));
 }
 @Test public void supportsArrayInputAndMissingStatusAsPending()throws Exception{PendingReels q=new PendingReels("[{\"url\":\"https://instagram.com/reel/ONE/\"}]");assertEquals(0,q.done());assertNotNull(q.next());}
 @Test public void normalizesUrlsWithoutAcceptingArbitraryDestinations()throws Exception{
  assertEquals("https://www.instagram.com/reel/ONE/",PendingReels.canonicalUrl("https://instagram.com/p/ONE/?igsh=tracking"));
  for(String url:new String[]{"http://instagram.com/reel/ONE/","https://instagram.com.evil/reel/ONE/","https://user@instagram.com/reel/ONE/","https://instagram.com/direct/","https://instagram.com:123/reel/ONE/"}){
   try{PendingReels.canonicalUrl(url);fail(url);}catch(JSONException expected){} }
 }
 @Test public void rejectsDuplicateAndInvalidQueues()throws Exception{
  for(String json:new String[]{"{\"reels\":[{\"url\":\"https://instagram.com/reel/ONE/\"},{\"url\":\"https://www.instagram.com/p/ONE/\"}]}","{\"reels\":[{\"url\":\"https://instagram.com/reel/ONE/\",\"status\":\"made_up\"}]}"}){
   try{new PendingReels(json);fail();}catch(JSONException expected){} }
 }
 @Test public void emptyAndUnexposedMetricsCannotBeCollected(){assertEquals("partial",PendingReels.outcome(new Reel()));Reel r=complete();assertEquals("collected",PendingReels.outcome(r));r.likes=null;r.likesAvailability="owner_only";assertEquals("collected",PendingReels.outcome(r));r.shares=null;assertEquals("partial",PendingReels.outcome(r));}
 @Test public void incompleteRetryRetainsOldValuesAndTheirActualTime()throws Exception{Reel old=complete();old.capturedAt="100";Reel latest=new Reel();latest.capturedAt="200";latest.likesError="Unavailable on latest capture";latest.retainMissingFrom(old);assertEquals(old.likes,latest.likes);assertEquals("Unavailable on latest capture",latest.likesError);assertEquals("100",latest.retainedObservations.getJSONObject("likes").getString("captured_at"));Reel copy=Reel.fromJson(latest.toJson());assertEquals("100",copy.retainedObservations.getJSONObject("likes").getString("captured_at"));}
 @Test public void validZeroAndNewValuesAreNeverReplacedByOlderOnes(){Reel old=complete();old.likes=20L;Reel latest=complete();latest.likes=0L;latest.retainMissingFrom(old);assertEquals(Long.valueOf(0),latest.likes);}
 @Test public void sharedFolderScopeIsExact(){assertTrue(SharedReelDocuments.validFolderId("primary:Documents/dedgram"));assertFalse(SharedReelDocuments.validFolderId("primary:Documents"));assertFalse(SharedReelDocuments.validFolderId("primary:Download/dedgram"));assertFalse(SharedReelDocuments.validFolderId("primary:Documents/dedgram-other"));}
 static Reel complete(){Reel r=new Reel();r.account="owner";r.capturedAt="123";r.caption="Caption";r.captionExpanded=true;r.datePosted="16h";r.likes=1L;r.comments=0L;r.viewsOrPlays=4L;r.shares=1L;r.reposts=0L;r.saves=0L;return r;}
}
