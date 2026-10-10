package fr.jldaussy.randotracker;

import android.Manifest;
import android.annotation.TargetApi;
import android.content.Context;
import android.content.Intent;
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
                Log.w(TAG, "WebView SSL Notice: " + error.toString());
                handler.proceed();
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
        // IMPORTANT : Ne pas appeler webView.onPause() pour permettre au moteur JavaScript,
        // à la boucle audio keep-alive et aux WebSockets WSS de continuer l'émission en direct écran éteint.
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
            return "1.4.15 (53)";
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
        public void openBatteryOptimizationSettings() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent();
                    String packageName = getPackageName();
                    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                        intent.setAction(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + packageName));
                    } else {
                        intent.setAction(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    }
                    startActivity(intent);
                }
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ex) {
                    Log.e(TAG, "Impossible d'ouvrir les paramètres batterie", ex);
                }
            }
        }
    }
}
