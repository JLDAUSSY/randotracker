# ⛰️ RandoTracker - Suivi de Randonnée Multi-Groupes & Traces GPX

Application web moderne et réactive conçue pour les sorties et randonnées collectives avec plusieurs groupes de niveaux différents.

---

## 🎯 Fonctionnalités Principales

1. **🗺️ Fonds de Carte Interchangeables en 1 Clic :**
   - **IGN Plan** : Flux officiel Géoplateforme IGN (cartes topographiques françaises détaillées).
   - **OpenTopoMap** : Sentiers de randonnée et courbes de niveau mondiales.
   - **IGN Satellite** : Photos aériennes haute résolution.
   - **OpenStreetMap** : Fond cartographique standard.

2. **📁 Gestion jusqu'à 5 Traces GPX Simultanées :**
   - Import simple de fichiers `.gpx` (glisser-déposer ou sélection).
   - Code couleur distinct et automatique par trace (Vert, Bleu, Rouge, Jaune, Violet).
   - Affichage / masquage individuel de chaque parcours.
   - Statistiques instantanées : distance totale ($km$), dénivelé positif ($D+$ en mètres), altitudes min/max.
   - **Profil Altimétrique Interactif** : Graphique de dénivelé synchronisé avec un curseur sur la carte.
   - 3 parcours de démonstration inclus au démarrage (Lac d'Annecy & Massif du Veyrier).

3. **📍 Suivi jusqu'à 10 Utilisateurs Géolocalisés :**
   - **Profil Personnalisé** : Nom, Rôle (*Guide de tête*, *Serre-file*, *Randonneur*, *Sécurité*) et Avatar (icône + couleur).
   - **GPS Réel** : Géolocalisation haute précision depuis le smartphone ou le PC.
   - **Diffusion Temps Réel** : Synchronisation instantanée entre appareils (via WebSocket et BroadcastChannel).
   - **Indicateurs de Groupe** : Vitesse ($km/h$), altitude ($m$), batterie restante ($%$) et distance relative par rapport à vous.
   - **Alerte SOS** : Bouton d'urgence pour signaler un problème à l'ensemble du groupe.
   - **Moteur de Simulation** : Bouton *"Simuler 6 randonneurs"* pour tester immédiatement l'affichage dynamique de plusieurs marcheurs en mouvement sur les sentiers.

---

## 🚀 Comment Lancer l'Application

### 1. Démarrer le Serveur Local (avec support multi-appareils & smartphones)

Dans un terminal PowerShell :
```powershell
cd C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker
python server.py
```

Le serveur s'ouvre sur le port `8000` :
- **Sur votre ordinateur :** Ouvrez votre navigateur sur [http://localhost:8000](http://localhost:8000)
- **Sur vos smartphones (connectés au même WiFi ou partage de connexion 4G) :** Ouvrez l'adresse IP locale affichée dans la console (ex: `http://192.168.1.XX:8000`).

---

## 📱 Utilisation le Jour J

1. **L'organisateur** démarre l'application et charge les fichiers GPX des différents parcours (ex: *Groupe 1 Découverte*, *Groupe 2 Sportif*).
2. **Chaque guide / serre-file** ouvre l'application sur son téléphone et renseigne son nom et son rôle dans *"Mon Profil"*.
3. Les marcheurs cliquent sur **« Activer mon GPS »** : leurs positions s'affichent en direct sur la carte avec leurs avatars respectifs.
4. L'organisateur peut suivre l'avancée de chaque groupe, les distances et s'assurer que personne ne s'égare.
