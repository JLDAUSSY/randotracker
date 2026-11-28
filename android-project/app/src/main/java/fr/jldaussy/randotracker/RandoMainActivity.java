package fr.jldaussy.randotracker;

import android.Manifest;
import android.annotation.TargetApi;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.app.AlertDialog;
import android.os.Message;
import android.webkit.DownloadListener;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import android.content.ContentValues;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class RandoMainActivity extends AppCompatActivity {
    private static final String TAG = "RandoMainActivity";
    private static final int PERMISSION_REQ_CODE = 2026;
    private static final int FILE_CHOOSER_REQ_CODE = 2027;
    private static final String BASE_URL = "https://jldaussy.github.io/randotracker/";
    
    private WebView webView;
    private String pendingRoom = null;
    private ValueCallback<Uri[]> fileUploadCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configuration barre de statut et theme immersif sombre
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#0d273a"));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                window.setNavigationBarColor(Color.parseColor("#0d273a"));
            }
        }

        // Initialisation de la WebView native pure (Plein écran sans barre d'adresse)
        webView = new WebView(this);
        setContentView(webView);

        initWebViewSettings();

        // Si nouvelle version installée, vider le cache WebView pour forcer le chargement immédiat des nouveaux scripts
        android.content.SharedPreferences prefs = getSharedPreferences("rando_app_prefs", MODE_PRIVATE);
        int lastVersionCode = prefs.getInt("last_version_code", -1);
        int currentVersionCode = 62;
        if (lastVersionCode != currentVersionCode) {
            webView.clearCache(true);
            prefs.edit().putInt("last_version_code", currentVersionCode).apply();
        }

        checkAndRequestPermissions();

        handleIntent(getIntent());

        String initialUrl = BASE_URL;
        if (pendingRoom != null && !pendingRoom.isEmpty()) {
            initialUrl = BASE_URL + "?room=" + Uri.encode(pendingRoom);
        }
        webView.loadUrl(initialUrl);
    }

    private void initWebViewSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setBackgroundColor(Color.parseColor("#0a1926"));

        // Écouteur de téléchargement (pour APKs, traces GPX, documents PDF)
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                } catch (Exception e) {
                    Log.e(TAG, "Erreur déclenchement téléchargement WebView: " + url, e);
                }
            }
        });

        // Injection du pont natif JavaScript
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        // Gestionnaire d'autorisations et console JS
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Toujours accorder la géolocalisation au domaine de l'app
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            // Accorder automatiquement la caméra pour le scanner QR
                            request.grant(request.getResources());
                        }
                    });
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("RandoTrackerJS", consoleMessage.message() + " [" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + "]");
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(RandoMainActivity.this)
                    .setTitle("RandoTracker")
                    .setMessage(message)
                    .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int which) {
                            result.confirm();
                        }
                    })
                    .setNegativeButton("Annuler", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int which) {
                            result.cancel();
                        }
                    })
                    .setCancelable(false)
                    .create()
                    .show();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(RandoMainActivity.this)
                    .setTitle("RandoTracker")
                    .setMessage(message)
                    .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int which) {
                            result.confirm();
                        }
                    })
                    .setCancelable(false)
                    .create()
                    .show();
                return true;
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView.HitTestResult result = view.getHitTestResult();
                String data = result != null ? result.getExtra() : null;
                Context context = view.getContext();
                if (data != null && !data.isEmpty()) {
                    try {
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(data));
                        context.startActivity(browserIntent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Erreur ouverture lien nouvelle fenêtre: " + data, e);
                    }
                }
                // Fallback sécurisé pour capturer l'URL ciblée par window.open ou target="_blank"
                WebView newWebView = new WebView(context);
                newWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            context.startActivity(intent);
                        } catch (Exception e) {
                            Log.e(TAG, "Erreur intent nouvelle fenêtre: " + url, e);
                        }
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(newWebView);
                resultMsg.sendToTarget();
                return true;
            }

            @TargetApi(Build.VERSION_CODES.LOLLIPOP)
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
                fileUploadCallback = filePathCallback;

                // Intent universel */* sans filtrage MIME restrictif
                // afin que les fichiers .gpx (souvent typés octet-stream par Android) restent 100% sélectionnables et non grisés
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Sélectionner un fichier GPX"), FILE_CHOOSER_REQ_CODE);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Impossible d'ouvrir le sélecteur de fichier", e);
                    if (fileUploadCallback != null) {
                        fileUploadCallback.onReceiveValue(null);
                        fileUploadCallback = null;
                    }
                    return false;
                }
            }
        });

        // Gestionnaire de navigation (aucun affichage de barre d'URL externe, liens externes gérés par Intent)
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrlNavigation(url);
            }

            @TargetApi(Build.VERSION_CODES.N)
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrlNavigation(request.getUrl().toString());
            }

            private boolean handleUrlNavigation(String url) {
                if (url == null) return false;

                // Protocoles d'appels d'urgence, SMS, Mail, WhatsApp, Cartes externes
                if (url.startsWith("tel:") || url.startsWith("sms:") || url.startsWith("mailto:") || 
                    url.startsWith("whatsapp:") || url.startsWith("geo:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Erreur intent externe: " + url, e);
                        return true;
                    }
                }

                // Documents PDF, APK ou modes d'emploi : ouvrir systématiquement via Intent externe (lecteur PDF système / navigateur)
                String lowerUrl = url.toLowerCase();
                if (lowerUrl.endsWith(".pdf") || lowerUrl.endsWith(".apk") || lowerUrl.contains(".pdf?") || lowerUrl.contains(".apk?") ||
                    lowerUrl.contains("mode_d_emploi") || lowerUrl.contains("user_manual") || lowerUrl.contains("manual_de_uso")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Erreur ouverture document externe: " + url, e);
                        return true;
                    }
                }

                // Rester dans la WebView native pour les pages de l'application
                if (url.contains("jldaussy.github.io/randotracker") || url.contains("localhost") || url.contains("127.0.0.1")) {
                    return false;
                }

                // Autres liens HTTP externes : ouvrir dans le navigateur système
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Impossible d'ouvrir le lien externe: " + url, e);
                    return false;
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                view.setBackgroundColor(Color.parseColor("#0a1926"));
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.w(TAG, "WebView Error (" + errorCode + "): " + description + " URL: " + failingUrl);
            }

            @TargetApi(Build.VERSION_CODES.M)
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    Log.w(TAG, "WebView MainFrame Error: " + error.getDescription() + " (" + error.getErrorCode() + ")");
                }
            }

            @Override
            public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
                Log.e(TAG, "WebView SSL Error: " + error.toString());
                handler.cancel();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.setBackgroundColor(Color.parseColor("#0a1926"));
                // Flag identifiant l'application Android Native Pure
                view.evaluateJavascript("window.IS_NATIVE_ANDROID_APP = true; if(window.RandoLogger) { window.RandoLogger.info('NATIVE', 'Architecture Android Native Pure Active'); }", null);

                if (pendingRoom != null && !pendingRoom.isEmpty()) {
                    view.evaluateJavascript("if(window.joinRoomDirectly) window.joinRoomDirectly('" + pendingRoom + "');", null);
                    pendingRoom = null;
                }
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null) {
            String room = data.getQueryParameter("room");
            if (room != null && !room.isEmpty()) {
                pendingRoom = room;
                RandoGpsForegroundService.updateSessionConfig(getApplicationContext(), room, null, null, null, null, null, false);
                if (webView != null) {
                    webView.evaluateJavascript("if(window.joinRoomDirectly) window.joinRoomDirectly('" + room + "');", null);
                }
            }
        }
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] permissions;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.POST_NOTIFICATIONS,
                    Manifest.permission.CAMERA
                };
            } else {
                permissions = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.CAMERA
                };
            }

            boolean needsRequest = false;
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    needsRequest = true;
                    break;
                }
            }

            if (needsRequest) {
                ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQ_CODE);
            }
        }
    }

    public void startGpsService() {
        if (!hasLocationPermission()) {
            return;
        }
        try {
            Intent serviceIntent = new Intent(this, RandoGpsForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur démarrage GPS Service", e);
        }
    }

    public void stopGpsService() {
        try {
            Intent serviceIntent = new Intent(this, RandoGpsForegroundService.class);
            serviceIntent.setAction(RandoGpsForegroundService.ACTION_STOP_SERVICE);
            startService(serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Erreur arrêt GPS Service", e);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            if (webView != null) {
                webView.evaluateJavascript("if(window.onNativePermissionsGranted) { window.onNativePermissionsGranted(); }", null);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQ_CODE) {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                android.content.ClipData clipData = data.getClipData();
                if (clipData != null && clipData.getItemCount() > 0) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                } else if (data.getDataString() != null) {
                    results = new Uri[]{ Uri.parse(data.getDataString()) };
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("if(typeof handleNativeBackPress === 'function') { handleNativeBackPress(); } else { history.back(); }", null);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getVersionName() {
            return "1.4.25 (64)";
        }

        @JavascriptInterface
        public void showMessageNotification(String title, String body, String type, String sender) {
            RandoGpsForegroundService.showNativeNotification(getApplicationContext(), title, body, type, sender);
        }

        @JavascriptInterface
        public void syncTrackingSession(String room, String userId, String name, String role, String color, String icon, boolean isSos) {
            RandoGpsForegroundService.updateSessionConfig(getApplicationContext(), room, userId, name, role, color, icon, isSos);
            if (hasLocationPermission()) {
                startGpsService();
            }
        }

        @JavascriptInterface
        public void updateSession(String room, String userId, String name, String icon, String color, String assignedTrackId, boolean isTrackingGps) {
            RandoGpsForegroundService.updateSessionConfig(getApplicationContext(), room, userId, name, "Randonneur", color, icon, false);
            if (hasLocationPermission() && isTrackingGps) {
                startGpsService();
            }
        }

        @JavascriptInterface
        public void stopTrackingService() {
            stopGpsService();
        }

        @JavascriptInterface
        public boolean isScreenOn() {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    return pm.isInteractive();
                }
            } catch (Exception e) {}
            return true;
        }

        @JavascriptInterface
        public void saveFileToDownloads(final String base64Data, final String fileName, final String mimeType) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                            if (uri != null) {
                                OutputStream os = getContentResolver().openOutputStream(uri);
                                if (os != null) {
                                    os.write(fileBytes);
                                    os.flush();
                                    os.close();
                                }
                            }
                        } else {
                            File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                            if (!downloadDir.exists()) downloadDir.mkdirs();
                            File destFile = new File(downloadDir, fileName);
                            FileOutputStream fos = new FileOutputStream(destFile);
                            fos.write(fileBytes);
                            fos.flush();
                            fos.close();
                        }

                        Toast.makeText(getApplicationContext(), "Fichier envoyé dans Téléchargements : " + fileName, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Log.e(TAG, "Erreur enregistrement dans Téléchargements: " + fileName, e);
                        Toast.makeText(getApplicationContext(), "Erreur téléchargement: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openManual(String lang) {
            String filename;
            if ("es".equalsIgnoreCase(lang)) {
                filename = "RandoTracker_Manual_de_Uso_ES.pdf";
            } else if ("en".equalsIgnoreCase(lang)) {
                filename = "RandoTracker_User_Manual_EN.pdf";
            } else {
                filename = "RandoTracker_Mode_d_emploi_FR.pdf";
            }
            openPdf(BASE_URL + filename);
        }

        @JavascriptInterface
        public void openPdf(String url) {
            openExternalUrl(url);
        }

        @JavascriptInterface
        public void openExternalUrl(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Impossible d'ouvrir l'URL externe via le pont: " + url, e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void closeApp() {
            stopGpsService();
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        // Basculer immédiatement sur l'écran d'accueil du téléphone
                        moveTaskToBack(true);
                        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
                        homeIntent.addCategory(Intent.CATEGORY_HOME);
                        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(homeIntent);

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            finishAndRemoveTask();
                        } else {
                            finishAffinity();
                        }
                        new android.os.Handler().postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    android.os.Process.killProcess(android.os.Process.myPid());
                                } catch (Exception e) {}
                                System.exit(0);
                            }
                        }, 250);
                    } catch (Exception e) {
                        e.printStackTrace();
                        finishAffinity();
                        System.exit(0);
                    }
                }
            });
        }
    }
}
