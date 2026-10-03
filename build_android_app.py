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
        versionCode = 9
        versionName = "1.0.8"

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
    <color name="colorPrimaryDark">#0f172a</color>
    <color name="colorAccent">#10b981</color>
    <color name="navigationColor">#0f172a</color>
    <color name="ic_launcher_background">#0f172a</color>
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

android_manifest = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
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
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
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
    </application>
</manifest>
"""
with open(os.path.join(app_dir, "src", "main", "AndroidManifest.xml"), "w", encoding="utf-8") as f:
    f.write(android_manifest)

print("Projet Android généré avec succès dans :", project_dir)
