package fr.jldaussy.randotracker;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class RandoMainActivity extends AppCompatActivity {
    private static final String TAG = "RandoMainActivity";
    private static final int PERMISSION_REQ_CODE = 2026;
    private static final String DEFAULT_URL = "https://jldaussy.github.io/randotracker/";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQ_CODE = 2027;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Setup container et WebView plein ecran
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        rootLayout.addView(webView);
        setContentView(rootLayout);

        setupWebViewSettings();
        setupWebViewClients();
        setupBackPressedHandler();

        checkAndRequestPermissions();

        loadTargetUrl(getIntent());
    }

    private void setupWebViewSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Pont JavaScript Natif
        webView.addJavascriptInterface(new RandoNativeBridge(this), "AndroidBridge");
    }

    private void setupWebViewClients() {
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Accorder directement l'acces geolocalisation au WebView
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (RandoMainActivity.this.filePathCallback != null) {
                    RandoMainActivity.this.filePathCallback.onReceiveValue(null);
                }
                RandoMainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQ_CODE);
                } catch (Exception e) {
                    RandoMainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    return handleUrl(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            private boolean handleUrl(String url) {
                if (url == null) return false;
                
                // Si lien interne RandoTracker, charger dans le WebView
                if (url.startsWith("https://jldaussy.github.io/randotracker") || url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
                    return false;
                }

                // Si appel d'urgence, SMS ou lien externe
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Erreur ouverture lien externe: " + url, e);
                    return false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                String initScript = 
                    "try {" +
                    "  window.IS_NATIVE_ANDROID_APP = true;" +
                    "  var uid = localStorage.getItem('rando_user_id') || ('u_' + Math.random().toString(36).substr(2,9));" +
                    "  localStorage.setItem('rando_user_id', uid);" +
                    "  var uname = localStorage.getItem('rando_user_name') || 'Randonneur';" +
                    "  var uicon = localStorage.getItem('rando_user_icon') || '🥾';" +
                    "  var ucol = localStorage.getItem('rando_user_color') || '#10b981';" +
                    "  var utrk = localStorage.getItem('rando_user_track') || 'auto';" +
                    "  var room = localStorage.getItem('rando_room_code') || 'RANDO-2026';" +
                    "  if (window.AndroidBridge && typeof window.AndroidBridge.updateSession === 'function') {" +
                    "    window.AndroidBridge.updateSession(room, uid, uname, uicon, ucol, utrk, true);" +
                    "  }" +
                    "  if (window.onNativeAndroidReady) window.onNativeAndroidReady();" +
                    "} catch(e) { console.error('[BridgeInitError]', e); }";
                webView.evaluateJavascript(initScript, null);
            }
        });
    }

    private void setupBackPressedHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    // Mettre l'app en arriere-plan au lieu de la tuer pour continuer le suivi
                    moveTaskToBack(true);
                }
            }
        });
    }

    private void loadTargetUrl(Intent intent) {
        String urlToLoad = DEFAULT_URL;
        if (intent != null && intent.getData() != null) {
            String dataUrl = intent.getData().toString();
            if (dataUrl.startsWith("https://jldaussy.github.io/randotracker")) {
                urlToLoad = dataUrl;
            }
        }
        Log.d(TAG, "Chargement WebView : " + urlToLoad);
        webView.loadUrl(urlToLoad);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadTargetUrl(intent);
    }

    private boolean hasLocationPermissions() {
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
                    Manifest.permission.POST_NOTIFICATIONS
                };
            } else {
                permissions = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
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
            } else {
                startGpsService();
                requestBatteryOptimizationExemption();
            }
        } else {
            startGpsService();
        }
    }

    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                String packageName = getPackageName();
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent();
                    intent.setAction(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    startActivity(intent);
                }
            } catch (Exception e) {
                Log.w(TAG, "Erreur demande ignore battery optimizations", e);
            }
        }
    }

    private void startGpsService() {
        if (!hasLocationPermissions()) {
            Log.w(TAG, "Permissions localisation non accordees, demarrage reporte");
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
            Log.e(TAG, "Erreur demarrage RandoGpsForegroundService", e);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            if (hasLocationPermissions()) {
                startGpsService();
                if (webView != null) {
                    webView.reload();
                }
            }
            requestBatteryOptimizationExemption();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQ_CODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
    }

    public static class RandoNativeBridge {
        private final Context context;

        public RandoNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.2.0 (14)";
        }

        @JavascriptInterface
        public void updateSession(String room, String uid, String name, String icon, String color, String trackId, boolean isTracking) {
            Log.d(TAG, "Bridge JS -> updateSession: Salon=" + room + ", User=" + name);
            RandoGpsForegroundService.updateSession(context, room, uid, name, icon, color, trackId, isTracking);
        }

        @JavascriptInterface
        public void vibratePhone(int milliseconds) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(milliseconds);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Erreur vibration", e);
            }
        }
    }
}
