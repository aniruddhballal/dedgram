package com.dedgram.collector;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;

/** Draws dedgram's target/logo for reel collection. */
public final class ReelBubbleDrawable extends Drawable {
    private final Drawable mark;

    public ReelBubbleDrawable(Context context) {
        mark = context.getDrawable(R.drawable.dedgram_mark);
    }

    @Override
    public void draw(Canvas canvas) {
        Rect bounds = getBounds();
        if (bounds.isEmpty()) return;
        mark.setBounds(bounds.left, bounds.top, bounds.right, bounds.bottom);
        mark.draw(canvas);
    }

    @Override public void setAlpha(int alpha) { mark.setAlpha(alpha); invalidateSelf(); }
    @Override public void setColorFilter(android.graphics.ColorFilter colorFilter) { mark.setColorFilter(colorFilter); invalidateSelf(); }
    @Override public int getOpacity() { return android.graphics.PixelFormat.TRANSLUCENT; }
    @Override public int getIntrinsicWidth() { return 54; }
    @Override public int getIntrinsicHeight() { return 54; }
}
