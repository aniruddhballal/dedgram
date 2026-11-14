package com.dedgram.collector;
import android.widget.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import org.robolectric.util.ReflectionHelpers;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28) @LooperMode(LooperMode.Mode.PAUSED)
public class PendingQueueUiTest {
 @Test public void queueCountAndCtaBelongToReelMode(){org.robolectric.android.controller.ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();try{MainActivity a=c.get();TextView count=ReflectionHelpers.getField(a,"pendingCount");LinearLayout reels=ReflectionHelpers.getField(a,"reelModeContainer");assertSame(reels,count.getParent().getParent());TextView start=ReflectionHelpers.getField(a,"pendingStart");assertSame(count.getParent(),start.getParent());assertFalse(start.isEnabled());}finally{c.pause().stop().destroy();}}
}
