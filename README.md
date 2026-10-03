# ⛰️ RandoTracker - Suivi de Randonnée Multi-Groupes & Traces GPX

**Application web progressive (PWA) & application Android (TWA)** conçue pour les sorties et randonnées collectives avec plusieurs groupes de niveaux différents, cartographie IGN/Topo, profil altimétrique interactif, télémétrie en direct et sécurité secours.

Conception & Développement : **Jean-Luc DAUSSY (JLD Apps) - 2026**

---

## 🌐 Liens Utiles & Accès Direct

- 🚀 **Application en Ligne (GitHub Pages)** : [https://jldaussy.github.io/randotracker/](https://jldaussy.github.io/randotracker/)
- 📖 **Site Web du Mode d'Emploi** : [https://jldaussy.github.io/randotracker-guide/](https://jldaussy.github.io/randotracker-guide/)
- 📄 **Mode d'Emploi Complet (PDF A4 6 pages)** : [RandoTracker_Mode_d_emploi.pdf](https://jldaussy.github.io/randotracker-guide/RandoTracker_Mode_d_emploi.pdf)
- 📚 **Dépôt GitHub de la Documentation** : [https://github.com/JLDAUSSY/randotracker-guide](https://github.com/JLDAUSSY/randotracker-guide)
- 🛡️ **Politique de Confidentialité** : [https://jldaussy.github.io/randotracker/privacy.html](https://jldaussy.github.io/randotracker/privacy.html)
- 📱 **Package Android** : `fr.jldaussy.randotracker` (Android 7.0+ / Target SDK 36)

---

## 🎯 Fonctionnalités Principales

1. **🗺️ Fonds de Carte Interchangeables en 1 Clic :**
   - **IGN Plan** : Flux officiel Géoplateforme IGN (cartes topographiques françaises détaillées).
   - **OpenTopoMap** : Sentiers de randonnée et courbes de niveau mondiales.
   - **Pentes Montagne IGN** : Calque d'inclinaison des pentes pour la sécurité en dénivelé.
   - **IGN Satellite** : Photos aériennes haute résolution.
   - **OpenStreetMap** : Fond cartographique standard mondial.

2. **📁 Gestion Multi-Traces GPX :**
   - Import simple de fichiers `.gpx` (glisser-déposer ou sélection).
   - Palette de 10 couleurs distinctes et personnalisables par trace.
   - Affichage / masquage individuel de chaque parcours.
   - Statistiques instantanées : distance totale, dénivelé positif ($D+$ en mètres), altitudes min/max.
   - **Profil Altimétrique Interactif** : Graphique synchronisé avec curseur en temps réel sur la carte.
   - **Calcul de l'Écart GPX en direct** : Alerte visuelle et sonore de sortie de trace si vous vous éloignez du sentier (> 50 m).

3. **📍 Suivi Multi-Utilisateurs & Télémétrie en Temps Réel :**
   - **Profil Personnalisé** : Nom, Rôle (*Guide de tête*, *Serre-file*, *Randonneur*, *Sécurité*) et Avatar (icône + couleur).
   - **GPS Réel** : Géolocalisation haute précision depuis smartphone ou PC.
   - **Synchronisation Instantanée** : Diffusion en direct (WebSocket + BroadcastChannel).
   - **Indicateurs de Groupe** : Vitesse en déplacement ($km/h$), auto-pause intelligente (< 1 km/h), altitude ($m$), batterie restante ($%$) et heure estimée d'arrivée (ETA).
   - **Rétention 5h Zone Blanche** : Maintien et fusion intelligente des positions même en cas de coupure temporaire de réseau.

4. **🚨 Sécurité & Module de Secours d'Urgence :**
   - **Alerte SOS Groupe** : Signalement instantané à tous les membres de la sortie.
   - **Pavé d'appel d'urgence rapide** : 15 (SAMU), 112 (Numéro Européen / PGHM Secours Montagne), 114 (SMS Urgence pour malentendants ou zone à faible réseau).
   - **Copie automatique des coordonnées GPS** : Format universel prêt à dicter aux secouristes.

5. **📱 Ergonomie Outdoor & Accessibilité Mobile :**
   - **Sanctuarisation Plein Écran** : Anti-swipe back et barres de navigation verrouillées pour smartphones Android / Pixel.
   - **Fenêtres & Fiches déplaçables (Drag & Drop)** : Positionnez les fiches randonneurs où vous le souhaitez sur l'écran.
   - **Sélecteur d'échelle & Zoom UI** : Lisibilité adaptée au soleil et en plein air (+35% et +65%).

---

## 🚀 Installation & Développement Local

### 1. Démarrer le Serveur Local (avec support multi-appareils)

Dans un terminal PowerShell :
```powershell
cd C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker
python server.py
```

Le serveur s'ouvre sur le port `8000` :
- **Sur PC :** Ouvrez votre navigateur sur [http://localhost:8000](http://localhost:8000)
- **Sur Smartphones :** Connectez-vous sur l'adresse IP locale affichée dans la console (ex: `http://192.168.1.XX:8000`).

### 2. Lancer la Suite de Tests Automatisés

```powershell
python test_suite.py
```

---

## 📦 Déploiement & Publication

- **GitHub Pages** : Déploiement automatique depuis la branche `main` (avec support `.well-known/assetlinks.json` et `.nojekyll`).
- **Google Play Store** : Bundle Android App Bundle (`RandoTracker-release.aab`) signé et prêt pour le Play Console.

---

## 📄 Licence & Droits

Projet développé par **Jean-Luc DAUSSY** - 2026. Tous droits réservés.
