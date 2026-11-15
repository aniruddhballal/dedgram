package com.dedgram.collector;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class ProfileStore {
    public enum SaveResult {
        ADDED,
        ALREADY_PRESENT,
        FAILED
    }

    private static final String FILE_NAME = "profiles.json";
    private static final String RELATIVE_PATH = Environment.DIRECTORY_DOCUMENTS + "/dedgram";
    // Instagram permits usernames to end in an underscore, but not a period.
    private static final Pattern USERNAME_PATTERN = Pattern.compile("[a-z0-9](?:[a-z0-9._]{0,28}[a-z0-9_])?");
    private static final Object LOCK = new Object();
    private static boolean readFailed;

    private ProfileStore() {}

    public static String storageLocation() {
        return RELATIVE_PATH + "/" + FILE_NAME;
    }

    public static String normalizeUsername(String value) {
        if (value == null) return "";
        String normalized = value.trim();
        if (normalized.startsWith("@")) normalized = normalized.substring(1);
        normalized = normalized.toLowerCase(Locale.ROOT);
        if (normalized.length() > 30 || !USERNAME_PATTERN.matcher(normalized).matches()) return "";
        return normalized;
    }

    public static List<Profile> read(Context context) {
        synchronized (LOCK) {
            readFailed = false;
            Uri uri;
            try { uri = document(context, false); }
            catch (Exception error) { readFailed = true; return new ArrayList<>(); }
            if (uri == null) return new ArrayList<>();
            try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                if (input == null) { readFailed = true; return new ArrayList<>(); }
                String json = new String(readAll(input), StandardCharsets.UTF_8);
                return parse(json);
            } catch (IOException | JSONException ignored) {
                readFailed = true;
                return new ArrayList<>();
            }
        }
    }

    public static boolean addIfAbsent(Context context, String username) {
        return add(context, username) == SaveResult.ADDED;
    }

    public static SaveResult add(Context context, String username) {
        String normalized = normalizeUsername(username);
        if (normalized.isEmpty()) return SaveResult.FAILED;
        synchronized (LOCK) {
            List<Profile> profiles = read(context);
            if (readFailed) return SaveResult.FAILED;
            Set<String> seen = new HashSet<>();
            for (Profile profile : profiles) {
                if (!profile.normalizedUsername.isEmpty()) seen.add(profile.normalizedUsername);
            }
            if (seen.contains(normalized)) return SaveResult.ALREADY_PRESENT;
            profiles.add(new Profile(username.trim().replaceFirst("^@", ""), normalized, Long.toString(System.currentTimeMillis())));
            return write(context, profiles) ? SaveResult.ADDED : SaveResult.FAILED;
        }
    }

    static List<Profile> parse(String json) throws JSONException {
        List<Profile> profiles = new ArrayList<>();
        if (json == null || json.trim().isEmpty()) throw new JSONException("Empty profile document");
        JSONArray array = new JSONObject(json).optJSONArray("profiles");
        if (array == null) throw new JSONException("Missing profiles array");
        Set<String> seen = new HashSet<>();
        for (int index = 0; index < array.length(); index += 1) {
            Profile profile = Profile.fromJson(array.getJSONObject(index));
            String normalized = normalizeUsername(profile.normalizedUsername);
            if (normalized.isEmpty() || seen.contains(normalized)) continue;
            seen.add(normalized);
            profiles.add(new Profile(profile.username, normalized, profile.firstSeenAt, profile.details));
        }
        return profiles;
    }

    private static boolean write(Context context, List<Profile> profiles) {
        ContentResolver resolver = context.getContentResolver();
        Uri uri;
        try { uri = document(context, false); }
        catch (Exception error) { return false; }
        boolean pending = false;
        if (uri != null) {
            try (InputStream input = resolver.openInputStream(uri)) {
                if (input == null) return false;
                byte[] bytes = readAll(input);
                parse(new String(bytes, StandardCharsets.UTF_8));
                try (java.io.FileOutputStream backup = context.openFileOutput("profiles-last-good.json", 0)) {
                    backup.write(bytes); backup.getFD().sync();
                }
            } catch (Exception error) { return false; }
        }
        if (uri == null && SharedReelDocuments.folder(context) != null) {
            try { uri = document(context, true); } catch (Exception error) { return false; }
        }
        if (uri == null) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, FILE_NAME);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, RELATIVE_PATH);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            uri = resolver.insert(MediaStore.Files.getContentUri("external"), values);
            pending = true;
            if (uri != null) try (Cursor check = resolver.query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
                if (check == null || !check.moveToFirst() || !FILE_NAME.equals(check.getString(0))) {
                    resolver.delete(uri, null, null); return false;
                }
            }
        }
        if (uri == null) return false;
        try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
            if (output == null) return false;
            JSONObject root = new JSONObject();
            root.put("version", 2);
            JSONArray array = new JSONArray();
            for (Profile profile : profiles) array.put(profile.toJson());
            root.put("profiles", array);
            output.write((root.toString(2) + "\n").getBytes(StandardCharsets.UTF_8));
            output.flush();
            if (pending) {
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, ready, null, null);
            }
            try (InputStream check = resolver.openInputStream(uri)) {
                if (check == null) return false;
                return parse(new String(readAll(check), StandardCharsets.UTF_8)).size() == profiles.size();
            }
        } catch (IOException | JSONException error) {
            if (pending) resolver.delete(uri, null, null);
            return false;
        }
    }

    public static boolean saveCapture(Context context, Profile captured) {
        synchronized (LOCK) {
            try {
                List<Profile> profiles = read(context);
                if (readFailed) return false;
                boolean replaced = false;
                for (int i=0; i<profiles.size(); i++) {
                    Profile old = profiles.get(i);
                    if (!old.normalizedUsername.equals(captured.normalizedUsername)) continue;
                    JSONObject merged = new JSONObject(old.details.toString());
                    // Keep the last successful complete observation if a later attempt fails.
                    if (captured.captureFailed() && "complete".equals(old.details.optString("capture_status"))) {
                        JSONObject lastGood = new JSONObject(old.details.toString());
                        lastGood.remove("last_successful_capture");
                        merged.put("last_successful_capture", lastGood);
                    }
                    if (!captured.captureFailed()) merged.remove("last_successful_capture");
                    java.util.Iterator<String> keys = captured.details.keys();
                    while (keys.hasNext()) { String key=keys.next(); merged.put(key, captured.details.get(key)); }
                    profiles.set(i, new Profile(captured.username, captured.normalizedUsername, old.firstSeenAt, merged));
                    replaced = true; break;
                }
                if (!replaced) profiles.add(0, captured);
                return write(context, profiles);
            } catch (Exception error) { return false; }
        }
    }

    private static Uri document(Context context, boolean create) throws Exception {
        return SharedReelDocuments.folder(context) == null ? findFile(context.getContentResolver())
                : SharedReelDocuments.file(context, FILE_NAME, create);
    }

    private static Uri findFile(ContentResolver resolver) {
        Uri collection = MediaStore.Files.getContentUri("external");
        String[] projection = {MediaStore.MediaColumns._ID};
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?";
        String[] args = {FILE_NAME, RELATIVE_PATH + "/"};
        Uri uri = findFile(resolver, collection, projection, selection, args);
        if (uri != null) return uri;

        // Accept the provider's alternate trailing-slash form, never unrelated folders.
        return findFile(resolver, collection, projection,
                selection, new String[]{FILE_NAME, RELATIVE_PATH});
    }

    private static Uri findFile(ContentResolver resolver, Uri collection, String[] projection,
                                String selection, String[] args) {
        try (Cursor cursor = resolver.query(collection, projection, selection, args, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                long id = cursor.getLong(0);
                return Uri.withAppendedPath(collection, Long.toString(id));
            }
        }
        return null;
    }

    private static byte[] readAll(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
        return output.toByteArray();
    }
}
