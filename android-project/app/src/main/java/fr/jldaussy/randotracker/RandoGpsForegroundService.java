package fr.jldaussy.randotracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

import java.util.Locale;

public class RandoGpsForegroundService extends Service implements MqttCallback {
    private static final String TAG = "RandoGpsService";
    public static final String CHANNEL_ID = "rando_gps_tracking_channel";
    public static final int NOTIFICATION_ID = 2026;
    public static final String PREFS_NAME = "RandoTrackerPrefs";

    public static final String ACTION_UPDATE_SESSION = "fr.jldaussy.randotracker.ACTION_UPDATE_SESSION";
    public static final String EXTRA_ROOM = "extra_room";
    public static final String EXTRA_USER_ID = "extra_user_id";
    public static final String EXTRA_USER_NAME = "extra_user_name";
    public static final String EXTRA_USER_ICON = "extra_user_icon";
    public static final String EXTRA_USER_COLOR = "extra_user_color";
    public static final String EXTRA_TRACK_ID = "extra_track_id";
    public static final String EXTRA_IS_TRACKING = "extra_is_tracking";

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationManager locationManager;
    private LocationListener locationListener;

    private PowerManager.WakeLock wakeLock;
    private MqttClient mqttClient;

    private String roomCode = "RANDO-2026";
    private String userId = "u_native";
    private String userName = "Randonneur";
    private String userIcon = "🥾";
    private String userColor = "#10b981";
    private String assignedTrackId = "auto";
    private boolean isTrackingActive = true;

    private Location lastLocation = null;
    private double totalDistanceMeters = 0.0;
    private int batteryPct = 100;
    private static final String[] BROKERS = {
        "ssl://broker.hivemq.com:8883",
        "ssl://broker.emqx.io:8883",
        "tcp://broker.hivemq.com:1883",
        "tcp://broker.emqx.io:1883"
    };
    private int currentBrokerIndex = 0;
    private boolean isConnectingMqtt = false;

    @Override
    public void onCreate() {
        super.onCreate();
        loadSavedPreferences();
        createNotificationChannel();
        startForegroundTracking();
        acquirePartialWakeLock();
        initLocationProviders();
        initMqttConnection();
    }

    private void loadSavedPreferences() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        roomCode = prefs.getString("room_code", "RANDO-2026");
        userId = prefs.getString("user_id", "u_native_" + System.currentTimeMillis());
        userName = prefs.getString("user_name", "Randonneur");
        userIcon = prefs.getString("user_icon", "🥾");
        userColor = prefs.getString("user_color", "#10b981");
        assignedTrackId = prefs.getString("assigned_track_id", "auto");
        isTrackingActive = prefs.getBoolean("is_tracking", true);
        Log.d(TAG, "Prefs chargees: Salon=" + roomCode + ", User=" + userName + " (" + userId + ")");
    }

    public static void updateSession(Context context, String room, String uid, String name, String icon, String color, String trackId, boolean isTracking) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("room_code", room)
            .putString("user_id", uid)
            .putString("user_name", name)
            .putString("user_icon", icon)
            .putString("user_color", color)
            .putString("assigned_track_id", trackId)
            .putBoolean("is_tracking", isTracking)
            .apply();

        Intent intent = new Intent(context, RandoGpsForegroundService.class);
        intent.setAction(ACTION_UPDATE_SESSION);
        intent.putExtra(EXTRA_ROOM, room);
        intent.putExtra(EXTRA_USER_ID, uid);
        intent.putExtra(EXTRA_USER_NAME, name);
        intent.putExtra(EXTRA_USER_ICON, icon);
        intent.putExtra(EXTRA_USER_COLOR, color);
        intent.putExtra(EXTRA_TRACK_ID, trackId);
        intent.putExtra(EXTRA_IS_TRACKING, isTracking);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
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
            .setContentText("Position partagée en direct (écran allumé ou éteint dans la poche)")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        try {
            boolean hasFine = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            boolean hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && (hasFine || hasCoarse)) {
                try {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } catch (Exception e) {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur startForegroundTracking", e);
        }
    }

    private void updateNotification(Location location) {
        try {
            double speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6 : 0.0;
            double distKm = totalDistanceMeters / 1000.0;
            String text = String.format(Locale.FRANCE, "Salon %s • %.2f km • %.1f km/h (±%dm)", 
                roomCode, distKm, speedKmh, (int) location.getAccuracy());

            Intent launchIntent = new Intent(this, RandoMainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);

            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(userIcon + " " + userName + " • Suivi GPS en direct")
                .setContentText(text)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur mise a jour notification", e);
        }
    }

    private void acquirePartialWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RandoTracker::NativeGpsWakeLock");
                wakeLock.acquire(24 * 3600 * 1000L); // 24h
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur acquire WakeLock", e);
        }
    }

    private void initLocationProviders() {
        boolean hasFine = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (!hasFine && !hasCoarse) {
            Log.w(TAG, "Permissions localisation non accordees au Service, attente...");
            return;
        }

        // 1. Google Play Services Fused Location Provider (Standard de haute précision en arrière-plan)
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L)
                .setMinUpdateIntervalMillis(1000L)
                .setMinUpdateDistanceMeters(0.0f)
                .setWaitForAccurateLocation(false)
                .build();

            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(@NonNull LocationResult locationResult) {
                    Location loc = locationResult.getLastLocation();
                    if (loc != null) {
                        onNewLocationReceived(loc);
                    }
                }
            };

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
            Log.d(TAG, "FusedLocationProviderClient configure avec succes");
        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException FusedLocation", se);
        } catch (Exception e) {
            Log.e(TAG, "Erreur FusedLocationProviderClient", e);
        }

        // 2. Dual-fallback natif LocationManager
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager != null) {
                locationListener = new LocationListener() {
                    @Override
                    public void onLocationChanged(@NonNull Location location) {
                        onNewLocationReceived(location);
                    }
                    @Override
                    public void onStatusChanged(String provider, int status, Bundle extras) {}
                    @Override
                    public void onProviderEnabled(@NonNull String provider) {}
                    @Override
                    public void onProviderDisabled(@NonNull String provider) {}
                };

                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 0.0f, locationListener, Looper.getMainLooper());
                }
            }
        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException LocationManager fallback", se);
        } catch (Exception e) {
            Log.e(TAG, "Erreur LocationManager fallback", e);
        }
    }

    private synchronized void onNewLocationReceived(Location location) {
        if (location == null) return;

        // Éviter les doublons stricts à moins de 500ms
        if (lastLocation != null && (location.getTime() - lastLocation.getTime() < 500)) {
            return;
        }

        // Calcul distance parcourue
        if (lastLocation != null) {
            float d = lastLocation.distanceTo(location);
            if (d > 0.8f && d < 250.0f) {
                totalDistanceMeters += d;
            }
        }
        lastLocation = location;

        // Mise a jour notification
        updateNotification(location);

        // Publication directe vers le groupe via MQTT
        publishGpsLocationToMqtt(location);
    }

    private void initMqttConnection() {
        new Thread(() -> {
            if (isConnectingMqtt) return;
            isConnectingMqtt = true;
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    isConnectingMqtt = false;
                    return;
                }

                String broker = BROKERS[currentBrokerIndex];
                String cleanUid = userId.replaceAll("[^a-zA-Z0-9_-]", "_");
                String clientId = "android_" + cleanUid + "_" + (System.currentTimeMillis() % 10000);
                Log.d(TAG, "Connexion MQTT vers " + broker + " avec client " + clientId);

                mqttClient = new MqttClient(broker, clientId, new MemoryPersistence());
                mqttClient.setCallback(this);

                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setConnectionTimeout(10);
                options.setKeepAliveInterval(20);
                options.setAutomaticReconnect(true);

                if (broker.startsWith("ssl://")) {
                    options.setSocketFactory(javax.net.ssl.SSLSocketFactory.getDefault());
                }

                mqttClient.connect(options);
                Log.d(TAG, "Connecte avec succes au broker MQTT: " + broker);

                String sanitizedRoom = roomCode.replaceAll("[^a-zA-Z0-9_-]", "_");
                String topic = "randotracker/v1/rooms/" + sanitizedRoom + "/events";
                mqttClient.subscribe(topic, 0);

            } catch (Exception e) {
                Log.w(TAG, "Erreur connexion MQTT: " + e.getMessage());
                currentBrokerIndex = (currentBrokerIndex + 1) % BROKERS.length;
            } finally {
                isConnectingMqtt = false;
            }
        }).start();
    }

    private void publishGpsLocationToMqtt(Location loc) {
        if (!isTrackingActive) return;

        new Thread(() -> {
            try {
                if (mqttClient == null || !mqttClient.isConnected()) {
                    initMqttConnection();
                    return;
                }

                updateBatteryLevel();

                double speedKmh = loc.hasSpeed() ? loc.getSpeed() * 3.6 : 0.0;
                double altitude = loc.hasAltitude() ? loc.getAltitude() : 0.0;
                float accuracy = loc.hasAccuracy() ? loc.getAccuracy() : 10.0f;
                long now = System.currentTimeMillis();

                JSONObject userObj = new JSONObject();
                userObj.put("id", userId);
                userObj.put("name", userName);
                userObj.put("role", "Randonneur");
                userObj.put("icon", userIcon);
                userObj.put("color", userColor);
                userObj.put("assignedTrackId", assignedTrackId);
                userObj.put("lat", loc.getLatitude());
                userObj.put("lon", loc.getLongitude());
                userObj.put("ele", Math.round(altitude));
                userObj.put("speed", Math.round(speedKmh * 10.0) / 10.0);
                userObj.put("acc", Math.round(accuracy));
                userObj.put("battery", batteryPct);
                userObj.put("lastSeen", now);

                JSONObject payload = new JSONObject();
                payload.put("type", "update_position");
                payload.put("room", roomCode);
                payload.put("senderId", userId);
                payload.put("timestamp", now);
                payload.put("user", userObj);

                String sanitizedRoom = roomCode.replaceAll("[^a-zA-Z0-9_-]", "_");
                String topic = "randotracker/v1/rooms/" + sanitizedRoom + "/events";

                MqttMessage msg = new MqttMessage(payload.toString().getBytes("UTF-8"));
                msg.setQos(0);
                mqttClient.publish(topic, msg);

                Log.d(TAG, "Position GPS native (" + userName + ") diffusee sur " + topic + " : " + loc.getLatitude() + ", " + loc.getLongitude());
            } catch (Exception e) {
                Log.w(TAG, "Erreur publication MQTT native: " + e.getMessage());
            }
        }).start();
    }

    private void updateBatteryLevel() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);
            if (bm != null) {
                batteryPct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            }
        } catch (Exception e) {
            batteryPct = 100;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_UPDATE_SESSION.equals(intent.getAction())) {
            String newRoom = intent.getStringExtra(EXTRA_ROOM);
            if (newRoom != null && !newRoom.isEmpty()) roomCode = newRoom;
            
            String newUid = intent.getStringExtra(EXTRA_USER_ID);
            if (newUid != null && !newUid.isEmpty()) userId = newUid;

            String newName = intent.getStringExtra(EXTRA_USER_NAME);
            if (newName != null && !newName.isEmpty()) userName = newName;

            String newIcon = intent.getStringExtra(EXTRA_USER_ICON);
            if (newIcon != null && !newIcon.isEmpty()) userIcon = newIcon;

            String newColor = intent.getStringExtra(EXTRA_USER_COLOR);
            if (newColor != null && !newColor.isEmpty()) userColor = newColor;

            String newTrackId = intent.getStringExtra(EXTRA_TRACK_ID);
            if (newTrackId != null && !newTrackId.isEmpty()) assignedTrackId = newTrackId;

            isTrackingActive = intent.getBooleanExtra(EXTRA_IS_TRACKING, true);

            Log.d(TAG, "Session mise a jour : Salon=" + roomCode + ", User=" + userName + " (" + userId + ")");

            if (lastLocation != null) {
                updateNotification(lastLocation);
                publishGpsLocationToMqtt(lastLocation);
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (fusedLocationClient != null && locationCallback != null) {
            try { fusedLocationClient.removeLocationUpdates(locationCallback); } catch (Exception e) {}
        }
        if (locationManager != null && locationListener != null) {
            try { locationManager.removeUpdates(locationListener); } catch (Exception e) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception e) {}
        }
        if (mqttClient != null) {
            try { mqttClient.disconnect(); mqttClient.close(); } catch (Exception e) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void connectionLost(Throwable cause) {
        Log.w(TAG, "Connexion MQTT perdue, reconnexion...");
        initMqttConnection();
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {}

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {}
}
