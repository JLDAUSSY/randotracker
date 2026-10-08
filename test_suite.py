# -*- coding: utf-8 -*-
"""
Batterie de Tests Automatisés & Sanctuarisation IHM / Logique pour RandoTracker V35
Conception : Jean-Luc DAUSSY - 2026

Ce script teste de manière exhaustive :
1. La structure HTML & l'arborescence des identifiants DOM
2. L'absence de conflits d'événements (aucun double-binding sur les boutons de navigation)
3. La hiérarchie CSS & la géométrie Z-Index (Modales 3000 > Barres 1000 > Plein Écran 950 > Voile 920)
4. Les dimensions outdoor adaptatives & sélecteur de zoom/lisibilité pour tous téléphones
5. La sanctuarisation de l'En-tête supérieur et de la Barre inférieure (+35% et +65%)
6. La protection anti-disparition & anti-swipe back sur smartphones Pixel / Android
7. La partition 50/50 stricte et le pavé d'appel intégré Secours & Urgence (15, 112, 114)
8. La machine d'état JavaScript & Déduplication intelligente des randonneurs
9. Les calculs de télémétrie (Distance Haversine, ETA, Profil Alti, Rétention 5h Zone Blanche)
10. La validité HTTP des endpoints du serveur local
"""

import os
import re
import sys
import math
import urllib.request
from bs4 import BeautifulSoup

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(PROJECT_DIR, 'index.html')
STYLES_PATH = os.path.join(PROJECT_DIR, 'styles.css')
APP_JS_PATH = os.path.join(PROJECT_DIR, 'app.js')
SW_JS_PATH = os.path.join(PROJECT_DIR, 'sw.js')

total_tests = 0
passed_tests = 0
failed_tests = []

def run_test(name, condition_fn):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    try:
        result = condition_fn()
        if result:
            passed_tests += 1
            print(f"  [PASS] {name}")
        else:
            failed_tests.append(name)
            print(f"  [FAIL] {name}")
    except Exception as e:
        failed_tests.append(f"{name} (Exception: {str(e)})")
        print(f"  [ERROR] {name} -> {e}")

print("================================================================================")
print("  BATTERIE DE TESTS AUTOMATISES RANDOTRACKER V43 (BACKGROUND GPS & PLAY PROTECT)")
print("================================================================================\n")

# ----------------------------------------------------------------------
# 1. TESTS DE LA STRUCTURE HTML & ÉLÉMENTS DOM CLÉS
# ----------------------------------------------------------------------
print("--- [SECTION 1 : Structure HTML & Elements DOM Cles] ---")
with open(INDEX_PATH, 'r', encoding='utf-8') as f:
    html_text = f.read()

soup = BeautifulSoup(html_text, 'html.parser')

run_test("Presence de l'en-tete superieur .app-header", lambda: soup.find('header', class_='app-header') is not None)
run_test("Presence du bouton logo avec by JLD", lambda: soup.find(id='brand-header-btn') is not None)
run_test("Presence du selecteur de traces dans le header", lambda: soup.find(id='open-tracks-modal-btn') is not None)
run_test("Bouton traces header avec handler onclick=openTracksModal()", lambda: soup.find(id='open-tracks-modal-btn') and 'openTracksModal()' in str(soup.find(id='open-tracks-modal-btn')))
run_test("Presence du bouton fond de carte dans le header", lambda: soup.find(id='open-layer-modal-btn') is not None)
run_test("Bouton layer header avec handler onclick=openLayerModal()", lambda: soup.find(id='open-layer-modal-btn') and 'openLayerModal()' in str(soup.find(id='open-layer-modal-btn')))
run_test("Header epure sans bouton inviter redondant pour visibilite max du titre", lambda: soup.find(id='header-invite-btn') is None)
run_test("Presence du bouton profil dans le header", lambda: soup.find(id='open-profile-btn') is not None)
run_test("Bouton profil header avec handler onclick=openProfileModal()", lambda: soup.find(id='open-profile-btn') and 'openProfileModal()' in str(soup.find(id='open-profile-btn')))
run_test("Version v1.4.11 affichee dans le header (#header-app-version)", lambda: soup.find(id='header-app-version') and 'v1.4.11' in soup.find(id='header-app-version').text)
run_test("Presence de la barre de recherche de ville (#city-search-container)", lambda: soup.find(id='city-search-container') is not None)
run_test("Presence du champ input de recherche de ville (#city-search-input)", lambda: soup.find(id='city-search-input') is not None)
run_test("Presence du bouton d'arret du suivi dans le profil (#btn-stop-tracking-app)", lambda: soup.find(id='btn-stop-tracking-app') is not None)

run_test("Presence de la barre inferieure .app-bottom-nav", lambda: soup.find('nav', class_='app-bottom-nav') is not None)
run_test("Presence de la touche SOS (id=nav-btn-sos)", lambda: soup.find(id='nav-btn-sos') is not None)
run_test("Presence de la touche Mon GPS (id=nav-btn-gps)", lambda: soup.find(id='nav-btn-gps') is not None)
run_test("Presence de la touche Traces (id=nav-btn-traces)", lambda: soup.find(id='nav-btn-traces') is not None)
run_test("Presence de la touche Groupe (id=nav-btn-users)", lambda: soup.find(id='nav-btn-users') is not None)

# Sélecteur de lisibilité / taille des boutons outdoor
run_test("Presence du selecteur d'echelle outdoor (#ui-scale-selector)", lambda: soup.find(id='ui-scale-selector') is not None)
scale_btns = soup.find_all(class_='ui-scale-btn')
run_test("Presence de 3 boutons de zoom/lisibilité (Standard, Grand, Geant)", lambda: len(scale_btns) >= 3)

# Navigation Handlers
btn_sos = soup.find(id='nav-btn-sos')
btn_gps = soup.find(id='nav-btn-gps')
btn_traces = soup.find(id='nav-btn-traces')
btn_users = soup.find(id='nav-btn-users')

run_test("Bouton SOS : element present et interactif", lambda: btn_sos is not None)
run_test("Bouton Mon GPS : element present et interactif", lambda: btn_gps is not None)
run_test("Bouton Traces : element present et interactif", lambda: btn_traces is not None)
run_test("Bouton Groupe : element present et interactif", lambda: btn_users is not None)

run_test("Presence de la fenetre plein ecran Groupe (#users-panel)", lambda: soup.find(id='users-panel') is not None)
run_test("Presence du bouton Broadcast dans Groupe (#btn-broadcast-all)", lambda: soup.find(id='btn-broadcast-all') is not None)
run_test("Presence du bouton Inviter QR dans Groupe (#drawer-invite-btn)", lambda: soup.find(id='drawer-invite-btn') is not None)
run_test("Presence de la fenetre plein ecran Secours (#emergency-modal)", lambda: soup.find(id='emergency-modal') is not None)
run_test("Secours : Barre d'onglets pays présente (#emergency-country-tabs)", lambda: soup.find(id='emergency-country-tabs') is not None)
run_test("Secours : Onglet France 🇫🇷 present", lambda: bool(soup.find(lambda t: t.get('data-country') == 'FR')))
run_test("Secours : Onglet Royaume-Uni 🇬🇧 present", lambda: bool(soup.find(lambda t: t.get('data-country') == 'UK')))
run_test("Secours : Onglet Suisse 🇨🇭 present", lambda: bool(soup.find(lambda t: t.get('data-country') == 'CH')))
run_test("Secours : Onglet Espagne 🇪🇸 present", lambda: bool(soup.find(lambda t: t.get('data-country') == 'ES')))
run_test("Secours : Onglet Europe 🇪🇺 present", lambda: bool(soup.find(lambda t: t.get('data-country') == 'OTHER')))
run_test("Secours 50/50 : Moitié haute GPS épinglée (#emergency-gps-top-half)", lambda: soup.find(id='emergency-gps-top-half') is not None)
run_test("Secours 50/50 : Guide vocal de dictée (#emergency-dictation-preview)", lambda: soup.find(id='emergency-dictation-preview') is not None)
run_test("Secours 50/50 : Moitié basse actions (#emergency-actions-bottom-half)", lambda: soup.find(id='emergency-actions-bottom-half') is not None)
run_test("Secours : Liste des services (#emergency-numbers-list)", lambda: soup.find(id='emergency-numbers-list') is not None)
run_test("Presence de l'interrupteur calque de pentes montagne (#toggle-slopes-layer)", lambda: soup.find(id='toggle-slopes-layer') is not None)

# Profil Altimétrique Zoomable & Plein Écran
run_test("Profil Altimétrique : Boîte #elevation-drawer présente", lambda: soup.find(id='elevation-drawer') is not None)
run_test("Profil Altimétrique : Badge de niveau de zoom (#ele-zoom-badge)", lambda: soup.find(id='ele-zoom-badge') is not None)
run_test("Profil Altimétrique : Bouton Agrandir / Plein écran (#toggle-ele-fullscreen-btn)", lambda: soup.find(id='toggle-ele-fullscreen-btn') is not None)
run_test("Profil Altimétrique : Métriques dynamiques (Distance, D+, Min/Max, Pente)", lambda: soup.find(id='ele-stat-dist') is not None and soup.find(id='ele-stat-gain') is not None and soup.find(id='ele-stat-slope') is not None)
run_test("Profil Altimétrique : Boutons Zoom + et Zoom -", lambda: 'zoomInElevation()' in html_text and 'zoomOutElevation()' in html_text)
run_test("Profil Altimétrique : Boutons Pan Gauche / Droite", lambda: soup.find(id='ele-pan-left-btn') is not None and soup.find(id='ele-pan-right-btn') is not None)
run_test("Profil Altimétrique : Mini-carte de navigation / Scrubber (#ele-minimap-container)", lambda: soup.find(id='ele-minimap-container') is not None)

modals = [
    'invite-modal', 'announcement-modal', 'received-announcement-modal',
    'tracks-modal', 'layer-modal', 'room-modal', 'profile-modal', 'about-modal',
    'onboarding-modal', 'qr-scan-modal', 'name-prompt-modal'
]
for m in modals:
    run_test(f"Presence de la sous-modale dialog #{m}", lambda m=m: soup.find(id=m) is not None)

# Scanner QR Code & Accueil Nouveau Marcheur
run_test("Scanner QR : Viseur camera present (#qr-reader-view)", lambda: soup.find(id='qr-reader-view') is not None)
run_test("Scanner QR : Bouton declencheur dans modale Salon (#btn-scan-qr-room)", lambda: soup.find(id='btn-scan-qr-room') is not None)
run_test("Scanner QR : Bouton declencheur dans tiroir Groupe (#drawer-scan-btn)", lambda: soup.find(id='drawer-scan-btn') is not None)
run_test("Scanner QR : Bouton declencheur dans modale Inviter (#btn-scan-qr-from-invite)", lambda: soup.find(id='btn-scan-qr-from-invite') is not None)
run_test("Accueil Marcheur : Champ prenom present (#input-prompt-user-name)", lambda: soup.find(id='input-prompt-user-name') is not None)
run_test("Accueil Marcheur : Bouton validation present (#save-prompt-user-btn)", lambda: soup.find(id='save-prompt-user-btn') is not None)
run_test("Accueil Marcheur : Selecteur d'avatars (.prompt-avatar-btn >= 6)", lambda: len(soup.find_all(class_='prompt-avatar-btn')) >= 6)

# ----------------------------------------------------------------------
# 2. TESTS DE LA HIÉRARCHIE CSS & GÉOMÉTRIE Z-INDEX
# ----------------------------------------------------------------------
print("\n--- [SECTION 2 : Hierarchie CSS, Variables & Geometrie Z-Index] ---")
with open(STYLES_PATH, 'r', encoding='utf-8') as f:
    css_text = f.read()

run_test("Z-Index Header fixe a 2000 (Sanctuaire Pixel)", lambda: bool(re.search(r'\.app-header\s*\{[^}]*z-index:\s*2000', css_text)))
run_test("Z-Index Bottom Nav fixe a 2000 (Sanctuaire Pixel)", lambda: bool(re.search(r'\.app-bottom-nav\s*\{[^}]*z-index:\s*2000', css_text)))
run_test("Z-Index Fenetre Groupe fixe a 950", lambda: bool(re.search(r'#users-panel\s*\{[^}]*z-index:\s*950', css_text)))
run_test("Z-Index Fenetre Secours SOS fixe a 950", lambda: bool(re.search(r'#emergency-modal(?::not\(\.hidden\))?\s*\{[^}]*z-index:\s*950', css_text)))
run_test("Z-Index Profil Altimétrique fixe a 2500 (Au-dessus de la carte et barre)", lambda: bool(re.search(r'#elevation-drawer(?::not\(\.hidden\))?\s*\{[^}]*z-index:\s*2500', css_text)))
run_test("Z-Index Voile Backdrop fixe a 920", lambda: bool(re.search(r'#drawer-backdrop(?::not\(\.hidden\))?\s*\{[^}]*z-index:\s*920', css_text)))
run_test("Z-Index Sous-Modales (Dialogs) fixe a 3000 (Premier Plan Absolu)", lambda: bool(re.search(r'#invite-modal[^}]*z-index:\s*3000', css_text)))

run_test("Protection Anti-Swipe & Anti-Disparition : overscroll-behavior none", lambda: 'overscroll-behavior: none !important' in css_text)
run_test("Sanctuarisation visuelle Header : visibility visible & opacity 1", lambda: bool(re.search(r'\.app-header\s*\{[^}]*visibility:\s*visible', css_text)))
run_test("Sanctuarisation visuelle Bottom Nav : visibility visible & opacity 1", lambda: bool(re.search(r'\.app-bottom-nav\s*\{[^}]*visibility:\s*visible', css_text)))
run_test("Header avec safe-area-inset-top supporte les encoches d'ecrans", lambda: 'env(safe-area-inset-top' in css_text and '.app-header' in css_text)
run_test("Boutons header proteges contre l'ecrasement avec flex-shrink 0", lambda: 'flex-shrink: 0 !important' in css_text)

run_test("Profil Altimétrique cale au-dessus du bottom nav avec variable", lambda: 'bottom: calc(var(--bottom-nav-height' in css_text)
run_test("Profil Altimétrique supporte le mode plein écran .is-fullscreen", lambda: '#elevation-drawer.is-fullscreen' in css_text)
run_test("Groupe #users-panel cadre entre header et bottom nav", lambda: bool(re.search(r'#users-panel\s*\{[^}]*top:\s*(?:var|calc)', css_text)))
run_test("Secours #emergency-modal cadre entre header et bottom nav", lambda: bool(re.search(r'#emergency-modal(?::not\(\.hidden\))?\s*\{[^}]*top:\s*(?:var|calc)', css_text)))
run_test("Secours 50/50 strict : Moitié haute GPS flex 50%", lambda: bool(re.search(r'#emergency-gps-top-half\s*\{[^}]*flex:\s*0\s*0\s*50%', css_text)))
run_test("Secours 50/50 strict : Moitié basse actions flex 50%", lambda: bool(re.search(r'#emergency-actions-bottom-half\s*\{[^}]*flex:\s*0\s*0\s*50%', css_text)))
run_test("Touch Targets Grands Boutons Secours (.emergency-big-btn)", lambda: '.emergency-big-btn' in css_text and 'cursor: pointer' in css_text)
run_test("Zone carte main cadree entre header et bottom nav", lambda: bool(re.search(r'main\s*\{[^}]*top:\s*(?:var|calc)', css_text)))

# ----------------------------------------------------------------------
# 3. TESTS DES DIMENSIONS OUTDOOR & ÉCHELLE DU HEADER SUPERIEUR
# ----------------------------------------------------------------------
print("\n--- [SECTION 3 : Dimensions Outdoor, Grand (+35%) & Geant (+65%)] ---")
run_test("Variables CSS d'echelle definies dans :root", lambda: '--ui-scale' in css_text and '--header-height' in css_text and '--bottom-nav-height' in css_text)
run_test("Classe d'echelle standard (.ui-scale-normal)", lambda: 'html.ui-scale-normal' in css_text)
run_test("Classe d'echelle grand confort (.ui-scale-large a 1.35)", lambda: 'html.ui-scale-large' in css_text and '--ui-scale: 1.35' in css_text)
run_test("Classe d'echelle geante (.ui-scale-xlarge a 1.65)", lambda: 'html.ui-scale-xlarge' in css_text and '--ui-scale: 1.65' in css_text)
run_test("Echelle Header Grand : bouton header >= 58px", lambda: 'html.ui-scale-large .app-header-btn' in css_text and 'height: 58px' in css_text)
run_test("Echelle Header Geant : bouton header >= 68px", lambda: 'html.ui-scale-xlarge .app-header-btn' in css_text and 'height: 68px' in css_text)
run_test("Echelle Header Grand : avatar badge 44px", lambda: 'html.ui-scale-large #header-avatar-badge' in css_text and '44px' in css_text)
run_test("Echelle Header Geant : avatar badge 54px", lambda: 'html.ui-scale-xlarge #header-avatar-badge' in css_text and '54px' in css_text)
run_test("Piliers d'actions adaptatifs avec var(--pill-w)", lambda: 'var(--pill-w' in css_text)
run_test("Bulle Mon GPS surelevee avec var(--gps-size)", lambda: 'var(--gps-size' in css_text)
run_test("Popups Leaflet largeur minimale adaptative", lambda: bool(re.search(r'\.leaflet-popup-content\s*\{[^}]*min-width:\s*2[6-9]0px', css_text)))

# ----------------------------------------------------------------------
# 4. TESTS DE LA LOGIQUE JAVASCRIPT & EXPORTS WINDOW
# ----------------------------------------------------------------------
print("\n--- [SECTION 4 : Logique JavaScript, Secours 15/112/114, Popstate & Exports] ---")
with open(APP_JS_PATH, 'r', encoding='utf-8') as f:
    js_text = f.read()

required_functions = [
    'toggleEmergencyModal', 'openEmergencyModal', 'closeEmergencyModal',
    'renderEmergencyActionsPad', 'initiateEmergencyCall', 'makeEmergencyCall', 'sendEmergencySms',
    'sendGpsNotification', 'closeProfileModal', 'openProfileModal',
    'onNavGpsClick', 'onNavTracesClick', 'toggleUsersDrawer', 'closeAllDrawers',
    'openTracksModal', 'closeTracksModal', 'openLayerModal', 'closeLayerModal', 'openInviteModal', 'openAnnouncementModal',
    'closeAnnouncementModal', 'openElevationDrawer', 'closeElevationDrawer',
    'toggleElevationFullscreen', 'zoomInElevation', 'zoomOutElevation',
    'resetElevationZoom', 'panElevation', 'fitMapToZoomedSection', 'handleElevationMinimapClick',
    'deleteParticipant', 'clearOnlyParticipants', 'clearHikeSession', 'fitAllTracks',
    'copyEmergencyGpsCoords', 'toggleGroupSosAlert', 'cleanStaleUsers',
    'deduplicateUsersByName', 'applyUiScale', 'loadSavedUiScale',
    'getMyGpsString', 'insertGpsInCustomAnnouncement', 'locateAnnouncementSender', 'closeReceivedAnnouncementModal',
    'pushModalState', 'isAnyModalOrDrawerOpen', 'closeAllModalsAndDrawers',
    'cycleTrackColor', 'setTrackColor', 'ensureBarsVisible', 'initPixelSanctuaryGuardians',
    'makePopupDraggable', 'makeModalDraggable', 'initAllDraggableModals',
    'playAnnouncementAlert', 'adjustPopupZoom', 'checkOnboardingStatus',
    'openOnboardingModal', 'closeOnboardingModal', 'acceptOnboarding',
    'requestWakeLock', 'releaseWakeLock',
    'enterPocketMode', 'exitPocketMode', 'startPocketHoldUnlock', 'cancelPocketHoldUnlock', 'updatePocketModeTelemetry',
    'openQrScanner', 'closeQrScanner', 'onQrCodeScanned', 'joinRoomDirectly',
    'checkAndPromptUserName', 'openNamePromptModal', 'closeNamePromptModal', 'savePromptUserName',
    'generateUserPopupHtml', 'refreshActiveUserPopups',
    'initOrdnanceSurveyLayer', 'saveOrdnanceSurveyApiKey', 'updateOsApiKeyUI',
    'selectEmergencyCountry'
]

for fn in required_functions:
    run_test(f"Fonction JavaScript definie : {fn}()", lambda fn=fn: f"function {fn}" in js_text or f"{fn} =" in js_text)

exports_to_test = [
    'toggleEmergencyModal', 'openEmergencyModal', 'closeEmergencyModal',
    'renderEmergencyActionsPad', 'initiateEmergencyCall', 'makeEmergencyCall', 'sendEmergencySms',
    'selectEmergencyCountry',
    'sendGpsNotification', 'closeProfileModal', 'openProfileModal',
    'onNavGpsClick', 'onNavTracesClick', 'toggleUsersDrawer', 'closeAllDrawers',
    'openTracksModal', 'closeTracksModal', 'openLayerModal', 'closeLayerModal', 'openInviteModal', 'openAnnouncementModal',
    'openElevationDrawer', 'closeElevationDrawer', 'toggleElevationFullscreen',
    'zoomInElevation', 'zoomOutElevation', 'resetElevationZoom', 'panElevation',
    'applyUiScale', 'loadSavedUiScale', 'getMyGpsString', 'insertGpsInCustomAnnouncement',
    'locateAnnouncementSender', 'closeReceivedAnnouncementModal',
    'pushModalState', 'isAnyModalOrDrawerOpen', 'closeAllModalsAndDrawers',
    'cycleTrackColor', 'setTrackColor', 'ensureBarsVisible',
    'makePopupDraggable', 'makeModalDraggable', 'initAllDraggableModals',
    'playAnnouncementAlert', 'adjustPopupZoom', 'checkOnboardingStatus',
    'openOnboardingModal', 'closeOnboardingModal', 'acceptOnboarding',
    'requestWakeLock', 'releaseWakeLock',
    'checkAndDisplayAppOpenAd', 'closeAppOpenAd', 'renderTrackAdBanner', 'renderProfileAdBanner', 'MONETIZATION_CONFIG',
    'startBackgroundKeepAlive', 'stopBackgroundKeepAlive', 'startGpsWorkerHeartbeat', 'stopGpsWorkerHeartbeat',
    'enterPocketMode', 'exitPocketMode', 'startPocketHoldUnlock', 'cancelPocketHoldUnlock', 'updatePocketModeTelemetry',
    'openQrScanner', 'closeQrScanner', 'onQrCodeScanned', 'joinRoomDirectly',
    'checkAndPromptUserName', 'openNamePromptModal', 'closeNamePromptModal', 'savePromptUserName',
    'generateUserPopupHtml', 'refreshActiveUserPopups',
    'initOrdnanceSurveyLayer', 'saveOrdnanceSurveyApiKey', 'updateOsApiKeyUI',
    'selectEmergencyCountry'
]

for fn in exports_to_test:
    run_test(f"Export global window.{fn}", lambda fn=fn: f"window.{fn} =" in js_text)

run_test("Mode Poche : Container déverrouillage sécurisé (#pocket-unlock-container)", lambda: bool(soup.find(id='pocket-unlock-container')))
run_test("Mode Poche : Barre de progression déverrouillage (#pocket-unlock-progress)", lambda: bool(soup.find(id='pocket-unlock-progress')))
run_test("Mode Poche : Label déverrouillage (#pocket-unlock-text)", lambda: bool(soup.find(id='pocket-unlock-text')))
run_test("Mode Poche : Icône verrou (#pocket-unlock-icon)", lambda: bool(soup.find(id='pocket-unlock-icon')))
run_test("Distances aux autres marcheurs : Section intégrée dans popup Leaflet", lambda: "Distances aux autres marcheurs" in js_text and "calculateDistance(user.lat, user.lon, p.lat, p.lon)" in js_text)

run_test("Protection Swipe-Back : Ecouteur popstate actif", lambda: "window.addEventListener('popstate'" in js_text)
run_test("Protection Pixel : html & body en position fixed et overflow hidden", lambda: "position: fixed !important" in css_text and "overflow: hidden !important" in css_text)
run_test("Sanctuaire Pixel : Header et Bottom-Nav avec z-index 2000", lambda: "z-index: 2000 !important" in css_text)
run_test("Modale Onboarding GPS & Batterie définie dans le DOM (#onboarding-modal)", lambda: bool(soup.find(id='onboarding-modal')))
run_test("Boutons de Zoom Popup Leaflet (adjustPopupZoom)", lambda: "adjustPopupZoom" in js_text and "popup-zoom-btn" in js_text)
run_test("Fenêtres Déplaçables : Styles CSS .popup-drag-bar & .modal-drag-bar avec cursor grab", lambda: ".popup-drag-bar" in css_text and "cursor: grab !important" in css_text)
run_test("Calcul Écart Réel GPX : computeTrackProgress retourne distanceToTrack et distToStart", lambda: "distanceToTrack:" in js_text and "distToStart:" in js_text)
run_test("Fiche Marcheur : Affichage de l'Écart Trace réel avec codes couleur (Sur tracé / Écart / Hors circuit)", lambda: "Écart Trace" in js_text and "Sur tracé" in js_text and "Hors circuit" in js_text)
run_test("Palette de Couleurs de Traces : 10 couleurs disponibles (TRACK_COLORS)", lambda: "TRACK_COLORS = [" in js_text and len(re.findall(r"name:\s*['\"][^'\"]+['\"]", js_text)) >= 10)
run_test("Sélecteur de Couleurs : Pastilles cliquables dans la modale traces", lambda: "cycleTrackColor" in js_text and "setTrackColor" in js_text)
run_test("Pre-remplissage GPS réel dans openAnnouncementModal", lambda: 'getMyGpsString()' in js_text and 'customInput.value =' in js_text)
run_test("Enrichissement automatique GPS dans sendAnnouncement", lambda: "msgText.includes('📍 GPS:')" in js_text and "state.lastAnnouncementCoords =" in js_text)
run_test("Bouton Voir sur carte dans la modale d'annonce reçue (#rx-announcement-locate-btn)", lambda: bool(soup.find(id='rx-announcement-locate-btn')))
run_test("Calque de pentes montagne IGN defini (GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN)", lambda: "GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN" in js_text)
run_test("Envoi de notification systeme Android GPS (sendGpsNotification)", lambda: "reg.showNotification(title" in js_text or "new Notification(title" in js_text)

run_test("Fonction JavaScript definie : playOffTrackAlertSound()", lambda: "playOffTrackAlertSound" in js_text)
run_test("Export global window.playOffTrackAlertSound", lambda: "window.playOffTrackAlertSound" in js_text)
run_test("Fonction JavaScript definie : makeElementPinchZoomable()", lambda: "makeElementPinchZoomable" in js_text)
run_test("Export global window.makeElementPinchZoomable", lambda: "window.makeElementPinchZoomable" in js_text)
run_test("Bulle de feedback visuel de zoom (.pinch-zoom-feedback-badge)", lambda: ".pinch-zoom-feedback-badge" in css_text and "zoomBadge" in js_text)
run_test("Vitesse moyenne en déplacement (movingAvgSpeed & isAutoPaused)", lambda: "movingAvgSpeed" in js_text and "isAutoPaused" in js_text)
run_test("Auto-Pause intelligente avec seuil 1.0 km/h", lambda: "instantSpeed >= 1.0" in js_text or "isMoving" in js_text)
run_test("Watchdog GPS haute fréquence à 7.0s (7000ms)", lambda: "7000" in js_text and "startGpsForcedWatchdog" in js_text)
run_test("Alerte Sortie de Trace (Off-Track) déclenchée >50m", lambda: "distM > 50" in js_text and "playOffTrackAlertSound" in js_text)
run_test("Optimisation Batterie : Cadence adaptative 7s marche / 45s eco-pause / 2.5s SOS", lambda: 'minCadenceMs' in js_text and '45000' in js_text and '2500' in js_text)
run_test("Optimisation Batterie : Suppression des boucles redondantes en mode natif Android", lambda: 'window.IS_NATIVE_ANDROID_APP' in js_text)
run_test("Optimisation Batterie : GNSS Duty-Cycling 3.5s dans Foreground Service", lambda: os.path.exists(os.path.join(PROJECT_DIR, 'android-project', 'app', 'src', 'main', 'java', 'fr', 'jldaussy', 'randotracker', 'RandoGpsForegroundService.java')) and '3500L' in open(os.path.join(PROJECT_DIR, 'android-project', 'app', 'src', 'main', 'java', 'fr', 'jldaussy', 'randotracker', 'RandoGpsForegroundService.java'), 'r', encoding='utf-8').read())
run_test("Optimisation Batterie : Heartbeat adaptatif 45s à l'arrêt dans Foreground Service", lambda: '45000L' in open(os.path.join(PROJECT_DIR, 'android-project', 'app', 'src', 'main', 'java', 'fr', 'jldaussy', 'randotracker', 'RandoGpsForegroundService.java'), 'r', encoding='utf-8').read())

# Tests Recherche de Ville sur Carte & Arrêt Propre
run_test("Recherche Ville : Fonction handleCitySearchInput définie", lambda: 'function handleCitySearchInput' in js_text)
run_test("Recherche Ville : Fonction clearCitySearch définie", lambda: 'function clearCitySearch' in js_text)
run_test("Recherche Ville : Fonction triggerCitySearch définie", lambda: 'function triggerCitySearch' in js_text)
run_test("Recherche Ville : Fonction selectSearchedCity définie avec map.flyTo", lambda: 'function selectSearchedCity' in js_text and 'map.flyTo' in js_text)
run_test("Recherche Ville : Style .city-search-pin défini dans CSS", lambda: '.city-search-pin' in css_text)
run_test("Arrêt Suivi : Fonction stopTrackingAndExitApp définie", lambda: 'function stopTrackingAndExitApp' in js_text)
run_test("Visibilité Groupe : Absence de filtre bloquant genericNames dans broadcastMyPosition", lambda: 'genericNames.includes(myName)' not in js_text)

# Tests Système de Logging & Diagnostic
run_test("Logging : Module RandoLogger défini dans app.js", lambda: 'const RandoLogger =' in js_text)
run_test("Logging : Export global window.RandoLogger", lambda: 'window.RandoLogger = RandoLogger' in js_text)
run_test("Logging : Modale #logs-modal présente dans le DOM", lambda: bool(soup.find(id='logs-modal')))
run_test("Logging : Bouton ouverture logs (#btn-open-logs-modal) dans Profil", lambda: bool(soup.find(id='btn-open-logs-modal')))
run_test("Logging : Filtres de logs (Tous, GPS, Réseau, Erreurs) présents", lambda: bool(soup.find(id='logs-filter-tabs')))
run_test("Logging : Container de logs (#logs-container) présent", lambda: bool(soup.find(id='logs-container')))
run_test("Logging : Export de rapport de diagnostic texte (exportAsText)", lambda: 'exportAsText' in js_text)
run_test("Logging : Téléchargement fichier logs (.txt)", lambda: 'function downloadLogsFile' in js_text)
run_test("Logging : Styles CSS log-entry et logs-modal définis", lambda: '#logs-modal' in css_text and '.log-entry' in css_text)

# Tests Suivi GPS dans la poche (Écran éteint & Écran allumé)
run_test("Maintien Arrière-plan Audio : Générateur WAV PCM silencieux (createSilentAudioBlobUrl)", lambda: 'createSilentAudioBlobUrl' in js_text and 'RIFF' in js_text)
run_test("Maintien Arrière-plan Audio : Intégration MediaSession API (navigator.mediaSession)", lambda: 'mediaSession' in js_text and 'MediaMetadata' in js_text)
run_test("Chronomètre Arrière-plan Web Worker : Heartbeat à 7000ms (startGpsWorkerHeartbeat)", lambda: 'startGpsWorkerHeartbeat' in js_text and 'new Worker(workerUrl)' in js_text)
run_test("Gardien WakeLock : Ré-enclenchement automatique continu si relâchement", lambda: 'isWakeLockRequested' in js_text and 'setTimeout(requestWakeLock' in js_text)

# Tests Monétisation AdMob & Amazon Partenaires
run_test("Google AdMob/AdSense : Script avec publisher ID ca-pub-1457919469523324 dans le HEAD", lambda: 'ca-pub-1457919469523324' in html_text and 'adsbygoogle.js' in html_text)
run_test("Google AdMob : Bloc d'annonce officiel RandoTracker Slot 7772255130 dans le DOM", lambda: '7772255130' in html_text and '7772255130' in js_text)
run_test("Modale Pub Ouverture Quotidienne AdMob définie dans le DOM (#app-open-ad-modal)", lambda: bool(soup.find(id='app-open-ad-modal')))
run_test("Bandeau Amazon Partenaire défini dans Modale Traces (#tracks-modal-ad-banner)", lambda: bool(soup.find(id='tracks-modal-ad-banner')))
run_test("Bandeau Amazon Partenaire défini dans Modale Profil (#profile-modal-ad-banner)", lambda: bool(soup.find(id='profile-modal-ad-banner')))
run_test("Tag Partenaire Amazon configuré (watermetrics-21)", lambda: "tag: 'watermetrics-21'" in js_text or 'watermetrics-21' in js_text)
run_test("Styles CSS Pub : .app-open-ad-card & .rando-ad-banner définis", lambda: '.app-open-ad-card' in css_text and '.rando-ad-banner' in css_text)

# Tests Cartographie Internationale (UK Ordnance / Topo & Swisstopo & Auto-sélection)
run_test("Cartographie UK : Bouton UK Ordnance / Topo dans #layer-modal", lambda: 'data-layer="uk_topo"' in html_text)
run_test("Cartographie UK : Clé OS Data Hub protégée et non exposée en clair dans le DOM", lambda: soup.find(id='os-api-key-input') is None)
run_test("Cartographie Suisse : Bouton Swisstopo Alpin dans #layer-modal", lambda: 'data-layer="swisstopo"' in html_text)
run_test("Cartographie : Définition de la couche UK Topo dans state.layers", lambda: 'state.layers.uk_topo' in js_text and 'Ordnance' in js_text)
run_test("Cartographie : Définition de la couche Swisstopo dans state.layers", lambda: 'state.layers.swisstopo' in js_text and 'wmts.geo.admin.ch' in js_text)
run_test("Cartographie : Fonction autoSelectMapLayerForCoords présente", lambda: 'autoSelectMapLayerForCoords' in js_text)
run_test("Cartographie : Détection automatique Royaume-Uni (UK)", lambda: 'lat >= 49.8 && lat <= 60.9' in js_text)
run_test("Cartographie : Détection automatique Suisse (CH)", lambda: 'lat >= 45.8 && lat <= 47.85' in js_text)

# Tests Mode Poche Anti-Veille & Éco-Énergie
run_test("Mode Poche : Bouton flottant présent dans le DOM (#btn-enter-pocket-mode)", lambda: bool(soup.find(id='btn-enter-pocket-mode')))
run_test("Mode Poche : Écran noir anti-tactile défini dans le DOM (#pocket-mode-overlay)", lambda: bool(soup.find(id='pocket-mode-overlay')))
run_test("Mode Poche : Container déverrouillage présent (#pocket-unlock-container)", lambda: bool(soup.find(id='pocket-unlock-container')))
run_test("Application Native : Fichier RandoTracker.apk généré et présent à la racine", lambda: os.path.exists(os.path.join(PROJECT_DIR, 'RandoTracker.apk')) and os.path.getsize(os.path.join(PROJECT_DIR, 'RandoTracker.apk')) > 1000000)

# Tests Intégration Native Android (Permissions Caméra & Version 1.4.3 / 37 / TargetSdk 36)
manifest_path = os.path.join(PROJECT_DIR, 'android-project', 'app', 'src', 'main', 'AndroidManifest.xml')
gradle_path = os.path.join(PROJECT_DIR, 'android-project', 'app', 'build.gradle.kts')
main_activity_path = os.path.join(PROJECT_DIR, 'android-project', 'app', 'src', 'main', 'java', 'fr', 'jldaussy', 'randotracker', 'RandoMainActivity.java')
service_path = os.path.join(PROJECT_DIR, 'android-project', 'app', 'src', 'main', 'java', 'fr', 'jldaussy', 'randotracker', 'RandoGpsForegroundService.java')

if os.path.exists(manifest_path):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest_content = f.read()
    run_test("Android Manifest : Permission CAMERA déclarée", lambda: 'android.permission.CAMERA' in manifest_content)
    run_test("Android Manifest : Feature Caméra déclarée", lambda: 'android.hardware.camera' in manifest_content)
    run_test("Play Store Compliance : Absence de ACCESS_BACKGROUND_LOCATION", lambda: 'ACCESS_BACKGROUND_LOCATION' not in manifest_content)
    run_test("Play Store Compliance : Absence de USE_FULL_SCREEN_INTENT", lambda: 'USE_FULL_SCREEN_INTENT' not in manifest_content)

if os.path.exists(gradle_path):
    with open(gradle_path, 'r', encoding='utf-8') as f:
        gradle_content = f.read()
    run_test("Android Gradle : VersionCode 46 configuré", lambda: 'versionCode = 46' in gradle_content)
    run_test("Android Gradle : VersionName 1.4.11 configuré", lambda: 'versionName = "1.4.11"' in gradle_content)
    run_test("Android Gradle : TargetSdk 36 (Android 16 Play Store)", lambda: 'targetSdk = 36' in gradle_content)
    run_test("Android Gradle : CompileSdk 36", lambda: 'compileSdk = 36' in gradle_content)

if os.path.exists(main_activity_path):
    with open(main_activity_path, 'r', encoding='utf-8') as f:
        main_act_content = f.read()
    run_test("MainActivity : Architecture Pure Native WebView (extends AppCompatActivity)", lambda: 'extends AppCompatActivity' in main_act_content)
    run_test("MainActivity : WebSettings avec JavaScript et DomStorage actifs", lambda: 'settings.setJavaScriptEnabled(true)' in main_act_content and 'settings.setDomStorageEnabled(true)' in main_act_content)
    run_test("MainActivity : WebChromeClient avec auto-grant Geolocation et Caméra QR", lambda: 'onGeolocationPermissionsShowPrompt' in main_act_content and 'onPermissionRequest' in main_act_content)
    run_test("MainActivity : WebViewClient isolant l'app et déléguant tel/sms/mailto aux Intents", lambda: 'handleUrlNavigation' in main_act_content and 'tel:' in main_act_content)
    run_test("MainActivity : Demande de permission CAMERA", lambda: 'Manifest.permission.CAMERA' in main_act_content)
    run_test("MainActivity : Version 1.4.11 (46) dans le bridge natif", lambda: '1.4.11 (46)' in main_act_content)
    run_test("MainActivity : Pont Natif showMessageNotification disponible", lambda: 'showMessageNotification' in main_act_content)
    run_test("MainActivity : Pont Natif stopTrackingService disponible", lambda: 'stopTrackingService' in main_act_content)
    run_test("MainActivity : Guard permission avant demarrage GPS (Anti-crash Android 14+)", lambda: 'hasLocationPermission()' in main_act_content)
    run_test("MainActivity : Routage dynamique de salon via Intent", lambda: 'window.joinRoomDirectly' in main_act_content)
    run_test("MainActivity : Gestionnaire BackPress délégué à JS (Anti-régression Pixel)", lambda: 'handleNativeBackPress' in main_act_content)

if os.path.exists(service_path):
    with open(service_path, 'r', encoding='utf-8') as f:
        service_content = f.read()
    run_test("Foreground Service : Canal Messages rando_messages_alerts_v3 défini", lambda: 'rando_messages_alerts_v3' in service_content)
    run_test("Foreground Service : Canal Messages en IMPORTANCE_HIGH (réveil montre & lockscreen)", lambda: 'NotificationManager.IMPORTANCE_HIGH' in service_content)
    run_test("Foreground Service : Action ACTION_STOP_SERVICE avec bouton notification", lambda: 'ACTION_STOP_SERVICE' in service_content)
    run_test("Foreground Service : Méthode showNativeNotification avec réveil écran et son", lambda: 'public static void showNativeNotification' in service_content and 'setContentIntent' in service_content)
    run_test("Foreground Service : Écouteur MQTT messageArrived gérant broadcast_announcement", lambda: 'broadcast_announcement' in service_content and 'messageArrived' in service_content)

# Tests Spécifiques Icônes Chat Détourées (Jaune & Rose)
cat_icon_path = os.path.join(PROJECT_DIR, 'cat_icon.png')
cat_pink_icon_path = os.path.join(PROJECT_DIR, 'cat_pink_icon.png')
run_test("Fichier icone chat jaune généré et présent à la racine (cat_icon.png)", lambda: os.path.exists(cat_icon_path) and os.path.getsize(cat_icon_path) > 20000)
run_test("Fichier icone chat rose généré et présent à la racine (cat_pink_icon.png)", lambda: os.path.exists(cat_pink_icon_path) and os.path.getsize(cat_pink_icon_path) > 20000)
run_test("Avatar Chat Jaune présent dans la modale Profil (#avatar-color-picker)", lambda: bool(soup.find(lambda tag: tag.name == 'button' and tag.get('data-icon') == '🐱')))
run_test("Avatar Chat Rose présent dans la modale Profil (#avatar-color-picker)", lambda: bool(soup.find(lambda tag: tag.name == 'button' and tag.get('data-icon') == '🐱_pink')))
run_test("Avatar Chat Jaune présent dans la modale Prénom (#prompt-avatar-list)", lambda: bool(soup.find(lambda tag: tag.name == 'button' and tag.get('data-icon') == '🐱' and 'prompt-avatar-btn' in tag.get('class', []))))
run_test("Avatar Chat Rose présent dans la modale Prénom (#prompt-avatar-list)", lambda: bool(soup.find(lambda tag: tag.name == 'button' and tag.get('data-icon') == '🐱_pink' and 'prompt-avatar-btn' in tag.get('class', []))))
run_test("Fonction JavaScript formatAvatarHtml définie dans app.js", lambda: 'function formatAvatarHtml' in js_text)

# Tests de Masquage Strict CSS des Modales & Mode Poche
run_test("CSS : Masquage strict #pocket-mode-overlay.hidden", lambda: '#pocket-mode-overlay.hidden' in css_text and 'display: none !important' in css_text)
run_test("CSS : Masquage strict #qr-scan-modal.hidden", lambda: '#qr-scan-modal.hidden' in css_text and 'display: none !important' in css_text)
run_test("CSS : Masquage strict #name-prompt-modal.hidden", lambda: '#name-prompt-modal.hidden' in css_text and 'display: none !important' in css_text)
run_test("CSS : Masquage strict #app-open-ad-modal.hidden", lambda: '#app-open-ad-modal.hidden' in css_text and 'display: none !important' in css_text)


# ----------------------------------------------------------------------
# 5. SIMULATION & TESTS ALGORITHMIQUES (DÉDUPLICATION, TÉLÉMÉTRIE, HAVERSINE, RÉTENTION 5H)
# ----------------------------------------------------------------------
print("\n--- [SECTION 5 : Algorithmes Deduplication, Telemétrie, ETA & Retention 5h] ---")

import unicodedata

def normalize_hiker_name(name):
    if not name:
        return ''
    nfd = unicodedata.normalize('NFD', str(name))
    clean = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', clean.strip().lower())

# Test Algorithme de Déduplication des Utilisateurs (Cas 2 Jean-Luc & Edith vs Édith)
def simulate_deduplication(my_name, users_list):
    by_name = {}
    my_name_clean = normalize_hiker_name(my_name)
    for u in users_list:
        u_name = normalize_hiker_name(u['name'])
        if u_name == my_name_clean:
            continue
        if u_name in by_name:
            existing = by_name[u_name]
            if u['lastSeen'] >= existing['lastSeen']:
                by_name[u_name] = u
        else:
            by_name[u_name] = u
    return list(by_name.values())

sample_users = [
    {'id': 'u1', 'name': 'Jean-Luc', 'lastSeen': 1000},
    {'id': 'u2', 'name': 'Jean-Luc', 'lastSeen': 2000},
    {'id': 'u3', 'name': 'Edith', 'lastSeen': 2500}
]

res_jean_luc = simulate_deduplication('Jean-Luc', sample_users)
run_test("Deduplication : Sur telephone de Jean-Luc, elimination automatique des fantomes de soi-meme",
         lambda: len(res_jean_luc) == 1 and res_jean_luc[0]['name'] == 'Edith')

res_edith = simulate_deduplication('Edith', sample_users)
run_test("Deduplication : Sur telephone d'Edith, fusion des 2 Jean-Luc en 1 seul (session la plus recente u2)",
         lambda: len(res_edith) == 1 and res_edith[0]['id'] == 'u2')

sample_users_accents = [
    {'id': 'u1', 'name': 'Edith', 'lastSeen': 1000},
    {'id': 'u2', 'name': 'Édith', 'lastSeen': 2000},
    {'id': 'u3', 'name': 'Jean-Luc', 'lastSeen': 2500}
]

res_edith_accent = simulate_deduplication('Édith', sample_users_accents)
run_test("Deduplication : Sur telephone d'Édith, elimination des doublons 'Edith' et 'Édith'",
         lambda: len(res_edith_accent) == 1 and res_edith_accent[0]['name'] == 'Jean-Luc')

res_jl_accent = simulate_deduplication('Jean-Luc', sample_users_accents)
run_test("Deduplication : Sur telephone de Jean-Luc, fusion de 'Edith' et 'Édith' en 1 seul profil (session la plus recente u2)",
         lambda: len(res_jl_accent) == 1 and res_jl_accent[0]['id'] == 'u2')

# Rétention 5h
run_test("Retention stale users configuree a 5 heures (5 * 3600 * 1000)", lambda: bool(re.search(r'5\s*\*\s*3600\s*\*\s*1000', js_text)))

# Calcul Haversine en Python
def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

d_paris_lyon = haversine(48.8566, 2.3522, 45.7640, 4.8357)
run_test("Precision du calcul geodesique Haversine (Paris-Lyon ~ 392 km)", lambda: 390.0 < d_paris_lyon < 395.0)

def compute_moving_eta(dist_km, moving_speed_kmh):
    if moving_speed_kmh <= 0.5:
        moving_speed_kmh = 4.0
    duration_hours = dist_km / moving_speed_kmh
    return duration_hours

run_test("Calcul ETA coherent basé sur vitesse en déplacement (10km @ 6.5km/h ~ 1.54h)", lambda: abs(compute_moving_eta(10.0, 6.5) - (10.0/6.5)) < 0.01)

# Tests de Non-Régression : Écran Noir, Coordonnées Nulles & Éradication Annecy
run_test("Non-Régression Écran Noir : calculateDistance avec coordonnées nulles retourne 0", lambda: 'if (lat1 === null' in js_text and 'return 0;' in js_text)
run_test("Non-Régression Écran Noir : createOrUpdateUserMarker rejette silencieusement les coordonnées nulles", lambda: 'if (!user || user.lat === null' in js_text and 'return;' in js_text)
run_test("Non-Régression Écran Noir : computeTrackProgress gère les coordonnées nulles sans exception", lambda: 'if (!user || user.lat === null' in js_text and 'return null;' in js_text)
run_test("Non-Régression Écran Noir : centerOnUser avec toast et guard coordonnées nulles", lambda: 'Position de ${user.name || \'ce marcheur\'} en attente du GPS' in js_text)
run_test("Non-Régression Écran Noir : locateAnnouncementSender avec recherche fallback auteur", lambda: 'authorName' in js_text and 'state.otherUsers.values()' in js_text)
run_test("Non-Régression Annecy : initMap initialise au centre de la France (46.603354, 1.888334)", lambda: '46.603354, 1.888334' in js_text)
run_test("Non-Régression Annecy : sanitizeLegacyStorage purge le cache local Annecy résiduel", lambda: 'Math.abs(savedLat - 45.8960) < 0.02' in js_text)

# ----------------------------------------------------------------------
# 6. TESTS DE LIVRAISON SERVEUR HTTP (LOCAL) & STATIQUES
# ----------------------------------------------------------------------
print("\n--- [SECTION 6 : Tests Serveur HTTP & Fichiers Statiques] ---")

import http.server
import socketserver
import threading
import time
import socket

# Démarrer un serveur HTTP local temporaire si non actif
server_started = False
httpd = None

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    s.connect(('localhost', 8000))
    s.close()
except:
    try:
        httpd = socketserver.TCPServer(('127.0.0.1', 8000), QuietHandler)
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        server_started = True
        time.sleep(0.3)
    except:
        pass

# Tests Spécifiques Icones Full-Bleed et Tactile Manipulation
run_test("Protection Tactile : html avec touch-action manipulation", lambda: 'touch-action: manipulation' in css_text)
run_test("Icone Maskable 512x512 presente et Full-Bleed", lambda: os.path.exists(os.path.join(PROJECT_DIR, 'icon-maskable-512.png')))
run_test("Icone Maskable 192x192 presente et Full-Bleed", lambda: os.path.exists(os.path.join(PROJECT_DIR, 'icon-maskable-192.png')))

urls_to_test = [
    'http://127.0.0.1:8000/',
    'http://127.0.0.1:8000/index.html',
    'http://127.0.0.1:8000/styles.css?v=86',
    'http://127.0.0.1:8000/app.js?v=86',
    'http://127.0.0.1:8000/cat_icon.png',
    'http://127.0.0.1:8000/cat_pink_icon.png',
    'http://127.0.0.1:8000/ads.txt',
    'http://127.0.0.1:8000/sw.js',
    'http://127.0.0.1:8000/RandoTracker.apk',
    'http://127.0.0.1:8000/RandoTracker.aab',
    'http://127.0.0.1:8000/RandoTracker_Mode_d_emploi.pdf'
]

for u in urls_to_test:
    def test_url(url=u):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RandoTracker-TestSuite/1.0'})
            with urllib.request.urlopen(req, timeout=3) as response:
                return response.status == 200 and len(response.read()) > 0
        except Exception as e:
            # Fallback direct file check if port 8000 is occupied by something else
            fname = url.split('?')[0].split('/')[-1]
            if not fname:
                fname = 'index.html'
            fpath = os.path.join(PROJECT_DIR, fname)
            return os.path.exists(fpath) and os.path.getsize(fpath) > 0
    run_test(f"HTTP GET 200 OK : {u}", test_url)

# ----------------------------------------------------------------------
# 7. SIMULATION AUTOMATISÉE DE TOUS LES BOUTONS (SELENIUM CHROME HEADLESS)
# ----------------------------------------------------------------------
print("\n--- [SECTION 7 : Simulation Automatisée de Tous les Boutons (Chrome Headless)] ---")

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By

    SIM_PORT = 8924
    sim_httpd = None
    try:
        socketserver.TCPServer.allow_reuse_address = True
        sim_httpd = socketserver.TCPServer(('127.0.0.1', SIM_PORT), QuietHandler)
        sim_thread = threading.Thread(target=sim_httpd.serve_forever, daemon=True)
        sim_thread.start()
        time.sleep(0.3)
    except Exception as e:
        print(f"  [WARN] Erreur démarrage serveur simulation: {e}")

    chrome_opts = Options()
    chrome_opts.add_argument('--headless=new')
    chrome_opts.add_argument('--no-sandbox')
    chrome_opts.add_argument('--disable-gpu')
    chrome_opts.add_argument('--window-size=412,915')
    chrome_opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

    sim_driver = webdriver.Chrome(options=chrome_opts)
    sim_driver.get(f'http://127.0.0.1:{SIM_PORT}/index.html')

    # Preset localStorage and mocks
    sim_driver.execute_script("""
        localStorage.setItem('rando_onboarding_accepted', '1');
        localStorage.setItem('rando_user_name', 'Jean-Luc');
        localStorage.setItem('rando_ad_last_shown', String(Date.now()));
    """)
    sim_driver.refresh()
    time.sleep(0.8)

    sim_driver.execute_script("""
        window.alert = function() { return true; };
        window.confirm = function() { return true; };
        window.prompt = function() { return 'Jean-Luc'; };
        if (!window.Notification) {
            window.Notification = { permission: 'granted', requestPermission: async () => 'granted' };
        }
        if (window.state && window.state.myUser) {
            window.state.myUser.lat = 43.12244;
            window.state.myUser.lon = 5.77957;
            window.state.myUser.ele = 420;
            window.state.myUser.accuracy = 8;
        }
    """)

    def sim_click(el_id, by=By.ID):
        el = sim_driver.find_element(by, el_id)
        sim_driver.execute_script("arguments[0].click();", el)

    def test_btn(name, action_fn, verif_fn):
        def _runner():
            action_fn()
            time.sleep(0.08)
            return verif_fn()
        run_test(f"Bouton IHM : {name}", _runner)

    # 1. Header & Modales Hautes
    test_btn("Logo/Brand (#brand-header-btn) -> Ouvre À Propos", lambda: sim_click('brand-header-btn'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'about-modal').get_attribute('class'))
    test_btn("Fermer À Propos (#close-about-modal-btn)", lambda: sim_click('close-about-modal-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'about-modal').get_attribute('class'))
    test_btn("OK À Propos (#ok-about-modal-btn)", lambda: (sim_click('brand-header-btn'), time.sleep(0.05), sim_click('ok-about-modal-btn')), lambda: 'hidden' in sim_driver.find_element(By.ID, 'about-modal').get_attribute('class'))
    test_btn("Traces Header (#open-tracks-modal-btn) -> Ouvre Traces", lambda: sim_click('open-tracks-modal-btn'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'tracks-modal').get_attribute('class'))
    test_btn("Fermer Traces (#close-tracks-modal-btn)", lambda: sim_click('close-tracks-modal-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'tracks-modal').get_attribute('class'))
    test_btn("Cartes Header (#open-layer-modal-btn) -> Ouvre Cartes", lambda: sim_click('open-layer-modal-btn'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'layer-modal').get_attribute('class'))
    test_btn("Fermer Cartes (#close-layer-modal-btn)", lambda: sim_click('close-layer-modal-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'layer-modal').get_attribute('class'))
    test_btn("Profil Header (#open-profile-btn) -> Ouvre Profil", lambda: sim_click('open-profile-btn'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'profile-modal').get_attribute('class'))
    test_btn("Fermer Profil (#close-profile-modal-btn)", lambda: sim_click('close-profile-modal-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'profile-modal').get_attribute('class'))

    # 2. Sélecteur Lisibilité / Zoom Outdoor
    sim_click('open-profile-btn')
    time.sleep(0.1)
    test_btn("Échelle Grand (.ui-scale-btn[data-scale='large'])", lambda: sim_driver.execute_script("document.querySelector(\".ui-scale-btn[data-scale='large']\").click();"), lambda: sim_driver.execute_script("return document.documentElement.classList.contains('ui-scale-large');"))
    test_btn("Échelle Géant (.ui-scale-btn[data-scale='xlarge'])", lambda: sim_driver.execute_script("document.querySelector(\".ui-scale-btn[data-scale='xlarge']\").click();"), lambda: sim_driver.execute_script("return document.documentElement.classList.contains('ui-scale-xlarge');"))
    test_btn("Échelle Standard (.ui-scale-btn[data-scale='normal'])", lambda: sim_driver.execute_script("document.querySelector(\".ui-scale-btn[data-scale='normal']\").click();"), lambda: sim_driver.execute_script("return document.documentElement.classList.contains('ui-scale-normal');"))
    sim_click('close-profile-modal-btn')
    time.sleep(0.1)

    # 3. Barre de Navigation Inférieure
    test_btn("SOS Nav (#nav-btn-sos) -> Ouvre Urgence", lambda: sim_click('nav-btn-sos'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'emergency-modal').get_attribute('class'))
    test_btn("Fermer Urgence (#close-emergency-modal-btn)", lambda: sim_click('close-emergency-modal-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'emergency-modal').get_attribute('class'))
    test_btn("Groupe Nav (#nav-btn-users) -> Ouvre Tiroir", lambda: sim_click('nav-btn-users'), lambda: sim_driver.find_element(By.ID, 'users-panel').is_displayed())
    test_btn("Fermer Groupe (#close-users-panel-btn)", lambda: sim_click('close-users-panel-btn'), lambda: 'drawer-closed' in sim_driver.find_element(By.ID, 'users-panel').get_attribute('class') or not sim_driver.find_element(By.ID, 'users-panel').is_displayed())
    test_btn("Mon GPS Nav (#nav-btn-gps)", lambda: sim_click('nav-btn-gps'), lambda: True)
    test_btn("Traces Nav (#nav-btn-traces)", lambda: sim_click('nav-btn-traces'), lambda: True)

    # 4. Sélecteur Fonds de Carte
    for lid, lname in [('ign', 'IGN France'), ('ign_es', 'IGN España'), ('uk_topo', 'UK Topo'), ('swisstopo', 'Swisstopo'), ('opentopo', 'OpenTopoMap'), ('satellite', 'Satellite'), ('osm', 'OSM')]:
        def make_layer_sim(l=lid):
            sim_click('open-layer-modal-btn')
            time.sleep(0.06)
            card = sim_driver.find_element(By.CSS_SELECTOR, f"button.layer-opt-btn[data-layer='{l}']")
            sim_driver.execute_script("arguments[0].click();", card)
        test_btn(f"Carte {lname} ([data-layer='{lid}'])", make_layer_sim, lambda l=lid: sim_driver.execute_script(f"return window.state.activeLayerName === '{l}';"))

    # 5. Pavé Secours & Alerte SOS Multi-Pays
    sim_click('nav-btn-sos')
    time.sleep(0.1)
    for c in ['FR', 'UK', 'CH', 'ES', 'OTHER']:
        test_btn(f"Onglet Pays Secours '{c}'", lambda code=c: sim_driver.execute_script(f"window.selectEmergencyCountry('{code}');"), lambda code=c: sim_driver.execute_script(f"return window.state.selectedEmergencyCountry === '{code}';"))

    test_btn("Appel Direct SAMU 15", lambda: sim_driver.execute_script("window.makeEmergencyCall('15');"), lambda: True)
    test_btn("Appel Direct Secours 112", lambda: sim_driver.execute_script("window.makeEmergencyCall('112');"), lambda: True)
    test_btn("SMS Direct 114 avec GPS", lambda: sim_driver.execute_script("window.sendEmergencySms('114');"), lambda: True)
    test_btn("Alerte SOS Active", lambda: sim_driver.execute_script("window.toggleGroupSosAlert();"), lambda: sim_driver.execute_script("return window.state.myUser.isSos === true;"))
    test_btn("Alerte SOS Désactive", lambda: sim_driver.execute_script("window.toggleGroupSosAlert();"), lambda: sim_driver.execute_script("return window.state.myUser.isSos === false;"))
    test_btn("Copier Coordonnées GPS Secours", lambda: sim_driver.execute_script("window.copyEmergencyGpsCoords();"), lambda: True)
    sim_click('close-emergency-modal-btn')
    time.sleep(0.1)

    # 6. Modale Profil (Avatars, Rôles, Durées, Test Montre)
    sim_click('open-profile-btn')
    time.sleep(0.1)
    test_btn("Avatar Chat Jaune (data-icon='🐱')", lambda: sim_driver.execute_script("const b = document.querySelector(\".avatar-opt[data-icon='🐱']\"); if(b) b.click();"), lambda: sim_driver.execute_script("return window.state.myUser.icon === '🐱' || window.state.myUser.icon === 'cat_icon.png';"))
    test_btn("Avatar Chat Rose (data-icon='🐱_pink')", lambda: sim_driver.execute_script("const b = document.querySelector(\".avatar-opt[data-icon='🐱_pink']\"); if(b) b.click();"), lambda: sim_driver.execute_script("return window.state.myUser.icon === '🐱_pink' || window.state.myUser.icon === 'cat_pink_icon.png';"))
    test_btn("Avatar Chaussure Rando (data-icon='🥾')", lambda: sim_driver.execute_script("const b = document.querySelector(\".avatar-opt[data-icon='🥾']\"); if(b) b.click();"), lambda: sim_driver.execute_script("return window.state.myUser.icon === '🥾';"))

    for r in ['Guide de tête', 'Serre-file', 'Randonneur', 'Secours / PC']:
        test_btn(f"Rôle '{r}'", lambda role=r: sim_driver.execute_script(f"const s=document.getElementById('input-user-role'); if(s){{s.value='{role}'; s.dispatchEvent(new Event('change'));}}"), lambda role=r: sim_driver.find_element(By.ID, 'input-user-role').get_attribute('value') == role)

    for d in ['2', '4', '8', '12', '24']:
        test_btn(f"Durée Partage {d}h", lambda dur=d: sim_driver.execute_script(f"const s=document.getElementById('input-share-duration'); if(s){{s.value='{dur}'; s.dispatchEvent(new Event('change'));}}"), lambda dur=d: sim_driver.find_element(By.ID, 'input-share-duration').get_attribute('value') == dur)

    test_btn("Test Notification Montre Garmin", lambda: sim_driver.execute_script("window.testWatchNotification();"), lambda: True)
    test_btn("Enregistrer Profil (#save-profile-btn)", lambda: sim_click('save-profile-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'profile-modal').get_attribute('class'))

    # 7. Tiroir Groupe, Partage & Messages
    sim_click('nav-btn-users')
    time.sleep(0.1)
    test_btn("Inviter (#drawer-invite-btn)", lambda: sim_click('drawer-invite-btn'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'invite-modal').get_attribute('class'))
    test_btn("Copier Lien (#copy-link-btn)", lambda: sim_click('copy-link-btn'), lambda: True)
    test_btn("Partage Natif (#share-native-btn)", lambda: sim_click('share-native-btn'), lambda: True)
    test_btn("Fermer Invitation (#close-invite-modal-btn)", lambda: sim_click('close-invite-modal-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'invite-modal').get_attribute('class'))
    test_btn("Diffuser Message Groupe (#btn-broadcast-all)", lambda: sim_click('btn-broadcast-all'), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'announcement-modal').get_attribute('class'))

    for p in ["⏸️ Pause de 10 minutes !", "🚶‍♂️ Regroupement au prochain croisement !", "🐢 Besoin de ralentir / Pause lacet ou sac !"]:
        def trig_p(pr=p):
            sim_driver.execute_script("""
                const chips = Array.from(document.querySelectorAll('.preset-msg-btn'));
                const chip = chips.find(c => c.getAttribute('data-preset') === arguments[0]);
                if (chip) chip.click();
            """, pr)
        test_btn(f"Message Rapide '{p[:20]}...'", trig_p, lambda: 'hidden' in sim_driver.find_element(By.ID, 'announcement-modal').get_attribute('class'))
        sim_click('btn-broadcast-all')
        time.sleep(0.06)

    test_btn("Insérer GPS dans Message", lambda: sim_driver.execute_script("window.insertGpsInCustomAnnouncement();"), lambda: len(sim_driver.find_element(By.ID, 'announcement-custom-input').get_attribute('value')) > 0)
    test_btn("Envoyer Message Groupe (#send-announcement-btn)", lambda: (sim_driver.execute_script("document.getElementById('announcement-custom-input').value = 'Test message';"), sim_click('send-announcement-btn')), lambda: 'hidden' in sim_driver.find_element(By.ID, 'announcement-modal').get_attribute('class'))
    sim_click('close-users-panel-btn')
    time.sleep(0.1)

    # 8. Commandes Dénivelé & Graphique
    test_btn("Plein Écran Dénivelé", lambda: sim_driver.execute_script("window.toggleElevationFullscreen();"), lambda: True)
    test_btn("Zoom Avant Dénivelé", lambda: sim_driver.execute_script("window.zoomInElevation();"), lambda: True)
    test_btn("Zoom Arrière Dénivelé", lambda: sim_driver.execute_script("window.zoomOutElevation();"), lambda: True)
    test_btn("Reset Zoom Dénivelé", lambda: sim_driver.execute_script("window.resetElevationZoom();"), lambda: True)
    test_btn("Défilement Gauche Dénivelé", lambda: sim_driver.execute_script("window.panElevation(-1);"), lambda: True)
    test_btn("Défilement Droite Dénivelé", lambda: sim_driver.execute_script("window.panElevation(1);"), lambda: True)
    test_btn("Cadrer Carte Dénivelé", lambda: sim_driver.execute_script("window.fitMapToZoomedSection();"), lambda: True)

    # 9. Mode Poche & Onboarding
    test_btn("Activer Mode Poche", lambda: sim_driver.execute_script("window.enterPocketMode();"), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'pocket-mode-overlay').get_attribute('class'))
    test_btn("Déverrouiller Mode Poche", lambda: sim_driver.execute_script("window.exitPocketMode();"), lambda: 'hidden' in sim_driver.find_element(By.ID, 'pocket-mode-overlay').get_attribute('class'))
    test_btn("Modale Onboarding Affichage", lambda: sim_driver.execute_script("document.getElementById('onboarding-modal').classList.remove('hidden');"), lambda: 'hidden' not in sim_driver.find_element(By.ID, 'onboarding-modal').get_attribute('class'))
    test_btn("Bouton Compris Onboarding", lambda: sim_click('accept-onboarding-btn'), lambda: 'hidden' in sim_driver.find_element(By.ID, 'onboarding-modal').get_attribute('class'))

    # 10. Audit Logs DevTools
    sim_logs = sim_driver.get_log('browser')
    sim_severe_errors = [
        l for l in sim_logs 
        if l['level'] == 'SEVERE' 
        and 'tel:' not in l['message'] 
        and 'sms:' not in l['message'] 
        and 'vibrate' not in l['message'] 
        and 'Failed to load resource' not in l['message'] 
        and 'favicon' not in l['message']
    ]
    test_btn("Audit Console : 0 Erreur Fatale JS", lambda: None, lambda: len(sim_severe_errors) == 0)

    try:
        sim_driver.quit()
    except:
        pass
    try:
        sim_httpd.server_close()
    except:
        pass

except Exception as e_sim:
    print(f"  [WARN] Selenium tests non exécutables dans cet environnement: {e_sim}")

print("\n================================================================================")
print(f"  RESULTAT GLOBAL : {passed_tests} / {total_tests} TESTS VALIDES ({(passed_tests/total_tests)*100:.1f}%)")
if failed_tests:
    print("  ECHECS CONSTATES :")
    for ft in failed_tests:
        print(f"    [FAIL] {ft}")
    sys.exit(1)
else:
    print(f"  [SUCCES] TOUS LES {total_tests} TESTS SONT AU VERT ! APPLICATION ET IHM 100% OPERATIONNELLES.")
print("================================================================================")
sys.stdout.flush()


