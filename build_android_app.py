# -*- coding: utf-8 -*-
"""
Constructeur et compilateur de l'Android App Bundle (.aab) et APK pour RandoTracker V1.4.12 (50)
Génère le projet Android complet avec pont natif, scanner QR caméra, service d'arrière-plan haute priorité,
support des notifications montre & lockscreen, transmission MQTT native écran éteint et compilation Play Store / Release.
"""

import os
import subprocess
from PIL import Image

project_dir = os.path.abspath("android-project")
app_dir = os.path.join(project_dir, "app")
res_dir = os.path.join(app_dir, "src", "main", "res")
keystore_dir = os.path.join(project_dir, "keystore")

os.makedirs(os.path.join(app_dir, "src", "main", "java", "fr", "jldaussy", "randotracker"), exist_ok=True)
os.makedirs(os.path.join(res_dir, "values"), exist_ok=True)
os.makedirs(os.path.join(res_dir, "xml"), exist_ok=True)
os.makedirs(keystore_dir, exist_ok=True)

# 1. Generation des icones Android Full-Bleed et Adaptive Icons
try:
    import generate_app_icons
    generate_app_icons.create_full_bleed_icons()
    print("[OK] Icones Android et PWA generees.")
except Exception as e:
    print("[WARN] Erreur generation icones:", e)

# 2. Keystore de signature Release (RSA 2048, 25 ans)
keytool_exe = r"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
keystore_path = os.path.join(keystore_dir, "randotracker-release.jks")
store_pass = "randotracker2026"
key_alias = "randotracker"

if not os.path.exists(keystore_path):
    cmd_keytool = [
        keytool_exe,
        "-genkeypair",
        "-v",
        "-keystore", keystore_path,
        "-alias", key_alias,
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "10000",
        "-storepass", store_pass,
        "-keypass", store_pass,
        "-dname", "CN=Jean-Luc DAUSSY, OU=RandoTracker, O=RandoClub, L=Sanary, ST=Var, C=FR"
    ]
    print("Génération du Keystore de signature de production...")
    subprocess.run(cmd_keytool, check=True)
    print(f"Keystore créé : {keystore_path}")

sha256_fingerprint = "7D:40:04:E7:AC:75:31:DF:A1:27:97:29:C2:4B:B4:4D:11:CF:45:A2:5F:67:3B:E4:25:25:D4:24:B0:AB:A0:27"
print(f"Empreinte SHA-256 de la clé : {sha256_fingerprint}")

# 3. Sauvegarde de l'assetlinks.json modèle
assetlinks_content = f"""[
  {{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {{
      "namespace": "android_app",
      "package_name": "fr.jldaussy.randotracker",
      "sha256_cert_fingerprints": [
        "{sha256_fingerprint}"
      ]
    }}
  }}
]
"""
with open(os.path.join(project_dir, "assetlinks.json"), "w", encoding="utf-8") as f:
    f.write(assetlinks_content)
with open(os.path.abspath("assetlinks.json"), "w", encoding="utf-8") as f:
    f.write(assetlinks_content)
print("Fichier assetlinks.json généré.")

# 4. Fichiers de configuration Gradle racine
settings_gradle = """pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "RandoTracker"
include(":app")
"""
with open(os.path.join(project_dir, "settings.gradle.kts"), "w", encoding="utf-8") as f:
    f.write(settings_gradle)

build_gradle_root = """plugins {
    id("com.android.application") version "8.7.3" apply false
}
"""
with open(os.path.join(project_dir, "build.gradle.kts"), "w", encoding="utf-8") as f:
    f.write(build_gradle_root)

gradle_properties = """org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
android.suppressUnsupportedCompileSdk=36
"""
with open(os.path.join(project_dir, "gradle.properties"), "w", encoding="utf-8") as f:
    f.write(gradle_properties)

# 5. Fichier app/build.gradle.kts
keystore_escaped = keystore_path.replace("\\", "\\\\")
build_gradle_app = f"""plugins {{
    id("com.android.application")
}}

android {{
    namespace = "fr.jldaussy.randotracker"
    compileSdk = 36

    defaultConfig {{
        applicationId = "fr.jldaussy.randotracker"
        minSdk = 24
        targetSdk = 36
        versionCode = 50
        versionName = "1.4.12"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        manifestPlaceholders["hostName"] = "jldaussy.github.io"
        manifestPlaceholders["defaultUrl"] = "https://jldaussy.github.io/randotracker/"
        manifestPlaceholders["assetStatements"] = \"""[
            {{
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {{
                    "namespace": "android_app",
                    "package_name": "fr.jldaussy.randotracker",
                    "sha256_cert_fingerprints": ["{sha256_fingerprint}"]
                }}
            }}
        ]\"""
    }}

    signingConfigs {{
        create("release") {{
            storeFile = file("{keystore_escaped}")
            storePassword = "{store_pass}"
            keyAlias = "{key_alias}"
            keyPassword = "{store_pass}"
        }}
    }}

    buildTypes {{
        release {{
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }}
    }}
    compileOptions {{
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }}
}}

dependencies {{
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5")
}}
"""
with open(os.path.join(app_dir, "build.gradle.kts"), "w", encoding="utf-8") as f:
    f.write(build_gradle_app)

# 6. Ressources Android (values & manifest)
strings_xml = """<resources>
    <string name="app_name">RandoTracker</string>
    <string name="host_name">jldaussy.github.io</string>
    <string name="default_url">https://jldaussy.github.io/randotracker/</string>
</resources>
"""
with open(os.path.join(res_dir, "values", "strings.xml"), "w", encoding="utf-8") as f:
    f.write(strings_xml)

colors_xml = """<resources>
    <color name="colorPrimary">#064e3b</color>
    <color name="colorPrimaryDark">#0d273a</color>
    <color name="colorAccent">#10b981</color>
    <color name="navigationColor">#0d273a</color>
    <color name="ic_launcher_background">#0d273a</color>
</resources>
"""
with open(os.path.join(res_dir, "values", "colors.xml"), "w", encoding="utf-8") as f:
    f.write(colors_xml)

styles_xml = """<resources>
    <style name="Theme.RandoTracker" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:navigationBarColor">@color/navigationColor</item>
        <item name="android:statusBarColor">@color/colorPrimaryDark</item>
    </style>
</resources>
"""
with open(os.path.join(res_dir, "values", "styles.xml"), "w", encoding="utf-8") as f:
    f.write(styles_xml)

# 7. Code Source Java Natif pour le Suivi GPS en Arrière-Plan & Pont Natif
main_activity_java = """package fr.jldaussy.randotracker;

import android.Manifest;
import android.annotation.TargetApi;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
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
    private static final String BASE_URL = "https://jldaussy.github.io/randotracker/";
    
    private WebView webView;
    private String pendingRoom = null;

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
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
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
            return "1.4.12 (50)";
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
    }
}
"""
with open(os.path.join(app_dir, "src", "main", "java", "fr", "jldaussy", "randotracker", "RandoMainActivity.java"), "w", encoding="utf-8") as f:
    f.write(main_activity_java)

service_java = """package fr.jldaussy.randotracker;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

public class RandoGpsForegroundService extends Service {
    public static final String CHANNEL_ID = "rando_gps_tracking_channel";
    public static final String MESSAGE_CHANNEL_ID = "rando_messages_alerts_v3";
    public static final int NOTIFICATION_ID = 2026;
    public static final String PREFS_NAME = "randotracker_config";
    public static final String ACTION_STOP_SERVICE = "fr.jldaussy.randotracker.ACTION_STOP_SERVICE";
    
    private static volatile String activeRoom = "RANDO-2026";
    private static volatile String activeUserId = "";
    private static volatile String activeUserName = "Randonneur";
    private static volatile String activeUserRole = "Randonneur";
    private static volatile String activeUserColor = "#059669";
    private static volatile String activeUserIcon = "🥾";
    private static volatile boolean activeIsSos = false;

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private LocationListener locationListener;
    private MqttClient mqttClient;
    private long lastNativeBroadcastTime = 0L;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();

    public static void updateSessionConfig(Context context, String room, String userId, String name, String role, String color, String icon, boolean isSos) {
        if (room != null && !room.trim().isEmpty()) activeRoom = room.trim();
        if (userId != null && !userId.trim().isEmpty()) activeUserId = userId.trim();
        if (name != null && !name.trim().isEmpty()) activeUserName = name.trim();
        if (role != null && !role.trim().isEmpty()) activeUserRole = role.trim();
        if (color != null && !color.trim().isEmpty()) activeUserColor = color.trim();
        if (icon != null && !icon.trim().isEmpty()) activeUserIcon = icon.trim();
        activeIsSos = isSos;

        if (context != null) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor ed = prefs.edit();
                if (room != null && !room.trim().isEmpty()) ed.putString("room", activeRoom);
                if (userId != null && !userId.trim().isEmpty()) ed.putString("userId", activeUserId);
                if (name != null && !name.trim().isEmpty()) ed.putString("name", activeUserName);
                if (role != null && !role.trim().isEmpty()) ed.putString("role", activeUserRole);
                if (color != null && !color.trim().isEmpty()) ed.putString("color", activeUserColor);
                if (icon != null && !icon.trim().isEmpty()) ed.putString("icon", activeUserIcon);
                ed.putBoolean("isSos", activeIsSos);
                ed.apply();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        loadSavedConfig();
        createNotificationChannels();
        startForegroundTracking();
        acquirePartialWakeLock();
        initNativeLocationListener();
        initMqttListener();
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void loadSavedConfig() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            activeRoom = prefs.getString("room", "RANDO-2026");
            activeUserId = prefs.getString("userId", "");
            if (activeUserId.isEmpty()) {
                activeUserId = "user_droid_" + (System.currentTimeMillis() % 10000);
                prefs.edit().putString("userId", activeUserId).apply();
            }
            activeUserName = prefs.getString("name", "Randonneur");
            activeUserRole = prefs.getString("role", "Randonneur");
            activeUserColor = prefs.getString("color", "#059669");
            activeUserIcon = prefs.getString("icon", "🥾");
            activeIsSos = prefs.getBoolean("isSos", false);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // 1. Canal GPS basse priorité (suivi passif continu)
            NotificationChannel trackingChannel = new NotificationChannel(
                CHANNEL_ID,
                "Suivi GPS RandoTracker",
                NotificationManager.IMPORTANCE_LOW
            );
            trackingChannel.setDescription("Maintient le suivi GPS actif dans la poche écran éteint");
            trackingChannel.setShowBadge(false);
            trackingChannel.enableVibration(false);
            trackingChannel.enableLights(false);
            manager.createNotificationChannel(trackingChannel);

            // 2. Canal Messages & Alertes Haute Priorité (Réveil montre Garmin/WearOS & écran verrouillé)
            NotificationChannel msgChannel = new NotificationChannel(
                MESSAGE_CHANNEL_ID,
                "Messages & Alertes Groupe",
                NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("Notifications prioritaires pour réveil de l'écran et des montres connectées");
            msgChannel.setShowBadge(true);
            msgChannel.enableVibration(true);
            msgChannel.setVibrationPattern(new long[]{0, 350, 150, 350, 150, 350});
            msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            msgChannel.setSound(defaultSoundUri, audioAttr);

            manager.createNotificationChannel(msgChannel);
        }
    }

    private void startForegroundTracking() {
        Intent launchIntent = new Intent(this, RandoMainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);

        // Bouton Arrêter le suivi directement dans la notification
        Intent stopIntent = new Intent(this, RandoGpsForegroundService.class);
        stopIntent.setAction(ACTION_STOP_SERVICE);
        PendingIntent stopPendingIntent = PendingIntent.getService(this, 101, stopIntent, flags);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🥾 RandoTracker • Suivi GPS actif")
            .setContentText("Position partagée en direct (écran allumé ou éteint en poche)")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "🛑 Arrêter le suivi", stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasLocationPermission()) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }

    public static void showNativeNotification(Context context, String title, String body, String type, String sender) {
        if (context == null) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Réveil physique de l'écran pour avertir le marcheur même écran verrouillé en poche
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock screenWake = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "RandoTracker::ScreenWakeAlert"
                );
                screenWake.acquire(4000L);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        Intent fullScreenIntent = new Intent(context, RandoMainActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        int uniqueReqCode = (int) (System.currentTimeMillis() % 100000);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(context, uniqueReqCode, fullScreenIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MESSAGE_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setNumber(1)
            .setDefaults(Notification.DEFAULT_ALL)
            .setContentIntent(fullScreenPendingIntent)
            .setVibrate(new long[]{0, 350, 150, 350, 150, 350});

        manager.notify(uniqueReqCode, builder.build());
    }

    private void acquirePartialWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RandoTracker::NativeGpsWakeLock");
                wakeLock.acquire(12 * 3600 * 1000L);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void initNativeLocationListener() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(final Location location) {
                if (location != null) {
                    networkExecutor.execute(new Runnable() {
                        @Override
                        public void run() {
                            broadcastNativeLocation(location);
                        }
                    });
                }
            }
            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override
            public void onProviderEnabled(String provider) {}
            @Override
            public void onProviderDisabled(String provider) {}
        };

        try {
            // GNSS Duty-Cycling 3.5s dans Foreground Service
            // Heartbeat adaptatif 45s à l'arrêt dans Foreground Service
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3500L, 0.0f, locationListener);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 45000L, 0.0f, locationListener);
            }
        } catch (SecurityException se) {
            se.printStackTrace();
        }
    }

    private void broadcastNativeLocation(Location loc) {
        if (loc == null) return;
        String room = (activeRoom != null && !activeRoom.trim().isEmpty()) ? activeRoom.trim() : "RANDO-2026";
        String userId = (activeUserId != null && !activeUserId.trim().isEmpty()) ? activeUserId.trim() : "user_droid";
        String userName = (activeUserName != null && !activeUserName.trim().isEmpty()) ? activeUserName.trim() : "Randonneur";

        long now = System.currentTimeMillis();
        float speedKmh = loc.hasSpeed() ? (loc.getSpeed() * 3.6f) : 0f;
        long minInterval = (speedKmh < 0.8f && !activeIsSos) ? 40000L : 3500L;
        if (now - lastNativeBroadcastTime < minInterval) {
            return;
        }
        lastNativeBroadcastTime = now;

        try {
            ensureMqttConnected();
            if (mqttClient != null && mqttClient.isConnected()) {
                String sanitizedRoom = room.replaceAll("[^a-zA-Z0-9_-]", "_");
                String topic = "randotracker/v1/rooms/" + sanitizedRoom + "/events";

                JSONObject userObj = new JSONObject();
                userObj.put("id", userId);
                userObj.put("name", userName);
                userObj.put("role", activeUserRole);
                userObj.put("color", activeUserColor);
                userObj.put("icon", activeUserIcon);
                userObj.put("lat", loc.getLatitude());
                userObj.put("lon", loc.getLongitude());
                userObj.put("ele", loc.hasAltitude() ? loc.getAltitude() : 0.0);
                userObj.put("speed", (double) speedKmh);
                userObj.put("heading", (double) (loc.hasBearing() ? loc.getBearing() : 0.0f));
                userObj.put("battery", getNativeBatteryLevel());
                userObj.put("accuracy", (double) (loc.hasAccuracy() ? loc.getAccuracy() : 5.0f));
                userObj.put("lastSeen", now);
                userObj.put("isSos", activeIsSos);

                JSONObject payload = new JSONObject();
                payload.put("type", "update_position");
                payload.put("user", userObj);
                payload.put("senderId", userId);
                payload.put("room", room);
                payload.put("timestamp", now);

                MqttMessage mqttMsg = new MqttMessage(payload.toString().getBytes(StandardCharsets.UTF_8));
                mqttMsg.setQos(0);
                mqttClient.publish(topic, mqttMsg);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private int getNativeBatteryLevel() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            }
        } catch (Exception e) {}
        return 90;
    }

    private synchronized void ensureMqttConnected() {
        try {
            if (mqttClient == null) {
                String broker = "tcp://broker.hivemq.com:1883";
                String clientId = "RandoTracker_Native_" + (activeUserId.isEmpty() ? "gen" : activeUserId) + "_" + (System.currentTimeMillis() % 100000);
                mqttClient = new MqttClient(broker, clientId, new MemoryPersistence());
            }
            if (!mqttClient.isConnected()) {
                MqttConnectOptions connOpts = new MqttConnectOptions();
                connOpts.setCleanSession(true);
                connOpts.setAutomaticReconnect(true);
                connOpts.setConnectionTimeout(10);
                connOpts.setKeepAliveInterval(20);
                mqttClient.connect(connOpts);
                mqttClient.subscribe("randotracker/v1/rooms/+/events", 1);
                mqttClient.subscribe("randotracker/+/broadcast_announcement", 1);
            }
        } catch (Exception e) {}
    }

    private void initMqttListener() {
        networkExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    ensureMqttConnected();
                    if (mqttClient != null) {
                        mqttClient.setCallback(new MqttCallback() {
                            @Override
                            public void connectionLost(Throwable cause) {}

                            @Override
                            public void messageArrived(String topic, MqttMessage message) throws Exception {
                                try {
                                    if (topic != null && (topic.contains("broadcast_announcement") || topic.contains("/events"))) {
                                        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
                                        if (payload.contains("broadcast_announcement") || payload.contains("group_sos_alert")) {
                                            String author = "Groupe";
                                            String text = payload;
                                            String role = "Randonneur";
                                            String type = "announcement";
                                            
                                            try {
                                                JSONObject obj = new JSONObject(payload);
                                                if (obj.has("author")) author = obj.getString("author");
                                                if (obj.has("text")) text = obj.getString("text");
                                                if (obj.has("role")) role = obj.getString("role");
                                                if (obj.has("type")) type = obj.getString("type");
                                            } catch (Exception parseEx) {}
                                            
                                            String title = "📢 Message de " + author + (role.isEmpty() ? "" : " (" + role + ")");
                                            if ("group_sos_alert".equals(type)) {
                                                title = "🚨 ALERTE SOS GROUPE • " + author;
                                            }
                                            showNativeNotification(getApplicationContext(), title, text, type, author);
                                        }
                                    }
                                } catch (Exception ex) {
                                    ex.printStackTrace();
                                }
                            }

                            @Override
                            public void deliveryComplete(IMqttDeliveryToken token) {}
                        });
                    }
                } catch (Exception e) {
                    // MQTT optionnel pour bridge
                }
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_SERVICE.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null && locationListener != null) {
            try { locationManager.removeUpdates(locationListener); } catch (Exception e) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception e) {}
        }
        networkExecutor.execute(new Runnable() {
            @Override
            public void run() {
                if (mqttClient != null) {
                    try { mqttClient.disconnect(); } catch (Exception e) {}
                }
            }
        });
        networkExecutor.shutdown();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
"""
with open(os.path.join(app_dir, "src", "main", "java", "fr", "jldaussy", "randotracker", "RandoGpsForegroundService.java"), "w", encoding="utf-8") as f:
    f.write(service_java)

# 8. Manifeste Android Officiel avec Service Foreground Location, Permissions & Caméra
android_manifest = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.CAMERA" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.RandoTracker">

        <meta-data
            android:name="asset_statements"
            android:value="${assetStatements}" />

        <activity
            android:name=".RandoMainActivity"
            android:label="@string/app_name"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="https"
                    android:host="${hostName}"
                    android:pathPrefix="/randotracker" />
            </intent-filter>
        </activity>

        <service
            android:name=".RandoGpsForegroundService"
            android:foregroundServiceType="location"
            android:exported="false" />
    </application>
</manifest>
"""
with open(os.path.join(app_dir, "src", "main", "AndroidManifest.xml"), "w", encoding="utf-8") as f:
    f.write(android_manifest)

print("Projet Android généré avec succès dans :", project_dir)
