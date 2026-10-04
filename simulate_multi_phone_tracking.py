import time
import json
import ssl
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Force unbuffered output
def log(msg):
    print(msg, flush=True)

import paho.mqtt.client as mqtt

# Configuration
ROOM_CODE = "RANDO-2026"
SANITIZED_ROOM = ROOM_CODE.replace("-", "_")
TOPIC = f"randotracker/v1/rooms/{SANITIZED_ROOM}/events"

phone1_received_messages = []
phone2_received_messages = []

# Callbacks pour Téléphone 1 (Jean-Luc - Web WebSocket)
def on_connect_phone1(client, userdata, flags, rc, properties=None):
    print(f"[Phone 1 (Jean-Luc Web)] Connecté au broker. Code: {rc}")
    client.subscribe(TOPIC, qos=0)
    print(f"[Phone 1 (Jean-Luc Web)] Abonné au topic : {TOPIC}")

def on_message_phone1(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode('utf-8'))
        print(f"[Phone 1 (Jean-Luc Web)] 📩 REÇU de {data.get('user', {}).get('name', 'Inconnu')} (ID: {data.get('senderId')}) : "
              f"Lat={data.get('user', {}).get('lat')}, Lon={data.get('user', {}).get('lon')}, "
              f"Vitesse={data.get('user', {}).get('speed')} km/h, Salon={data.get('room')}")
        phone1_received_messages.append(data)
    except Exception as e:
        print(f"[Phone 1] Erreur décodage message: {e}")

# Callbacks pour Téléphone 2 (Edith - Native Android Service)
def on_connect_phone2(client, userdata, flags, rc, properties=None):
    print(f"[Phone 2 (Edith Android Service)] Connecté au broker via TCP/SSL. Code: {rc}")
    client.subscribe(TOPIC, qos=0)

def on_message_phone2(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode('utf-8'))
        phone2_received_messages.append(data)
    except Exception as e:
        pass

def run_simulation():
    print("=" * 70)
    print("🚀 DÉMARRAGE DU SIMULATEUR MULTI-TÉLÉPHONES RANDOTRACKER")
    print(f"Salon de test : {ROOM_CODE} | Topic MQTT : {TOPIC}")
    print("=" * 70)

    # 1. Initialisation Téléphone 1 (Jean-Luc - Web WebSocket wss://broker.hivemq.com:8884/mqtt)
    client_phone1 = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2, client_id="web_jeanluc_sim", transport="websockets")
    client_phone1.ws_set_options(path="/mqtt")
    client_phone1.tls_set(cert_reqs=ssl.CERT_NONE)
    client_phone1.on_connect = on_connect_phone1
    client_phone1.on_message = on_message_phone1

    try:
        print("[Simulateur] Connexion Phone 1 (WebSocket SSL sur HiveMQ:8884)...")
        client_phone1.connect("broker.hivemq.com", 8884, 60)
        client_phone1.loop_start()
    except Exception as e:
        print(f"[Erreur] Connexion Phone 1 échouée: {e}")
        return False

    time.sleep(2)

    # 2. Initialisation Téléphone 2 (Edith - Service Natif Android TCP sur HiveMQ:1883)
    client_phone2 = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2, client_id="android_edith_sim", transport="tcp")
    client_phone2.on_connect = on_connect_phone2
    client_phone2.on_message = on_message_phone2

    try:
        print("[Simulateur] Connexion Phone 2 (TCP sur HiveMQ:1883)...")
        client_phone2.connect("broker.hivemq.com", 1883, 60)
        client_phone2.loop_start()
    except Exception as e:
        print(f"[Erreur] Connexion Phone 2 échouée: {e}")
        client_phone1.loop_stop()
        return False

    time.sleep(2)

    # 3. Simulation : Edith marche 5 pas avec l'écran éteint
    gps_track = [
        {"lat": 43.12340, "lon": 5.77950, "speed": 4.1, "ele": 450},
        {"lat": 43.12350, "lon": 5.77960, "speed": 4.3, "ele": 451},
        {"lat": 43.12360, "lon": 5.77970, "speed": 4.2, "ele": 452},
        {"lat": 43.12370, "lon": 5.77980, "speed": 4.5, "ele": 453},
        {"lat": 43.12380, "lon": 5.77990, "speed": 4.4, "ele": 455},
    ]

    print("\n--- [SIMULATION MARCHE ÉDITH ÉCRAN ÉTEINT (5 POINTS GPS)] ---")
    for i, pt in enumerate(gps_track):
        payload = {
            "type": "update_position",
            "room": ROOM_CODE,
            "senderId": "u_edith_uuid_789",
            "timestamp": int(time.time() * 1000),
            "user": {
                "id": "u_edith_uuid_789",
                "name": "Édith",
                "role": "Randonneur",
                "icon": "🐺",
                "color": "#9333ea",
                "assignedTrackId": "auto",
                "lat": pt["lat"],
                "lon": pt["lon"],
                "ele": pt["ele"],
                "speed": pt["speed"],
                "acc": 4,
                "battery": 88,
                "lastSeen": int(time.time() * 1000)
            }
        }
        print(f"\n[Phone 2 (Edith Android)] 📡 Émission GPS point #{i+1} : Lat={pt['lat']}, Lon={pt['lon']}, Vitesse={pt['speed']} km/h")
        client_phone2.publish(TOPIC, json.dumps(payload), qos=0)
        time.sleep(1.5)

    time.sleep(2)

    # 4. Vérification finale
    print("\n" + "=" * 70)
    print("📊 RÉSULTAT DE LA SIMULATION :")
    print(f"Points émis par Phone 2 (Edith) : {len(gps_track)}")
    print(f"Points reçus par Phone 1 (Jean-Luc) : {len(phone1_received_messages)}")
    print("=" * 70)

    client_phone1.loop_stop()
    client_phone2.loop_stop()

    if len(phone1_received_messages) == len(gps_track):
        print("✅ SUCCÈS TOTAL : 100% des points GPS émis par le service natif ont été reçus par le récepteur Web en temps réel !")
        return True
    else:
        print(f"❌ ÉCHEC : Seulement {len(phone1_received_messages)}/{len(gps_track)} reçus.")
        return False

if __name__ == "__main__":
    success = run_simulation()
    sys.exit(0 if success else 1)
