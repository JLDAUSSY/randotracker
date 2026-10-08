package fr.jldaussy.randotracker;

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
