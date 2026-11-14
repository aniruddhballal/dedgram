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
import java.util.List;

public final class ReelStore {
    private static final String FILE_NAME = "reels.json";
    private static final String RELATIVE_PATH = Environment.DIRECTORY_DOCUMENTS + "/dedgram";
    private static final Object LOCK = new Object();
    private static boolean readFailed;

    private ReelStore() {}

    public static String storageLocation() {
        return RELATIVE_PATH + "/" + FILE_NAME;
    }

    public static List<Reel> read(Context context) {
        synchronized (LOCK) {
            readFailed=false;
            Uri uri;
            try { uri = SharedReelDocuments.folder(context) == null ? findFile(context.getContentResolver()) : SharedReelDocuments.file(context,"reels.json",false); }
            catch(Exception e){readFailed=true;return new ArrayList<>();}
            if (uri == null) return new ArrayList<>();
            try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                if (input == null) return new ArrayList<>();
                JSONObject root = new JSONObject(new String(readAll(input), StandardCharsets.UTF_8));
                JSONArray array = root.optJSONArray("reels");
                List<Reel> result = new ArrayList<>();
                if (array == null) return result;
                for (int index = 0; index < array.length(); index++) {
                    JSONObject object = array.optJSONObject(index);
                    if (object != null) result.add(Reel.fromJson(object));
                }
                return result;
            } catch (IOException | JSONException ignored) {
                readFailed=true;
                return new ArrayList<>();
            }
        }
    }

    public static boolean addOrReplace(Context context, Reel reel) {
        synchronized (LOCK) {
            List<Reel> reels = read(context);
            if(readFailed)return false;
            String identity = identity(reel);
            boolean replaced = false;
            for (int index = 0; index < reels.size(); index++) {
                if (identity.equals(identity(reels.get(index)))) {
                    reel.retainMissingFrom(reels.get(index));
                    reels.set(index, reel);
                    replaced = true;
                    break;
                }
            }
            if (!replaced) reels.add(0, reel);
            return write(context, reels);
        }
    }

    private static String identity(Reel reel) {
        if (reel.shortcode != null && !reel.shortcode.isEmpty()) return "shortcode:" + reel.shortcode;
        return "captured:" + reel.capturedAt + ":" + reel.account;
    }

    private static boolean write(Context context, List<Reel> reels) {
        if(SharedReelDocuments.folder(context)!=null)return writeExactDocument(context,reels);
        ContentResolver resolver = context.getContentResolver();
        Uri uri = findFile(resolver);
        boolean pending = false;
        if (uri == null) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, FILE_NAME);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, RELATIVE_PATH);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            uri = resolver.insert(MediaStore.Files.getContentUri("external"), values);
            pending = true;
            if(uri!=null)try(Cursor check=resolver.query(uri,new String[]{MediaStore.MediaColumns.DISPLAY_NAME},null,null,null)){
                if(check==null||!check.moveToFirst()||!FILE_NAME.equals(check.getString(0))){resolver.delete(uri,null,null);return false;}
            }
        }
        if (uri == null) return false;
        if(!pending)try(InputStream previous=resolver.openInputStream(uri)){
            if(previous==null)return false;byte[] bytes=readAll(previous);new JSONObject(new String(bytes,StandardCharsets.UTF_8));
            try(java.io.FileOutputStream backup=context.openFileOutput("reels-last-good.json",0)){backup.write(bytes);backup.getFD().sync();}
        }catch(IOException|JSONException e){return false;}
        try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
            if (output == null) return false;
            JSONObject root = new JSONObject();
            root.put("version", 1);
            JSONArray array = new JSONArray();
            for (Reel reel : reels) array.put(reel.toJson());
            root.put("reels", array);
            output.write((root.toString(2) + "\n").getBytes(StandardCharsets.UTF_8));
            output.flush();
            if (pending) {
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, ready, null, null);
            }
            return true;
        } catch (IOException | JSONException error) {
            if (pending) resolver.delete(uri, null, null);
            return false;
        }
    }

    private static boolean writeExactDocument(Context context,List<Reel> reels) {
        try {
            ContentResolver resolver=context.getContentResolver();Uri existing=SharedReelDocuments.file(context,"reels.json",false);
            if(existing!=null)try(InputStream previous=resolver.openInputStream(existing)){
                if(previous==null)return false;byte[] bytes=readAll(previous);new JSONObject(new String(bytes,StandardCharsets.UTF_8));
                try(java.io.FileOutputStream backup=context.openFileOutput("reels-last-good.json",0)){backup.write(bytes);backup.getFD().sync();}
            }
            Uri uri=existing==null?SharedReelDocuments.file(context,"reels.json",true):existing;
            JSONObject root=new JSONObject();JSONArray records=new JSONArray();for(Reel r:reels)records.put(r.toJson());root.put("version",1).put("reels",records);
            try(OutputStream output=resolver.openOutputStream(uri,"rwt")){if(output==null)return false;output.write((root.toString(2)+"\n").getBytes(StandardCharsets.UTF_8));output.flush();}
            try(InputStream check=resolver.openInputStream(uri)){if(check==null)return false;JSONObject verified=new JSONObject(new String(readAll(check),StandardCharsets.UTF_8));return verified.getJSONArray("reels").length()==reels.size();}
        }catch(Exception error){return false;}
    }

    private static Uri findFile(ContentResolver resolver) {
        Uri collection = MediaStore.Files.getContentUri("external");
        String[] projection = {MediaStore.MediaColumns._ID};
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND "
                + MediaStore.MediaColumns.RELATIVE_PATH + "=?";
        String[] args = {FILE_NAME, RELATIVE_PATH + "/"};
        Uri uri = findFile(resolver, collection, projection, selection, args);
        if (uri != null) return uri;
        return findFile(resolver, collection, projection,
                MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?", new String[]{FILE_NAME, RELATIVE_PATH});
    }

    private static Uri findFile(ContentResolver resolver, Uri collection, String[] projection,
                                String selection, String[] args) {
        try (Cursor cursor = resolver.query(collection, projection, selection, args, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                return Uri.withAppendedPath(collection, Long.toString(cursor.getLong(0)));
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
