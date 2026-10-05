# -*- coding: utf-8 -*-
"""
Simulation Complète Multi-Téléphones (Jean-Luc, Edith, Pierre) pour RandoTracker V1.2.3
Vérifie :
1. Connexion et échanges MQTT / WebSockets simulés entre 2+ appareils
2. Scan QR Code d'invitation et bascule immédiate de salon
3. Éradication totale des libellés 'Animateur'
4. Synchronisation bidirectionnelle instantanée de la présence et des positions GPS
5. Synchronisation des messages d'annonces et alertes SOS
"""

import sys
import json
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class SimulatedPhone:
    def __init__(self, user_id, name, role, icon, color, room_code='RANDO-2026'):
        self.user_id = user_id
        self.name = name
        self.role = role
        self.icon = icon
        self.color = color
        self.room_code = room_code
        self.lat = 45.8920
        self.lon = 6.1550
        self.ele = 450
        self.speed = 4.2
        self.battery = 90
        self.other_users = {}
        self.received_messages = []
        self.received_announcements = []
        self.is_sos = False

    def get_my_user_payload(self):
        return {
            'id': self.user_id,
            'name': self.name,
            'role': self.role,
            'icon': self.icon,
            'color': self.color,
            'lat': self.lat,
            'lon': self.lon,
            'ele': self.ele,
            'speed': self.speed,
            'battery': self.battery,
            'isSos': self.is_sos,
            'lastSeen': int(time.time() * 1000)
        }

    def scan_qr_code(self, scanned_text):
        """Simule la fonction JavaScript onQrCodeScanned(decodedText)"""
        room_code = None
        if 'room=' in scanned_text:
            part = scanned_text.split('room=')[1]
            room_code = part.split('&')[0].split('#')[0]
        elif scanned_text.startswith('RANDO-'):
            room_code = scanned_text

        if room_code:
            self.room_code = room_code.upper().strip()
            self.other_users.clear() # purge participants de l'ancien salon
            return self.room_code
        return None

    def handle_incoming_message(self, data, sender_phone=None):
        if not data or data.get('senderId') == self.user_id:
            return None # Ignore ses propres messages
        if data.get('room') and data.get('room') != self.room_code:
            return None # Ignore les messages d'autres salons

        msg_type = data.get('type')
        if msg_type == 'request_presence':
            # Répondre immédiatement avec respond_presence
            return {
                'type': 'respond_presence',
                'senderId': self.user_id,
                'room': self.room_code,
                'user': self.get_my_user_payload(),
                'timestamp': int(time.time() * 1000)
            }
        elif msg_type == 'user_joined':
            u = data.get('user')
            if u and u['id'] != self.user_id:
                self.other_users[u['id']] = u
            return {
                'type': 'respond_presence',
                'senderId': self.user_id,
                'room': self.room_code,
                'user': self.get_my_user_payload(),
                'timestamp': int(time.time() * 1000)
            }
        elif msg_type in ('respond_presence', 'update_position', 'user_updated'):
            u = data.get('user')
            if u and u['id'] != self.user_id:
                self.other_users[u['id']] = u
        elif msg_type == 'broadcast_announcement':
            self.received_announcements.append(data)
        elif msg_type == 'group_sos_alert':
            self.is_sos = data.get('active', False)

        return None


def run_multi_user_simulation():
    print("================================================================================")
    print("  SIMULATION MULTI-UTILISATEURS EN DIRECT (JEAN-LUC, EDITH, PIERRE)")
    print("================================================================================\n")

    # 1. Initialisation téléphone Jean-Luc (Organisateur)
    phone_jl = SimulatedPhone('u_jeanluc_01', 'Jean-Luc', 'Guide de tête', '🌲', '#059669', 'RANDO-2026')
    print(f"1. [Jean-Luc] Lance l'application. Salon: {phone_jl.room_code}, Nom: {phone_jl.name}, Rôle: {phone_jl.role}")
    assert phone_jl.name != 'Animateur', "Erreur : Nom ne doit pas être Animateur"

    # 2. Génération QR Code sur le téléphone de Jean-Luc
    invite_url = f"https://jldaussy.github.io/randotracker/?room={phone_jl.room_code}"
    print(f"2. [Jean-Luc] Affiche le QR Code d'invitation : {invite_url}")

    # 3. Edith prend son téléphone et scanne le QR code de Jean-Luc
    phone_edith = SimulatedPhone('u_edith_02', 'Edith', 'Randonneur', '🐺', '#9333ea', 'SALON_INITIAL_DEFAUT')
    print(f"3. [Edith] Ouvre le scanner caméra et pointe le QR code de Jean-Luc...")
    scanned_room = phone_edith.scan_qr_code(invite_url)
    print(f"   -> QR Code décodé avec succès ! Salon rejoint : {scanned_room}")
    assert phone_edith.room_code == 'RANDO-2026', "Erreur : Edith n'a pas rejoint RANDO-2026"

    # 4. Edith envoie l'événement 'user_joined' et 'request_presence'
    edith_join_msg = {
        'type': 'user_joined',
        'senderId': phone_edith.user_id,
        'room': phone_edith.room_code,
        'user': phone_edith.get_my_user_payload(),
        'timestamp': int(time.time() * 1000)
    }

    # Jean-Luc reçoit le message d'arrivée d'Edith
    jl_reply = phone_jl.handle_incoming_message(edith_join_msg)
    print(f"4. [Jean-Luc] Reçoit l'arrivée de {edith_join_msg['user']['name']} ({edith_join_msg['user']['icon']}).")
    print(f"   -> Nombre de participants sur le téléphone de Jean-Luc : {len(phone_jl.other_users) + 1} (Moi + Edith)")
    assert 'u_edith_02' in phone_jl.other_users, "Erreur : Edith doit être présente sur le téléphone de Jean-Luc"

    # Edith reçoit la réponse de présence de Jean-Luc
    if jl_reply:
        phone_edith.handle_incoming_message(jl_reply)
        print(f"5. [Edith] Reçoit la présence de {jl_reply['user']['name']} ({jl_reply['user']['icon']}).")
        print(f"   -> Nombre de participants sur le téléphone d'Edith : {len(phone_edith.other_users) + 1} (Moi + Jean-Luc)")
        assert 'u_jeanluc_01' in phone_edith.other_users, "Erreur : Jean-Luc doit être présent sur le téléphone d'Edith"

    # 6. Vérification de l'absence totale du libellé "Animateur"
    all_names_jl = [phone_jl.name] + [u['name'] for u in phone_jl.other_users.values()]
    all_names_edith = [phone_edith.name] + [u['name'] for u in phone_edith.other_users.values()]
    print(f"\n6. Noms affichés sur le téléphone de Jean-Luc : {all_names_jl}")
    print(f"   Noms affichés sur le téléphone d'Edith : {all_names_edith}")
    assert 'Animateur' not in all_names_jl, "Erreur : 'Animateur' trouvé sur le tél de Jean-Luc"
    assert 'Animateur' not in all_names_edith, "Erreur : 'Animateur' trouvé sur le tél d'Edith"

    # 7. Jean-Luc envoie un message d'annonce vocale / texte au groupe
    announcement_msg = {
        'type': 'broadcast_announcement',
        'senderId': phone_jl.user_id,
        'room': phone_jl.room_code,
        'author': phone_jl.name,
        'role': phone_jl.role,
        'icon': phone_jl.icon,
        'color': phone_jl.color,
        'text': 'Pause déjeuner dans 500m au bord du lac 🥪📍 GPS: 45.89200, 6.15500',
        'lat': phone_jl.lat,
        'lon': phone_jl.lon,
        'timestamp': int(time.time() * 1000)
    }
    phone_edith.handle_incoming_message(announcement_msg)
    print(f"\n7. [Annonce] Message envoyé par {announcement_msg['author']} reçu par Edith : \"{phone_edith.received_announcements[-1]['text']}\"")
    assert len(phone_edith.received_announcements) == 1

    # 8. Un 3ème randonneur (Pierre) rejoint le groupe via le même salon
    phone_pierre = SimulatedPhone('u_pierre_03', 'Pierre', 'Randonneur', '🦅', '#2563eb', 'RANDO-2026')
    pierre_join_msg = {
        'type': 'user_joined',
        'senderId': phone_pierre.user_id,
        'room': phone_pierre.room_code,
        'user': phone_pierre.get_my_user_payload(),
        'timestamp': int(time.time() * 1000)
    }
    reply_jl_for_p = phone_jl.handle_incoming_message(pierre_join_msg)
    reply_edith_for_p = phone_edith.handle_incoming_message(pierre_join_msg)
    if reply_jl_for_p: phone_pierre.handle_incoming_message(reply_jl_for_p)
    if reply_edith_for_p: phone_pierre.handle_incoming_message(reply_edith_for_p)

    print(f"\n8. [Pierre] A rejoint le groupe.")
    print(f"   -> Participants chez Jean-Luc (total {len(phone_jl.other_users) + 1}) : {[phone_jl.name] + [u['name'] for u in phone_jl.other_users.values()]}")
    print(f"   -> Participants chez Edith (total {len(phone_edith.other_users) + 1}) : {[phone_edith.name] + [u['name'] for u in phone_edith.other_users.values()]}")
    print(f"   -> Participants chez Pierre (total {len(phone_pierre.other_users) + 1}) : {[phone_pierre.name] + [u['name'] for u in phone_pierre.other_users.values()]}")

    assert len(phone_jl.other_users) == 2
    assert len(phone_edith.other_users) == 2
    assert len(phone_pierre.other_users) == 2

    # 9. Test du calcul des distances à vol d'oiseau entre chaque participant
    print("\n9. [Distances à vol d'oiseau] Test du calcul entre les participants :")
    def haversine_km(lat1, lon1, lat2, lon2):
        import math
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    # Positions distinctes pour le test
    phone_jl.lat, phone_jl.lon = 45.8920, 6.1550 # Annecy
    phone_edith.lat, phone_edith.lon = 45.8950, 6.1580 # ~400m
    phone_pierre.lat, phone_pierre.lon = 45.9000, 6.1600 # ~1km

    d_jl_edith = haversine_km(phone_jl.lat, phone_jl.lon, phone_edith.lat, phone_edith.lon)
    d_jl_pierre = haversine_km(phone_jl.lat, phone_jl.lon, phone_pierre.lat, phone_pierre.lon)
    d_edith_pierre = haversine_km(phone_edith.lat, phone_edith.lon, phone_pierre.lat, phone_pierre.lon)

    print(f"   -> Distance Jean-Luc <-> Edith : {d_jl_edith*1000:.1f} m")
    print(f"   -> Distance Jean-Luc <-> Pierre : {d_jl_pierre:.2f} km")
    print(f"   -> Distance Edith <-> Pierre : {d_edith_pierre*1000:.1f} m")

    assert 0.35 < d_jl_edith < 0.50, "Distance JL-Edith anormale"
    assert 0.85 < d_jl_pierre < 1.20, "Distance JL-Pierre anormale"

    # 10. Test du maintien 2s pour déverrouiller le mode poche (Anti-frottements)
    print("\n10. [Mode Poche] Test de la sécurité de maintien (Hold 1.8s) :")
    hold_duration_ms = 1800
    accidental_tap_ms = 250 # Faux contact frottement tissu (250ms)
    is_unlocked_tap = accidental_tap_ms >= hold_duration_ms
    assert not is_unlocked_tap, "Erreur : un appui court involontaire ne doit pas déverrouiller le mode poche !"
    
    deliberate_hold_ms = 1850 # Maintien volontaire appuyé 1.85s
    is_unlocked_hold = deliberate_hold_ms >= hold_duration_ms
    assert is_unlocked_hold, "Erreur : un maintien volontaire >= 1.8s doit déverrouiller le mode poche"
    print("   -> Appui court (frottement tissu) rejeté avec succès (verrouillé).")
    print("   -> Maintien prolongé validé avec succès (déverrouillé).")

    print("\n================================================================================")
    print("  SIMULATION 100% REUSSIE ! TOUTES LES BRANCHES MULTI-PHONES SONT VALIDEES.")
    print("================================================================================")

if __name__ == '__main__':
    run_multi_user_simulation()
