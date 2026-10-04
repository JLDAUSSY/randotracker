# -*- coding: utf-8 -*-
"""
Constructeur et compilateur de l'Android App Bundle (.aab) pour RandoTracker
Génère le projet Android TWA complet, la clé de signature (keystore),
les icônes de toutes résolutions et compile l'AAB pour le Google Play Store.
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
        versionCode = 12
        versionName = "1.1.0"

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
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
    implementation("androidx.browser:browser:1.8.0")
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

# 7. Code Source Java Natif pour le Suivi GPS en Arrière-Plan (Poche / Écran Éteint)
main_activity_java = """package fr.jldaussy.randotracker;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

public class RandoMainActivity extends LauncherActivity {
    private static final int PERMISSION_REQ_CODE = 2026;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkAndRequestPermissions();
        startGpsService();
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
            }
        }
    }

    private void startGpsService() {
        try {
            Intent serviceIntent = new Intent(this, RandoGpsForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            startGpsService();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                        PERMISSION_REQ_CODE + 1
                    );
                }
            }
        }
    }
}
"""
with open(os.path.join(app_dir, "src", "main", "java", "fr", "jldaussy", "randotracker", "RandoMainActivity.java"), "w", encoding="utf-8") as f:
    f.write(main_activity_java)

service_java = """package fr.jldaussy.randotracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class RandoGpsForegroundService extends Service {
    public static final String CHANNEL_ID = "rando_gps_tracking_channel";
    public static final int NOTIFICATION_ID = 2026;
    
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private LocationListener locationListener;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForegroundTracking();
        acquirePartialWakeLock();
        initNativeLocationListener();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Suivi GPS RandoTracker",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintient le suivi GPS actif dans la poche écran éteint");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.enableLights(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
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

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🥾 RandoTracker • Suivi GPS actif")
            .setContentText("Position partagée en direct (écran allumé ou éteint en poche)")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
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
            public void onLocationChanged(Location location) {}
            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override
            public void onProviderEnabled(String provider) {}
            @Override
            public void onProviderDisabled(String provider) {}
        };

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 0.0f, locationListener);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000L, 0.0f, locationListener);
            }
        } catch (SecurityException se) {
            se.printStackTrace();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
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
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
"""
with open(os.path.join(app_dir, "src", "main", "java", "fr", "jldaussy", "randotracker", "RandoGpsForegroundService.java"), "w", encoding="utf-8") as f:
    f.write(service_java)

# 8. Manifeste Android Officiel avec Service Foreground Location & Permissions
android_manifest = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

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
            android:exported="true">

            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${defaultUrl}" />

            <meta-data
                android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR"
                android:resource="@color/colorPrimaryDark" />

            <meta-data
                android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR"
                android:resource="@color/navigationColor" />

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

