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
    public static final String MSG_CHANNEL_ID = "rando_messages_channel";
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
        "ssl://broker.emqx.io:8883",
        "tcp://broker.emqx.io:1883",
        "ssl://broker.hivemq.com:8883",
        "tcp://broker.hivemq.com:1883"
    };
    private static volatile RandoGpsForegroundService sInstance = null;
    private int currentBrokerIndex = 0;
    private boolean isConnectingMqtt = false;
    private android.os.Handler backgroundHandler = null;
    private Runnable backgroundHeartbeatRunnable = null;
    private boolean isFusedActive = false;

    public static RandoGpsForegroundService getInstance() {
        return sInstance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        try {
            loadSavedPreferences();
            createNotificationChannel();
            startForegroundTracking();
            acquirePartialWakeLock();
            initLocationProviders();
            initMqttConnection();
            startBackgroundHeartbeat();
        } catch (Throwable t) {
            Log.e(TAG, "Erreur dans Service onCreate", t);
        }
    }

    private void startBackgroundHeartbeat() {
        try {
            backgroundHandler = new android.os.Handler(Looper.getMainLooper());
            backgroundHeartbeatRunnable = new Runnable() {
                @Override
                public void run() {
                    long nextDelay = 7000L;
                    try {
                        if (isTrackingActive) {
                            float speedMs = (lastLocation != null && lastLocation.hasSpeed()) ? lastLocation.getSpeed() : 0.0f;
                            boolean isMoving = speedMs >= 0.25f;
                            nextDelay = isMoving ? 7000L : 45000L;

                            // Vérifier la santé de la connexion MQTT en arrière-plan
                            if (mqttClient == null || !mqttClient.isConnected()) {
                                Log.d(TAG, "[Heartbeat] MQTT non connecté en arrière-plan, tentative de reconnexion...");
                                initMqttConnection();
                            } else if (lastLocation != null) {
                                // Maintien d'émission vers les compagnons avec cadence adaptative (7s en marche, 45s à l'arrêt)
                                publishGpsLocationToMqtt(lastLocation);
                            }
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Erreur background heartbeat", e);
                    }
                    if (backgroundHandler != null && backgroundHeartbeatRunnable != null) {
                        backgroundHandler.postDelayed(this, nextDelay);
                    }
                }
            };
            backgroundHandler.postDelayed(backgroundHeartbeatRunnable, 7000L);
        } catch (Exception e) {
            Log.e(TAG, "Erreur startBackgroundHeartbeat", e);
        }
    }

    private void stopBackgroundHeartbeat() {
        if (backgroundHandler != null && backgroundHeartbeatRunnable != null) {
            backgroundHandler.removeCallbacks(backgroundHeartbeatRunnable);
            backgroundHeartbeatRunnable = null;
            backgroundHandler = null;
        }
    }

    private void loadSavedPreferences() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            roomCode = prefs.getString("room_code", "RANDO-2026");
            userId = prefs.getString("user_id", "u_native_" + System.currentTimeMillis());
            userName = prefs.getString("user_name", "Randonneur");
            if ("Animateur".equals(userName) || "Guide".equals(userName)) {
                userName = "Randonneur";
            }
            userIcon = prefs.getString("user_icon", "🥾");
            userColor = prefs.getString("user_color", "#10b981");
            assignedTrackId = prefs.getString("assigned_track_id", "auto");
            isTrackingActive = prefs.getBoolean("is_tracking", true);
            Log.d(TAG, "Prefs chargees: Salon=" + roomCode + ", User=" + userName + " (" + userId + ")");
        } catch (Throwable t) {
            Log.e(TAG, "Erreur loadSavedPreferences", t);
        }
    }

    public void updateSessionDirect(String room, String uid, String name, String icon, String color, String trackId, boolean isTracking) {
        try {
            boolean roomChanged = room != null && !room.isEmpty() && !room.equals(roomCode);
            if (room != null && !room.isEmpty()) roomCode = room;
            if (uid != null && !uid.isEmpty()) userId = uid;
            if (name != null && !name.isEmpty()) userName = name;
            if (icon != null && !icon.isEmpty()) userIcon = icon;
            if (color != null && !color.isEmpty()) userColor = color;
            if (trackId != null && !trackId.isEmpty()) assignedTrackId = trackId;
            isTrackingActive = isTracking;

            Log.d(TAG, "Session mise a jour directe (in-memory) : Salon=" + roomCode + ", User=" + userName + " (" + userId + ")");

            if (roomChanged && mqttClient != null && mqttClient.isConnected()) {
                new Thread(() -> {
                    try {
                        String sanitizedRoom = roomCode.replaceAll("[^a-zA-Z0-9_-]", "_");
                        String topic = "randotracker/v1/rooms/" + sanitizedRoom + "/events";
                        mqttClient.subscribe(topic, 0);
                        publishUserJoinedToMqtt();
                    } catch (Exception e) {
                        Log.w(TAG, "Erreur resouscription MQTT salon", e);
                    }
                }).start();
            } else if (mqttClient == null || !mqttClient.isConnected()) {
                initMqttConnection();
            }

            if (lastLocation != null) {
                updateNotification(lastLocation);
                publishGpsLocationToMqtt(lastLocation);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Erreur updateSessionDirect", t);
        }
    }

    public static void updateSession(Context context, String room, String uid, String name, String icon, String color, String trackId, boolean isTracking) {
        try {
            if (context != null) {
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
            }

            // Si le service est déjà actif en mémoire, mise à jour directe sans déclencher de cycle IPC / Service Start
            if (sInstance != null) {
                sInstance.updateSessionDirect(room, uid, name, icon, color, trackId, isTracking);
                return;
            }

            if (context != null) {
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
        } catch (Throwable t) {
            Log.e(TAG, "Erreur updateSession", t);
        }
    }

    private void createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    // 1. Canal silencieux dédié au suivi GPS en tâche de fond (basse priorité)
                    NotificationChannel gpsChannel = new NotificationChannel(
                        CHANNEL_ID,
                        "Suivi GPS RandoTracker",
                        NotificationManager.IMPORTANCE_LOW
                    );
                    gpsChannel.setDescription("Maintient le suivi GPS actif dans la poche écran éteint");
                    gpsChannel.setShowBadge(false);
                    gpsChannel.enableVibration(false);
                    gpsChannel.enableLights(false);
                    manager.createNotificationChannel(gpsChannel);

                    // 2. Canal d'alerte haute priorité dédié aux Messages et Annonces de groupe (réveil montre & écran)
                    NotificationChannel msgChannel = new NotificationChannel(
                        MSG_CHANNEL_ID,
                        "Messages et Alertes RandoTracker",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    msgChannel.setDescription("Alerte immédiate pour les messages du salon, annonces et secours");
                    msgChannel.setShowBadge(true);
                    msgChannel.enableVibration(true);
                    msgChannel.setVibrationPattern(new long[]{0, 300, 150, 300, 150, 300});
                    msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    manager.createNotificationChannel(msgChannel);
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "Erreur createNotificationChannel", t);
        }
    }

    public static void showNativeNotification(Context context, String title, String body, String type, String author) {
        try {
            if (context == null) return;
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            // S'assurer que les canaux existent
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel msgChannel = manager.getNotificationChannel(MSG_CHANNEL_ID);
                if (msgChannel == null) {
                    msgChannel = new NotificationChannel(
                        MSG_CHANNEL_ID,
                        "Messages et Alertes RandoTracker",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    msgChannel.setDescription("Alerte immédiate pour les messages du salon, annonces et secours");
                    msgChannel.setShowBadge(true);
                    msgChannel.enableVibration(true);
                    msgChannel.setVibrationPattern(new long[]{0, 300, 150, 300, 150, 300});
                    msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    manager.createNotificationChannel(msgChannel);
                }
            }

            Intent intent = new Intent(context, RandoMainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("open_announcement", true);
            intent.putExtra("announcement_title", title);
            intent.putExtra("announcement_body", body);
            intent.putExtra("announcement_type", type);
            intent.putExtra("announcement_author", author);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            int reqCode = (int) (System.currentTimeMillis() % 10000);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, reqCode, intent, flags);

            boolean isEmergency = "emergency".equalsIgnoreCase(type) || "emergency_alert".equalsIgnoreCase(type);
            long[] vibPattern = isEmergency 
                ? new long[]{0, 500, 200, 500, 200, 500, 200, 1000} 
                : new long[]{0, 300, 150, 300, 150, 300};

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MSG_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(isEmergency ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setVibrate(vibPattern)
                .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_LIGHTS);

            int notifId = (int) (System.currentTimeMillis() % 100000);
            manager.notify(notifId, builder.build());
            Log.d(TAG, "Notification native postee: " + title + " - " + body);
        } catch (Throwable t) {
            Log.e(TAG, "Erreur showNativeNotification", t);
        }
    }

    private void startForegroundTracking() {
        try {
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
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

            boolean hasFine = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            boolean hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && (hasFine || hasCoarse)) {
                try {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } catch (Throwable t) {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Erreur startForegroundTracking", t);
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
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, notification);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Erreur mise a jour notification", t);
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

        // 1. Google Play Services Fused Location Provider (Haute précision et basse consommation prioritaire)
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3500L)
                .setMinUpdateIntervalMillis(2000L)
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
            isFusedActive = true;
            Log.d(TAG, "FusedLocationProviderClient configure avec succes (Priorite 1 - Duty-Cycle 3.5s)");
        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException FusedLocation", se);
        } catch (Exception e) {
            Log.e(TAG, "Erreur FusedLocationProviderClient", e);
            isFusedActive = false;
        }

        // 2. Fallback natif LocationManager uniquement si FusedLocation est inactif
        if (!isFusedActive) {
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
                        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3500L, 0.0f, locationListener, Looper.getMainLooper());
                        Log.d(TAG, "LocationManager GPS_PROVIDER configure en fallback (3.5s)");
                    }
                }
            } catch (SecurityException se) {
                Log.e(TAG, "SecurityException LocationManager fallback", se);
            } catch (Exception e) {
                Log.e(TAG, "Erreur LocationManager fallback", e);
            }
        }
    }

    private synchronized void onNewLocationReceived(Location location) {
        if (location == null) return;

        // Éviter les micro-doublons stricts à moins de 800ms
        if (lastLocation != null && (location.getTime() - lastLocation.getTime() < 800)) {
            return;
        }

        // Calcul distance parcourue avec filtre anti-dérive GPS (anti-drift)
        if (lastLocation != null) {
            float d = lastLocation.distanceTo(location);
            long dtMs = Math.max(1L, location.getTime() - lastLocation.getTime());
            float dtSec = dtMs / 1000.0f;
            float speed = location.hasSpeed() ? location.getSpeed() : (d / dtSec);
            float accuracy = location.hasAccuracy() ? location.getAccuracy() : 20.0f;

            // Filtre de déplacement réaliste à pied :
            // - Précision suffisante (< 35m)
            // - Vitesse minimale > 0.35 m/s (~1.26 km/h) pour éliminer le jitter statique en poche / sur table
            // - Vitesse maximale < 8.5 m/s (~30 km/h)
            // - Distance minimale proportionnelle à la précision pour éviter les faux cumuls
            boolean isValidMovement = accuracy <= 35.0f 
                && speed >= 0.35f 
                && speed <= 8.5f 
                && d >= Math.max(3.0f, accuracy * 0.30f)
                && d < 250.0f;

            if (isValidMovement) {
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

                publishUserJoinedToMqtt();

            } catch (Exception e) {
                Log.w(TAG, "Erreur connexion MQTT: " + e.getMessage());
                currentBrokerIndex = (currentBrokerIndex + 1) % BROKERS.length;
            } finally {
                isConnectingMqtt = false;
            }
        }).start();
    }

    private void publishUserJoinedToMqtt() {
        new Thread(() -> {
            try {
                if (mqttClient == null || !mqttClient.isConnected()) return;
                long now = System.currentTimeMillis();
                JSONObject userObj = new JSONObject();
                userObj.put("id", userId);
                userObj.put("name", userName);
                userObj.put("role", "Randonneur");
                userObj.put("icon", userIcon);
                userObj.put("color", userColor);
                userObj.put("assignedTrackId", assignedTrackId);
                if (lastLocation != null) {
                    userObj.put("lat", lastLocation.getLatitude());
                    userObj.put("lon", lastLocation.getLongitude());
                    userObj.put("ele", Math.round(lastLocation.hasAltitude() ? lastLocation.getAltitude() : 0.0));
                    userObj.put("speed", Math.round((lastLocation.hasSpeed() ? lastLocation.getSpeed() * 3.6 : 0.0) * 10.0) / 10.0);
                }
                userObj.put("battery", batteryPct);
                userObj.put("lastSeen", now);

                JSONObject payload = new JSONObject();
                payload.put("type", "user_joined");
                payload.put("room", roomCode);
                payload.put("senderId", userId);
                payload.put("timestamp", now);
                payload.put("user", userObj);

                String sanitizedRoom = roomCode.replaceAll("[^a-zA-Z0-9_-]", "_");
                String topic = "randotracker/v1/rooms/" + sanitizedRoom + "/events";

                MqttMessage msg = new MqttMessage(payload.toString().getBytes("UTF-8"));
                msg.setQos(0);
                mqttClient.publish(topic, msg);
                Log.d(TAG, "Notification user_joined diffusee sur " + topic + " pour " + userName);
            } catch (Exception e) {
                Log.w(TAG, "Erreur publishUserJoinedToMqtt: " + e.getMessage());
            }
        }).start();
    }

    private long lastMqttPublishTime = 0;

    private void publishGpsLocationToMqtt(Location loc) {
        publishGpsLocationToMqtt(loc, false);
    }

    private void publishGpsLocationToMqtt(Location loc, boolean force) {
        if (!isTrackingActive || loc == null) return;

        long now = System.currentTimeMillis();
        float speedMs = loc.hasSpeed() ? loc.getSpeed() : 0.0f;
        boolean isMoving = speedMs >= 0.25f; // ~0.9 km/h
        long minInterval = isMoving ? 7000L : 45000L;

        if (!force && (now - lastMqttPublishTime < minInterval)) {
            return;
        }
        lastMqttPublishTime = now;

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
            String newUid = intent.getStringExtra(EXTRA_USER_ID);
            String newName = intent.getStringExtra(EXTRA_USER_NAME);
            String newIcon = intent.getStringExtra(EXTRA_USER_ICON);
            String newColor = intent.getStringExtra(EXTRA_USER_COLOR);
            String newTrackId = intent.getStringExtra(EXTRA_TRACK_ID);
            boolean tracking = intent.getBooleanExtra(EXTRA_IS_TRACKING, true);
            updateSessionDirect(newRoom, newUid, newName, newIcon, newColor, newTrackId, tracking);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sInstance == this) {
            sInstance = null;
        }
        stopBackgroundHeartbeat();
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
            new Thread(() -> {
                try {
                    if (mqttClient != null && mqttClient.isConnected()) {
                        mqttClient.disconnect();
                    }
                    if (mqttClient != null) {
                        mqttClient.close();
                    }
                } catch (Exception ignored) {}
            }).start();
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
    public void messageArrived(String topic, MqttMessage message) {
        try {
            if (message == null || message.getPayload() == null) return;
            String payloadStr = new String(message.getPayload(), "UTF-8");
            JSONObject json = new JSONObject(payloadStr);
            String type = json.optString("type", "");
            String senderId = json.optString("senderId", "");

            // Ne pas s'auto-notifier
            if (senderId != null && !senderId.isEmpty() && senderId.equals(userId)) {
                return;
            }

            if ("broadcast_announcement".equals(type)) {
                String author = json.optString("author", "Marcheur");
                String role = json.optString("role", "Randonneur");
                String text = json.optString("text", "");
                if (!text.isEmpty()) {
                    String title = "💬 Message de " + author + " (" + role + ")";
                    showNativeNotification(this, title, text, "announcement", author);
                }
            } else if ("emergency_alert".equals(type) || "emergency".equals(type)) {
                String author = json.optString("author", json.optString("senderName", "Secours"));
                String text = json.optString("text", "Alerte secours déclenchée !");
                String title = "🚨 ALERTE SECOURS : " + author;
                showNativeNotification(this, title, text, "emergency", author);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Erreur parsing message MQTT entrant", t);
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {}
}
