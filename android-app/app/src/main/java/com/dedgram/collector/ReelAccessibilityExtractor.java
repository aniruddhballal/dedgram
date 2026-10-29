package com.dedgram.collector;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Rect;
import android.os.Build;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads reel details from the active Instagram reel UI only. */
public final class ReelAccessibilityExtractor {
    private static final Pattern URL_PATTERN = Pattern.compile(
            "instagram\\.com/(?:reel|reels)/([A-Za-z0-9_-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE_PATTERN = Pattern.compile(
            "(?i)\\b(?:[0-9]{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)|"
                    + "(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+[0-9]{1,2})\\b");
    private static final Pattern COUNT_PATTERN = Pattern.compile(
            "(?i)^\\s*([0-9][0-9,.]*)(?:\\s*)([KMB])?\\b.*$");
    private static final Pattern EMBEDDED_COUNT_PATTERN = Pattern.compile(
            "(?i)(?:number is|reposted|reshare number is|save number is)\\s*([0-9][0-9,.]*)(?:\\s*)([KMB])?");
    private static final String[] MONTHS = {
            "january", "february", "march", "april", "may", "june", "july",
            "august", "september", "october", "november", "december"
    };

    private ReelAccessibilityExtractor() {}

    public static Snapshot snapshot(AccessibilityNodeInfo root) {
        List<Entry> entries = new ArrayList<>();
        collect(root, entries);
        return new Snapshot(entries);
    }

    public static final class Snapshot {
        private final List<Entry> entries;

        private Snapshot(List<Entry> entries) {
            this.entries = entries;
        }

        public boolean isLikelyReel() {
            return findLabel("repost") >= 0 && (findLabel("share") >= 0 || findLabel("save") >= 0);
        }

        public boolean hasLikesAndPlaysSheet() {
            return indexContaining("likes and plays") >= 0;
        }

        public Long metric(String label) {
            return countAfter(label, 10);
        }

        public Long playsFromSheet() {
            int title = indexContaining("likes and plays");
            if (title < 0) return null;
            Long second = null;
            int found = 0;
            for (int index = title + 1; index < entries.size() && index < title + 100; index++) {
                Long count = parseCount(entries.get(index).display());
                if (count == null) continue;
                if (found++ == 1) {
                    second = count;
                    break;
                }
            }
            return second;
        }

        public String account() {
            for (Entry entry : entries) {
                String value = entry.text().trim();
                if (value.startsWith("@")) value = value.substring(1);
                String normalized = ProfileStore.normalizeUsername(value);
                if (!normalized.isEmpty() && !isCommonUiWord(normalized)) return normalized;
            }
            return "";
        }

        public String shortcode() {
            for (Entry entry : entries) {
                Matcher matcher = URL_PATTERN.matcher(entry.display());
                if (matcher.find()) return matcher.group(1);
            }
            return "";
        }

        public String datePosted() {
            for (Entry entry : entries) {
                Matcher matcher = DATE_PATTERN.matcher(entry.display());
                if (matcher.find()) return matcher.group();
            }
            return "";
        }

        public String caption() {
            Entry best = null;
            int bestScore = 0;
            for (Entry entry : entries) {
                String value = entry.text().trim();
                if (!isCaptionCandidate(value)) continue;
                int score = value.length();
                if (containsCaptionSignal(value)) score += 1000;
                if (score > bestScore) {
                    bestScore = score;
                    best = entry;
                }
            }
            return best == null ? "" : best.text().trim();
        }

        public boolean captionLooksTruncated() {
            String caption = caption();
            return caption.endsWith("...") || caption.endsWith("…") || caption.contains("…");
        }

        private int findLabel(String label) {
            String wanted = label.toLowerCase(Locale.ROOT);
            for (int index = 0; index < entries.size(); index++) {
                String value = entries.get(index).display().trim().toLowerCase(Locale.ROOT);
                if (value.equals(wanted) || value.startsWith(wanted + ",") || value.startsWith(wanted + " ")) return index;
            }
            return -1;
        }

        private int indexContaining(String value) {
            String wanted = value.toLowerCase(Locale.ROOT);
            for (int index = 0; index < entries.size(); index++) {
                if (entries.get(index).display().toLowerCase(Locale.ROOT).contains(wanted)) return index;
            }
            return -1;
        }

        private Long countAfter(String label, int maxDistance) {
            int start = findLabel(label);
            if (start < 0) return null;
            for (int index = start; index < entries.size() && index <= start + maxDistance; index++) {
                Long count = parseCount(entries.get(index).display());
                if (count != null) return count;
            }
            return null;
        }
    }

    public static boolean clickLikesCount(AccessibilityNodeInfo root, AccessibilityService service) {
        Snapshot snapshot = snapshot(root);
        int label = snapshot.findLabel("like");
        if (label < 0) return false;
        for (int index = label + 1; index < snapshot.entries.size() && index <= label + 8; index++) {
            Entry entry = snapshot.entries.get(index);
            String description = entry.display().toLowerCase(Locale.ROOT);
            if (parseCount(entry.display()) == null && !description.contains("like number")
                    && !description.contains("view likes")) continue;
            return click(entry, service);
        }
        return false;
    }

    public static boolean clickCaptionExpansion(AccessibilityNodeInfo root, AccessibilityService service) {
        Snapshot snapshot = snapshot(root);
        for (Entry entry : snapshot.entries) {
            String value = entry.text().trim();
            if ((value.endsWith("...") || value.endsWith("…")) && isCaptionCandidate(value)) {
                return click(entry, service);
            }
        }
        return false;
    }

    private static boolean click(Entry entry, AccessibilityService service) {
        Rect bounds = new Rect();
        entry.node.getBoundsInScreen(bounds);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !bounds.isEmpty()) {
            GestureDescription.Builder builder = new GestureDescription.Builder();
            android.graphics.Path path = new android.graphics.Path();
            path.moveTo(bounds.centerX(), bounds.centerY());
            builder.addStroke(new GestureDescription.StrokeDescription(path, 0, 80));
            if (service.dispatchGesture(builder.build(), null, null)) return true;
        }
        if (entry.node.isClickable() && entry.node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
        AccessibilityNodeInfo parent = entry.node.getParent();
        if (parent != null) {
            boolean clicked = parent.isClickable() && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            parent.recycle();
            if (clicked) return true;
        }
        return false;
    }

    private static void collect(AccessibilityNodeInfo node, List<Entry> entries) {
        if (node == null) return;
        String text = node.getText() == null ? "" : node.getText().toString();
        String description = node.getContentDescription() == null ? "" : node.getContentDescription().toString();
        if (!text.trim().isEmpty() || !description.trim().isEmpty()) entries.add(new Entry(node, text, description));
        for (int index = 0; index < node.getChildCount(); index++) collect(node.getChild(index), entries);
    }

    private static Long parseCount(String value) {
        if (value == null) return null;
        String normalized = value.replace("\u00a0", " ").trim();
        Matcher matcher = COUNT_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            matcher = EMBEDDED_COUNT_PATTERN.matcher(normalized);
            if (!matcher.find()) return null;
        }
        try {
            double number = Double.parseDouble(matcher.group(1).replace(",", ""));
            String suffix = matcher.group(2);
            if (suffix != null) {
                if (suffix.equalsIgnoreCase("K")) number *= 1000d;
                else if (suffix.equalsIgnoreCase("M")) number *= 1000000d;
                else if (suffix.equalsIgnoreCase("B")) number *= 1000000000d;
            }
            return Math.round(number);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static boolean isCaptionCandidate(String value) {
        if (value.length() < 12 || value.length() > 4000) return false;
        String lower = value.toLowerCase(Locale.ROOT);
        String[] excluded = {"add comment", "what do you think", "see translation", "follow", "try it",
                "likes and plays", "liked by", "video player", "adjust volume", "press to play",
                "reels navigation", "navigate to", "ai-generated profile", "instagram.com"};
        for (String item : excluded) if (lower.contains(item)) return false;
        if (lower.contains("profile picture of ")) return false;
        if (parseCount(value) != null) return false;
        return true;
    }

    private static boolean containsCaptionSignal(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character >= 0x3000 || character == '#' || character == '@' || character == '\n') return true;
        }
        return false;
    }

    private static boolean isCommonUiWord(String value) {
        if (value.equals("reels") || value.equals("instagram") || value.equals("video")) return true;
        for (String month : MONTHS) if (value.equals(month)) return true;
        return false;
    }

    private static final class Entry {
        private final AccessibilityNodeInfo node;
        private final String text;
        private final String description;

        private Entry(AccessibilityNodeInfo node, String text, String description) {
            this.node = node;
            this.text = text;
            this.description = description;
        }

        private String text() { return text.isEmpty() ? description : text; }
        private String display() { return text.isEmpty() ? description : text; }
    }
}
