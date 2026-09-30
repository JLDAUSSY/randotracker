/**
 * RandoTracker v20 - Application Mobile PWA de Randonnée & Suivi Multi-Marcheurs
 * Cartes Officielles IGN Géoplateforme (France) & IGN España (MTN Topo 1:25k),
 * Version Organisateur (Privilèges GPX, Invitations, Purge) & Mode Invité Simplifié,
 * Auto-Commutation Intelligente selon la Géolocalisation & Coordonnées GPX,
 * Multi-Traces GPX (jusqu'à 5), Calcul Automatique de Progression & ETA.
 */

// ============================================================================
// CONFIGURATION & CONSTANTES
// ============================================================================
const MAX_TRACKS = 5;
const MAX_USERS = 10;
const ABSOLUTE_MAX_HOURS = 24; // Limite stricte maximale de 24 heures
const MAX_POINTS_PER_TRACK = 2500; // Optimisation pour fluidité 60fps sur mobile

const TRACK_COLORS = [
  { name: 'Vert Émeraude', hex: '#10b981', border: '#059669', bgClass: 'bg-emerald-500' },
  { name: 'Bleu Azur', hex: '#3b82f6', border: '#2563eb', bgClass: 'bg-blue-500' },
  { name: 'Rouge Corail', hex: '#ef4444', border: '#dc2626', bgClass: 'bg-red-500' },
  { name: 'Orange Ambré', hex: '#f59e0b', border: '#d97706', bgClass: 'bg-amber-500' },
  { name: 'Violet Améthyste', hex: '#8b5cf6', border: '#7c3aed', bgClass: 'bg-purple-500' }
];

// ============================================================================
// IDENTIFIANT UNIQUE PERSISTANT DE L'UTILISATEUR
// ============================================================================
function getOrCreateUserId() {
  try {
    let uid = localStorage.getItem('rando_user_id');
    if (!uid) {
      uid = 'u_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('rando_user_id', uid);
    }
    return uid;
  } catch (e) {
    return 'u_' + Math.random().toString(36).substr(2, 9);
  }
}

// ============================================================================
// ÉTAT GLOBAL DE L'APPLICATION
// ============================================================================
const state = {
  map: null,
  activeLayerName: 'ign',
  layers: {},
  tracks: [],
  roomCode: 'RANDO-2026',
  isOrganizer: true, // true pour l'Organisateur (Jean-Luc), false pour les Invités
  myUser: {
    id: getOrCreateUserId(),
    name: 'Jean-Luc',
    role: 'Guide de tête',
    icon: '🌲',
    color: '#059669',
    assignedTrackId: 'auto', // 'auto' ou l'ID d'une trace GPX
    lat: 45.8920,
    lon: 6.1550,
    ele: 450,
    speed: 0.0,
    battery: 95,
    isSos: false,
    lastSeen: Date.now()
  },
  shareDurationHours: 8, // Par défaut 8h, max 24h
  gpsStartTime: null,
  expiryCheckInterval: null,
  otherUsers: new Map(),
  userMarkers: new Map(),
  trackLayers: new Map(),
  chartInstance: null,
  isTrackingGps: false,
  gpsWatchId: null,
  accuracyCircle: null,
  ws: null,
  broadcastChannel: null,
  peer: null,
  peerConnections: new Map(),
  hoverMarker: null,
  activeDrawer: null,
  hasAutoCenteredGps: false,
  hasAutoDetectedGpsCountry: false
};

// ============================================================================
// NOTIFICATIONS TOAST HAUTE VISIBILITÉ
// ============================================================================
function showToast(msg, type = 'info') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800';
  toast.className = `fixed top-24 left-1/2 -translate-x-1/2 z-50 ${bgColor} text-white text-sm sm:text-base font-black px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-3 transition-all duration-300 transform translate-y-0 max-w-[90vw]`;
  toast.innerHTML = `
    <span class="text-xl">${type === 'success' ? '📍' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span class="truncate">${msg}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ============================================================================
// MOTEUR DE CALCUL : PROGRESSION SUR LA TRACE GPX & ESTIMATION DE L'ETA
// ============================================================================
function computeTrackProgress(user) {
  if (!state.tracks || state.tracks.length === 0) {
    return null;
  }

  // 1. Déterminer la trace suivie
  let track = null;
  if (user.assignedTrackId && user.assignedTrackId !== 'auto') {
    track = state.tracks.find(t => t.id === user.assignedTrackId);
  }

  // Si pas de trace définie ou 'auto', trouver la trace la plus proche
  if (!track) {
    let minDistanceToAnyTrack = Infinity;
    state.tracks.forEach(t => {
      if (t.points && t.points.length > 0) {
        for (let i = 0; i < t.points.length; i += 4) {
          const pt = t.points[i];
          const dist = calculateDistance(user.lat, user.lon, pt.lat, pt.lon);
          if (dist < minDistanceToAnyTrack) {
            minDistanceToAnyTrack = dist;
            track = t;
          }
        }
      }
    });
  }

  if (!track || !track.points || track.points.length === 0) {
    return null;
  }

  // 2. Trouver le point le plus proche sur la trace
  let closestIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i < track.points.length; i++) {
    const pt = track.points[i];
    const dist = calculateDistance(user.lat, user.lon, pt.lat, pt.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  const closestPt = track.points[closestIndex];
  const distFromStart = closestPt.distanceFromStart || 0;
  const totalDist = track.totalDistance || 1;
  const remainingDist = Math.max(0, totalDist - distFromStart);
  const progressPct = Math.min(100, Math.max(0, Math.round((distFromStart / totalDist) * 100)));

  // 3. Calcul du dénivelé positif restant (D+ restant)
  let remainingEleGain = 0;
  for (let i = closestIndex; i < track.points.length - 1; i++) {
    const diff = (track.points[i + 1].ele || 0) - (track.points[i].ele || 0);
    if (diff > 0.5) remainingEleGain += diff;
  }
  remainingEleGain = Math.round(remainingEleGain);

  // 4. Calcul de la vitesse de marche et du temps restant (Formule Suisse / FFRando)
  let walkingSpeed = 4.0;
  if (user.speed && user.speed >= 2.0 && user.speed <= 12.0) {
    walkingSpeed = (user.speed * 0.6) + (4.0 * 0.4);
  }

  // Temps restant : (Distance à plat / Vitesse) + (D+ restant / 350m par heure)
  const timeFlatHours = remainingDist / walkingSpeed;
  const timeClimbHours = remainingEleGain / 350;
  const totalRemainingHours = timeFlatHours + timeClimbHours;
  const totalRemainingMs = totalRemainingHours * 3600 * 1000;

  // Formatage ETA
  const etaDate = new Date(Date.now() + totalRemainingMs);
  const etaHours = etaDate.getHours().toString().padStart(2, '0');
  const etaMins = etaDate.getMinutes().toString().padStart(2, '0');

  const durationMinTotal = Math.round(totalRemainingHours * 60);
  let durationStr = '';
  if (durationMinTotal < 60) {
    durationStr = `~${durationMinTotal} min`;
  } else {
    const h = Math.floor(durationMinTotal / 60);
    const m = durationMinTotal % 60;
    durationStr = `~${h}h${m.toString().padStart(2, '0')}`;
  }

  const etaShort = (progressPct >= 99 || remainingDist < 0.05) ? 'Arrivé' : `${etaHours}:${etaMins}`;
  let etaFormatted = `${etaHours}h${etaMins} (${durationStr})`;
  if (progressPct >= 99 || remainingDist < 0.05) {
    etaFormatted = '🏁 Arrivé';
  }

  return {
    trackId: track.id,
    trackName: track.name,
    trackColor: track.color ? track.color.hex : '#10b981',
    progressPct: progressPct,
    distFromStart: distFromStart,
    remainingDist: remainingDist,
    remainingEleGain: remainingEleGain,
    etaString: etaFormatted,
    etaShort: etaShort,
    walkingSpeed: walkingSpeed
  };
}

// ============================================================================
// PERSISTANCE DE LA RANDONNÉE (GPX GARDÉS EN MÉMOIRE JUSQU'À 8H / 24H)
// ============================================================================
function saveHikeSessionToStorage() {
  try {
    const sessionData = {
      savedAt: Date.now(),
      durationHours: state.shareDurationHours || 8,
      roomCode: state.roomCode,
      tracks: state.tracks.map(t => ({
        id: t.id,
        name: t.name,
        points: t.points,
        totalDistance: t.totalDistance,
        eleGain: t.eleGain,
        minEle: t.minEle,
        maxEle: t.maxEle,
        visible: t.visible,
        color: t.color
      }))
    };
    localStorage.setItem('rando_saved_session', JSON.stringify(sessionData));
  } catch (e) {
    console.warn('[Storage] Erreur sauvegarde session:', e);
  }
}

function loadHikeSessionFromStorage() {
  try {
    const savedStr = localStorage.getItem('rando_saved_session');
    if (!savedStr) return false;

    const sessionData = JSON.parse(savedStr);
    if (!sessionData || !Array.isArray(sessionData.tracks) || sessionData.tracks.length === 0) return false;

    // Filtrer et supprimer toute ancienne trace exemple
    const realTracks = sessionData.tracks.filter(t => t.id && !t.id.startsWith('track_sample_') && !t.name.includes('Exemple') && !t.name.includes('Boucle Découverte'));
    if (realTracks.length === 0) {
      localStorage.removeItem('rando_saved_session');
      return false;
    }

    const now = Date.now();
    const durationHours = sessionData.durationHours || 8;
    const maxAgeMs = durationHours * 3600 * 1000;

    if (now - sessionData.savedAt > maxAgeMs) {
      console.log('[Storage] Session de rando expirée (> ' + durationHours + 'h)');
      localStorage.removeItem('rando_saved_session');
      return false;
    }

    state.tracks = [];
    state.trackLayers.clear();

    realTracks.forEach(track => {
      state.tracks.push(track);
      renderTrackOnMap(track);
    });

    renderQuickTracksBar();
    fitAllTracks();

    // Auto-détection du pays de la trace restaurée
    if (state.tracks.length > 0 && state.tracks[0].points && state.tracks[0].points.length > 0) {
      const p0 = state.tracks[0].points[0];
      autoSelectMapLayerForCoords(p0.lat, p0.lon, 'gpx');
    }

    const remainingHours = Math.max(1, Math.ceil((sessionData.savedAt + maxAgeMs - now) / 3600000));
    showToast(`Randonnée restaurée : ${state.tracks.length} trace(s) (Valide encore ${remainingHours}h)`, 'success');
    return true;
  } catch (e) {
    console.warn('[Storage] Erreur chargement session:', e);
    return false;
  }
}

function saveOtherUsersToStorage() {
  try {
    const now = Date.now();
    // Conserver les participants de la rando jusqu'à 5 heures (pour traverser les zones blanches)
    const activeUsersArr = Array.from(state.otherUsers.values()).filter(u => (now - (u.lastSeen || 0)) < 5 * 3600 * 1000);
    localStorage.setItem('rando_saved_other_users', JSON.stringify({
      savedAt: now,
      roomCode: state.roomCode,
      users: activeUsersArr
    }));
  } catch (e) {
    console.warn('[Storage] Erreur sauvegarde participants:', e);
  }
}

function loadSavedOtherUsersFromStorage() {
  try {
    const str = localStorage.getItem('rando_saved_other_users');
    if (!str) return false;
    const data = JSON.parse(str);
    if (!data || data.roomCode !== state.roomCode || !Array.isArray(data.users)) return false;

    // Restaurer les participants de la session de moins de 5 heures
    const now = Date.now();
    const maxFreshnessMs = 5 * 3600 * 1000;
    let loadedCount = 0;

    data.users.forEach(u => {
      if (u && u.id && u.id !== state.myUser.id && (now - (u.lastSeen || 0) < maxFreshnessMs)) {
        state.otherUsers.set(u.id, u);
        createOrUpdateUserMarker(u);
        loadedCount++;
      }
    });

    if (loadedCount > 0) {
      renderUsersList();
      return true;
    }
  } catch (e) {
    console.warn('[Storage] Erreur chargement participants:', e);
  }
  return false;
}

function clearHikeSession() {
  if (!confirm('Voulez-vous réinitialiser la randonnée ?\nCela effacera toutes les traces GPX et réinitialisera la liste des participants pour démarrer une nouvelle randonnée.')) return;

  // 1. Effacer toutes les traces de la carte et de l'état
  state.tracks.forEach(t => {
    const l = state.trackLayers.get(t.id);
    if (l) state.map.removeLayer(l);
  });
  state.tracks = [];
  state.trackLayers.clear();
  state.myUser.assignedTrackId = 'auto';

  // 2. Effacer tous les autres participants de la carte et de la liste (sauf Moi)
  state.otherUsers.forEach((u, id) => {
    removeUserMarker(id);
  });
  state.otherUsers.clear();

  // 3. Purger les stockages locaux (traces et anciens participants)
  localStorage.removeItem('rando_saved_session');
  localStorage.removeItem('rando_saved_other_users');

  // 4. Mettre à jour l'interface
  renderQuickTracksBar();
  renderUsersList();
  updateProfileUI();
  showToast('Randonnée et participants réinitialisés !', 'info');

  // 5. Diffuser le signal de réinitialisation à tous les participants du salon
  publishMessage({
    type: 'reset_session',
    from: state.myUser.id
  });
  publishMessage({
    type: 'clear_tracks',
    from: state.myUser.id
  });
}

function clearOnlyParticipants() {
  if (state.otherUsers.size === 0) {
    showToast('Aucun autre participant dans le salon.', 'info');
    return;
  }
  const count = state.otherUsers.size;
  if (!confirm(`Voulez-vous supprimer les ${count} autre(s) participant(s) de votre carte ?\n(Vos traces GPX seront conservées).`)) return;

  // 1. Effacer tous les autres participants de la carte et de la liste (sauf Moi)
  state.otherUsers.forEach((u, id) => {
    removeUserMarker(id);
  });
  state.otherUsers.clear();

  // 2. Purger le stockage local des participants
  localStorage.removeItem('rando_saved_other_users');

  // 3. Mettre à jour l'affichage
  renderUsersList();
  showToast(`${count} participant(s) purgé(s).`, 'info');

  // 4. Diffuser l'ordre de purge aux autres téléphones
  publishMessage({
    type: 'kick_all',
    from: state.myUser.id
  });
}

function deleteParticipant(userId) {
  const user = state.otherUsers.get(userId);
  const userName = user ? user.name : 'ce marcheur';

  if (!confirm(`Voulez-vous vraiment supprimer ${userName} de la session et de la carte ?`)) {
    return;
  }

  // 1. Fermer le popup de la carte s'il est ouvert
  if (state.map) {
    state.map.closePopup();
  }

  // 2. Supprimer le marqueur de la carte et de la collection
  removeUserMarker(userId);
  state.otherUsers.delete(userId);

  // 3. Mettre à jour le stockage local persistant
  saveOtherUsersToStorage();

  // 4. Mettre à jour l'interface utilisateur
  renderUsersList();
  showToast(`Participant ${userName} supprimé de la session.`, 'info');

  // 5. Diffuser l'exclusion aux autres téléphones du groupe
  publishMessage({
    type: 'kick_user',
    targetUserId: userId,
    from: state.myUser.id
  });
}

// ============================================================================
// GESTION DES RÔLES : ORGANISATEUR vs INVITÉ / MARCHEUR
// ============================================================================
function initUserRole() {
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  
  if (roleParam === 'guest' || roleParam === 'viewer') {
    state.isOrganizer = false;
    localStorage.setItem('rando_is_organizer', 'false');
    const savedName = localStorage.getItem('rando_user_name');
    if (!savedName || savedName === 'Jean-Luc') {
      state.myUser.name = 'Invité';
      state.myUser.role = 'Randonneur';
      state.myUser.icon = '🥾';
      state.myUser.color = '#2563eb';
      localStorage.setItem('rando_user_name', 'Invité');
      localStorage.setItem('rando_user_role', 'Randonneur');
      localStorage.setItem('rando_user_icon', '🥾');
      localStorage.setItem('rando_user_color', '#2563eb');
    }
  } else if (roleParam === 'organizer' || roleParam === 'admin') {
    state.isOrganizer = true;
    localStorage.setItem('rando_is_organizer', 'true');
  } else {
    const saved = localStorage.getItem('rando_is_organizer');
    state.isOrganizer = (saved !== 'false');
  }

  applyRoleUI();
}

function applyRoleUI() {
  const headerInvite = document.getElementById('header-invite-btn');
  const drawerAdminActions = document.getElementById('drawer-admin-actions');
  const navBtnGpx = document.getElementById('nav-btn-gpx');
  const navBtnEle = document.getElementById('nav-btn-ele');

  if (headerInvite) {
    if (state.isOrganizer) headerInvite.classList.remove('hidden');
    else headerInvite.classList.add('hidden');
  }

  if (drawerAdminActions) {
    if (state.isOrganizer) drawerAdminActions.classList.remove('hidden');
    else drawerAdminActions.classList.add('hidden');
  }

  if (navBtnGpx && navBtnEle) {
    if (state.isOrganizer) {
      navBtnGpx.classList.remove('hidden');
      navBtnEle.classList.add('hidden');
    } else {
      navBtnGpx.classList.add('hidden');
      navBtnEle.classList.remove('hidden');
    }
  }

  // Mettre à jour les marqueurs sur la carte et la liste
  state.otherUsers.forEach(u => createOrUpdateUserMarker(u));
  renderUsersList();
  renderQuickTracksBar();
}

function openGuestTrackView() {
  if (state.tracks.length > 0) {
    fitAllTracks();
    openElevationDrawer(state.tracks[0].id);
  } else {
    showToast('En attente de la transmission des traces du guide...', 'info');
  }
}

// ============================================================================
// GESTION DU PROFIL UTILISATEUR & PERSISTANCE LOCALSTORAGE
// ============================================================================
function loadUserProfile() {
  const savedName = localStorage.getItem('rando_user_name');
  const savedRole = localStorage.getItem('rando_user_role');
  const savedIcon = localStorage.getItem('rando_user_icon');
  const savedColor = localStorage.getItem('rando_user_color');
  const savedTrack = localStorage.getItem('rando_user_track');
  const savedDuration = localStorage.getItem('rando_share_duration');

  if (savedName) {
    state.myUser.name = savedName;
  } else {
    state.myUser.name = state.isOrganizer ? 'Jean-Luc' : 'Invité';
    localStorage.setItem('rando_user_name', state.myUser.name);
  }

  if (savedRole) {
    state.myUser.role = savedRole;
  } else {
    state.myUser.role = state.isOrganizer ? 'Guide de tête' : 'Randonneur';
  }

  if (savedIcon) state.myUser.icon = savedIcon;
  if (savedColor) state.myUser.color = savedColor;
  
  if (savedTrack && !savedTrack.startsWith('track_sample_')) {
    state.myUser.assignedTrackId = savedTrack;
  } else {
    state.myUser.assignedTrackId = 'auto';
    localStorage.setItem('rando_user_track', 'auto');
  }

  if (savedDuration) {
    const d = parseFloat(savedDuration);
    state.shareDurationHours = Math.min(ABSOLUTE_MAX_HOURS, Math.max(1, isNaN(d) ? 8 : d));
  }

  updateProfileUI();
}

function updateProfileUI() {
  const headerBadge = document.getElementById('header-avatar-badge');
  if (headerBadge) {
    headerBadge.textContent = state.myUser.icon;
    headerBadge.style.backgroundColor = state.myUser.color;
  }

  const myName = document.getElementById('my-name-display');
  const myRole = document.getElementById('my-role-display');
  const myAvatar = document.getElementById('my-avatar-display');

  if (myName) myName.textContent = state.myUser.name;
  if (myRole) myRole.textContent = state.myUser.role;
  if (myAvatar) {
    myAvatar.textContent = state.myUser.icon;
    myAvatar.style.backgroundColor = state.myUser.color;
  }

  const inputName = document.getElementById('input-user-name');
  const inputRole = document.getElementById('input-user-role');
  const inputDuration = document.getElementById('input-share-duration');
  const inputTrack = document.getElementById('input-user-track');
  const orgToggle = document.getElementById('toggle-organizer-mode');

  if (inputName) inputName.value = state.myUser.name;
  if (inputRole) inputRole.value = state.myUser.role;
  if (inputDuration) inputDuration.value = String(state.shareDurationHours);
  if (orgToggle) orgToggle.checked = state.isOrganizer;

  // Mettre à jour la liste des traces disponibles dans le sélecteur
  if (inputTrack) {
    let optionsHtml = '<option value="auto">🎯 Automatique (Trace la plus proche)</option>';
    state.tracks.forEach(t => {
      optionsHtml += `<option value="${t.id}">${t.name} (${t.totalDistance.toFixed(1)} km)</option>`;
    });
    inputTrack.innerHTML = optionsHtml;
    inputTrack.value = state.myUser.assignedTrackId || 'auto';
  }

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    const isSelected = btn.getAttribute('data-icon') === state.myUser.icon;
    if (isSelected) {
      btn.classList.add('border-white', 'scale-110');
      btn.classList.remove('border-transparent');
    } else {
      btn.classList.remove('border-white', 'scale-110');
      btn.classList.add('border-transparent');
    }
  });
}

function saveUserProfile() {
  const name = document.getElementById('input-user-name').value.trim();
  const role = document.getElementById('input-user-role').value;
  const duration = parseFloat(document.getElementById('input-share-duration').value);
  const trackId = document.getElementById('input-user-track').value;
  const orgToggle = document.getElementById('toggle-organizer-mode');

  if (name) state.myUser.name = name;
  if (role) state.myUser.role = role;
  state.myUser.assignedTrackId = trackId || 'auto';
  state.shareDurationHours = Math.min(ABSOLUTE_MAX_HOURS, Math.max(1, isNaN(duration) ? 8 : duration));

  if (orgToggle) {
    const wasOrganizer = state.isOrganizer;
    state.isOrganizer = orgToggle.checked;
    localStorage.setItem('rando_is_organizer', state.isOrganizer ? 'true' : 'false');
    if (wasOrganizer !== state.isOrganizer) {
      applyRoleUI();
    }
  }

  localStorage.setItem('rando_user_name', state.myUser.name);
  localStorage.setItem('rando_user_role', state.myUser.role);
  localStorage.setItem('rando_user_icon', state.myUser.icon);
  localStorage.setItem('rando_user_color', state.myUser.color);
  localStorage.setItem('rando_user_track', state.myUser.assignedTrackId);
  localStorage.setItem('rando_share_duration', String(state.shareDurationHours));

  updateProfileUI();
  saveHikeSessionToStorage();
  document.getElementById('profile-modal').classList.add('hidden');
  broadcastMyPosition();
  showToast(`Profil enregistré : ${state.myUser.name} (${state.myUser.icon})`, 'success');
}

// ============================================================================
// SERVICE WORKER & PWA
// ============================================================================
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=29')
      .then((reg) => {
        console.log('[PWA] Service Worker v29 actif:', reg.scope);
        // Forcer la vérification immédiate des mises à jour
        if (reg.update) reg.update();
      })
      .catch((err) => console.log('[PWA] Erreur Service Worker:', err));
  }

  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      state.myUser.battery = Math.round(battery.level * 100);
      battery.addEventListener('levelchange', () => {
        state.myUser.battery = Math.round(battery.level * 100);
        broadcastMyPosition();
      });
    }).catch(() => {});
  }
}

// ============================================================================
// INITIALISATION DE LA CARTE AVEC MOTEUR CANVAS ULTRA-RAPIDE
// ============================================================================
function initMap() {
  const savedLat = parseFloat(localStorage.getItem('rando_last_lat'));
  const savedLon = parseFloat(localStorage.getItem('rando_last_lon'));
  const hasSavedPos = !isNaN(savedLat) && !isNaN(savedLon);
  const initialCenter = hasSavedPos ? [savedLat, savedLon] : [45.8960, 6.1680];
  const initialZoom = hasSavedPos ? 14 : 13;

  state.map = L.map('map', {
    center: initialCenter,
    zoom: initialZoom,
    zoomControl: false,
    preferCanvas: true,
    fadeAnimation: true
  });

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  // 1. Fond IGN Géoplateforme (Plan IGN V2 France) - Optimisé
  state.layers.ign = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.ign.fr/" target="_blank">IGN France</a>',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  // 2. Fond IGN España (MTN Topographique 1:25 000 / CNIG Espagne) - Optimisé
  state.layers.ign_es = L.tileLayer(
    'https://www.ign.es/wmts/mapa-raster?service=WMTS&request=GetTile&version=1.0.0&layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/jpeg',
    {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.ign.es/" target="_blank">IGN España / CNIG</a>',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  // 3. Fond OpenTopoMap (Courbes de niveau & Sentiers Monde) - Optimisé
  state.layers.opentopo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap',
      subdomains: 'abc',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  // 4. Fond IGN Orthophoto (Photos Aériennes Satellite) - Optimisé
  state.layers.satellite = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; IGN Satellite',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  // 5. Fond OpenStreetMap standard - Optimisé
  state.layers.osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  state.layers.ign.addTo(state.map);

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 200);

  // Rafraîchir les icônes à l'ouverture des fenêtres popups de la carte
  state.map.on('popupopen', () => {
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  });

  // Support Glisser-Déposer direct de fichiers GPX sur la carte
  const mapDiv = document.getElementById('map');
  mapDiv.addEventListener('dragover', (e) => e.preventDefault());
  mapDiv.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    let added = 0;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.gpx')) {
        try {
          const text = await file.text();
          const parsed = parseGpxContent(text, file.name);
          addTrackToState(parsed);
          added++;
        } catch (err) {
          showToast(`Erreur GPX : ${err.message}`, 'error');
        }
      }
    }
    if (added > 0) {
      saveHikeSessionToStorage();
      fitAllTracks();
    }
  });
}

function setBaseLayer(layerKey) {
  if (!state.layers[layerKey]) return;

  if (state.layers[state.activeLayerName]) {
    state.map.removeLayer(state.layers[state.activeLayerName]);
  }

  state.layers[layerKey].addTo(state.map);
  state.activeLayerName = layerKey;

  const names = {
    ign: 'IGN France',
    ign_es: 'IGN España',
    opentopo: 'OpenTopoMap',
    satellite: 'IGN Satellite',
    osm: 'OSM Standard'
  };

  const label = document.getElementById('active-layer-label');
  if (label) label.textContent = names[layerKey] || 'Fond de Carte';

  document.querySelectorAll('.layer-opt-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-layer') === layerKey;
    const check = btn.querySelector('.layer-check');
    if (isThis) {
      btn.classList.add('border-emerald-500', 'bg-emerald-600/25');
      btn.classList.remove('border-slate-700', 'bg-slate-800');
      if (check) check.classList.remove('hidden');
    } else {
      btn.classList.remove('border-emerald-500', 'bg-emerald-600/25');
      btn.classList.add('border-slate-700', 'bg-slate-800');
      if (check) check.classList.add('hidden');
    }
  });
}

// ============================================================================
// AUTO-DÉTECTION DU PAYS ET COMMUTATION INTELLIGENTE DU FOND DE CARTE
// ============================================================================
function detectCountry(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return 'FR';
  }

  // 1. ESPAGNE (ES)
  // Îles Canaries
  if (lat >= 27.0 && lat <= 29.8 && lon >= -18.5 && lon <= -13.0) return 'ES';
  // Îles Baléares (Majorque, Minorque, Ibiza, Formentera)
  if (lat >= 38.5 && lat <= 40.5 && lon >= 1.0 && lon <= 4.6) return 'ES';
  // Espagne Nord-Ouest (Galice, Asturies, Cantabrie)
  if (lat >= 41.8 && lat <= 43.9 && lon >= -9.5 && lon <= -1.8) return 'ES';
  // Espagne Nord-Est / Pyrénées espagnoles (Aragon, Catalogne, Navarre)
  if (lat >= 40.0 && lat <= 42.85 && lon >= -1.8 && lon <= 3.4) return 'ES';
  // Reste de l'Espagne continentale
  if (lat >= 35.8 && lat <= 42.0 && lon >= -9.5 && lon <= 3.5) {
    if (lon < -6.8 && lat >= 37.0 && lat <= 42.0) return 'OTHER'; // Portugal
    return 'ES';
  }

  // 2. FRANCE (FR)
  // DROM-COM
  if (lat >= -21.5 && lat <= -20.8 && lon >= 55.1 && lon <= 56.0) return 'FR'; // La Réunion
  if (lat >= 15.8 && lat <= 16.6 && lon >= -61.9 && lon <= -61.0) return 'FR'; // Guadeloupe
  if (lat >= 14.3 && lat <= 14.9 && lon >= -61.3 && lon <= -60.7) return 'FR'; // Martinique
  if (lat >= 2.0 && lat <= 6.0 && lon >= -55.0 && lon <= -51.0) return 'FR';   // Guyane
  if (lat >= -13.1 && lat <= -12.5 && lon >= 45.0 && lon <= 45.4) return 'FR'; // Mayotte
  // Corse
  if (lat >= 41.3 && lat <= 43.1 && lon >= 8.5 && lon <= 9.6) return 'FR';
  // France Métropolitaine (avec exclusion fine des Alpes suisses/italiennes)
  if (lat >= 42.3 && lat <= 51.2 && lon >= -5.2 && lon <= 8.3) {
    if ((lat >= 45.8 && lon >= 7.1) || (lat >= 46.2 && lon >= 6.2)) {
      return 'OTHER';
    }
    return 'FR';
  }

  return 'OTHER';
}

function autoSelectMapLayerForCoords(lat, lon, reason = 'gps') {
  const country = detectCountry(lat, lon);
  const current = state.activeLayerName;

  if (country === 'ES') {
    if (current !== 'ign_es' && current !== 'satellite') {
      setBaseLayer('ign_es');
      const prefix = reason === 'gpx' ? '🇪🇸 Trace en Espagne' : '🇪🇸 Position en Espagne';
      showToast(`${prefix} : Fond IGN España (MTN Topo) activé`, 'info');
    }
  } else if (country === 'FR') {
    if (current === 'ign_es') {
      setBaseLayer('ign');
      const prefix = reason === 'gpx' ? '🇫🇷 Trace en France' : '🇫🇷 Position en France';
      showToast(`${prefix} : Fond IGN France activé`, 'info');
    }
  } else {
    // Zone internationale (Suisse, Italie, etc.)
    if (current === 'ign' || current === 'ign_es') {
      setBaseLayer('opentopo');
      const prefix = reason === 'gpx' ? '🏔️ Trace internationale' : '🏔️ Position internationale';
      showToast(`${prefix} : Fond OpenTopoMap activé`, 'info');
    }
  }
}

// ============================================================================
// CALCULS GÉODÉSIQUES & PARSING GPX OPTIMISÉ
// ============================================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseGpxContent(xmlText, fileName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  let name = fileName.replace(/\.gpx$/i, '');
  const nameNode = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('metadata > name');
  if (nameNode && nameNode.textContent.trim()) {
    name = nameNode.textContent.trim();
  }

  const trkpts = xmlDoc.querySelectorAll('trkpt, rtept');
  if (trkpts.length === 0) {
    throw new Error('Aucun point de trace (<trkpt> ou <rtept>) trouvé dans ce fichier GPX.');
  }

  const totalRawPts = trkpts.length;
  const stepRatio = totalRawPts > MAX_POINTS_PER_TRACK ? Math.ceil(totalRawPts / MAX_POINTS_PER_TRACK) : 1;

  const rawPoints = [];
  let totalDistance = 0;
  let eleGain = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;

  let prevLat = null;
  let prevLon = null;
  let prevEle = null;

  for (let i = 0; i < totalRawPts; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const eleNode = pt.querySelector('ele');
    const ele = eleNode ? parseFloat(eleNode.textContent) : 0;

    if (!isNaN(lat) && !isNaN(lon)) {
      if (prevLat !== null && prevLon !== null) {
        const dist = calculateDistance(prevLat, prevLon, lat, lon);
        totalDistance += dist;
        if (eleNode && prevEle !== null) {
          const diff = ele - prevEle;
          if (diff > 0.5) eleGain += diff;
        }
      }

      if (eleNode && !isNaN(ele)) {
        if (ele < minEle) minEle = ele;
        if (ele > maxEle) maxEle = ele;
      }

      if (i === 0 || i === (totalRawPts - 1) || (i % stepRatio === 0)) {
        rawPoints.push({
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
          ele: Math.round(ele),
          distanceFromStart: Number(totalDistance.toFixed(2))
        });
      }

      prevLat = lat;
      prevLon = lon;
      prevEle = ele;
    }
  }

  return {
    id: 'track_' + Math.random().toString(36).substr(2, 9),
    name: name,
    points: rawPoints,
    totalDistance: totalDistance,
    eleGain: Math.round(eleGain),
    minEle: minEle === Infinity ? 0 : Math.round(minEle),
    maxEle: maxEle === -Infinity ? 0 : Math.round(maxEle),
    visible: true
  };
}

// ============================================================================
// GESTION DES JUSQU'À 5 TRACES GPX
// ============================================================================
function addTrackToState(track) {
  if (state.tracks.length >= MAX_TRACKS) {
    alert(`Limite de ${MAX_TRACKS} traces atteinte. Supprimez une trace pour en ajouter une autre.`);
    return false;
  }

  const colorIndex = state.tracks.length % TRACK_COLORS.length;
  track.color = TRACK_COLORS[colorIndex];

  state.tracks.push(track);
  renderTrackOnMap(track);
  renderQuickTracksBar();
  fitAllTracks();
  saveHikeSessionToStorage();
  updateProfileUI(); // Met à jour le sélecteur de trace

  // Auto-détection du pays de la trace GPX
  if (track.points && track.points.length > 0) {
    const p0 = track.points[0];
    autoSelectMapLayerForCoords(p0.lat, p0.lon, 'gpx');
  }

  showToast(`Trace ajoutée : ${track.name} (${track.totalDistance.toFixed(1)} km)`, 'success');

  // Synchroniser immédiatement la trace avec tous les invités du salon
  publishMessage({
    type: 'sync_tracks',
    from: state.myUser.id,
    tracks: state.tracks
  });

  return true;
}

function renderTrackOnMap(track) {
  const layerGroup = L.layerGroup();
  const latlngs = track.points.map(p => [p.lat, p.lon]);

  const borderPolyline = L.polyline(latlngs, {
    color: '#0f172a',
    weight: 8,
    opacity: 0.85,
    smoothFactor: 1.2,
    lineCap: 'round',
    lineJoin: 'round'
  });

  const mainPolyline = L.polyline(latlngs, {
    color: track.color.hex,
    weight: 5,
    opacity: 0.98,
    smoothFactor: 1.2,
    lineCap: 'round',
    lineJoin: 'round'
  });

  mainPolyline.bindPopup(`
    <div class="space-y-2.5 p-1 min-w-[220px]">
      <div class="flex items-center gap-2.5">
        <span class="w-4 h-4 rounded-full shadow" style="background-color: ${track.color.hex}"></span>
        <h4 class="font-black text-base text-white">${track.name}</h4>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm text-slate-200 pt-2 border-t border-slate-700">
        <div>Distance : <b class="text-white">${track.totalDistance.toFixed(1)} km</b></div>
        <div>Dénivelé + : <b class="text-emerald-400">+${track.eleGain} m</b></div>
        <div>Alt. Min : <b class="text-white">${track.minEle} m</b></div>
        <div>Alt. Max : <b class="text-white">${track.maxEle} m</b></div>
      </div>
      <button onclick="openElevationDrawer('${track.id}')" class="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow">
        📈 Voir Profil Altimétrique
      </button>
    </div>
  `);

  layerGroup.addLayer(borderPolyline);
  layerGroup.addLayer(mainPolyline);

  // Marqueur Départ
  if (track.points.length > 0) {
    const startPt = track.points[0];
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: `<div class="w-9 h-9 rounded-full bg-emerald-500 border-3 border-white flex items-center justify-center text-xs font-black text-white shadow-xl">D</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon }).bindTooltip(`Départ : ${track.name}`, { direction: 'top' });
    layerGroup.addLayer(startMarker);
  }

  // Marqueur Arrivée
  if (track.points.length > 1) {
    const endPt = track.points[track.points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `<div class="w-9 h-9 rounded-full bg-slate-900 border-3 border-white flex items-center justify-center text-base font-black text-white shadow-xl">🏁</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    const endMarker = L.marker([endPt.lat, endPt.lon], { icon: endIcon }).bindTooltip(`Arrivée : ${track.name}`, { direction: 'top' });
    layerGroup.addLayer(endMarker);
  }

  if (track.visible) {
    layerGroup.addTo(state.map);
  }

  state.trackLayers.set(track.id, layerGroup);
}

// ============================================================================
// GESTIONNAIRE DES PARCOURS & TRACES GPX (MODALE & SÉLECTEUR HEADER)
// ============================================================================
function openTracksModal() {
  const modal = document.getElementById('tracks-modal');
  if (!modal) return;
  renderTracksModalContent();
  modal.classList.remove('hidden');
}

function closeTracksModal() {
  const modal = document.getElementById('tracks-modal');
  if (modal) modal.classList.add('hidden');
}

function renderQuickTracksBar() {
  // 1. Mettre à jour le sélecteur de trace compact dans le Header
  const headerDot = document.getElementById('header-track-dot');
  const headerLabel = document.getElementById('header-track-label');

  if (headerLabel && headerDot) {
    if (state.tracks.length === 0) {
      headerDot.style.backgroundColor = '#94a3b8';
      headerLabel.textContent = state.isOrganizer ? '+ Traces (0)' : 'Traces (0)';
    } else if (state.tracks.length === 1) {
      headerDot.style.backgroundColor = state.tracks[0].color.hex || '#10b981';
      headerLabel.textContent = `${state.tracks[0].name} (${state.tracks[0].totalDistance.toFixed(1)} km)`;
    } else {
      headerDot.style.backgroundColor = state.tracks[0].color.hex || '#10b981';
      headerLabel.textContent = `${state.tracks.length} Traces (${state.tracks[0].name}...)`;
    }
  }

  // 2. Mettre à jour le contenu de la modale de gestion des traces
  renderTracksModalContent();
}

function renderTracksModalContent() {
  const list = document.getElementById('tracks-modal-list');
  const countLabel = document.getElementById('tracks-modal-count-label');
  const adminActions = document.getElementById('tracks-modal-admin-actions');
  const clearBtn = document.getElementById('tracks-modal-clear-btn');

  if (countLabel) {
    countLabel.textContent = `${state.tracks.length} parcours chargé(s) (max ${MAX_TRACKS})`;
  }

  if (adminActions) {
    if (state.isOrganizer && state.tracks.length < MAX_TRACKS) {
      adminActions.classList.remove('hidden');
    } else {
      adminActions.classList.add('hidden');
    }
  }

  if (clearBtn) {
    if (state.isOrganizer && state.tracks.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  if (!list) return;

  if (state.tracks.length === 0) {
    list.innerHTML = `
      <div class="text-center py-8 px-4 bg-slate-800/60 rounded-3xl border border-slate-700/80 text-slate-300 text-sm flex flex-col items-center gap-3 shadow-inner">
        <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shadow-inner text-2xl">
          🗺️
        </div>
        <div>
          <div class="font-black text-white text-base">Aucun parcours GPX chargé</div>
          <div class="text-xs text-slate-400 mt-1 font-semibold">
            ${state.isOrganizer ? 'Chargez 1 à 5 fichiers GPX pour vos différents groupes de marcheurs.' : 'En attente de la transmission des parcours par le guide...'}
          </div>
        </div>
        ${state.isOrganizer ? `
          <label for="gpx-file-input" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition cursor-pointer">
            <i data-lucide="upload-cloud" class="w-5 h-5"></i>
            <span>📂 Charger un fichier GPX</span>
          </label>
        ` : ''}
      </div>
    `;
    lucide.createIcons();
    return;
  }

  list.innerHTML = state.tracks.map((track) => `
    <div class="track-card-item ${track.visible ? 'is-visible-track' : 'is-hidden-track'} p-4 shadow-xl flex flex-col gap-3">
      <!-- Ligne 1 : Nom, Couleur et Statut -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <span class="w-5 h-5 rounded-full border-2 border-white shrink-0 shadow-md" style="background-color: ${track.color.hex};"></span>
          <div class="min-w-0 flex-1">
            <div class="font-black text-white text-base truncate leading-tight">${track.name}</div>
            <div class="flex items-center gap-2 mt-1 text-xs">
              <span class="font-mono font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-lg">${track.totalDistance.toFixed(1)} km</span>
              <span class="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg">+${Math.round(track.eleGain || 0)}m D+</span>
            </div>
          </div>
        </div>

        <button onclick="toggleTrackVisibility('${track.id}')" class="px-3 py-1.5 rounded-xl ${track.visible ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700'} text-xs font-black transition active:scale-95 shrink-0" title="Afficher ou masquer cette trace sur la carte">
          ${track.visible ? '👁️ Visible' : '🙈 Masquée'}
        </button>
      </div>

      <!-- Ligne 2 : Actions Rapides -->
      <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
        <button onclick="zoomToTrack('${track.id}'); closeTracksModal();" class="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-blue-300 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition active:scale-95" title="Centrer la carte sur cette trace">
          <i data-lucide="maximize" class="w-4 h-4 text-blue-400"></i>
          <span>Centrer</span>
        </button>
        <button onclick="openElevationDrawer('${track.id}'); closeTracksModal();" class="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition active:scale-95" title="Voir le profil altimétrique">
          <i data-lucide="bar-chart-2" class="w-4 h-4 text-emerald-400"></i>
          <span>Dénivelé</span>
        </button>
        ${state.isOrganizer ? `
          <button onclick="removeTrack('${track.id}')" class="py-2 px-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 border border-red-500/40 transition active:scale-95" title="Supprimer cette trace">
            <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
            <span>Supprimer</span>
          </button>
        ` : `
          <button onclick="zoomToTrack('${track.id}'); closeTracksModal();" class="py-2 px-2 rounded-xl bg-slate-800/80 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700">
            <span>Trace active</span>
          </button>
        `}
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function toggleTrackVisibility(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  const layer = state.trackLayers.get(trackId);
  if (!track || !layer) return;

  track.visible = !track.visible;
  if (track.visible) {
    layer.addTo(state.map);
  } else {
    state.map.removeLayer(layer);
  }
  saveHikeSessionToStorage();
  renderQuickTracksBar();
}

function removeTrack(trackId) {
  const index = state.tracks.findIndex(t => t.id === trackId);
  if (index === -1) return;

  const layer = state.trackLayers.get(trackId);
  if (layer) {
    state.map.removeLayer(layer);
    state.trackLayers.delete(trackId);
  }

  state.tracks.splice(index, 1);
  saveHikeSessionToStorage();
  updateProfileUI();
  renderQuickTracksBar();
}

function zoomToTrack(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (!track || track.points.length === 0) return;

  const latlngs = track.points.map(p => [p.lat, p.lon]);
  const bounds = L.latLngBounds(latlngs);
  state.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
}

function fitAllTracks() {
  const allPoints = [];
  state.tracks.forEach(t => {
    if (t.visible) {
      t.points.forEach(p => allPoints.push([p.lat, p.lon]));
    }
  });

  if (allPoints.length > 0) {
    const bounds = L.latLngBounds(allPoints);
    state.map.fitBounds(bounds, { padding: [50, 50] });
  } else if (state.isTrackingGps) {
    state.map.setView([state.myUser.lat, state.myUser.lon], 15, { animate: true });
  }
}

// ============================================================================
// PROFIL ALTIMÉTRIQUE (Chart.js)
// ============================================================================
function openElevationDrawer(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (!track || track.points.length === 0) return;

  const drawer = document.getElementById('elevation-drawer');
  const title = document.getElementById('ele-drawer-title');
  const stats = document.getElementById('ele-drawer-stats');
  const colorDot = document.getElementById('ele-drawer-color');

  title.textContent = `${track.name}`;
  stats.textContent = `${track.totalDistance.toFixed(1)} km | +${track.eleGain}m D+`;
  colorDot.style.backgroundColor = track.color.hex;

  drawer.classList.remove('hidden');

  const labels = [];
  const elevationData = [];
  const step = Math.max(1, Math.floor(track.points.length / 100));

  for (let i = 0; i < track.points.length; i += step) {
    const pt = track.points[i];
    labels.push(pt.distanceFromStart.toFixed(1) + ' km');
    elevationData.push(pt.ele);
  }

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const ctx = document.getElementById('elevation-chart').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0, track.color.hex + 'bb');
  gradient.addColorStop(1, track.color.hex + '05');

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Altitude (m)',
        data: elevationData,
        borderColor: track.color.hex,
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: track.color.hex,
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          bodyFont: { weight: 'bold', size: 14 },
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => `Distance : ${items[0].label}`,
            label: (item) => `Altitude : ${Math.round(item.raw)} m`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' } }
        }
      },
      onHover: (event, activeElements) => {
        if (activeElements && activeElements.length > 0) {
          const index = activeElements[0].index * step;
          if (index < track.points.length) {
            const pt = track.points[index];
            updateHoverMapMarker(pt.lat, pt.lon);
          }
        }
      }
    }
  });
}

function updateHoverMapMarker(lat, lon) {
  if (!state.hoverMarker) {
    const icon = L.divIcon({
      className: 'hover-pin',
      html: '<div class="w-6 h-6 rounded-full bg-white border-4 border-emerald-500 shadow-2xl animate-ping"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    state.hoverMarker = L.marker([lat, lon], { icon: icon }).addTo(state.map);
  } else {
    state.hoverMarker.setLatLng([lat, lon]);
  }
}

// ============================================================================
// SUIVI DES RANDONNEURS SUR LA CARTE AVEC PROGRESSION & ETA
// ============================================================================
function createOrUpdateUserMarker(user) {
  let marker = state.userMarkers.get(user.id);
  const isMe = user.id === state.myUser.id;
  const now = Date.now();
  const timeSinceSeenMs = now - (user.lastSeen || now);
  const isZoneBlanche = !isMe && timeSinceSeenMs > 2 * 60 * 1000;
  const minSinceSeen = Math.round(timeSinceSeenMs / 60000);

  const sosClass = user.isSos ? 'is-sos' : '';
  const liveClass = (!user.isSos && !isZoneBlanche) ? 'is-live' : '';
  const roleBadge = user.role.includes('Guide') ? '👑' : user.role.includes('Serre-file') ? '🛡️' : '🥾';

  const html = `
    <div class="user-marker-pin" id="marker-${user.id}">
      <div class="user-avatar-bubble ${liveClass} ${sosClass}" style="background-color: ${user.color || '#059669'}; ${isZoneBlanche ? 'opacity: 0.85; filter: saturate(0.8);' : ''}">
        <span>${user.icon || '🌲'}</span>
      </div>
      <div class="user-label-tag" style="${isZoneBlanche ? 'border-color: #f59e0b; background: rgba(15,23,42,0.95);' : ''}">
        <span>${roleBadge}</span>
        <span>${user.name}</span>
        ${user.isSos ? '<span class="text-red-400 font-black ml-1 animate-pulse">SOS</span>' : ''}
        ${isZoneBlanche ? '<span class="text-[10px] text-amber-300 font-black ml-1">🌲 ' + minSinceSeen + 'm</span>' : ''}
      </div>
    </div>
  `;

  const customIcon = L.divIcon({
    className: 'custom-user-leaflet-icon',
    html: html,
    iconSize: [70, 90],
    iconAnchor: [35, 55],
    popupAnchor: [0, -55]
  });

  if (!marker) {
    marker = L.marker([user.lat, user.lon], { icon: customIcon }).addTo(state.map);
    state.userMarkers.set(user.id, marker);
  } else {
    marker.setLatLng([user.lat, user.lon]);
    marker.setIcon(customIcon);
  }

  const distFromMe = isMe ? 0 : calculateDistance(state.myUser.lat, state.myUser.lon, user.lat, user.lon);
  const progress = computeTrackProgress(user);

  marker.bindPopup(`
    <div class="p-2 space-y-3 min-w-[280px] max-w-[340px]">
      <!-- En-tête Participant GÉANT -->
      <div class="flex items-center gap-3 pb-3 border-b-2 border-slate-700/80">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl shrink-0 border-2 border-white/80" style="background-color: ${user.color}">
          ${user.icon || '🌲'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-black text-lg sm:text-xl text-white truncate leading-tight">${user.name} ${isMe ? '<span class="text-xs text-emerald-400 font-bold ml-1">(Moi)</span>' : ''}</div>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold border border-slate-700">${user.role}</span>
            ${progress ? `<span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">ETA ${progress.etaShort}</span>` : ''}
            ${isZoneBlanche ? `<span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">🌲 Zone blanche (${minSinceSeen} min)</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Grille 4 Cartes Statistiques Haut Contraste -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col shadow-inner">
          <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Vitesse</span>
          <span class="text-base sm:text-lg font-black text-white mt-0.5">${(user.speed || 0).toFixed(1)} <span class="text-xs font-bold text-slate-400">km/h</span></span>
        </div>
        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col shadow-inner">
          <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Altitude</span>
          <span class="text-base sm:text-lg font-black text-white mt-0.5">${Math.round(user.ele || 0)} <span class="text-xs font-bold text-slate-400">m</span></span>
        </div>
        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col shadow-inner">
          <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Batterie</span>
          <span class="text-base sm:text-lg font-black mt-0.5 ${user.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${user.battery || 90}%</span>
        </div>
        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col shadow-inner">
          <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Écart</span>
          <span class="text-base sm:text-lg font-black text-blue-400 mt-0.5">${isMe ? '0 m' : distFromMe < 1 ? Math.round(distFromMe * 1000) + ' m' : distFromMe.toFixed(1) + ' km'}</span>
        </div>
      </div>

      <!-- Progression & ETA de Trace -->
      ${progress ? `
        <div class="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 shadow-inner">
          <div class="flex items-center justify-between">
            <span class="font-black text-sm text-slate-200 flex items-center gap-2 truncate max-w-[170px]">
              <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${progress.trackColor};"></span>
              <span class="truncate">${progress.trackName}</span>
            </span>
            <span class="font-mono font-black text-emerald-400 text-sm">${progress.progressPct}%</span>
          </div>
          <div class="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${progress.progressPct}%; background-color: ${progress.trackColor};"></div>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-300 pt-0.5">
            <span class="font-bold">Reste ${progress.remainingDist.toFixed(1)} km <span class="text-slate-400">(+${progress.remainingEleGain}m D+)</span></span>
          </div>
          <div class="bg-amber-500/15 border border-amber-500/35 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
            <span class="text-xs font-bold text-amber-200">Arrivée estimée :</span>
            <span class="text-sm font-black text-amber-300 font-mono">${progress.etaString}</span>
          </div>
        </div>
      ` : ''}

      ${user.isSos ? `
        <div class="p-3 rounded-2xl bg-red-600/30 border-2 border-red-500 text-red-200 text-sm font-black flex items-center gap-2.5 shadow-lg animate-pulse">
          <i data-lucide="alert-triangle" class="w-6 h-6 text-red-400 shrink-0"></i>
          <span>🚨 ALERTE SOS SIGNALÉE !</span>
        </div>
      ` : ''}

      <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 flex items-center justify-between font-semibold">
        <span>${isZoneBlanche ? '🌲 Zone blanche (dernière pos.)' : '🟢 Signal GPS direct'}</span>
        <span class="${isZoneBlanche ? 'text-amber-300 font-bold' : 'text-slate-200'}">${new Date(user.lastSeen).toLocaleTimeString()} ${isZoneBlanche ? `(il y a ${minSinceSeen} min)` : ''}</span>
      </div>

      ${(!isMe && state.isOrganizer) ? `
        <div class="pt-2 border-t border-slate-700/80">
          <button onclick="deleteParticipant('${user.id}')" class="w-full py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 text-red-300 hover:text-white border border-red-500/50 hover:border-red-400 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md" title="Supprimer ce marcheur de la session">
            <i data-lucide="user-x" class="w-4 h-4 text-red-400"></i>
            <span>Supprimer ce marcheur</span>
          </button>
        </div>
      ` : ''}
    </div>
  `);
}

function removeUserMarker(userId) {
  const marker = state.userMarkers.get(userId);
  if (marker) {
    state.map.removeLayer(marker);
    state.userMarkers.delete(userId);
  }
}

function renderUsersList() {
  const container = document.getElementById('users-list-container');
  if (!container) return;

  const now = Date.now();
  const maxAgeMs = 5 * 3600 * 1000; // 5 heures de rétention pour préserver le suivi en zone blanche

  state.otherUsers.forEach((user, id) => {
    if (now - (user.lastSeen || 0) > maxAgeMs) {
      removeUserMarker(id);
      state.otherUsers.delete(id);
    }
  });

  const allUsers = [state.myUser, ...Array.from(state.otherUsers.values())].slice(0, MAX_USERS);
  const totalCount = allUsers.length;

  const panelBadge = document.getElementById('users-badge');
  const navBadge = document.getElementById('nav-users-badge');
  if (panelBadge) panelBadge.textContent = `${totalCount}/${MAX_USERS}`;
  if (navBadge) navBadge.textContent = totalCount;

  const mySpeedStat = document.getElementById('my-speed-stat');
  const myEleStat = document.getElementById('my-ele-stat');
  const myBatteryStat = document.getElementById('my-battery-stat');

  if (mySpeedStat) mySpeedStat.textContent = `${(state.myUser.speed || 0).toFixed(1)} km/h`;
  if (myEleStat) myEleStat.textContent = `${Math.round(state.myUser.ele || 0)} m`;
  if (myBatteryStat) myBatteryStat.textContent = `${state.myUser.battery || 95}%`;

  // Mettre à jour l'ETA de "Moi" (Jean-Luc)
  const myProgress = computeTrackProgress(state.myUser);
  const myNameEta = document.getElementById('my-name-eta');
  if (myNameEta) {
    if (myProgress) {
      myNameEta.textContent = `• ETA ${myProgress.etaShort}`;
    } else {
      myNameEta.textContent = '• ETA --:--';
    }
  }

  const myEtaCard = document.getElementById('my-eta-card');
  if (myEtaCard) {
    if (myProgress) {
      myEtaCard.classList.remove('hidden');
      document.getElementById('my-track-dot').style.backgroundColor = myProgress.trackColor;
      document.getElementById('my-track-label').textContent = myProgress.trackName;
      document.getElementById('my-progress-pct').textContent = `${myProgress.progressPct}%`;
      document.getElementById('my-progress-bar').style.width = `${myProgress.progressPct}%`;
      document.getElementById('my-progress-bar').style.backgroundColor = myProgress.trackColor;
      document.getElementById('my-remaining-dist').textContent = `${myProgress.remainingDist.toFixed(1)} km`;
      document.getElementById('my-remaining-ele').textContent = `(+${myProgress.remainingEleGain}m D+)`;
      document.getElementById('my-eta-time').textContent = myProgress.etaString;
    } else {
      myEtaCard.classList.add('hidden');
    }
  }

  const otherUsersList = Array.from(state.otherUsers.values());

  if (otherUsersList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 bg-slate-800/60 rounded-3xl border border-slate-700/80 text-slate-300 text-sm flex flex-col items-center gap-3 shadow-xl">
        <div class="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center shadow-inner">
          <i data-lucide="users" class="w-8 h-8"></i>
        </div>
        <div>
          <div class="font-black text-white text-base">Vous êtes seul sur ce salon</div>
          <div class="text-xs text-slate-400 mt-1 font-semibold">Invitez vos compagnons pour les voir en direct sur la carte avec leur vitesse, progression et ETA.</div>
        </div>
        <button onclick="openInviteModal()" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition">
          <i data-lucide="qr-code" class="w-5 h-5"></i>
          <span>📲 Afficher le QR Code d'invitation</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = otherUsersList.map(u => {
    const dist = calculateDistance(state.myUser.lat, state.myUser.lon, u.lat, u.lon);
    const distStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
    const timeSinceMs = now - (u.lastSeen || now);
    const isZoneBlanche = timeSinceMs > 2 * 60 * 1000;
    const minAgo = Math.max(1, Math.round(timeSinceMs / 60000));
    const progress = computeTrackProgress(u);

    return `
      <div class="p-4 rounded-3xl bg-slate-800/95 border-2 ${u.isSos ? 'border-red-500 bg-red-950/40 shadow-red-500/20' : isZoneBlanche ? 'border-amber-500/50 bg-slate-850' : 'border-slate-700'} hover:border-slate-500 transition flex flex-col gap-3 cursor-pointer active:scale-98 shadow-xl" onclick="centerOnUser('${u.id}')">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0 flex-1">
            <div class="w-14 h-14 rounded-full flex items-center justify-center text-3xl font-black text-white shrink-0 shadow-lg relative border-2 border-white/90" style="background-color: ${u.color || '#3b82f6'}; ${isZoneBlanche ? 'opacity: 0.85;' : ''}">
              ${u.icon || '🥾'}
              ${u.isSos ? '<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white animate-ping"></span>' : ''}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-black text-lg sm:text-xl text-white truncate">${u.name}</span>
                ${u.isSos ? '<span class="text-xs font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">SOS</span>' : ''}
                ${isZoneBlanche ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">🌲 Zone blanche (${minAgo} min)</span>` : '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🟢 Direct</span>'}
              </div>
              <div class="flex items-center gap-2 text-xs sm:text-sm mt-1 flex-wrap">
                <span class="text-slate-300 font-bold truncate">${u.role}</span>
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 shrink-0">ETA ${progress ? progress.etaShort : '--:--'}</span>
              </div>
            </div>
          </div>

          <div class="text-right shrink-0 flex flex-col items-end">
            <div class="font-black text-lg sm:text-xl text-blue-400 font-mono">${distStr}</div>
            <div class="text-xs text-slate-300 font-black flex items-center gap-1.5 mt-1">
              <span>${(u.speed || 0).toFixed(1)} km/h</span>
              <span class="text-slate-500">•</span>
              <span class="${u.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${u.battery}% 🔋</span>
            </div>
            ${state.isOrganizer ? `
              <button onclick="event.stopPropagation(); deleteParticipant('${u.id}')" class="mt-2 px-2.5 py-1 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 hover:text-white font-black text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm" title="Supprimer ce marcheur">
                <i data-lucide="user-x" class="w-3.5 h-3.5 text-red-400"></i>
                <span>Supprimer</span>
              </button>
            ` : ''}
          </div>
        </div>

        ${progress ? `
          <div class="pt-2.5 border-t border-slate-700/80 flex flex-col gap-2 text-xs">
            <div class="flex items-center justify-between text-slate-200">
              <span class="font-black text-sm flex items-center gap-2 truncate max-w-[200px]">
                <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${progress.trackColor};"></span>
                <span class="truncate">${progress.trackName}</span>
              </span>
              <span class="font-black text-emerald-400 font-mono text-sm">${progress.progressPct}%</span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
              <div class="h-full rounded-full transition-all duration-300" style="width: ${progress.progressPct}%; background-color: ${progress.trackColor};"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-300">
              <span class="font-bold">Reste ${progress.remainingDist.toFixed(1)} km (+${progress.remainingEleGain}m D+)</span>
              <span class="text-amber-300 font-black text-xs font-mono">Arrivée : ${progress.etaString}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function centerOnUser(userId) {
  let user = userId === state.myUser.id ? state.myUser : state.otherUsers.get(userId);
  if (!user) return;

  state.map.setView([user.lat, user.lon], 16, { animate: true });
  const marker = state.userMarkers.get(userId);
  if (marker) marker.openPopup();
  closeAllDrawers();
}

// ============================================================================
// TIROIR DES PARTICIPANTS (AVEC GESTION TACTILE & BACKDROP)
// ============================================================================
function toggleUsersDrawer() {
  const usersPanel = document.getElementById('users-panel');
  const backdrop = document.getElementById('drawer-backdrop');
  if (!usersPanel) return;

  if (state.activeDrawer === 'users' && !usersPanel.classList.contains('drawer-closed')) {
    closeAllDrawers();
  } else {
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    if (backdrop) backdrop.classList.remove('hidden');
    state.activeDrawer = 'users';
    const navUsers = document.getElementById('nav-btn-users');
    if (navUsers) navUsers.classList.add('text-indigo-400');
  }
}

function openDrawer(panelName) {
  const usersPanel = document.getElementById('users-panel');
  const backdrop = document.getElementById('drawer-backdrop');
  if (panelName === 'users' && usersPanel) {
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    if (backdrop) backdrop.classList.remove('hidden');
    state.activeDrawer = 'users';
    const navUsers = document.getElementById('nav-btn-users');
    if (navUsers) navUsers.classList.add('text-indigo-400');
  }
}

function closeAllDrawers() {
  const usersPanel = document.getElementById('users-panel');
  const backdrop = document.getElementById('drawer-backdrop');
  if (usersPanel) {
    usersPanel.classList.add('drawer-closed');
    usersPanel.classList.remove('drawer-open');
  }
  if (backdrop) backdrop.classList.add('hidden');
  const navUsers = document.getElementById('nav-btn-users');
  if (navUsers) navUsers.classList.remove('text-indigo-400');
  state.activeDrawer = null;
}

// ============================================================================
// GÉOLOCALISATION GPS AUTOMATIQUE AVEC DURÉE LIMITE (MAX 24H)
// ============================================================================
function checkGpsExpiry() {
  if (!state.isTrackingGps || !state.gpsStartTime) return;

  const elapsedMs = Date.now() - state.gpsStartTime;
  const maxMs = state.shareDurationHours * 3600 * 1000;

  if (elapsedMs >= maxMs) {
    stopGpsWatch();
    showToast(`⏳ Durée de partage (${state.shareDurationHours}h max) atteinte. Partage arrêté.`, 'info');
  }
}

function startGpsWatch(useHighAccuracy = true) {
  const navBubble = document.getElementById('nav-gps-bubble');
  const navIcon = document.getElementById('nav-gps-icon');
  const navLabel = document.getElementById('nav-gps-label');

  if (navLabel) navLabel.textContent = 'Recherche...';
  if (navBubble) navBubble.className = 'rounded-full bg-amber-500/30 border-3 sm:border-4 border-amber-400 flex items-center justify-center shadow-2xl transition animate-pulse';
  if (navIcon) navIcon.className = 'text-amber-300 stroke-[2.8] animate-spin';

  if (!state.gpsStartTime) {
    state.gpsStartTime = Date.now();
  }

  if (!state.expiryCheckInterval) {
    state.expiryCheckInterval = setInterval(checkGpsExpiry, 60000);
  }

  const onPositionSuccess = (pos) => {
    checkGpsExpiry();
    if (!state.isTrackingGps && state.gpsStartTime && (Date.now() - state.gpsStartTime >= state.shareDurationHours * 3600 * 1000)) {
      return;
    }

    state.isTrackingGps = true;
    state.myUser.lat = pos.coords.latitude;
    state.myUser.lon = pos.coords.longitude;
    state.myUser.ele = pos.coords.altitude !== null && !isNaN(pos.coords.altitude) ? Math.round(pos.coords.altitude) : state.myUser.ele;
    state.myUser.speed = pos.coords.speed ? (pos.coords.speed * 3.6) : 0.0;
    state.myUser.accuracy = pos.coords.accuracy || 10;

    try {
      localStorage.setItem('rando_last_lat', String(pos.coords.latitude));
      localStorage.setItem('rando_last_lon', String(pos.coords.longitude));
    } catch (e) {}

    const accStr = `±${Math.round(pos.coords.accuracy)}m`;
    if (navLabel) navLabel.textContent = `GPS (${accStr})`;
    if (navBubble) navBubble.className = 'rounded-full bg-emerald-600 border-3 sm:border-4 border-white flex items-center justify-center shadow-2xl transition animate-pulse';
    if (navIcon) navIcon.className = 'text-white stroke-[2.8]';

    if (!state.accuracyCircle) {
      state.accuracyCircle = L.circle([state.myUser.lat, state.myUser.lon], {
        radius: pos.coords.accuracy || 20,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.16,
        weight: 2
      }).addTo(state.map);
    } else {
      state.accuracyCircle.setLatLng([state.myUser.lat, state.myUser.lon]);
      state.accuracyCircle.setRadius(pos.coords.accuracy || 20);
    }

    broadcastMyPosition();

    const emergencyModal = document.getElementById('emergency-modal');
    if (emergencyModal && !emergencyModal.classList.contains('hidden')) {
      updateEmergencyModalGpsData();
    }

    if (!state.hasAutoCenteredGps) {
      state.map.setView([state.myUser.lat, state.myUser.lon], 16, { animate: true });
      state.hasAutoCenteredGps = true;
      showToast(`Position GPS trouvée (${accStr}) - Partage actif (${state.shareDurationHours}h max)`, 'success');
    }

    if (!state.hasAutoDetectedGpsCountry) {
      autoSelectMapLayerForCoords(state.myUser.lat, state.myUser.lon, 'gps');
      state.hasAutoDetectedGpsCountry = true;
    }
  };

  const onPositionError = (err) => {
    console.warn(`[GPS] Erreur (highAcc=${useHighAccuracy}):`, err.code, err.message);

    if (useHighAccuracy) {
      startGpsWatch(false);
      return;
    }

    stopGpsWatch();
    let explication = err.message;
    if (err.code === 1) {
      explication = "Autorisation GPS refusée. Veuillez autoriser la localisation dans les réglages de votre navigateur.";
    } else if (err.code === 2) {
      explication = "Signal GPS indisponible. Activez la localisation de votre téléphone.";
    } else if (err.code === 3) {
      explication = "Délai de réponse GPS dépassé.";
    }

    showToast(explication, 'error');
  };

  navigator.geolocation.getCurrentPosition(onPositionSuccess, onPositionError, {
    enableHighAccuracy: useHighAccuracy,
    timeout: 12000,
    maximumAge: 0
  });

  if (state.gpsWatchId !== null) {
    navigator.geolocation.clearWatch(state.gpsWatchId);
  }
  state.gpsWatchId = navigator.geolocation.watchPosition(onPositionSuccess, onPositionError, {
    enableHighAccuracy: useHighAccuracy,
    timeout: 15000,
    maximumAge: 2000
  });

  // Activer le forçage périodique actif du GPS matériel (Dual-Engine Polling)
  startGpsForcedWatchdog(onPositionSuccess);

  // Activer le maintien d'activité en tâche de fond (écran éteint dans la poche)
  startBackgroundKeepAlive();
}

// Watchdog de forçage GPS matériel (Évite les creux d'inactivité du système)
let gpsForcedInterval = null;
function startGpsForcedWatchdog(onSuccessCallback) {
  if (gpsForcedInterval) clearInterval(gpsForcedInterval);
  gpsForcedInterval = setInterval(() => {
    if (state.isTrackingGps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        onSuccessCallback,
        (e) => { console.warn('[GPS Watchdog] Polling passif:', e.code); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  }, 7000);
}

function stopGpsForcedWatchdog() {
  if (gpsForcedInterval) {
    clearInterval(gpsForcedInterval);
    gpsForcedInterval = null;
  }
}

// Maintien d'activité en arrière-plan (Background Audio Keep-Alive)
let silentAudioKeeper = null;
function startBackgroundKeepAlive() {
  if (!silentAudioKeeper) {
    try {
      // 1 seconde de silence MP3 encodée en base64 pour maintenir la boucle JavaScript active
      const silentMp3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//OEAAAAAAAAAAAAAAAAAAAAAAAADQAAAAAAA';
      silentAudioKeeper = new Audio(silentMp3);
      silentAudioKeeper.loop = true;
      silentAudioKeeper.volume = 0.01;
      silentAudioKeeper.play().catch(() => {});
    } catch (e) {
      console.warn('[KeepAlive] Audio non initialisé:', e);
    }
  }
}

function stopBackgroundKeepAlive() {
  if (silentAudioKeeper) {
    try {
      silentAudioKeeper.pause();
      silentAudioKeeper = null;
    } catch (e) {}
  }
}

function stopGpsWatch() {
  if (state.gpsWatchId !== null) {
    navigator.geolocation.clearWatch(state.gpsWatchId);
    state.gpsWatchId = null;
  }
  if (state.accuracyCircle) {
    state.map.removeLayer(state.accuracyCircle);
    state.accuracyCircle = null;
  }
  if (state.expiryCheckInterval) {
    clearInterval(state.expiryCheckInterval);
    state.expiryCheckInterval = null;
  }

  stopGpsForcedWatchdog();
  stopBackgroundKeepAlive();

  state.isTrackingGps = false;
  state.gpsStartTime = null;

  const navBubble = document.getElementById('nav-gps-bubble');
  const navIcon = document.getElementById('nav-gps-icon');
  const navLabel = document.getElementById('nav-gps-label');

  if (navLabel) navLabel.textContent = 'Mon GPS';
  if (navBubble) navBubble.className = 'rounded-full bg-slate-800 border-3 sm:border-4 border-slate-600 flex items-center justify-center shadow-xl transition';
  if (navIcon) navIcon.className = 'text-slate-300 stroke-[2]';
}

function toggleGps() {
  if (state.isTrackingGps) {
    stopGpsWatch();
    showToast('GPS désactivé', 'info');
  } else {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    state.gpsStartTime = Date.now();
    startGpsWatch(true);
  }
}

// ============================================================================
// INVITATION DES PARTICIPANTS (QR CODE + WHATSAPP / SMS)
// ============================================================================
function getInviteUrl() {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?room=${encodeURIComponent(state.roomCode)}&role=guest`;
}

function openInviteModal() {
  const modal = document.getElementById('invite-modal');
  const urlDisplay = document.getElementById('invite-room-url');
  const qrcodeContainer = document.getElementById('qrcode');
  const inviteUrl = getInviteUrl();

  if (urlDisplay) urlDisplay.textContent = inviteUrl;
  if (qrcodeContainer) {
    qrcodeContainer.innerHTML = '';
    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrcodeContainer, {
          text: inviteUrl,
          width: 220,
          height: 220,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } else {
        qrcodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}" alt="QR Code" class="w-[220px] h-[220px] rounded-xl" />`;
      }
    } catch (e) {
      qrcodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}" alt="QR Code" class="w-[220px] h-[220px] rounded-xl" />`;
    }
  }

  if (modal) modal.classList.remove('hidden');
}

async function shareInviteLink() {
  const inviteUrl = getInviteUrl();
  const title = `RandoTracker - Salon ${state.roomCode}`;
  const text = `Rejoins notre randonnée en direct sur la carte IGN/Topo (Salon ${state.roomCode}) :`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text,
        url: inviteUrl
      });
      showToast('Invitation partagée !', 'success');
      return;
    } catch (err) {}
  }

  copyInviteLink();
}

function copyInviteLink() {
  const inviteUrl = getInviteUrl();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      showToast('Lien copié dans le presse-papier !', 'success');
    }).catch(() => {
      prompt('Copiez ce lien d\'invitation :', inviteUrl);
    });
  } else {
    prompt('Copiez ce lien d\'invitation :', inviteUrl);
  }
}

// ============================================================================
// SYNCHRONISATION EN TEMPS RÉEL (MQTT 4G/5G/Wi-Fi & BroadcastChannel)
// ============================================================================
let mqttClient = null;

function initRealtimeSync() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room') || (window.location.hash ? window.location.hash.replace(/^#room=/, '').replace(/^#/, '') : null);
  if (roomParam) {
    state.roomCode = decodeURIComponent(roomParam).toUpperCase().trim();
    localStorage.setItem('rando_room_code', state.roomCode);
  } else {
    const savedRoom = localStorage.getItem('rando_room_code');
    if (savedRoom) state.roomCode = savedRoom;
  }
  updateRoomDisplay();
  loadSavedOtherUsersFromStorage();

  try {
    state.broadcastChannel = new BroadcastChannel(`rando_${state.roomCode}`);
    state.broadcastChannel.onmessage = (event) => handleIncomingMessage(event.data);
  } catch (e) {}

  initMqttSync();
}

function updateRoomDisplay() {
  const badge = document.getElementById('active-room-name');
  const input = document.getElementById('input-room-code');
  if (badge) badge.textContent = state.roomCode;
  if (input) input.value = state.roomCode;
  localStorage.setItem('rando_room_code', state.roomCode);
}

function updateConnectionStatus(isConnected) {
  const hint = document.getElementById('group-status-hint');
  if (hint) {
    if (isConnected) {
      hint.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>4G Direct`;
      hint.className = 'text-xs text-emerald-400 font-bold flex items-center';
    } else {
      hint.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1.5"></span>Connexion...`;
      hint.className = 'text-xs text-amber-400 font-bold flex items-center';
    }
  }
}

function initMqttSync() {
  if (typeof mqtt === 'undefined') {
    console.warn('[MQTT] Chargement du client MQTT...');
    setTimeout(initMqttSync, 1000);
    return;
  }

  if (mqttClient) {
    try { mqttClient.end(true); } catch (e) {}
  }

  const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const topic = `randotracker/v1/rooms/${sanitizedRoom}/events`;
  const clientId = `rando_${state.myUser.id}_${Math.random().toString(36).substr(2, 6)}`;

  const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
  console.log(`[MQTT] Connexion au broker HiveMQ (${state.roomCode})...`);

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: clientId,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
      keepalive: 30
    });

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connecté avec succès au salon:', state.roomCode);
      updateConnectionStatus(true);
      mqttClient.subscribe(topic, { qos: 0 }, (err) => {
        if (!err) {
          console.log(`[MQTT] Abonné au topic : ${topic}`);
          
          // 1. Annoncer notre arrivée dans le salon
          publishMessage({
            type: 'user_joined',
            user: state.myUser,
            hasTracks: state.tracks.length > 0
          });

          // 2. Demander la présence immédiate de tous les membres déjà présents
          publishMessage({
            type: 'request_presence',
            from: state.myUser.id
          });

          // 3. Si nous avons déjà des traces chargées, les envoyer immédiatement
          if (state.tracks.length > 0) {
            publishMessage({
              type: 'sync_tracks',
              from: state.myUser.id,
              tracks: state.tracks
            });
          }
        }
      });
    });

    mqttClient.on('message', (t, message) => {
      try {
        const data = JSON.parse(message.toString());
        handleIncomingMessage(data);
      } catch (e) {
        console.warn('[MQTT] Erreur message:', e);
      }
    });

    mqttClient.on('error', (err) => {
      console.warn('[MQTT] Erreur:', err);
      updateConnectionStatus(false);
    });

    mqttClient.on('offline', () => {
      console.log('[MQTT] Hors-ligne');
      updateConnectionStatus(false);
    });

    mqttClient.on('reconnect', () => {
      console.log('[MQTT] Reconnexion...');
    });
  } catch (err) {
    console.error('[MQTT] Impossible d\'initialiser MQTT:', err);
    updateConnectionStatus(false);
  }
}

function publishMessage(payload) {
  payload.senderId = state.myUser.id;
  payload.room = state.roomCode;
  payload.timestamp = Date.now();

  const msgStr = JSON.stringify(payload);

  if (mqttClient && mqttClient.connected) {
    const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const topic = `randotracker/v1/rooms/${sanitizedRoom}/events`;
    mqttClient.publish(topic, msgStr, { qos: 0 });
  }

  if (state.broadcastChannel) {
    try { state.broadcastChannel.postMessage(payload); } catch (e) {}
  }
}

function broadcastMyPosition() {
  state.myUser.lastSeen = Date.now();
  createOrUpdateUserMarker(state.myUser);
  renderUsersList();

  publishMessage({
    type: 'update_position',
    user: state.myUser
  });
}

function handleIncomingMessage(data) {
  if (!data || !data.type) return;
  if (data.senderId === state.myUser.id) return; // Ignore nos propres messages
  if (data.room && data.room !== state.roomCode) return;

  if (data.type === 'request_presence') {
    // Un participant demande la liste des présents : répondre immédiatement
    publishMessage({
      type: 'respond_presence',
      user: state.myUser
    });
    // Si nous avons des traces, les transmettre
    if (state.tracks.length > 0) {
      publishMessage({
        type: 'sync_tracks',
        from: state.myUser.id,
        tracks: state.tracks
      });
    }
  } else if (data.type === 'user_joined') {
    const user = data.user;
    if (user && user.id !== state.myUser.id) {
      state.otherUsers.set(user.id, user);
      createOrUpdateUserMarker(user);
      saveOtherUsersToStorage();
      renderUsersList();
      showToast(`👋 ${user.name} a rejoint la rando !`, 'info');

      // Répondre IMMÉDIATEMENT au nouvel arrivant avec notre présence
      publishMessage({
        type: 'respond_presence',
        user: state.myUser
      });

      // Si nous avons des traces GPX chargées, nous les envoyons au nouvel arrivant
      if (state.tracks.length > 0) {
        publishMessage({
          type: 'sync_tracks',
          from: state.myUser.id,
          tracks: state.tracks
        });
      }
    }
  } else if (data.type === 'respond_presence' || data.type === 'update_position' || data.type === 'user_updated') {
    const user = data.user;
    if (user && user.id !== state.myUser.id) {
      if (state.otherUsers.size < (MAX_USERS - 1) || state.otherUsers.has(user.id)) {
        state.otherUsers.set(user.id, user);
        createOrUpdateUserMarker(user);
        saveOtherUsersToStorage();
        renderUsersList();
      }
    }
  } else if (data.type === 'sync_tracks') {
    // Réception des traces GPX de la rando envoyées par Jean-Luc ou un participant
    if (Array.isArray(data.tracks) && data.tracks.length > 0) {
      const isDifferent = state.tracks.length !== data.tracks.length ||
        state.tracks.some((t, i) => !data.tracks[i] || t.id !== data.tracks[i].id);

      if (state.tracks.length === 0 || isDifferent) {
        // Nettoyer anciennes traces sur la carte
        state.tracks.forEach(t => {
          const l = state.trackLayers.get(t.id);
          if (l) state.map.removeLayer(l);
        });
        state.tracks = [];
        state.trackLayers.clear();

        // Charger et afficher les traces reçues
        data.tracks.forEach((track, idx) => {
          track.color = TRACK_COLORS[idx % TRACK_COLORS.length];
          track.visible = true;
          state.tracks.push(track);
          renderTrackOnMap(track);
        });

        renderQuickTracksBar();
        fitAllTracks();
        saveHikeSessionToStorage();
        updateProfileUI();
        showToast(`🗺️ Randonnée synchronisée (${state.tracks.length} trace(s) reçue(s)) !`, 'success');
      }
    }
  } else if (data.type === 'reset_session' || data.type === 'clear_tracks') {
    // 1. Effacer les traces GPX
    state.tracks.forEach(t => {
      const l = state.trackLayers.get(t.id);
      if (l) state.map.removeLayer(l);
    });
    state.tracks = [];
    state.trackLayers.clear();
    state.myUser.assignedTrackId = 'auto';

    // 2. Effacer les autres participants (sauf Moi)
    state.otherUsers.forEach((u, id) => {
      removeUserMarker(id);
    });
    state.otherUsers.clear();

    // 3. Purger les stockages locaux
    localStorage.removeItem('rando_saved_session');
    localStorage.removeItem('rando_saved_other_users');

    // 4. Mettre à jour l'affichage
    renderQuickTracksBar();
    renderUsersList();
    updateProfileUI();
    showToast('Randonnée réinitialisée par l\'organisateur.', 'info');
  } else if (data.type === 'kick_all') {
    if (data.from !== state.myUser.id) {
      state.otherUsers.forEach((u, id) => removeUserMarker(id));
      state.otherUsers.clear();
      localStorage.removeItem('rando_saved_other_users');
      renderUsersList();
      showToast('Salon des marcheurs purgé par l\'organisateur.', 'info');
    }
  } else if (data.type === 'kick_user') {
    if (data.targetUserId === state.myUser.id) {
      showToast('⚠️ Vous avez été retiré de la session par l\'organisateur.', 'warning');
    } else if (state.otherUsers.has(data.targetUserId)) {
      state.otherUsers.delete(data.targetUserId);
      removeUserMarker(data.targetUserId);
      saveOtherUsersToStorage();
      renderUsersList();
    }
  } else if (data.type === 'broadcast_announcement') {
    handleReceivedAnnouncement(data);
  } else if (data.type === 'user_left') {
    state.otherUsers.delete(data.userId);
    removeUserMarker(data.userId);
    saveOtherUsersToStorage();
    renderUsersList();
  }
}

// ============================================================================
// DIFFUSION DE MESSAGES EN DIRECT POUR TOUT LE GROUPE (TOUS LES MARCHEURS)
// ============================================================================
function openAnnouncementModal() {
  const modal = document.getElementById('announcement-modal');
  const customInput = document.getElementById('announcement-custom-input');
  if (customInput) customInput.value = '';
  if (modal) modal.classList.remove('hidden');
}

function closeAnnouncementModal() {
  const modal = document.getElementById('announcement-modal');
  if (modal) modal.classList.add('hidden');
}

function sendAnnouncement(text) {
  const msgText = (text || '').trim();
  if (!msgText) {
    showToast('Veuillez saisir un message à diffuser.', 'error');
    return;
  }

  const payload = {
    type: 'broadcast_announcement',
    author: state.myUser.name || 'Marcheur',
    role: state.myUser.role || 'Randonneur',
    icon: state.myUser.icon || '🥾',
    color: state.myUser.color || '#059669',
    text: msgText,
    timestamp: Date.now()
  };

  publishMessage(payload);
  closeAnnouncementModal();
  showToast(`📢 Message diffusé au groupe !`, 'success');

  // Afficher également le bandeau sur son propre écran
  displayAnnouncementBanner(payload.author, payload.icon, payload.role, payload.text, payload.timestamp);
}

function sendCustomAnnouncement() {
  const input = document.getElementById('announcement-custom-input');
  if (input) {
    sendAnnouncement(input.value);
  }
}

function displayAnnouncementBanner(author, icon, role, text, timestamp) {
  const banner = document.getElementById('active-announcement-banner');
  const senderTime = document.getElementById('announcement-sender-time');
  const bannerText = document.getElementById('announcement-banner-text');

  if (banner && senderTime && bannerText) {
    const timeStr = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const authorStr = icon ? `${icon} ${author}` : author;
    const roleStr = role ? ` (${role})` : '';
    senderTime.textContent = `📢 ${authorStr}${roleStr} • ${timeStr}`;
    bannerText.textContent = text;
    banner.classList.remove('hidden');
  }
}

function closeAnnouncementBanner() {
  const banner = document.getElementById('active-announcement-banner');
  if (banner) banner.classList.add('hidden');
}

function handleReceivedAnnouncement(data) {
  if (!data || !data.text) return;

  playAnnouncementAlert();

  const author = data.author || 'Marcheur';
  const icon = data.icon || '🥾';
  const role = data.role || 'Randonneur';
  const text = data.text;
  const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Afficher la popup modale de réception
  const rxModal = document.getElementById('received-announcement-modal');
  const rxSender = document.getElementById('rx-announcement-sender');
  const rxTime = document.getElementById('rx-announcement-time');
  const rxText = document.getElementById('rx-announcement-text');
  const rxBubble = document.getElementById('rx-announcement-icon-bubble');

  if (rxSender) rxSender.textContent = `Message de ${author} (${role})`;
  if (rxTime) rxTime.textContent = `Reçu à ${timeStr}`;
  if (rxText) rxText.textContent = text;
  if (rxBubble) {
    rxBubble.textContent = icon;
    if (data.color) rxBubble.style.borderColor = data.color;
  }

  if (rxModal) rxModal.classList.remove('hidden');

  // 2. Afficher le bandeau persistant en haut de la carte
  displayAnnouncementBanner(author, icon, role, text, data.timestamp);
}

function closeReceivedAnnouncementModal() {
  const rxModal = document.getElementById('received-announcement-modal');
  if (rxModal) rxModal.classList.add('hidden');
}

function playAnnouncementAlert() {
  // 1. Vibreur mobile
  if (navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch (e) {}
  }

  // 2. Synthétiseur sonore Web Audio API
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Bip 1 (587 Hz - Ré)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      // Bip 2 (880 Hz - La aigu)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.22);
      gain2.gain.setValueAtTime(0.4, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.55);
    }
  } catch (e) {
    console.warn('[Audio] Alerte son non supportée:', e);
  }
}

// ============================================================================
// GESTION DES SECOURS & APPELS D'URGENCE (15 SAMU / 112 POMPIERS / COORDONNÉES GPS)
// ============================================================================
function toDMS(val, isLat) {
  if (typeof val !== 'number' || isNaN(val)) return '--';
  const absVal = Math.abs(val);
  const deg = Math.floor(absVal);
  const minFloat = (absVal - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'O');
  return `${deg}° ${min.toString().padStart(2, '0')}' ${sec.toString().padStart(2, '0')}" ${dir}`;
}

function updateEmergencyModalGpsData() {
  const modal = document.getElementById('emergency-modal');
  if (!modal) return;

  const lat = state.myUser.lat || 45.8920;
  const lon = state.myUser.lon || 6.1550;
  const ele = state.myUser.ele || 0;
  const acc = state.myUser.accuracy || 10;
  const country = detectCountry(lat, lon);

  // 1. Affichage Degrés Décimaux (DD)
  const decimalEl = document.getElementById('emergency-gps-decimal');
  if (decimalEl) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'O';
    decimalEl.textContent = `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
  }

  // 2. Affichage Degrés Minutes Secondes (DMS)
  const dmsEl = document.getElementById('emergency-gps-dms');
  if (dmsEl) {
    dmsEl.textContent = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
  }

  // 3. Métadonnées (Altitude, Précision, Horodatage)
  const metaEl = document.getElementById('emergency-gps-meta');
  if (metaEl) {
    metaEl.textContent = `Alt : ${Math.round(ele)} m • Précision : ±${Math.round(acc)} m`;
  }
  const timeEl = document.getElementById('emergency-gps-time');
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleTimeString();
  }

  // 4. Tag Pays
  const countryTag = document.getElementById('emergency-country-tag');
  if (countryTag) {
    if (country === 'FR') {
      countryTag.textContent = '🇫🇷 France';
      countryTag.className = 'text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    } else if (country === 'ES') {
      countryTag.textContent = '🇪🇸 Espagne';
      countryTag.className = 'text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
    } else {
      countryTag.textContent = '🏔️ International';
      countryTag.className = 'text-[11px] font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40';
    }
  }

  // 5. Numéros d'urgence adaptés selon la géolocalisation
  const numList = document.getElementById('emergency-numbers-list');
  if (numList) {
    if (country === 'FR') {
      numList.innerHTML = `
        <!-- 15 SAMU -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border-2 border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">15</span>
              <span class="text-base sm:text-lg font-black text-white truncate">SAMU (Urgences Médicales)</span>
            </div>
            <p class="text-xs text-slate-400 font-semibold mt-1">Urgences médicales vitales, malaises graves, traumatismes.</p>
          </div>
          <a href="tel:15" class="h-13 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center gap-2 shadow-xl shrink-0 active:scale-95 transition" title="Appeler le 15">
            <i data-lucide="phone-call" class="w-5 h-5"></i>
            <span>15</span>
          </a>
        </div>

        <!-- 112 POMPIERS & SECOURS MONTAGNE -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border-2 border-red-500/40 flex items-center justify-between gap-3 shadow-lg">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40">112</span>
              <span class="text-base sm:text-lg font-black text-white truncate">Sapeurs-Pompiers & Secours</span>
            </div>
            <p class="text-xs text-slate-400 font-semibold mt-1">Pompiers, secours d'urgence, secours en montagne (PGHM/CRS).</p>
          </div>
          <a href="tel:112" class="h-13 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-base flex items-center gap-2 shadow-xl shrink-0 active:scale-95 transition" title="Appeler le 112">
            <i data-lucide="phone-call" class="w-5 h-5"></i>
            <span>112</span>
          </a>
        </div>

        <!-- 114 SMS D'URGENCE -->
        <div class="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40">114</span>
              <span class="text-sm font-black text-slate-200">SMS d'Urgence (Sans réseau vocal)</span>
            </div>
            <p class="text-[11px] text-slate-400 font-semibold mt-0.5">En cas de réseau vocal trop faible ou impossibilité de parler.</p>
          </div>
          <a href="sms:114" class="h-11 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow shrink-0 active:scale-95 transition" title="Envoyer un SMS au 114">
            <i data-lucide="message-square" class="w-4 h-4"></i>
            <span>SMS 114</span>
          </a>
        </div>
      `;
    } else if (country === 'ES') {
      numList.innerHTML = `
        <!-- 112 EMERGENCIAS ESPAÑA -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border-2 border-red-500/40 flex items-center justify-between gap-3 shadow-lg">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40">112</span>
              <span class="text-base sm:text-lg font-black text-white truncate">112 Emergencias España</span>
            </div>
            <p class="text-xs text-slate-400 font-semibold mt-1">Bomberos, Guardia Civil, Rescate en Montaña (GREIM).</p>
          </div>
          <a href="tel:112" class="h-13 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-base flex items-center gap-2 shadow-xl shrink-0 active:scale-95 transition" title="Llamar al 112">
            <i data-lucide="phone-call" class="w-5 h-5"></i>
            <span>112</span>
          </a>
        </div>

        <!-- 061 URGENCIAS MÉDICAS -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border-2 border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">061</span>
              <span class="text-base sm:text-lg font-black text-white truncate">061 Urgencias Sanitarias</span>
            </div>
            <p class="text-xs text-slate-400 font-semibold mt-1">Ambulancia y atención médica urgente.</p>
          </div>
          <a href="tel:061" class="h-13 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center gap-2 shadow-xl shrink-0 active:scale-95 transition" title="Llamar al 061">
            <i data-lucide="phone-call" class="w-5 h-5"></i>
            <span>061</span>
          </a>
        </div>
      `;
    } else {
      numList.innerHTML = `
        <!-- 112 EUROPE & INTERNATIONAL -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border-2 border-red-500/40 flex items-center justify-between gap-3 shadow-lg">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40">112</span>
              <span class="text-base sm:text-lg font-black text-white truncate">112 Numéro d'Urgence Européen</span>
            </div>
            <p class="text-xs text-slate-400 font-semibold mt-1">Numéro unique d'urgence valide en Europe et en Suisse (Pompiers, SAMU, Secours).</p>
          </div>
          <a href="tel:112" class="h-13 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-base flex items-center gap-2 shadow-xl shrink-0 active:scale-95 transition" title="Appeler le 112">
            <i data-lucide="phone-call" class="w-5 h-5"></i>
            <span>112</span>
          </a>
        </div>
      `;
    }
  }

  // 6. État du bouton Alerte Groupe
  const groupSosBtn = document.getElementById('emergency-modal-group-sos-btn');
  const groupSosText = document.getElementById('emergency-modal-group-sos-text');
  if (groupSosBtn && groupSosText) {
    if (state.myUser.isSos) {
      groupSosBtn.className = 'w-full py-3.5 px-4 rounded-2xl bg-red-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 animate-pulse shadow-xl transition active:scale-95';
      groupSosText.textContent = '⚠️ ALERTE SOS GROUPE ACTIVE (CLIQUEZ POUR ARRÊTER)';
    } else {
      groupSosBtn.className = 'w-full py-3.5 px-4 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border-2 border-red-500/50 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95';
      groupSosText.textContent = '🚨 Activer l\'alerte SOS sur les téléphones du groupe';
    }
  }

  lucide.createIcons();
}

function openEmergencyModal() {
  updateEmergencyModalGpsData();
  const modal = document.getElementById('emergency-modal');
  if (modal) modal.classList.remove('hidden');

  // Forcer une acquisition GPS haute précision fraîche
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.myUser.lat = pos.coords.latitude;
        state.myUser.lon = pos.coords.longitude;
        if (pos.coords.altitude !== null && !isNaN(pos.coords.altitude)) state.myUser.ele = Math.round(pos.coords.altitude);
        state.myUser.accuracy = pos.coords.accuracy || 10;
        updateEmergencyModalGpsData();
      },
      (err) => { console.warn('[Emergency GPS]', err); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
}

function closeEmergencyModal() {
  const modal = document.getElementById('emergency-modal');
  if (modal) modal.classList.add('hidden');
}

function copyEmergencyGpsCoords() {
  const lat = state.myUser.lat || 45.8920;
  const lon = state.myUser.lon || 6.1550;
  const ele = state.myUser.ele || 0;
  const acc = state.myUser.accuracy || 10;
  const time = new Date().toLocaleTimeString();

  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';

  const textToCopy = `🚨 URGENCE RANDOTRACKER\nCoordonnées GPS : ${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}\nFormat DMS : ${toDMS(lat, true)}, ${toDMS(lon, false)}\nAltitude : ${Math.round(ele)} m (Précision : ±${Math.round(acc)} m)\nRelevé à : ${time}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('📋 Coordonnées GPS copiées dans le presse-papier !', 'success');
      const copyTextEl = document.getElementById('copy-emergency-gps-text');
      if (copyTextEl) {
        copyTextEl.textContent = '✅ Coordonnées copiées !';
        setTimeout(() => { copyTextEl.textContent = 'Copier les coordonnées complètes'; }, 3000);
      }
    }).catch(() => {
      prompt('Copiez vos coordonnées GPS :', textToCopy);
    });
  } else {
    prompt('Copiez vos coordonnées GPS :', textToCopy);
  }
}

function toggleGroupSosAlert() {
  state.myUser.isSos = !state.myUser.isSos;
  
  const sosBtn = document.getElementById('sos-toggle-btn');
  const sosText = document.getElementById('sos-btn-text');

  if (state.myUser.isSos) {
    if (sosBtn) {
      sosBtn.classList.remove('bg-red-600/20', 'text-red-400');
      sosBtn.classList.add('bg-red-600', 'text-white', 'animate-pulse');
    }
    if (sosText) sosText.textContent = '⚠️ ALERTE SOS ACTIVE (ANNULER)';
    showToast('🚨 ALERTE SOS DIFFUSÉE AU GROUPE !', 'error');
  } else {
    if (sosBtn) {
      sosBtn.classList.add('bg-red-600/20', 'text-red-400');
      sosBtn.classList.remove('bg-red-600', 'text-white', 'animate-pulse');
    }
    if (sosText) sosText.textContent = '🚨 SIGNALER UN PROBLÈME / SOS';
    showToast('Alerte SOS désactivée', 'info');
  }

  updateEmergencyModalGpsData();
  broadcastMyPosition();
}

// Heartbeat périodique (toutes les 5 secondes) pour garantir la présence même à l'arrêt
let heartbeatInterval = null;
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (mqttClient && mqttClient.connected) {
      broadcastMyPosition();
    }
  }, 5000);
}

// Gestion du Wake Lock (Évite que l'écran s'éteigne pendant la marche active)
let screenWakeLock = null;
async function requestScreenWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      screenWakeLock = await navigator.wakeLock.request('screen');
      screenWakeLock.addEventListener('release', () => {
        screenWakeLock = null;
      });
    } catch (err) {
      console.warn('[WakeLock] Maintien écran indisponible:', err);
    }
  }
}

// 1. Réveil automatique lors du déverrouillage de l'écran ou retour sur l'onglet
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('[App] Réveil de l\'écran / Retour application');
    if (!mqttClient || !mqttClient.connected) {
      initMqttSync();
    } else {
      broadcastMyPosition();
      publishMessage({
        type: 'request_presence',
        from: state.myUser.id
      });
    }

    if (state.isTrackingGps) {
      requestScreenWakeLock();
    }
  }
});

// 2. Reconnexion automatique instantanée lors du retour de la 4G/5G/Wi-Fi
window.addEventListener('online', () => {
  console.log('[Réseau] Rétablissement de la connexion mobile 4G/5G');
  showToast('📶 Réseau 4G rétabli - Synchronisation...', 'success');
  if (!mqttClient || !mqttClient.connected) {
    initMqttSync();
  } else {
    broadcastMyPosition();
    publishMessage({
      type: 'request_presence',
      from: state.myUser.id
    });
  }
});

// 3. Notification discrète en cas de passage en zone blanche
window.addEventListener('offline', () => {
  console.log('[Réseau] Passage en zone blanche (Hors-ligne)');
  updateConnectionStatus(false);
  showToast('🌲 Zone blanche (Hors-réseau) - GPS actif', 'info');
});

// ============================================================================
// ÉCOUTEURS D'ÉVÉNEMENTS & INTERACTIONS
// ============================================================================
function setupEventListeners() {
  // Navigation inférieure (3 gros boutons)
  const navGps = document.getElementById('nav-btn-gps');
  if (navGps) navGps.addEventListener('click', toggleGps);

  const navUsers = document.getElementById('nav-btn-users');
  if (navUsers) navUsers.addEventListener('click', toggleUsersDrawer);

  // Boutons flottants sur la carte
  const centerBtn = document.getElementById('center-my-gps-btn');
  if (centerBtn) {
    centerBtn.addEventListener('click', () => {
      if (state.isTrackingGps) {
        state.map.setView([state.myUser.lat, state.myUser.lon], 16, { animate: true });
      } else {
        startGpsWatch(true);
      }
    });
  }

  const fitBtn = document.getElementById('fit-all-btn');
  if (fitBtn) fitBtn.addEventListener('click', fitAllTracks);

  // Invitations
  const headerInvite = document.getElementById('header-invite-btn');
  if (headerInvite) headerInvite.addEventListener('click', openInviteModal);

  const drawerInvite = document.getElementById('drawer-invite-btn');
  if (drawerInvite) drawerInvite.addEventListener('click', openInviteModal);

  const closeInvite = document.getElementById('close-invite-modal-btn');
  if (closeInvite) closeInvite.addEventListener('click', () => document.getElementById('invite-modal').classList.add('hidden'));

  const shareBtn = document.getElementById('share-native-btn');
  if (shareBtn) shareBtn.addEventListener('click', shareInviteLink);

  const copyBtn = document.getElementById('copy-link-btn');
  if (copyBtn) copyBtn.addEventListener('click', copyInviteLink);

  // Fermetures tiroirs
  const closeUsers = document.getElementById('close-users-panel-btn');
  if (closeUsers) closeUsers.addEventListener('click', closeAllDrawers);

  // Import GPX Multifichiers (1 à 5 fichiers sélectionnés d'un coup)
  const gpxInput = document.getElementById('gpx-file-input');
  if (gpxInput) {
    gpxInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      let countAdded = 0;
      for (const file of files) {
        if (state.tracks.length >= MAX_TRACKS) {
          alert(`Limite de ${MAX_TRACKS} traces GPX atteinte.`);
          break;
        }
        try {
          const text = await file.text();
          const parsed = parseGpxContent(text, file.name);
          addTrackToState(parsed);
          countAdded++;
        } catch (err) {
          alert(`Erreur dans ${file.name} : ${err.message}`);
        }
      }
      gpxInput.value = '';
      if (countAdded > 0) {
        saveHikeSessionToStorage();
        fitAllTracks();
      }
    });
  }

  // Fermer profil altimétrique
  const closeEle = document.getElementById('close-ele-drawer-btn');
  if (closeEle) {
    closeEle.addEventListener('click', () => {
      document.getElementById('elevation-drawer').classList.add('hidden');
      if (state.hoverMarker) {
        state.map.removeLayer(state.hoverMarker);
        state.hoverMarker = null;
      }
    });
  }

  // Modal Fonds de Carte (IGN / Topo / Satellite / OSM)
  const layerModal = document.getElementById('layer-modal');
  const openLayerBtn = document.getElementById('open-layer-modal-btn');
  const closeLayerBtn = document.getElementById('close-layer-modal-btn');

  if (openLayerBtn) openLayerBtn.addEventListener('click', () => layerModal.classList.remove('hidden'));
  if (closeLayerBtn) closeLayerBtn.addEventListener('click', () => layerModal.classList.add('hidden'));

  document.querySelectorAll('.layer-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setBaseLayer(btn.getAttribute('data-layer'));
      layerModal.classList.add('hidden');
    });
  });

  // Modal Code de Salon de Randonnée
  const roomModal = document.getElementById('room-modal');
  const inputRoom = document.getElementById('input-room-code');
  const openRoomBtn = document.getElementById('open-room-btn');
  const closeRoomBtn = document.getElementById('close-room-modal-btn');
  const cancelRoomBtn = document.getElementById('cancel-room-btn');
  const saveRoomBtn = document.getElementById('save-room-btn');

  if (openRoomBtn) {
    openRoomBtn.addEventListener('click', () => {
      if (inputRoom) inputRoom.value = state.roomCode;
      if (roomModal) roomModal.classList.remove('hidden');
    });
  }
  if (closeRoomBtn) closeRoomBtn.addEventListener('click', () => roomModal.classList.add('hidden'));
  if (cancelRoomBtn) cancelRoomBtn.addEventListener('click', () => roomModal.classList.add('hidden'));
  if (saveRoomBtn) {
    saveRoomBtn.addEventListener('click', () => {
      const val = inputRoom.value.toUpperCase().trim();
      if (val) {
        if (val !== state.roomCode) {
          state.otherUsers.forEach((u, id) => removeUserMarker(id));
          state.otherUsers.clear();
          state.roomCode = val;
          updateRoomDisplay();
          loadSavedOtherUsersFromStorage();
          initMqttSync();
          saveHikeSessionToStorage();
        }
        roomModal.classList.add('hidden');
        showToast(`Salon connecté : ${state.roomCode}`, 'success');
      }
    });
  }

  // Modal À Propos : Jean-Luc DAUSSY 2026
  const aboutModal = document.getElementById('about-modal');
  const brandHeaderBtn = document.getElementById('brand-header-btn');
  const closeAboutBtn = document.getElementById('close-about-modal-btn');
  const okAboutBtn = document.getElementById('ok-about-modal-btn');

  if (brandHeaderBtn && aboutModal) {
    brandHeaderBtn.addEventListener('click', () => {
      aboutModal.classList.remove('hidden');
    });
  }
  if (closeAboutBtn && aboutModal) {
    closeAboutBtn.addEventListener('click', () => {
      aboutModal.classList.add('hidden');
    });
  }
  if (okAboutBtn && aboutModal) {
    okAboutBtn.addEventListener('click', () => {
      aboutModal.classList.add('hidden');
    });
  }

  // Secours & Urgence (15 SAMU / 112 Pompiers / Coordonnées GPS)
  const sosBtn = document.getElementById('sos-toggle-btn');
  if (sosBtn) {
    sosBtn.addEventListener('click', openEmergencyModal);
  }

  // Modal Profil Utilisateur (Nom, Rôle, 12 Avatars, Trace GPX Suivie, Durée limite)
  const profileModal = document.getElementById('profile-modal');
  const openProfile = () => {
    updateProfileUI();
    profileModal.classList.remove('hidden');
  };

  const openProfileBtn = document.getElementById('open-profile-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-modal-btn');
  const cancelProfileBtn = document.getElementById('cancel-profile-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');

  if (openProfileBtn) openProfileBtn.addEventListener('click', openProfile);
  if (editProfileBtn) editProfileBtn.addEventListener('click', openProfile);
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
  if (cancelProfileBtn) cancelProfileBtn.addEventListener('click', () => profileModal.classList.add('hidden'));

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-opt').forEach(b => {
        b.classList.remove('border-white', 'scale-110');
        b.classList.add('border-transparent');
      });
      btn.classList.add('border-white', 'scale-110');
      btn.classList.remove('border-transparent');
      state.myUser.color = btn.getAttribute('data-color');
      state.myUser.icon = btn.getAttribute('data-icon');
    });
  });

  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveUserProfile);

  // Boutons de messages rapides prédéfinis pour l'organisateur
  document.querySelectorAll('.preset-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-preset');
      if (text) sendAnnouncement(text);
    });
  });
}

// Watchdog de nettoyage automatique des participants inactifs (> 5 heures de silence)
function cleanStaleUsers() {
  const now = Date.now();
  const maxAgeMs = 5 * 3600 * 1000; // 5 heures pour préserver les positions en zone blanche
  let changed = false;

  state.otherUsers.forEach((user, id) => {
    if (now - (user.lastSeen || 0) > maxAgeMs) {
      console.log(`[Watchdog] Nettoyage participant expiré (> 5h) : ${user.name} (${id})`);
      removeUserMarker(id);
      state.otherUsers.delete(id);
      changed = true;
    }
  });

  if (changed) {
    saveOtherUsersToStorage();
    renderUsersList();
  }
}

// ============================================================================
// DÉMARRAGE DE L'APPLICATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initMap();
  initUserRole();
  loadUserProfile();
  setupEventListeners();
  initRealtimeSync();

  createOrUpdateUserMarker(state.myUser);
  loadSavedOtherUsersFromStorage();
  renderUsersList();

  // CHARGEMENT DE LA SESSION PERSISTANTE (SI RANDONNÉE EN COURS < 8H/24H)
  const hasRestored = loadHikeSessionFromStorage();
  if (!hasRestored) {
    renderQuickTracksBar();
  }

  startHeartbeat();
  setInterval(cleanStaleUsers, 10000); // Surveillance toutes les 10s

  lucide.createIcons();

  // DÉMARRAGE IMMÉDIAT DE LA GÉOLOCALISATION GPS
  if (navigator.geolocation) {
    console.log('[GPS] Démarrage automatique de la géolocalisation...');
    startGpsWatch(true);
  }
});
