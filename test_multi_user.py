import json
import time
import ssl
import sys
import paho.mqtt.client as mqtt

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

ROOM = "RANDO_TEST_MULTI_GROUPE_5"
TOPIC = f"randotracker/v1/rooms/{ROOM}/events"

users = [
    {"name": "Jean-Luc (Guide)", "id": "u_jl_1", "icon": "🌲", "color": "#059669", "lat": 43.1230, "lon": 5.7790},
    {"name": "Édith", "id": "u_edith_2", "icon": "🐺", "color": "#9333ea", "lat": 43.1232, "lon": 5.7792},
    {"name": "Marc", "id": "u_marc_3", "icon": "🦅", "color": "#2563eb", "lat": 43.1234, "lon": 5.7794},
    {"name": "Sophie", "id": "u_sophie_4", "icon": "🦊", "color": "#ea580c", "lat": 43.1236, "lon": 5.7796},
    {"name": "Thomas", "id": "u_thomas_5", "icon": "🦁", "color": "#eab308", "lat": 43.1238, "lon": 5.7798}
]

received_by_guide = {}

def on_msg(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode('utf-8'))
        u = data.get('user', {})
        uid = u.get('id')
        received_by_guide[uid] = f"{u.get('icon')} {u.get('name')} [{u.get('color')}]: Lat={u.get('lat')}, Lon={u.get('lon')}"
    except Exception as e:
        print("Erreur:", e)

# 1. Le Guide (Récepteur)
guide_client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2, client_id="guide_receiver")
guide_client.on_message = on_msg
guide_client.tls_set(cert_reqs=ssl.CERT_NONE)
guide_client.connect("broker.hivemq.com", 8883, 30)
guide_client.subscribe(TOPIC)
guide_client.loop_start()

time.sleep(2)

# 2. Les 5 participants (Chacun son propre client / téléphone distinct)
clients = []
for u in users:
    c = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2, client_id=f"phone_{u['id']}", transport="tcp")
    c.tls_set(cert_reqs=ssl.CERT_NONE)
    c.connect("broker.hivemq.com", 8883, 30)
    c.loop_start()
    clients.append((c, u))

time.sleep(2)

# Émission simultanée des 5 téléphones
for c, u in clients:
    payload = {
        "type": "update_position",
        "room": ROOM,
        "senderId": u["id"],
        "timestamp": int(time.time() * 1000),
        "user": {
            "id": u["id"],
            "name": u["name"],
            "role": "Randonneur",
            "icon": u["icon"],
            "color": u["color"],
            "assignedTrackId": "auto",
            "lat": u["lat"],
            "lon": u["lon"],
            "ele": 420,
            "speed": 4.2,
            "acc": 3,
            "battery": 95,
            "lastSeen": int(time.time() * 1000)
        }
    }
    c.publish(TOPIC, json.dumps(payload))

time.sleep(3)

for c, _ in clients:
    c.loop_stop()
guide_client.loop_stop()

print(f"Total participants uniques reçus en direct : {len(received_by_guide)}/{len(users)}")
for uid, info in received_by_guide.items():
    print(f"  -> {info}")
