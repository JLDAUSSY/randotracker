package fr.jldaussy.randotracker;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

public class RandoMainActivity extends LauncherActivity {
    private static final int PERMISSION_REQ_CODE = 2026;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkAndRequestPermissions();
        startGpsService();
        handleIntent(getIntent());
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
                if (webView != null) {
                    webView.evaluateJavascript("if(window.joinRoomDirectly) window.joinRoomDirectly('" + room + "');", null);
                }
            }
        }
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
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            startGpsService();
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

    public class AndroidBridge {
        @JavascriptInterface
        public String getVersionName() {
            return "1.4.7 (41)";
        }

        @JavascriptInterface
        public void showMessageNotification(String title, String body, String type, String sender) {
            RandoGpsForegroundService.showNativeNotification(getApplicationContext(), title, body, type, sender);
        }
    }
}
