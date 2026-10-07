package fr.jldaussy.randotracker;

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
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

public class RandoGpsForegroundService extends Service {
    public static final String CHANNEL_ID = "rando_gps_tracking_channel";
    public static final String MESSAGE_CHANNEL_ID = "rando_messages_alerts_v3";
    public static final int NOTIFICATION_ID = 2026;
    public static final int MSG_NOTIFICATION_ID = 2027;
    
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private LocationListener locationListener;
    private MqttClient mqttClient;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        startForegroundTracking();
        acquirePartialWakeLock();
        initNativeLocationListener();
        initMqttListener();
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
            .setFullScreenIntent(fullScreenPendingIntent, true)
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
            public void onLocationChanged(Location location) {}
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

    private void initMqttListener() {
        try {
            String broker = "tcp://broker.hivemq.com:1883";
            String clientId = "RandoTracker_Native_" + System.currentTimeMillis();
            mqttClient = new MqttClient(broker, clientId, new MemoryPersistence());
            MqttConnectOptions connOpts = new MqttConnectOptions();
            connOpts.setCleanSession(true);
            connOpts.setAutomaticReconnect(true);

            mqttClient.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {}

                @Override
                public void messageArrived(String topic, MqttMessage message) throws Exception {
                    try {
                        if (topic != null && (topic.contains("broadcast_announcement") || topic.contains("/events"))) {
                            String payload = new String(message.getPayload());
                            if (payload.contains("broadcast_announcement") || payload.contains("group_sos_alert")) {
                                String author = "Groupe";
                                String text = payload;
                                String role = "Randonneur";
                                String type = "announcement";
                                
                                try {
                                    org.json.JSONObject obj = new org.json.JSONObject(payload);
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

            mqttClient.connect(connOpts);
            mqttClient.subscribe("randotracker/v1/rooms/+/events", 1);
            mqttClient.subscribe("randotracker/+/broadcast_announcement", 1);
        } catch (Exception e) {
            // MQTT optionnel pour bridge
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
        if (mqttClient != null) {
            try { mqttClient.disconnect(); } catch (Exception e) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
