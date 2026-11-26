package com.dtunnel.inapp;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.Application;
import android.app.Dialog;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.lang.ref.WeakReference;

/** Foreground-only, one-time in-app inbox client injected into generated APKs. */
public final class InAppMessageProvider extends ContentProvider {
    private static volatile boolean started;
    private static volatile WeakReference<Activity> resumedActivity = new WeakReference<>(null);

    @Override public boolean onCreate() {
        Context context = getContext();
        if (context == null) return false;
        synchronized (InAppMessageProvider.class) {
            if (!started) {
                started = true;
                Context appContext = context.getApplicationContext();
                if (appContext instanceof Application) {
                    ((Application) appContext).registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
                        @Override public void onActivityResumed(Activity activity) { resumedActivity = new WeakReference<>(activity); }
                        @Override public void onActivityPaused(Activity activity) {
                            if (resumedActivity.get() == activity) resumedActivity = new WeakReference<>(null);
                        }
                        @Override public void onActivityCreated(Activity a, Bundle b) {}
                        @Override public void onActivityStarted(Activity a) {}
                        @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
                        @Override public void onActivityStopped(Activity a) {}
                        @Override public void onActivityDestroyed(Activity activity) {
                            if (resumedActivity.get() == activity) resumedActivity = new WeakReference<>(null);
                        }
                    });
                }
                Thread poller = new Thread(new Poller(appContext), "dtmod-in-app-inbox");
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
        private static final String PREFS = "dtmod-in-app-inbox";
        private static final String CURSOR_KEY = "cursor_v2";
        private static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;
        private final Context context;
        private final Handler mainHandler = new Handler(Looper.getMainLooper());
        private final AtomicBoolean dialogPending = new AtomicBoolean(false);
        private final AtomicLong pendingCursor = new AtomicLong(0L);
        private volatile long cursor;
        private String userId;
        private String key;

        Poller(Context context) { this.context = context; }

        @Override public void run() {
            try {
                userId = readAsset("user_id.txt").trim();
                key = readAsset("registration_key.txt").trim();
                String panel = panelUrl();
                if (userId.isEmpty() || key.isEmpty() || panel.isEmpty()) return;
                android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                if (prefs.contains(CURSOR_KEY)) {
                    cursor = prefs.getLong(CURSOR_KEY, 0L);
                } else {
                    // Ignore messages sent before this upgraded client first opened; they are historical backlog.
                    cursor = initializeCursor(panel);
                    prefs.edit().putLong(CURSOR_KEY, cursor).commit();
                }
                while (!Thread.currentThread().isInterrupted()) {
                    if (isVisible() && !dialogPending.get()) pollOnce(panel);
                    Thread.sleep(5000L);
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

        private String panelUrl() {
            try {
                String panel = new JSONObject(readAsset("dtunnelmod.json")).optString("url", "").trim().replaceAll("/+$", "");
                return panel.startsWith("https://") ? panel : "";
            } catch (Exception ignored) { return ""; }
        }

        private boolean isVisible() {
            Activity activity = resumedActivity.get();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) return false;
            try {
                ActivityManager.RunningAppProcessInfo info = new ActivityManager.RunningAppProcessInfo();
                ActivityManager.getMyMemoryState(info);
                return info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
            } catch (Exception ignored) { return false; }
        }

        private long initializeCursor(String panel) {
            JSONObject result = request(panel + "/api/notifications/poll?after=latest");
            return result == null ? 0L : Math.max(0L, result.optLong("nextCursor", 0L));
        }

        private JSONObject request(String endpoint) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("X-Registration-Key", key);
                connection.setRequestProperty("X-User-Id", userId);
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
                try (InputStream input = connection.getInputStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) response.append(line);
                    return new JSONObject(response.toString());
                }
            } catch (Exception ignored) {
                return null;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        private void pollOnce(String panel) {
            JSONObject body = request(panel + "/api/notifications/poll?after=" + cursor);
            if (body == null) return;
            JSONArray notifications = body.optJSONArray("notifications");
            if (notifications == null || notifications.length() == 0) return;
            JSONObject message = notifications.optJSONObject(0);
            if (message == null) return;
            long id = message.optLong("id", 0L);
            if (id <= cursor || !dialogPending.compareAndSet(false, true)) return;
            String title = message.optString("title", "Mensagem do painel");
            String text = message.optString("message", "");
            String imageUrl = message.optString("imageUrl", "");
            Bitmap image = downloadImage(imageUrl);
            pendingCursor.set(id);
            mainHandler.post(() -> showDialog(title, text, image));
        }

        private Bitmap downloadImage(String imageUrl) {
            if (imageUrl == null || !imageUrl.startsWith("https://")) return null;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(imageUrl).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(10000);
                connection.setInstanceFollowRedirects(false);
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
                String finalUrl = connection.getURL().toString();
                if (!finalUrl.startsWith("https://")) return null;
                int length = connection.getContentLength();
                if (length > MAX_IMAGE_BYTES) return null;
                try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        if (output.size() + count > MAX_IMAGE_BYTES) return null;
                        output.write(buffer, 0, count);
                    }
                    byte[] bytes = output.toByteArray();
                    BitmapFactory.Options bounds = new BitmapFactory.Options();
                    bounds.inJustDecodeBounds = true;
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
                    int sample = 1;
                    while (bounds.outWidth / sample > 1200 || bounds.outHeight / sample > 1200) sample *= 2;
                    BitmapFactory.Options options = new BitmapFactory.Options();
                    options.inSampleSize = sample;
                    return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                }
            } catch (Exception ignored) {
                return null;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        private void showDialog(String title, String message, Bitmap bitmap) {
            Activity activity = resumedActivity.get();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
                dialogPending.set(false);
                return;
            }
            LinearLayout card = new LinearLayout(activity);
            card.setOrientation(LinearLayout.VERTICAL);
            GradientDrawable cardBackground = new GradientDrawable();
            cardBackground.setColor(Color.rgb(6, 0, 22));
            cardBackground.setCornerRadius(dp(activity, 20));
            cardBackground.setStroke(dp(activity, 1), Color.rgb(48, 39, 69));
            card.setBackground(cardBackground);
            card.setClipToOutline(true);
            card.setElevation(dp(activity, 12));

            LinearLayout header = new LinearLayout(activity);
            header.setGravity(Gravity.CENTER_VERTICAL);
            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setPadding(dp(activity, 18), dp(activity, 12), dp(activity, 8), dp(activity, 8));
            TextView heading = new TextView(activity);
            heading.setText(title);
            heading.setTextColor(Color.WHITE);
            heading.setTextSize(19f);
            heading.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            heading.setMaxLines(2);
            header.addView(heading, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            TextView close = new TextView(activity);
            close.setText("×");
            close.setTextColor(Color.rgb(221, 214, 239));
            close.setTextSize(32f);
            close.setGravity(Gravity.CENTER);
            close.setContentDescription("Fechar mensagem");
            close.setMinWidth(dp(activity, 48));
            close.setMinHeight(dp(activity, 48));
            header.addView(close, new LinearLayout.LayoutParams(dp(activity, 48), dp(activity, 48)));
            card.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            if (bitmap != null) {
                ImageView image = new ImageView(activity);
                image.setImageBitmap(bitmap);
                image.setAdjustViewBounds(true);
                image.setScaleType(ImageView.ScaleType.CENTER_CROP);
                LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 190));
                imageParams.setMargins(dp(activity, 14), 0, dp(activity, 14), 0);
                card.addView(image, imageParams);
            }
            TextView body = new TextView(activity);
            body.setText(message);
            body.setTextColor(Color.rgb(237, 233, 247));
            body.setTextSize(16f);
            body.setLineSpacing(dp(activity, 3), 1f);
            body.setPadding(dp(activity, 18), dp(activity, 12), dp(activity, 18), dp(activity, 20));
            card.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            ScrollView scroll = new ScrollView(activity);
            scroll.setFillViewport(false);
            scroll.setBackgroundColor(Color.TRANSPARENT);
            LinearLayout outer = new LinearLayout(activity);
            outer.setOrientation(LinearLayout.VERTICAL);
            outer.setPadding(dp(activity, 16), dp(activity, 18), dp(activity, 16), dp(activity, 12));
            outer.addView(card, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            scroll.addView(outer);

            Dialog dialog = new Dialog(activity);
            dialog.setContentView(scroll);
            dialog.setCancelable(false);
            dialog.setCanceledOnTouchOutside(false);
            dialog.setOnDismissListener(d -> {
                long seenId = pendingCursor.getAndSet(0L);
                if (seenId > cursor) {
                    cursor = seenId;
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(CURSOR_KEY, cursor).commit();
                }
                dialogPending.set(false);
            });
            close.setOnClickListener(view -> dialog.dismiss());
            try {
                dialog.show();
                Window window = dialog.getWindow();
                if (window != null) {
                    window.setBackgroundDrawableResource(android.R.color.transparent);
                    window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
                    WindowManager.LayoutParams params = window.getAttributes();
                    params.width = WindowManager.LayoutParams.MATCH_PARENT;
                    params.height = WindowManager.LayoutParams.WRAP_CONTENT;
                    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    params.y = dp(activity, 24);
                    params.dimAmount = 0.18f;
                    window.setAttributes(params);
                }
            } catch (Exception ignored) {
                dialogPending.set(false);
            }
        }

        private static int dp(Context context, int value) {
            return Math.round(value * context.getResources().getDisplayMetrics().density);
        }
    }
}
