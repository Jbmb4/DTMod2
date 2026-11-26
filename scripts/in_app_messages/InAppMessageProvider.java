package com.dtunnel.inapp;

import android.app.ActivityManager;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Experimental foreground-only inbox poller injected into generated APKs. */
public final class InAppMessageProvider extends ContentProvider {
    private static volatile boolean started;

    @Override public boolean onCreate() {
        Context context = getContext();
        if (context == null) return false;
        synchronized (InAppMessageProvider.class) {
            if (!started) {
                started = true;
                Thread poller = new Thread(new Poller(context.getApplicationContext()), "dtmod-in-app-inbox");
                poller.setDaemon(true);
                poller.start();
            }
        }
        return true;
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) { return null; }
    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] args) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }

    private static final class Poller implements Runnable {
        private final Context context;
        private long cursor;
        private String userId;
        private String key;

        Poller(Context context) { this.context = context; }

        @Override public void run() {
            try {
                userId = readAsset("user_id.txt").trim();
                key = readAsset("registration_key.txt").trim();
                JSONObject config = new JSONObject(readAsset("dtunnelmod.json"));
                String panel = config.optString("url", "").trim();
                if (userId.isEmpty() || key.isEmpty() || !panel.startsWith("https://")) return;
                cursor = context.getSharedPreferences("dtmod-in-app-inbox", Context.MODE_PRIVATE)
                        .getLong("cursor", 0L);
                while (!Thread.currentThread().isInterrupted()) {
                    if (isVisible()) pollOnce();
                    Thread.sleep(30000L);
                }
            } catch (Exception ignored) {
                // Missing assets or transient setup errors disable this experimental poller safely.
            }
        }

        private String readAsset(String name) throws Exception {
            try (InputStream input = context.getAssets().open(name);
                 BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                StringBuilder text = new StringBuilder();
                char[] buffer = new char[2048];
                int count;
                while ((count = reader.read(buffer)) >= 0) text.append(buffer, 0, count);
                return text.toString();
            }
        }

        private boolean isVisible() {
            try {
                ActivityManager.RunningAppProcessInfo info = new ActivityManager.RunningAppProcessInfo();
                ActivityManager.getMyMemoryState(info);
                return info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
            } catch (Exception ignored) {
                return false;
            }
        }

        private void pollOnce() {
            HttpURLConnection connection = null;
            try {
                JSONObject config = new JSONObject(readAsset("dtunnelmod.json"));
                String panel = config.optString("url", "").trim().replaceAll("/+$", "");
                if (!panel.startsWith("https://")) return;
                String endpoint = panel + "/api/notifications/poll?after=" + cursor;
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("X-Registration-Key", key);
                connection.setRequestProperty("X-User-Id", userId);
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;
                try (InputStream input = connection.getInputStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) response.append(line);
                    JSONObject body = new JSONObject(response.toString());
                    JSONArray notifications = body.optJSONArray("notifications");
                    if (notifications == null) return;
                    for (int i = 0; i < notifications.length(); i++) {
                        JSONObject message = notifications.optJSONObject(i);
                        if (message == null) continue;
                        long id = message.optLong("id", 0L);
                        if (id <= cursor) continue;
                        String title = message.optString("title", "Mensagem do painel");
                        String text = message.optString("message", "");
                        new Handler(Looper.getMainLooper()).post(() ->
                                Toast.makeText(context, title + "\n" + text, Toast.LENGTH_LONG).show());
                        cursor = id;
                        context.getSharedPreferences("dtmod-in-app-inbox", Context.MODE_PRIVATE)
                                .edit().putLong("cursor", cursor).apply();
                        Thread.sleep(4000L);
                    }
                }
            } catch (Exception ignored) {
                // Keep the previous cursor so the request can be retried on the next foreground poll.
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
    }
}
