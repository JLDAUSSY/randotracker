# 🧠 MÉMOIRE DU PROJET RANDOTRACKER & HISTORIQUE DES PROBLÈMES ET SOLUTIONS

Ce document récapitule les problèmes majeurs rencontrés lors du développement, les causes techniques identifiées et les solutions validées sur le terrain et pour le Play Store.

---

## 📌 1. Le problème du GPS figé écran éteint (Mode Veille / Mise en poche)

### Le Problème :
- En randonnée avec 2 téléphones (Jean-Luc écran allumé, Edith écran éteint avec le bouton Power), les deux icônes s'éloignaient au fur et à mesure que le groupe avançait.
- Le GPS du téléphone écran éteint s'arrêtait d'émettre ou envoyait des points espacés de plusieurs dizaines de minutes.

### La Cause :
- **Android Doze Mode & iOS Standby** : Dès que l'écran est éteint physiquement via le bouton Power, le système d'exploitation gèle l'exécution du JavaScript dans le navigateur / PWA (`navigator.geolocation.watchPosition`) et coupe les puces GPS pour économiser la batterie.

### Les Solutions Adoptées & Validées :

1. **Pour l'Application Web / PWA (Universel tous smartphones) : Le « Mode Poche » (🔒)**
   - **Fonctionnement** : Un bouton Cadenas 🔒 (`#btn-enter-pocket-mode`) active un écran noir total (0% d'émission lumineuse sur écran OLED/AMOLED, luminosité au minimum).
   - **WakeLock** : Maintient le processeur et le GPS actifs en continu.
   - **Protection tactile** : L'écran est verrouillé pour éviter que les frottements du tissu dans la poche ne déclenchent des clics.
   - **Télémétrie discrète** : Heure, batterie, vitesse, distance et altitude affichées en police sombre/rouge pour un contrôle d'un coup d'œil.
   - **Résultat terrain** : Testé avec succès sur les deux téléphones en conditions réelles de marche sans aucune désynchronisation.

2. **Pour l'Application Android Native (APK / Play Store) : Le Foreground Service Natif**
   - Implémentation d'un service d'arrière-plan Java/Kotlin (`RandoGpsForegroundService`) avec notification permanente dans la barre d'état Android (`POST_NOTIFICATIONS` + `FOREGROUND_SERVICE_LOCATION` + `WAKE_LOCK`).
   - Permet de continuer la capture et l'envoi GPS même si l'écran est éteint avec le bouton Power.

---

## 📌 2. Les Règles et Rejets Google Play Console

### Problème A : Permission `ACCESS_BACKGROUND_LOCATION`
- **Erreur** : Google Play applique une politique de rejet quasi systématique ou demande un audit lourd si cette permission est déclarée dans le Manifeste.
- **Règle** : **Ne JAMAIS inclure `ACCESS_BACKGROUND_LOCATION`**. Un Foreground Service avec notification permanente (`FOREGROUND_SERVICE_LOCATION`) suffit légalement et techniquement pour une application de suivi de randonnée à l'initiative de l'utilisateur.

### Problème B : Déclaration de type pour le Foreground Service
- **Règle Play Console** :
  - Dans la console, cocher **UNIQUEMENT** : `Partage de position à l'initiative de l'utilisateur` (User-initiated location sharing).
  - Décocher « Navigation » (sinon Google exige 2 vidéos distinctes).
  - Fournir le lien de la vidéo de démonstration : `https://jldaussy.github.io/randotracker/rando-demo-foreground-service.mp4` montrant l'activation du tracking, la notification permanente Android et la synchro multi-utilisateurs.

---

## 📌 3. Gestion des Cartes et Détection Automatique par Pays

### Fonctionnement :
- **Au démarrage / premier point GPS** :
  - Si position en **France** : Bascule automatique sur **IGN France** (Plan IGN / Cartes Topo).
  - Si position en **Espagne** : Bascule automatique sur **IGN España (MTN Topo)**.
  - Si position au **Royaume-Uni (UK)** : Bascule automatique sur **UK Ordnance Survey / Topo UK**.
  - Reste du monde : OpenStreetMap / OpenTopoMap.
- **Liberté totale** : Tous les fonds de carte restent accessibles et sélectionnables manuellement dans le menu déroulant des calques à tout moment et depuis n'importe quel pays.

---

## 📌 4. Parcours Invité & Scan QR Code

### Fonctionnement sans friction :
- Si un randonneur scanne le QR code d'invitation sans avoir installé l'application Play Store :
  - Le lien ouvre directement la **PWA Web (v58)** dans son navigateur mobile (Chrome, Safari, etc.).
  - Il rejoint la session de groupe instantanément, sans obligation de créer un compte ni d'installer quoi que ce soit.
  - S'il le souhaite, un lien direct vers l'APK / Play Store est disponible dans le menu "À propos" et "Profil".

---

## 📌 5. Checklist de Déploiement

1. **Version Web / PWA** :
   - Incrémenter le numéro de version (`v58` -> `v59`...) dans `index.html`, `styles.css?v=...`, `app.js?v=...` et `sw.js` (`CACHE_NAME`).
   - Exécuter la suite de tests unitaires pour garantir 100% de réussite.
2. **Bundle Android (.aab)** :
   - Incrémenter `versionCode` (ex: 13 -> 14) et `versionName` dans `android-project/app/build.gradle`.
   - Compiler avec Gradle (`./gradlew bundleRelease`).
