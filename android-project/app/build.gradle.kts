plugins {
    id("com.android.application")
}

android {
    namespace = "fr.jldaussy.randotracker"
    compileSdk = 36

    defaultConfig {
        applicationId = "fr.jldaussy.randotracker"
        minSdk = 24
        targetSdk = 36
        versionCode = 52
        versionName = "1.4.14"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        manifestPlaceholders["hostName"] = "jldaussy.github.io"
        manifestPlaceholders["defaultUrl"] = "https://jldaussy.github.io/randotracker/"
        manifestPlaceholders["assetStatements"] = """[
            {
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {
                    "namespace": "android_app",
                    "package_name": "fr.jldaussy.randotracker",
                    "sha256_cert_fingerprints": ["7D:40:04:E7:AC:75:31:DF:A1:27:97:29:C2:4B:B4:4D:11:CF:45:A2:5F:67:3B:E4:25:25:D4:24:B0:AB:A0:27"]
                }
            }
        ]"""
    }

    signingConfigs {
        create("release") {
            storeFile = file("C:\\Users\\lesda\\.gemini\\antigravity\\scratch\\rando-tracker\\android-project\\keystore\\randotracker-release.jks")
            storePassword = "randotracker2026"
            keyAlias = "randotracker"
            keyPassword = "randotracker2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5")
}
