package com.dedgram.collector;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.function.Supplier;

/** Independent, remembered expansion state; expensive details are created on first expansion. */
public final class CollapsibleEntryView {
    private CollapsibleEntryView() {}
    public static View create(Context context,String key,String label,String description,boolean failed,int color,Supplier<View> details){
        SharedPreferences preferences=context.getSharedPreferences("catalog_expansion",Context.MODE_PRIVATE);
        LinearLayout entry=new LinearLayout(context);entry.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bar=new LinearLayout(context);bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setMinimumHeight(UiStyles.dp(context,56));
        bar.setPadding(UiStyles.dp(context,12),UiStyles.dp(context,8),UiStyles.dp(context,12),UiStyles.dp(context,8));
        bar.setBackground(UiStyles.outline(context,Color.WHITE,0xFFDDDDDD));bar.setFocusable(true);
        TextView title=UiStyles.text(context,label,15,color,true);title.setSingleLine(true);title.setEllipsize(TextUtils.TruncateAt.END);
        title.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        bar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        if(failed){
            TextView warning=UiStyles.text(context,"!",16,0xFF9A3412,true);
            warning.setPadding(UiStyles.dp(context,10),0,UiStyles.dp(context,10),0);
            warning.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);bar.addView(warning);
        }
        TextView arrow=UiStyles.text(context,"▸",20,color,true);
        arrow.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);bar.addView(arrow);
        LinearLayout body=new LinearLayout(context);body.setOrientation(LinearLayout.VERTICAL);
        final boolean[] expanded={preferences.getBoolean(key,false)};
        Runnable refresh=()->{
            if(expanded[0] && body.getChildCount()==0)body.addView(details.get());
            body.setVisibility(expanded[0]?View.VISIBLE:View.GONE);
            arrow.setText(expanded[0]?"▾":"▸");bar.setSelected(expanded[0]);
            bar.setContentDescription((expanded[0]?"Collapse ":"Expand ")+description+(failed?", capture errors":""));
        };
        bar.setOnClickListener(v->{expanded[0]=!expanded[0];preferences.edit().putBoolean(key,expanded[0]).apply();refresh.run();});
        bar.setAccessibilityDelegate(new View.AccessibilityDelegate(){
            @Override public void onInitializeAccessibilityNodeInfo(View host,AccessibilityNodeInfo info){
                super.onInitializeAccessibilityNodeInfo(host,info);info.setClassName("android.widget.Button");
            }
        });
        LinearLayout.LayoutParams spacing=new LinearLayout.LayoutParams(-1,-2);spacing.topMargin=UiStyles.dp(context,10);
        entry.addView(bar,spacing);entry.addView(body);refresh.run();return entry;
    }
}
