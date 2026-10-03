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
  { name: 'Orange Fluo', hex: '#f97316', border: '#ea580c', bgClass: 'bg-orange-500' },
  { name: 'Violet Améthyste', hex: '#8b5cf6', border: '#7c3aed', bgClass: 'bg-purple-500' },
  { name: 'Jaune Soleil', hex: '#eab308', border: '#ca8a04', bgClass: 'bg-yellow-500' },
  { name: 'Cyan Lagon', hex: '#06b6d4', border: '#0891b2', bgClass: 'bg-cyan-500' },
  { name: 'Rose Magenta', hex: '#ec4899', border: '#db2777', bgClass: 'bg-pink-500' },
  { name: 'Blanc Alpin', hex: '#f8fafc', border: '#cbd5e1', bgClass: 'bg-slate-100' },
  { name: 'Marron Fauve', hex: '#b45309', border: '#92400e', bgClass: 'bg-amber-700' }
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
  isOrganizer: true, // true pour l'Organisateur, false pour les Invités
  myUser: {
    id: getOrCreateUserId(),
    name: 'Animateur',
    role: 'Guide de tête',
    icon: '🌲',
    color: '#059669',
    assignedTrackId: 'auto', // 'auto' ou l'ID d'une trace GPX
    lat: 45.8920,
    lon: 6.1550,
    ele: 450,
    speed: 0.0,
    movingAvgSpeed: 0.0,
    movingDistance: 0.0,
    movingTimeMs: 0,
    pausedTimeMs: 0,
    isAutoPaused: false,
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
  lastGpsPos: null,
  lastGpsTimestamp: null,
  offTrackCounter: 0,
  lastOffTrackAlertTime: 0,
  wasOffTrackAlerted: false,
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

  // Si pas de trace définie ou 'auto', trouver la trace géographiquement la plus proche
  if (!track) {
    let minDistanceToAnyTrack = Infinity;
    state.tracks.forEach(t => {
      if (t.visible !== false && t.points && t.points.length > 0) {
        for (let i = 0; i < t.points.length; i++) {
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

  // Fallback si toutes les traces étaient masquées
  if (!track && state.tracks.length > 0) {
    track = state.tracks[0];
  }

  if (!track || !track.points || track.points.length === 0) {
    return null;
  }

  // 2. Trouver le point le plus proche sur la trace sélectionnée
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
  const startPt = track.points[0];
  const distToStart = calculateDistance(user.lat, user.lon, startPt.lat, startPt.lon);
  const distFromStart = closestPt.distanceFromStart || 0;
  const totalDist = track.totalDistance || 1;
  const remainingDist = Math.max(0, totalDist - distFromStart);
  const isOffTrack = minDistance > 0.05; // Hors sentier si à plus de 50m
  const progressPct = Math.min(100, Math.max(0, Math.round((distFromStart / totalDist) * 100)));

  // 3. Calcul du dénivelé positif restant (D+ restant)
  let remainingEleGain = 0;
  for (let i = closestIndex; i < track.points.length - 1; i++) {
    const diff = (track.points[i + 1].ele || 0) - (track.points[i].ele || 0);
    if (diff > 0.5) remainingEleGain += diff;
  }
  remainingEleGain = Math.round(remainingEleGain);

  // 4. Calcul de la vitesse de marche et du temps restant (Formule Suisse / FFRando)
  // Basé prioritairement sur la Vitesse Moyenne en Déplacement (Moving Speed)
  let walkingSpeed = 4.0;
  if (user.movingAvgSpeed && user.movingAvgSpeed >= 1.5 && user.movingAvgSpeed <= 12.0) {
    walkingSpeed = user.movingAvgSpeed;
  } else if (user.speed && user.speed >= 1.8 && user.speed <= 12.0) {
    walkingSpeed = (user.speed * 0.7) + (4.0 * 0.3);
  }

  // Temps restant : (Distance à plat / Vitesse de déplacement) + (D+ restant / 350m par heure)
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
  } else if (isOffTrack && minDistance > 1.0) {
    etaFormatted = `${etaHours}h${etaMins} (${durationStr} sur circuit)`;
  }

  return {
    trackId: track.id,
    trackName: track.name,
    trackColor: track.color ? track.color.hex : '#10b981',
    progressPct: progressPct,
    distFromStart: distFromStart,
    distToStart: distToStart,
    distanceToTrack: minDistance, // en kilomètres réels
    isOffTrack: isOffTrack,
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
// GESTION DES RÔLES : MODE ÉGALITAIRE POUR TOUS LES MARCHEURS
// ============================================================================
function initUserRole() {
  // Tous les participants sont égaux avec l'application complète installée
  state.isOrganizer = true;
  localStorage.setItem('rando_is_organizer', 'true');
  applyRoleUI();
}

function applyRoleUI() {
  const headerInvite = document.getElementById('header-invite-btn');
  const drawerAdminActions = document.getElementById('drawer-admin-actions');
  const navBtnGpx = document.getElementById('nav-btn-gpx');
  const navBtnEle = document.getElementById('nav-btn-ele');

  if (headerInvite) headerInvite.classList.remove('hidden');
  if (drawerAdminActions) drawerAdminActions.classList.remove('hidden');
  if (navBtnGpx) navBtnGpx.classList.remove('hidden');
  if (navBtnEle) navBtnEle.classList.add('hidden');

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
// GESTION DU PROFIL UTILISATEUR & ÉCHELLE DE LISIBILITÉ OUTDOOR
// ============================================================================
function applyUiScale(scale = 'normal') {
  document.documentElement.classList.remove('ui-scale-normal', 'ui-scale-large', 'ui-scale-xlarge');
  if (scale === 'large') {
    document.documentElement.classList.add('ui-scale-large');
  } else if (scale === 'xlarge') {
    document.documentElement.classList.add('ui-scale-xlarge');
  } else {
    document.documentElement.classList.add('ui-scale-normal');
  }

  localStorage.setItem('rando_ui_scale', scale);

  // Mettre à jour l'état visuel des boutons de zoom/lisibilité
  document.querySelectorAll('.ui-scale-btn').forEach(btn => {
    const btnScale = btn.getAttribute('data-scale');
    if (btnScale === scale) {
      btn.className = 'ui-scale-btn py-2.5 px-2 rounded-xl border-2 border-emerald-500 bg-emerald-600/30 text-white font-black text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-md';
    } else {
      btn.className = 'ui-scale-btn py-2.5 px-2 rounded-xl border-2 border-slate-700 bg-slate-800 text-slate-300 font-black text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 hover:border-slate-600';
    }
  });

  // Forcer Leaflet à recalculer sa taille géométrique
  if (state.map) {
    setTimeout(() => {
      state.map.invalidateSize();
    }, 100);
  }
}

function loadSavedUiScale() {
  const savedScale = localStorage.getItem('rando_ui_scale') || 'normal';
  applyUiScale(savedScale);
}

function isOffTrackSoundEnabled() {
  const saved = localStorage.getItem('rando_offtrack_sound_enabled');
  return saved === null ? true : saved === 'true';
}

function setOffTrackSoundEnabled(enabled) {
  localStorage.setItem('rando_offtrack_sound_enabled', enabled ? 'true' : 'false');
}

function loadUserProfile() {
  loadSavedUiScale();

  const savedName = localStorage.getItem('rando_user_name');
  const savedRole = localStorage.getItem('rando_user_role');
  const savedIcon = localStorage.getItem('rando_user_icon');
  const savedColor = localStorage.getItem('rando_user_color');
  const savedTrack = localStorage.getItem('rando_user_track');
  const savedDuration = localStorage.getItem('rando_share_duration');

  if (savedName) {
    state.myUser.name = savedName;
  } else {
    state.myUser.name = 'Animateur';
    localStorage.setItem('rando_user_name', state.myUser.name);
  }

  if (savedRole) {
    state.myUser.role = savedRole;
  } else {
    state.myUser.role = 'Guide de tête';
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
  const soundToggle = document.getElementById('toggle-offtrack-sound');

  if (inputName) inputName.value = state.myUser.name;
  if (inputRole) inputRole.value = state.myUser.role;
  if (inputDuration) inputDuration.value = String(state.shareDurationHours);
  if (soundToggle) soundToggle.checked = isOffTrackSoundEnabled();

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

  const savedScale = localStorage.getItem('rando_ui_scale') || 'normal';
  document.querySelectorAll('.ui-scale-btn').forEach(btn => {
    const btnScale = btn.getAttribute('data-scale');
    if (btnScale === savedScale) {
      btn.className = 'ui-scale-btn py-2.5 px-2 rounded-xl border-2 border-emerald-500 bg-emerald-600/30 text-white font-black text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-md';
    } else {
      btn.className = 'ui-scale-btn py-2.5 px-2 rounded-xl border-2 border-slate-700 bg-slate-800 text-slate-300 font-black text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 hover:border-slate-600';
    }
  });
}

function closeProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) profileModal.classList.add('hidden');
  closeAllDrawers(); // Ferme également le panneau participants pour revenir directement sur la carte
}

function saveUserProfile() {
  const name = document.getElementById('input-user-name').value.trim();
  const role = document.getElementById('input-user-role').value;
  const duration = parseFloat(document.getElementById('input-share-duration').value);
  const trackId = document.getElementById('input-user-track').value;
  const soundToggle = document.getElementById('toggle-offtrack-sound');

  if (name) state.myUser.name = name;
  if (role) state.myUser.role = role;
  state.myUser.assignedTrackId = trackId || 'auto';
  state.shareDurationHours = Math.min(ABSOLUTE_MAX_HOURS, Math.max(1, isNaN(duration) ? 8 : duration));

  if (soundToggle) {
    setOffTrackSoundEnabled(soundToggle.checked);
  }

  localStorage.setItem('rando_user_name', state.myUser.name);
  localStorage.setItem('rando_user_role', state.myUser.role);
  localStorage.setItem('rando_user_icon', state.myUser.icon);
  localStorage.setItem('rando_user_color', state.myUser.color);
  localStorage.setItem('rando_user_track', state.myUser.assignedTrackId);
  localStorage.setItem('rando_share_duration', String(state.shareDurationHours));

  updateProfileUI();
  saveHikeSessionToStorage();
  closeProfileModal();
  broadcastMyPosition();
  showToast(`Profil enregistré : ${state.myUser.name} (${state.myUser.icon})`, 'success');
}

// ============================================================================
// SERVICE WORKER & PWA
// ============================================================================
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=49')
      .then((reg) => {
        console.log('[PWA] Service Worker v49 actif:', reg.scope);
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

  // 6. Calque de Surimpression : Pentes Fortes de Montagne IGN (> 30° / 35° / 40° / 45°)
  state.layers.slopes = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 18,
      opacity: 0.65,
      zIndex: 10,
      attribution: '&copy; IGN Pentes Montagne',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  state.layers.ign.addTo(state.map);

  // Restauration du calque de pentes de montagne
  const slopesToggle = document.getElementById('toggle-slopes-layer');
  const savedSlopes = localStorage.getItem('rando_show_slopes') === 'true';
  if (savedSlopes) {
    state.layers.slopes.addTo(state.map);
    if (slopesToggle) slopesToggle.checked = true;
  }
  if (slopesToggle) {
    slopesToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.layers.slopes.addTo(state.map);
        localStorage.setItem('rando_show_slopes', 'true');
        showToast('🏔️ Pentes fortes IGN (> 30°) activées', 'info');
      } else {
        state.map.removeLayer(state.layers.slopes);
        localStorage.setItem('rando_show_slopes', 'false');
        showToast('Pentes fortes IGN masquées', 'info');
      }
    });
  }

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 200);

  // Rafraîchir les icônes & activer le déplacement tactile/souris et zoom des popups
  state.map.on('popupopen', (e) => {
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
    if (e && e.popup) {
      const popupEl = e.popup.getElement();
      if (popupEl) {
        makePopupDraggable(popupEl);
        applySavedPopupZoom(popupEl);
      }
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

  // Maintenir le calque de pentes de montagne au-dessus
  if (state.layers.slopes && state.map.hasLayer(state.layers.slopes)) {
    state.layers.slopes.bringToFront();
  }

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
    weight: 6,
    opacity: 0.98,
    smoothFactor: 1.2,
    lineCap: 'round',
    lineJoin: 'round'
  });

  mainPolyline.bindPopup(`
    <div class="space-y-3 p-1 min-w-[280px] sm:min-w-[330px]">
      <!-- Barre de déplacement & Zoom de la fenêtre popup -->
      <div class="popup-drag-bar flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span class="flex items-center gap-1.5 cursor-grab">
          <span class="text-emerald-400 font-mono text-sm leading-none">⠿</span>
          <span>Déplacer</span>
        </span>
        <div class="flex items-center gap-1">
          <button type="button" onclick="adjustPopupZoom(this, -0.15)" class="popup-zoom-btn" title="Réduire la taille">A-</button>
          <span class="popup-zoom-level-badge text-[10px] font-mono text-emerald-400 px-1">100%</span>
          <button type="button" onclick="adjustPopupZoom(this, 0.15)" class="popup-zoom-btn" title="Agrandir la taille">A+</button>
        </div>
        <span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Parcours GPX</span>
      </div>

      <div class="flex items-center gap-3 pb-2.5 border-b-2 border-slate-700">
        <span class="w-5 h-5 rounded-full shadow-lg shrink-0 border-2 border-white" style="background-color: ${track.color.hex}"></span>
        <h4 class="font-black text-lg sm:text-xl text-white truncate leading-tight">${track.name}</h4>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm text-slate-200">
        <div class="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 flex flex-col">
          <span class="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">Distance</span>
          <b class="text-white text-base sm:text-lg mt-0.5">${track.totalDistance.toFixed(1)} km</b>
        </div>
        <div class="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 flex flex-col">
          <span class="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">Dénivelé +</span>
          <b class="text-emerald-400 text-base sm:text-lg mt-0.5">+${track.eleGain} m</b>
        </div>
        <div class="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 flex flex-col">
          <span class="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">Alt. Min</span>
          <b class="text-white text-base sm:text-lg mt-0.5">${track.minEle} m</b>
        </div>
        <div class="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 flex flex-col">
          <span class="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">Alt. Max</span>
          <b class="text-white text-base sm:text-lg mt-0.5">${track.maxEle} m</b>
        </div>
      </div>
      <button onclick="openElevationDrawer('${track.id}')" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl active:scale-95 transition">
        📈 Voir Profil Altimétrique
      </button>
    </div>
  `);

  layerGroup.addLayer(borderPolyline);
  layerGroup.addLayer(mainPolyline);

  // Marqueur Départ GÉANT
  if (track.points.length > 0) {
    const startPt = track.points[0];
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: `<div class="w-11 h-11 rounded-full bg-emerald-500 border-3 border-white flex items-center justify-center text-sm font-black text-white shadow-2xl">D</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon }).bindTooltip(`Départ : ${track.name}`, { direction: 'top' });
    layerGroup.addLayer(startMarker);
  }

  // Marqueur Arrivée GÉANT
  if (track.points.length > 1) {
    const endPt = track.points[track.points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `<div class="w-11 h-11 rounded-full bg-slate-900 border-3 border-white flex items-center justify-center text-xl font-black text-white shadow-2xl">🏁</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
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
  pushModalState('tracks-modal');
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
      <!-- Ligne 1 : Pastille Cliquable, Nom, Métadonnées et Statut -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <!-- Pastille de couleur interactive : clic pour faire défiler les couleurs -->
          <button type="button" onclick="cycleTrackColor('${track.id}')" class="relative group p-1 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-white transition active:scale-90 shrink-0 shadow-md" title="Cliquer pour changer la couleur de cette trace (${track.color.name || 'Couleur'})">
            <span class="w-6 h-6 rounded-full border-2 border-white block shadow" style="background-color: ${track.color.hex};"></span>
            <span class="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 border border-slate-600 rounded-full flex items-center justify-center text-[9px] shadow">🎨</span>
          </button>
          <div class="min-w-0 flex-1">
            <div class="font-black text-white text-base truncate leading-tight">${track.name}</div>
            <div class="flex items-center gap-2 mt-1 text-xs">
              <span class="font-mono font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-lg">${track.totalDistance.toFixed(1)} km</span>
              <span class="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg">+${Math.round(track.eleGain || 0)}m D+</span>
              <span class="text-slate-400 text-[11px] font-bold">(${track.color.name || 'Couleur'})</span>
            </div>
          </div>
        </div>

        <button onclick="toggleTrackVisibility('${track.id}')" class="px-3 py-1.5 rounded-xl ${track.visible ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700'} text-xs font-black transition active:scale-95 shrink-0" title="Afficher ou masquer cette trace sur la carte">
          ${track.visible ? '👁️ Visible' : '🙈 Masquée'}
        </button>
      </div>

      <!-- Ligne 2 : Sélecteur direct de couleur (Palette 10 teintes Outdoor) -->
      <div class="flex items-center gap-1.5 pt-2 pb-1 border-t border-slate-800/80 overflow-x-auto">
        <span class="text-[10px] text-slate-400 font-black uppercase shrink-0">Couleur :</span>
        <div class="flex items-center gap-1.5 shrink-0">
          ${TRACK_COLORS.map(c => `
            <button type="button" onclick="setTrackColor('${track.id}', '${c.hex}')" class="w-6 h-6 rounded-full border-2 ${track.color.hex.toLowerCase() === c.hex.toLowerCase() ? 'border-white scale-110 ring-2 ring-emerald-400 shadow-lg' : 'border-slate-700 opacity-75 hover:opacity-100 hover:scale-110'} transition active:scale-90 shrink-0" style="background-color: ${c.hex};" title="Choisir la couleur ${c.name}">
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Ligne 3 : Actions Rapides -->
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

function setTrackColor(trackId, colorHex) {
  const track = state.tracks.find(t => t.id === trackId);
  if (!track) return;

  const foundColor = TRACK_COLORS.find(c => c.hex.toLowerCase() === colorHex.toLowerCase());
  track.color = foundColor || {
    name: 'Personnalisée',
    hex: colorHex,
    border: colorHex,
    bgClass: 'bg-emerald-500'
  };

  // 1. Mettre à jour le calque Leaflet de la trace
  const oldLayer = state.trackLayers.get(trackId);
  if (oldLayer) {
    state.map.removeLayer(oldLayer);
    state.trackLayers.delete(trackId);
  }
  renderTrackOnMap(track);

  // 2. Mettre à jour l'en-tête et la modale
  renderQuickTracksBar();
  saveHikeSessionToStorage();

  // 3. Mettre à jour le profil altimétrique si ouvert sur cette trace
  if (typeof elevationProfileState !== 'undefined' && elevationProfileState.trackId === trackId) {
    const colorDot = document.getElementById('ele-drawer-color');
    if (colorDot) colorDot.style.backgroundColor = track.color.hex;
    renderElevationChart();
  }

  // 4. Mettre à jour mon profil si cette trace est assignée
  updateProfileUI();

  // 5. Synchroniser immédiatement avec le groupe MQTT
  publishMessage({
    type: 'sync_tracks',
    from: state.myUser.id,
    tracks: state.tracks
  });

  showToast(`Couleur changée : ${track.color.name} 🎨`, 'success');
}

function cycleTrackColor(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (!track) return;

  const currentIdx = TRACK_COLORS.findIndex(c => c.hex.toLowerCase() === (track.color.hex || '').toLowerCase());
  const nextIdx = (currentIdx + 1) % TRACK_COLORS.length;
  setTrackColor(trackId, TRACK_COLORS[nextIdx].hex);
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
// PROFIL ALTIMÉTRIQUE INTERACTIF, ZOOMABLE (1x à 12x) & PLEIN ÉCRAN
// ============================================================================
const elevationProfileState = {
  trackId: null,
  zoomLevel: 1, // 1, 1.5, 2, 3, 5, 8, 12
  zoomSteps: [1, 1.5, 2, 3, 5, 8, 12],
  windowStartPct: 0, // 0 à 100%
  windowEndPct: 100, // 0 à 100%
  activePoints: [],
  allPoints: [],
  isExpanded: false
};

function openElevationDrawer(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (!track || track.points.length === 0) return;

  elevationProfileState.trackId = trackId;
  elevationProfileState.allPoints = track.points;
  elevationProfileState.zoomLevel = 1;
  elevationProfileState.windowStartPct = 0;
  elevationProfileState.windowEndPct = 100;

  const drawer = document.getElementById('elevation-drawer');
  const title = document.getElementById('ele-drawer-title');
  const colorDot = document.getElementById('ele-drawer-color');

  if (title) title.textContent = `${track.name}`;
  if (colorDot) colorDot.style.backgroundColor = track.color.hex || '#10b981';

  if (drawer) {
    drawer.classList.remove('hidden');
  }
  pushModalState('elevation-drawer');

  renderElevationChart();
}

function renderElevationChart() {
  const track = state.tracks.find(t => t.id === elevationProfileState.trackId);
  if (!track || !elevationProfileState.allPoints || elevationProfileState.allPoints.length === 0) return;

  const totalPts = elevationProfileState.allPoints.length;
  const startIdx = Math.max(0, Math.floor((elevationProfileState.windowStartPct / 100) * (totalPts - 1)));
  const endIdx = Math.min(totalPts - 1, Math.ceil((elevationProfileState.windowEndPct / 100) * (totalPts - 1)));
  
  const visiblePoints = elevationProfileState.allPoints.slice(startIdx, Math.max(startIdx + 2, endIdx + 1));
  elevationProfileState.activePoints = visiblePoints;

  // Calcul des métadonnées sur la portion active
  const firstPt = visiblePoints[0];
  const lastPt = visiblePoints[visiblePoints.length - 1];
  const segDist = Math.max(0.05, (lastPt.distanceFromStart - firstPt.distanceFromStart));
  
  let segEleGain = 0;
  let segMinEle = Infinity;
  let segMaxEle = -Infinity;

  for (let i = 0; i < visiblePoints.length; i++) {
    const p = visiblePoints[i];
    if (p.ele < segMinEle) segMinEle = p.ele;
    if (p.ele > segMaxEle) segMaxEle = p.ele;
    if (i > 0) {
      const diff = p.ele - visiblePoints[i - 1].ele;
      if (diff > 0.5) segEleGain += diff;
    }
  }
  if (segMinEle === Infinity) segMinEle = 0;
  if (segMaxEle === -Infinity) segMaxEle = 0;

  const avgSlope = (segEleGain / (segDist * 1000)) * 100;

  // Mise à jour des cartes métriques
  const distEl = document.getElementById('ele-stat-dist');
  const gainEl = document.getElementById('ele-stat-gain');
  const minmaxEl = document.getElementById('ele-stat-minmax');
  const slopeEl = document.getElementById('ele-stat-slope');
  const rangeTextEl = document.getElementById('ele-drawer-range-text');
  const zoomBadge = document.getElementById('ele-zoom-badge');

  if (distEl) distEl.textContent = `${segDist.toFixed(1)} km`;
  if (gainEl) gainEl.textContent = `+${Math.round(segEleGain)} m`;
  if (minmaxEl) minmaxEl.textContent = `${Math.round(segMinEle)} / ${Math.round(segMaxEle)} m`;
  if (slopeEl) slopeEl.textContent = `${avgSlope.toFixed(1)} %`;
  if (rangeTextEl) rangeTextEl.textContent = `${firstPt.distanceFromStart.toFixed(1)} km → ${lastPt.distanceFromStart.toFixed(1)} km (${segDist.toFixed(1)} km)`;
  
  if (zoomBadge) {
    if (elevationProfileState.zoomLevel === 1) {
      zoomBadge.textContent = 'Zoom 1x (Tout)';
      zoomBadge.className = 'text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0';
    } else {
      zoomBadge.textContent = `Zoom ${elevationProfileState.zoomLevel}x`;
      zoomBadge.className = 'text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 animate-pulse';
    }
  }

  // Mise à jour de la minimap / scrubber
  const minimapViewport = document.getElementById('ele-minimap-viewport');
  if (minimapViewport) {
    const leftPct = elevationProfileState.windowStartPct;
    const widthPct = Math.max(4, elevationProfileState.windowEndPct - elevationProfileState.windowStartPct);
    minimapViewport.style.left = `${leftPct}%`;
    minimapViewport.style.width = `${widthPct}%`;
  }

  // État des boutons Pan
  const panLeftBtn = document.getElementById('ele-pan-left-btn');
  const panRightBtn = document.getElementById('ele-pan-right-btn');
  if (panLeftBtn) panLeftBtn.disabled = (elevationProfileState.windowStartPct <= 0.1);
  if (panRightBtn) panRightBtn.disabled = (elevationProfileState.windowEndPct >= 99.9);

  // Échantillonnage pour le tracé graphique (max 120 points pour fluidité 60fps)
  const maxChartPts = 120;
  const chartStep = Math.max(1, Math.floor(visiblePoints.length / maxChartPts));
  const labels = [];
  const elevationData = [];
  const sampledIndices = [];

  for (let i = 0; i < visiblePoints.length; i += chartStep) {
    const pt = visiblePoints[i];
    labels.push(pt.distanceFromStart.toFixed(1) + ' km');
    elevationData.push(pt.ele);
    sampledIndices.push(startIdx + i);
  }

  // Toujours inclure le dernier point
  const lastSampledPt = visiblePoints[visiblePoints.length - 1];
  if (labels[labels.length - 1] !== (lastSampledPt.distanceFromStart.toFixed(1) + ' km')) {
    labels.push(lastSampledPt.distanceFromStart.toFixed(1) + ' km');
    elevationData.push(lastSampledPt.ele);
    sampledIndices.push(endIdx);
  }

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const canvas = document.getElementById('elevation-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 180);
  gradient.addColorStop(0, (track.color.hex || '#10b981') + 'cc');
  gradient.addColorStop(1, (track.color.hex || '#10b981') + '08');

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Altitude (m)',
        data: elevationData,
        borderColor: track.color.hex || '#10b981',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: track.color.hex || '#10b981',
        pointHoverBorderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
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
          borderColor: 'rgba(255, 255, 255, 0.25)',
          borderWidth: 1.5,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => `Position : ${items[0].label}`,
            label: (item) => `Altitude : ${Math.round(item.raw)} m`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' } }
        }
      },
      onHover: (event, activeElements) => {
        if (activeElements && activeElements.length > 0) {
          const sampleIdx = activeElements[0].index;
          if (sampleIdx < sampledIndices.length) {
            const rawIdx = sampledIndices[sampleIdx];
            if (rawIdx < elevationProfileState.allPoints.length) {
              const pt = elevationProfileState.allPoints[rawIdx];
              updateHoverMapMarker(pt.lat, pt.lon);
            }
          }
        }
      }
    }
  });

  lucide.createIcons();
}

function zoomInElevation() {
  const steps = elevationProfileState.zoomSteps;
  const currentIdx = steps.indexOf(elevationProfileState.zoomLevel);
  const nextIdx = Math.min(steps.length - 1, (currentIdx === -1 ? 0 : currentIdx) + 1);
  setElevationZoomLevel(steps[nextIdx]);
}

function zoomOutElevation() {
  const steps = elevationProfileState.zoomSteps;
  const currentIdx = steps.indexOf(elevationProfileState.zoomLevel);
  const nextIdx = Math.max(0, (currentIdx === -1 ? 0 : currentIdx) - 1);
  setElevationZoomLevel(steps[nextIdx]);
}

function resetElevationZoom() {
  setElevationZoomLevel(1);
}

function setElevationZoomLevel(newLevel) {
  elevationProfileState.zoomLevel = newLevel;

  if (newLevel === 1) {
    elevationProfileState.windowStartPct = 0;
    elevationProfileState.windowEndPct = 100;
  } else {
    const currentCenter = (elevationProfileState.windowStartPct + elevationProfileState.windowEndPct) / 2;
    const windowWidth = 100 / newLevel;
    let start = currentCenter - (windowWidth / 2);
    let end = currentCenter + (windowWidth / 2);

    if (start < 0) {
      end += -start;
      start = 0;
    }
    if (end > 100) {
      start -= (end - 100);
      end = 100;
    }
    elevationProfileState.windowStartPct = Math.max(0, start);
    elevationProfileState.windowEndPct = Math.min(100, end);
  }

  renderElevationChart();
}

function panElevation(direction) {
  if (elevationProfileState.zoomLevel <= 1) return;

  const windowWidth = elevationProfileState.windowEndPct - elevationProfileState.windowStartPct;
  const step = windowWidth * 0.35 * direction;

  let newStart = elevationProfileState.windowStartPct + step;
  let newEnd = elevationProfileState.windowEndPct + step;

  if (newStart < 0) {
    newStart = 0;
    newEnd = windowWidth;
  }
  if (newEnd > 100) {
    newEnd = 100;
    newStart = 100 - windowWidth;
  }

  elevationProfileState.windowStartPct = Math.max(0, newStart);
  elevationProfileState.windowEndPct = Math.min(100, newEnd);

  renderElevationChart();
}

function handleElevationMinimapClick(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickPct = (clickX / rect.width) * 100;

  if (elevationProfileState.zoomLevel <= 1) {
    elevationProfileState.zoomLevel = 2;
  }

  const windowWidth = 100 / elevationProfileState.zoomLevel;
  let start = clickPct - (windowWidth / 2);
  let end = clickPct + (windowWidth / 2);

  if (start < 0) {
    end += -start;
    start = 0;
  }
  if (end > 100) {
    start -= (end - 100);
    end = 100;
  }

  elevationProfileState.windowStartPct = Math.max(0, start);
  elevationProfileState.windowEndPct = Math.min(100, end);

  renderElevationChart();
}

function fitMapToZoomedSection() {
  if (!elevationProfileState.activePoints || elevationProfileState.activePoints.length === 0) return;

  const latlngs = elevationProfileState.activePoints.map(p => [p.lat, p.lon]);
  const bounds = L.latLngBounds(latlngs);
  state.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  showToast('🎯 Carte cadrée sur la section zoomée', 'success');
}

function toggleElevationFullscreen() {
  const drawer = document.getElementById('elevation-drawer');
  const icon = document.getElementById('ele-fullscreen-icon');
  if (!drawer) return;

  elevationProfileState.isExpanded = !elevationProfileState.isExpanded;

  if (elevationProfileState.isExpanded) {
    drawer.classList.add('is-fullscreen');
    if (icon) {
      icon.setAttribute('data-lucide', 'minimize-2');
    }
  } else {
    drawer.classList.remove('is-fullscreen');
    if (icon) {
      icon.setAttribute('data-lucide', 'maximize-2');
    }
  }

  setTimeout(() => {
    if (state.chartInstance) {
      state.chartInstance.resize();
    }
    lucide.createIcons();
  }, 100);
}

function closeElevationDrawer() {
  const drawer = document.getElementById('elevation-drawer');
  const icon = document.getElementById('ele-fullscreen-icon');
  if (drawer) {
    drawer.classList.add('hidden');
    drawer.classList.remove('is-fullscreen');
    elevationProfileState.isExpanded = false;
    if (icon) {
      icon.setAttribute('data-lucide', 'maximize-2');
    }
  }
  if (state.hoverMarker) {
    state.map.removeLayer(state.hoverMarker);
    state.hoverMarker = null;
  }
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
  const distFromMeStr = distFromMe < 1 ? `${Math.round(distFromMe * 1000)} m` : `${distFromMe.toFixed(1)} km`;
  const progress = computeTrackProgress(user);

  // Calcul rigoureux et transparent de l'écart réel à la trace GPX
  let ecartDisplayVal = '--';
  let ecartDisplayColor = 'text-slate-400';
  let ecartStatusTag = '';
  let isFarFromTrack = false;

  if (progress && typeof progress.distanceToTrack === 'number') {
    const dMeters = Math.round(progress.distanceToTrack * 1000);
    if (dMeters < 30) {
      ecartDisplayVal = `${dMeters} m`;
      ecartDisplayColor = 'text-emerald-400';
      ecartStatusTag = 'Sur tracé';
    } else if (dMeters < 150) {
      ecartDisplayVal = `${dMeters} m`;
      ecartDisplayColor = 'text-emerald-300';
      ecartStatusTag = 'Proche';
    } else if (dMeters < 1000) {
      ecartDisplayVal = `${dMeters} m`;
      ecartDisplayColor = 'text-amber-400';
      ecartStatusTag = 'Écart';
      isFarFromTrack = true;
    } else {
      ecartDisplayVal = `${(progress.distanceToTrack).toFixed(1)} km`;
      ecartDisplayColor = 'text-rose-400';
      ecartStatusTag = 'Hors circuit';
      isFarFromTrack = true;
    }
  } else if (!isMe) {
    ecartDisplayVal = distFromMeStr;
    ecartDisplayColor = 'text-blue-400';
    ecartStatusTag = 'Dist. / Vous';
  }

  marker.bindPopup(`
    <div class="p-2 space-y-3 min-w-[280px] max-w-[340px]">
      <!-- Barre de déplacement & Zoom de la fenêtre popup -->
      <div class="popup-drag-bar flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span class="flex items-center gap-1.5 cursor-grab">
          <span class="text-emerald-400 font-mono text-sm leading-none">⠿</span>
          <span>Déplacer</span>
        </span>
        <div class="flex items-center gap-1">
          <button type="button" onclick="adjustPopupZoom(this, -0.15)" class="popup-zoom-btn" title="Réduire la taille">A-</button>
          <span class="popup-zoom-level-badge text-[10px] font-mono text-emerald-400 px-1">100%</span>
          <button type="button" onclick="adjustPopupZoom(this, 0.15)" class="popup-zoom-btn" title="Agrandir la taille">A+</button>
        </div>
        <span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">${isMe ? 'Ma Fiche' : 'Participant'}</span>
      </div>

      <!-- En-tête Participant GÉANT -->
      <div class="flex items-center gap-3 pb-3 border-b-2 border-slate-700/80">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl shrink-0 border-2 border-white/80" style="background-color: ${user.color}">
          ${user.icon || '🌲'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-black text-lg sm:text-xl text-white truncate leading-tight">${user.name} ${isMe ? '<span class="text-xs text-emerald-400 font-bold ml-1">(Moi)</span>' : ''}</div>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold border border-slate-700">${user.role}</span>
            ${!isMe ? `<span class="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">📍 à ${distFromMeStr} de vous</span>` : ''}
            ${progress ? `<span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">ETA ${progress.etaShort}</span>` : ''}
            ${isZoneBlanche ? `<span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">🌲 Zone blanche (${minSinceSeen} min)</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Grille 4 Cartes Statistiques Haut Contraste -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col shadow-inner">
          <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Vitesse Moy.</span>
          <span class="text-base sm:text-lg font-black text-white mt-0.5">${(user.movingAvgSpeed && user.movingAvgSpeed > 0 ? user.movingAvgSpeed : (user.speed || 0)).toFixed(1)} <span class="text-xs font-bold text-slate-400">km/h</span></span>
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
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Écart Trace</span>
            ${ecartStatusTag ? `<span class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${isFarFromTrack ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">${ecartStatusTag}</span>` : ''}
          </div>
          <span class="text-base sm:text-lg font-black ${ecartDisplayColor} mt-0.5">${ecartDisplayVal}</span>
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
          ${isFarFromTrack ? `
            <div class="bg-amber-500/15 border border-amber-500/35 rounded-xl px-2.5 py-1.5 text-xs text-amber-200 flex items-center justify-between">
              <span class="font-bold">⚠️ Hors circuit (${ecartDisplayVal})</span>
              <span class="text-[11px] text-amber-300 font-mono">Départ à ${(progress.distToStart || progress.distanceToTrack).toFixed(1)} km</span>
            </div>
          ` : ''}
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

// ============================================================================
// DÉDUPLICATION AUTOMATIQUE INTELLIGENTE DES RANDONNEURS (ANTI-DOUBLONS GHOSTS)
// ============================================================================
function deduplicateUsersByName() {
  const myName = (state.myUser.name || '').trim().toLowerCase();
  const byName = new Map();

  state.otherUsers.forEach((user, id) => {
    const userName = (user.name || '').trim().toLowerCase();

    // 1. Si un participant porte exactement le même prénom/nom que Moi (ex: ancien test sur tablette)
    if (userName && userName === myName && user.id !== state.myUser.id) {
      console.log(`[Deduplication] Suppression automatique du doublon de moi-même (${user.name} - ${id})`);
      removeUserMarker(id);
      state.otherUsers.delete(id);
      return;
    }

    // 2. Si deux participants distants portent le même nom (ex: rechargement/nouvel ID pour le même marcheur)
    if (byName.has(userName)) {
      const existing = byName.get(userName);
      const existingTime = existing.lastSeen || 0;
      const thisTime = user.lastSeen || 0;

      // Conserver la session la plus fraîche/active
      if (thisTime >= existingTime) {
        console.log(`[Deduplication] Remplacement doublon de ${user.name} (${existing.id}) par la session la plus récente (${id})`);
        removeUserMarker(existing.id);
        state.otherUsers.delete(existing.id);
        byName.set(userName, user);
      } else {
        console.log(`[Deduplication] Suppression session obsolète de ${user.name} (${id})`);
        removeUserMarker(id);
        state.otherUsers.delete(id);
      }
    } else {
      byName.set(userName, user);
    }
  });
}

function renderUsersList() {
  const container = document.getElementById('users-list-container');
  if (!container) return;

  const now = Date.now();
  const maxAgeMs = 5 * 3600 * 1000; // 5 heures de rétention pour préserver le suivi en zone blanche

  // 1. Dédupliquer automatiquement par nom avant le rendu
  deduplicateUsersByName();

  // 2. Nettoyer les expirés > 5h
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

  const displayMySpeed = (state.myUser.movingAvgSpeed && state.myUser.movingAvgSpeed > 0)
    ? state.myUser.movingAvgSpeed.toFixed(1)
    : (state.myUser.speed || 0).toFixed(1);
  if (mySpeedStat) mySpeedStat.textContent = `${displayMySpeed} km/h`;
  if (myEleStat) myEleStat.textContent = `${Math.round(state.myUser.ele || 0)} m`;
  if (myBatteryStat) myBatteryStat.textContent = `${state.myUser.battery || 95}%`;

  // Mettre à jour l'ETA de "Moi"
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
              <span>${(u.movingAvgSpeed && u.movingAvgSpeed > 0 ? u.movingAvgSpeed : (u.speed || 0)).toFixed(1)} km/h ${u.isAutoPaused ? '⏸️' : ''}</span>
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

  closeEmergencyModal();

  if (state.activeDrawer === 'users' && !usersPanel.classList.contains('drawer-closed')) {
    closeAllDrawers();
  } else {
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    if (backdrop) backdrop.classList.remove('hidden');
    state.activeDrawer = 'users';
    const navUsers = document.getElementById('nav-btn-users');
    if (navUsers) navUsers.classList.add('text-indigo-400');
    pushModalState('users-panel');
  }
}

function onNavGpsClick() {
  closeAllDrawers();
  closeEmergencyModal();
  if (state.isTrackingGps) {
    if (state.myUser.lat && state.myUser.lon) {
      state.map.setView([state.myUser.lat, state.myUser.lon], 16, { animate: true });
    }
  } else {
    state.gpsStartTime = Date.now();
    startGpsWatch(true);
  }
}

function onNavTracesClick() {
  closeAllDrawers();
  closeEmergencyModal();
  fitAllTracks();
}

function openDrawer(panelName) {
  const usersPanel = document.getElementById('users-panel');
  const backdrop = document.getElementById('drawer-backdrop');
  if (panelName === 'users' && usersPanel) {
    closeEmergencyModal();
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    if (backdrop) backdrop.classList.remove('hidden');
    state.activeDrawer = 'users';
    const navUsers = document.getElementById('nav-btn-users');
    if (navUsers) navUsers.classList.add('text-indigo-400');
    pushModalState('users-panel');
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

// ============================================================================
// ALERTE SONORE & VIBRATION EN CAS DE SORTIE DE TRACE GPX (OFF-TRACK)
// ============================================================================
function playOffTrackAlertSound() {
  if (navigator.vibrate) {
    try {
      navigator.vibrate([300, 150, 300, 150, 300]);
    } catch (e) {}
  }

  // Vérifier si l'utilisateur a désactivé le son pour les sorties de trace
  if (!isOffTrackSoundEnabled()) {
    console.log('[Audio] Alerte sonore sortie de trace désactivée par l\'utilisateur');
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      // 3 Bips distinctifs d'alerte sécurité (440Hz -> 660Hz -> 440Hz)
      const tones = [440, 660, 440];
      tones.forEach((f, i) => {
        const t = now + (i * 0.18);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.14);
      });
    }
  } catch (e) {
    console.warn('[Audio] Alerte hors-trace:', e);
  }
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

    const now = Date.now();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const rawSpeed = (typeof pos.coords.speed === 'number' && !isNaN(pos.coords.speed) && pos.coords.speed >= 0)
      ? (pos.coords.speed * 3.6)
      : 0.0;

    let stepDist = 0;
    let dtSec = 0;
    if (state.lastGpsPos && state.lastGpsTimestamp) {
      dtSec = (now - state.lastGpsTimestamp) / 1000;
      stepDist = calculateDistance(state.lastGpsPos.lat, state.lastGpsPos.lon, lat, lon);
    }

    // Détermination de la vitesse instantanée réelle
    let instantSpeed = rawSpeed;
    if (instantSpeed < 0.6 && stepDist > 0.003 && dtSec > 0 && dtSec < 35) {
      const derivedSpeed = (stepDist / (dtSec / 3600));
      if (derivedSpeed < 20) instantSpeed = derivedSpeed;
    }

    // Seuil de détection de marche active vs arrêt / pause (1.0 km/h)
    const isMoving = instantSpeed >= 1.0;

    if (dtSec > 0 && dtSec < 180) {
      const dtMs = dtSec * 1000;
      if (isMoving) {
        state.myUser.isAutoPaused = false;
        state.myUser.movingTimeMs = (state.myUser.movingTimeMs || 0) + dtMs;
        state.myUser.movingDistance = (state.myUser.movingDistance || 0) + stepDist;
      } else {
        state.myUser.isAutoPaused = true;
        state.myUser.pausedTimeMs = (state.myUser.pausedTimeMs || 0) + dtMs;
      }

      // Calcul Vitesse Moyenne en Déplacement (Moving Average Speed)
      if ((state.myUser.movingTimeMs || 0) >= 3000) {
        state.myUser.movingAvgSpeed = state.myUser.movingDistance / (state.myUser.movingTimeMs / 3600000);
      } else if (isMoving && instantSpeed > 0) {
        state.myUser.movingAvgSpeed = instantSpeed;
      }
    }

    state.lastGpsPos = { lat, lon };
    state.lastGpsTimestamp = now;

    state.isTrackingGps = true;
    state.myUser.lat = lat;
    state.myUser.lon = lon;
    state.myUser.ele = pos.coords.altitude !== null && !isNaN(pos.coords.altitude) ? Math.round(pos.coords.altitude) : state.myUser.ele;
    state.myUser.speed = isMoving ? instantSpeed : 0.0;
    state.myUser.movingAvgSpeed = state.myUser.movingAvgSpeed || (isMoving ? instantSpeed : 0.0);
    state.myUser.accuracy = pos.coords.accuracy || 10;

    try {
      localStorage.setItem('rando_last_lat', String(lat));
      localStorage.setItem('rando_last_lon', String(lon));
    } catch (e) {}

    const accStr = `±${Math.round(pos.coords.accuracy)}m`;
    const pauseTag = state.myUser.isAutoPaused ? ' ⏸️' : '';
    if (navLabel) navLabel.textContent = `GPS (${accStr})${pauseTag}`;
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

    // Détection de sortie de trace GPX (Off-Track Alert)
    const progress = computeTrackProgress(state.myUser);
    if (progress && typeof progress.distanceToTrack === 'number') {
      const distM = Math.round(progress.distanceToTrack * 1000);
      if (distM > 50) {
        state.offTrackCounter = (state.offTrackCounter || 0) + 1;
        if (state.offTrackCounter >= 2 && (now - (state.lastOffTrackAlertTime || 0) > 35000)) {
          playOffTrackAlertSound();
          showToast(`⚠️ ALERTE : Vous quittez la trace (${distM} m d'écart) !`, 'error');
          state.lastOffTrackAlertTime = now;
          state.wasOffTrackAlerted = true;
        }
      } else if (distM <= 30) {
        if (state.wasOffTrackAlerted && state.offTrackCounter >= 2) {
          showToast('✅ De retour sur la trace !', 'success');
        }
        state.offTrackCounter = 0;
        state.wasOffTrackAlerted = false;
      }
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
    timeout: 10000,
    maximumAge: 0
  });

  if (state.gpsWatchId !== null) {
    navigator.geolocation.clearWatch(state.gpsWatchId);
  }
  state.gpsWatchId = navigator.geolocation.watchPosition(onPositionSuccess, onPositionError, {
    enableHighAccuracy: useHighAccuracy,
    timeout: 12000,
    maximumAge: 0
  });

  // Activer le forçage périodique actif du GPS matériel (Dual-Engine Polling à 3.5s)
  startGpsForcedWatchdog(onPositionSuccess);

  // Activer le maintien d'activité en tâche de fond (écran éteint dans la poche)
  startBackgroundKeepAlive();

  // Activer le maintien d'écran allumé (Screen WakeLock API)
  requestWakeLock();
}

// Gestion du WakeLock (maintien écran allumé basse consommation)
let screenWakeLock = null;
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      screenWakeLock = await navigator.wakeLock.request('screen');
      screenWakeLock.addEventListener('release', () => {
        screenWakeLock = null;
      });
      console.log('[WakeLock] Maintien écran actif');
    } catch (err) {
      console.warn('[WakeLock] Non activé:', err);
    }
  }
}

function releaseWakeLock() {
  if (screenWakeLock) {
    try {
      screenWakeLock.release();
    } catch (e) {}
    screenWakeLock = null;
  }
}

// Watchdog de forçage GPS matériel (3500 ms)
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
  releaseWakeLock();

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
  return `${origin}${pathname}?room=${encodeURIComponent(state.roomCode)}`;
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

  if (modal) {
    modal.classList.remove('hidden');
    pushModalState('invite-modal');
  }
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
      reconnectPeriod: 2500,
      keepalive: 15
    });

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connecté avec succès au salon:', state.roomCode);
      updateConnectionStatus(true);
      const announceTopic = `randotracker/v1/rooms/${sanitizedRoom}/announcement`;
      mqttClient.subscribe([topic, announceTopic], { qos: 1 }, (err) => {
        if (!err) {
          console.log(`[MQTT] Abonné aux topics : ${topic} & ${announceTopic}`);
          
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
  payload.timestamp = payload.timestamp || Date.now();

  const msgStr = JSON.stringify(payload);

  if (mqttClient && mqttClient.connected) {
    const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const topic = `randotracker/v1/rooms/${sanitizedRoom}/events`;
    const qos = (payload.type === 'broadcast_announcement' || payload.type === 'group_sos_alert' || payload.type === 'sync_tracks') ? 1 : 0;
    mqttClient.publish(topic, msgStr, { qos: qos });

    if (payload.type === 'broadcast_announcement') {
      const announceTopic = `randotracker/v1/rooms/${sanitizedRoom}/announcement`;
      mqttClient.publish(announceTopic, msgStr, { qos: 1, retain: true });
    }
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
    if (!window._seenAnnouncements) window._seenAnnouncements = new Set();
    const msgKey = `${data.senderId || data.author || 'anon'}_${data.timestamp || 0}_${data.text || ''}`;
    if (window._seenAnnouncements.has(msgKey)) return;
    window._seenAnnouncements.add(msgKey);
    // Ignorer si le message date de plus de 45 minutes
    if (data.timestamp && (Date.now() - data.timestamp > 45 * 60 * 1000)) {
      return;
    }
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
function getMyGpsString() {
  const lat = state.myUser.lat || 45.8920;
  const lon = state.myUser.lon || 6.1550;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  const altStr = state.myUser.ele ? ` (Alt: ${Math.round(state.myUser.ele)}m)` : '';
  return `📍 GPS: ${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}${altStr} - `;
}

function insertGpsInCustomAnnouncement() {
  const customInput = document.getElementById('announcement-custom-input');
  if (customInput) {
    const gpsStr = getMyGpsString();
    const currentVal = customInput.value;
    if (currentVal.startsWith('📍 GPS:')) {
      const parts = currentVal.split(' - ');
      if (parts.length > 1) {
        customInput.value = gpsStr + parts.slice(1).join(' - ');
      } else {
        customInput.value = gpsStr;
      }
    } else {
      customInput.value = gpsStr + currentVal;
    }
    customInput.focus();
    customInput.setSelectionRange(customInput.value.length, customInput.value.length);
  }
}

function openAnnouncementModal() {
  const modal = document.getElementById('announcement-modal');
  const customInput = document.getElementById('announcement-custom-input');
  if (customInput) {
    // Préremplissage automatique avec les coordonnées GPS de l'émetteur
    customInput.value = getMyGpsString();
    setTimeout(() => {
      customInput.focus();
      customInput.setSelectionRange(customInput.value.length, customInput.value.length);
    }, 50);
  }
  if (modal) {
    modal.classList.remove('hidden');
    pushModalState('announcement-modal');
  }
}

function closeAnnouncementModal() {
  const modal = document.getElementById('announcement-modal');
  if (modal) modal.classList.add('hidden');
}

function sendAnnouncement(text) {
  let msgText = (text || '').trim();
  if (!msgText) {
    showToast('Veuillez saisir un message à diffuser.', 'error');
    return;
  }

  const lat = state.myUser.lat;
  const lon = state.myUser.lon;
  const ele = state.myUser.ele;

  // Enrichir systématiquement avec la position GPS exacte si elle n'est pas déjà dans le texte
  if (lat !== undefined && lat !== null && lon !== undefined && lon !== null && !msgText.includes('📍 GPS:')) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'O';
    const altStr = (ele !== undefined && ele !== null && !isNaN(ele)) ? ` (Alt: ${Math.round(ele)}m)` : '';
    msgText = `${msgText}\n📍 GPS: ${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}${altStr}`;
  }

  const payload = {
    type: 'broadcast_announcement',
    author: state.myUser.name || 'Marcheur',
    role: state.myUser.role || 'Randonneur',
    icon: state.myUser.icon || '🥾',
    color: state.myUser.color || '#059669',
    text: msgText,
    lat: lat || null,
    lon: lon || null,
    ele: ele || null,
    timestamp: Date.now()
  };

  if (lat && lon) {
    state.lastAnnouncementCoords = { lat, lon, author: payload.author };
  }

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

  // Déclencher le carillon sonore harmonieux et la vibration haptique
  playAnnouncementAlert();

  const author = data.author || 'Marcheur';
  const icon = data.icon || '🥾';
  const role = data.role || 'Randonneur';
  const text = data.text;
  const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Détection / Extraction des coordonnées GPS
  let annLat = (data.lat !== undefined && data.lat !== null) ? Number(data.lat) : null;
  let annLon = (data.lon !== undefined && data.lon !== null) ? Number(data.lon) : null;
  if ((annLat === null || isNaN(annLat)) && data.text) {
    const match = data.text.match(/📍 GPS:\s*([\d.]+)[°\s]*([NS]),\s*([\d.]+)[°\s]*([EO])/i);
    if (match) {
      annLat = parseFloat(match[1]) * (match[2].toUpperCase() === 'S' ? -1 : 1);
      annLon = parseFloat(match[3]) * (match[4].toUpperCase() === 'O' || match[4].toUpperCase() === 'W' ? -1 : 1);
    }
  }

  const locateBtn = document.getElementById('rx-announcement-locate-btn');
  if (annLat !== null && !isNaN(annLat) && annLon !== null && !isNaN(annLon)) {
    state.lastAnnouncementCoords = { lat: annLat, lon: annLon, author };
    if (locateBtn) locateBtn.classList.remove('hidden');
  } else {
    state.lastAnnouncementCoords = null;
    if (locateBtn) locateBtn.classList.add('hidden');
  }

  // 2. Notification système Android & Montres connectées (Garmin / Suunto)
  sendGpsNotification(`📢 Message de ${author} (${role})`, text);

  // 3. Afficher la popup modale de réception
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

  // 4. Afficher le bandeau persistant en haut de la carte
  displayAnnouncementBanner(author, icon, role, text, data.timestamp);
}

function closeReceivedAnnouncementModal() {
  const rxModal = document.getElementById('received-announcement-modal');
  if (rxModal) rxModal.classList.add('hidden');
}

function locateAnnouncementSender() {
  if (state.lastAnnouncementCoords && state.lastAnnouncementCoords.lat && state.lastAnnouncementCoords.lon && state.map) {
    state.map.setView([state.lastAnnouncementCoords.lat, state.lastAnnouncementCoords.lon], 16, { animate: true });
    closeReceivedAnnouncementModal();
    showToast(`📍 Carte centrée sur ${state.lastAnnouncementCoords.author || 'le marcheur'}`, 'info');
  } else {
    showToast('Position GPS non disponible pour ce message', 'warning');
  }
}

function playAnnouncementAlert() {
  // 1. Vibreur mobile puissant
  if (navigator.vibrate) {
    try {
      navigator.vibrate([250, 100, 250, 100, 350]);
    } catch (e) {}
  }

  // 2. Synthétiseur sonore Web Audio API - Carillon Outdoor 4 tons harmoniques
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      // 4 Tons mélodieux distinctifs et audibles en extérieur (Do-Mi-Sol-Do aigu)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const t = now + (idx * 0.08);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    }
  } catch (e) {
    console.warn('[Audio] Alerte son annonce:', e);
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
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  const ddStr = `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
  const dmsStr = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;

  // 1. Affichage Degrés Décimaux (DD)
  const decimalEl = document.getElementById('emergency-gps-decimal');
  if (decimalEl) {
    decimalEl.textContent = ddStr;
  }

  // 2. Affichage Degrés Minutes Secondes (DMS)
  const dmsEl = document.getElementById('emergency-gps-dms');
  if (dmsEl) {
    dmsEl.textContent = dmsStr;
  }

  // 3. Métadonnées (Altitude, Précision)
  const metaEl = document.getElementById('emergency-gps-meta');
  if (metaEl) {
    metaEl.textContent = `Alt : ${Math.round(ele)} m • Précision : ±${Math.round(acc)} m`;
  }

  // 4. Guide de dictée vocale
  const dictateCoords = document.getElementById('dictate-coords');
  const dictateAlt = document.getElementById('dictate-alt');
  if (dictateCoords) dictateCoords.textContent = ddStr;
  if (dictateAlt) dictateAlt.textContent = `${Math.round(ele)} m`;

  // 5. Tag Pays
  const countryTag = document.getElementById('emergency-country-tag');
  if (countryTag) {
    if (country === 'FR') {
      countryTag.textContent = '🇫🇷 France';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    } else if (country === 'ES') {
      countryTag.textContent = '🇪🇸 Espagne';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
    } else {
      countryTag.textContent = '🏔️ International';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40';
    }
  }

  // 6. Rendu des boutons d'action 1-Clic
  renderEmergencyActionsPad();

  // 7. État du bouton Alerte Groupe
  const groupSosBtn = document.getElementById('emergency-modal-group-sos-btn');
  const groupSosText = document.getElementById('emergency-modal-group-sos-text');
  if (groupSosBtn && groupSosText) {
    if (state.myUser.isSos) {
      groupSosBtn.className = 'w-full py-3 px-3 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center gap-2 animate-pulse shadow-xl transition active:scale-95';
      groupSosText.textContent = '⚠️ ALERTE SOS GROUPE ACTIVE (CLIQUEZ POUR ARRÊTER)';
    } else {
      groupSosBtn.className = 'w-full py-3 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border-2 border-red-500/50 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md';
      groupSosText.textContent = '🚨 Activer l\'alerte SOS sur les téléphones du groupe';
    }
  }

  lucide.createIcons();
}

function switchEmergencyTab(tab) {
  const quickBtn = document.getElementById('tab-btn-quick-sos');
  const dialerBtn = document.getElementById('tab-btn-dialer');
  const quickContent = document.getElementById('tab-content-quick-sos');
  const dialerContent = document.getElementById('tab-content-dialer');

  if (tab === 'quick') {
    if (quickBtn) {
      quickBtn.className = 'py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition border-2 border-red-500 bg-red-600/30 text-white shadow-md';
    }
    if (dialerBtn) {
      dialerBtn.className = 'py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition border-2 border-slate-700 bg-slate-800 text-slate-300 hover:text-white';
    }
    if (quickContent) quickContent.classList.remove('hidden');
    if (dialerContent) dialerContent.classList.add('hidden');
  } else {
    if (dialerBtn) {
      dialerBtn.className = 'py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition border-2 border-blue-500 bg-blue-600/30 text-white shadow-md';
    }
    if (quickBtn) {
      quickBtn.className = 'py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition border-2 border-slate-700 bg-slate-800 text-slate-300 hover:text-white';
    }
    if (dialerContent) dialerContent.classList.remove('hidden');
    if (quickContent) quickContent.classList.add('hidden');
  }
}

function dialerAppend(ch) {
  const input = document.getElementById('dialer-input');
  if (input) {
    input.value = (input.value + ch).trim();
  }
}

function dialerBackspace() {
  const input = document.getElementById('dialer-input');
  if (input && input.value.length > 0) {
    input.value = input.value.slice(0, -1);
  }
}

function dialerClear() {
  const input = document.getElementById('dialer-input');
  if (input) input.value = '';
}

function dialerSetNumber(num) {
  const input = document.getElementById('dialer-input');
  if (input) input.value = num;
}

function dialerCall() {
  const input = document.getElementById('dialer-input');
  const num = input ? input.value.trim() : '';
  if (!num) {
    showToast('Veuillez composer un numéro à appeler', 'warning');
    return;
  }
  makeEmergencyCall(num);
}

function dialerSms() {
  const input = document.getElementById('dialer-input');
  const num = input ? input.value.trim() : '';
  sendEmergencySms(num);
}

function renderEmergencyActionsPad() {
  const numList = document.getElementById('emergency-numbers-list');
  if (!numList) return;

  const lat = state.myUser.lat || 45.8920;
  const lon = state.myUser.lon || 6.1550;
  const country = detectCountry(lat, lon);

  if (country === 'FR') {
    numList.innerHTML = `
      <!-- 1. 🟢 BOUTON 15 SAMU (France 🇫🇷) -->
      <button type="button" onclick="makeEmergencyCall('15')" class="emergency-big-btn bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">15</span>
        <div class="emergency-flag-container" title="France">
          <svg class="emergency-flag-svg" viewBox="0 0 900 600" width="44" height="30">
            <rect width="300" height="600" fill="#002654"/>
            <rect x="300" width="300" height="600" fill="#ffffff"/>
            <rect x="600" width="300" height="600" fill="#ce1126"/>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 SAMU</span>
            <span class="emergency-btn-sub opacity-80 font-normal">Urgences Médicales</span>
          </div>
          <div class="emergency-btn-sub text-emerald-100 opacity-90 truncate">Malaise, traumatisme, détresse vitale</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 2. 🔴 BOUTON 112 POMPIERS & SECOURS MONTAGNE (Europe 🇪🇺) -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="Union Européenne">
          <svg class="emergency-flag-svg" viewBox="0 0 810 540" width="44" height="30">
            <rect width="810" height="540" fill="#003399"/>
            <g fill="#ffcc00" transform="translate(405,270) scale(18)">
              <g id="eu-star-js"><polygon points="0,-1 0.588,0.809 -0.951,-0.309 0.951,-0.309 -0.588,0.809" transform="translate(0,-9)"/></g>
              <use href="#eu-star-js" transform="rotate(30)"/>
              <use href="#eu-star-js" transform="rotate(60)"/>
              <use href="#eu-star-js" transform="rotate(90)"/>
              <use href="#eu-star-js" transform="rotate(120)"/>
              <use href="#eu-star-js" transform="rotate(150)"/>
              <use href="#eu-star-js" transform="rotate(180)"/>
              <use href="#eu-star-js" transform="rotate(210)"/>
              <use href="#eu-star-js" transform="rotate(240)"/>
              <use href="#eu-star-js" transform="rotate(270)"/>
              <use href="#eu-star-js" transform="rotate(300)"/>
              <use href="#eu-star-js" transform="rotate(330)"/>
            </g>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 Secours & Pompiers</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">PGHM / CRS Montagne, Pompiers, Gendarmerie</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 3. 🟣 BOUTON 114 SMS D'URGENCE (France 🇫🇷) -->
      <button type="button" onclick="sendEmergencySms('114')" class="emergency-big-btn bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-700 hover:from-indigo-500 hover:to-purple-500 text-white border-purple-400/40">
        <span class="emergency-btn-badge">114</span>
        <div class="emergency-flag-container" title="France (Relais SMS National)">
          <svg class="emergency-flag-svg" viewBox="0 0 900 600" width="44" height="30">
            <rect width="300" height="600" fill="#002654"/>
            <rect x="300" width="300" height="600" fill="#ffffff"/>
            <rect x="600" width="300" height="600" fill="#ce1126"/>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 SMS d'Urgence</span>
            <span class="text-xs bg-purple-900/80 px-2 py-0.5 rounded-full border border-purple-300/50 font-mono">avec GPS</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">Zone blanche voix / Sourd / Muet / Blessé silencieux</div>
        </div>
        <i data-lucide="message-square" class="w-7 h-7 text-white shrink-0"></i>
      </button>
    `;
  } else if (country === 'ES') {
    numList.innerHTML = `
      <!-- 1. 🔴 BOUTON 112 EMERGENCIAS (Europe 🇪🇺 & España 🇪🇸) -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="Unión Europea">
          <svg class="emergency-flag-svg" viewBox="0 0 810 540" width="44" height="30">
            <rect width="810" height="540" fill="#003399"/>
            <g fill="#ffcc00" transform="translate(405,270) scale(18)">
              <g id="eu-star-es"><polygon points="0,-1 0.588,0.809 -0.951,-0.309 0.951,-0.309 -0.588,0.809" transform="translate(0,-9)"/></g>
              <use href="#eu-star-es" transform="rotate(30)"/>
              <use href="#eu-star-es" transform="rotate(60)"/>
              <use href="#eu-star-es" transform="rotate(90)"/>
              <use href="#eu-star-es" transform="rotate(120)"/>
              <use href="#eu-star-es" transform="rotate(150)"/>
              <use href="#eu-star-es" transform="rotate(180)"/>
              <use href="#eu-star-es" transform="rotate(210)"/>
              <use href="#eu-star-es" transform="rotate(240)"/>
              <use href="#eu-star-es" transform="rotate(270)"/>
              <use href="#eu-star-es" transform="rotate(300)"/>
              <use href="#eu-star-es" transform="rotate(330)"/>
            </g>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 112 Emergencias España</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">Bomberos, Guardia Civil, Rescate GREIM</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 2. 🟢 BOUTON 061 URGENCIAS -->
      <button type="button" onclick="makeEmergencyCall('061')" class="emergency-big-btn bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">061</span>
        <div class="emergency-flag-container" title="España">
          <svg class="emergency-flag-svg" viewBox="0 0 750 500" width="44" height="30">
            <rect width="750" height="125" fill="#AA151B"/>
            <rect y="125" width="750" height="250" fill="#F1BF00"/>
            <rect y="375" width="750" height="125" fill="#AA151B"/>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 061 Urgencias Sanitarias</span>
          </div>
          <div class="emergency-btn-sub text-emerald-100 opacity-90 truncate">Ambulancia y atención médica urgente</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 3. 🟣 BOUTON 112 SMS CON GPS -->
      <button type="button" onclick="sendEmergencySms('112')" class="emergency-big-btn bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-700 hover:from-indigo-500 text-white border-purple-400/40">
        <span class="emergency-btn-badge">SMS</span>
        <div class="emergency-flag-container" title="España">
          <svg class="emergency-flag-svg" viewBox="0 0 750 500" width="44" height="30">
            <rect width="750" height="125" fill="#AA151B"/>
            <rect y="125" width="750" height="250" fill="#F1BF00"/>
            <rect y="375" width="750" height="125" fill="#AA151B"/>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 SMS de Emergencia</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">Mensaje de auxilio con coordenadas GPS</div>
        </div>
        <i data-lucide="message-square" class="w-7 h-7 text-white shrink-0"></i>
      </button>
    `;
  } else {
    numList.innerHTML = `
      <!-- 1. 🔴 BOUTON 112 INTERNATIONAL -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="Europe & International">
          <svg class="emergency-flag-svg" viewBox="0 0 810 540" width="44" height="30">
            <rect width="810" height="540" fill="#003399"/>
            <g fill="#ffcc00" transform="translate(405,270) scale(18)">
              <g id="eu-star-int"><polygon points="0,-1 0.588,0.809 -0.951,-0.309 0.951,-0.309 -0.588,0.809" transform="translate(0,-9)"/></g>
              <use href="#eu-star-int" transform="rotate(30)"/>
              <use href="#eu-star-int" transform="rotate(60)"/>
              <use href="#eu-star-int" transform="rotate(90)"/>
              <use href="#eu-star-int" transform="rotate(120)"/>
              <use href="#eu-star-int" transform="rotate(150)"/>
              <use href="#eu-star-int" transform="rotate(180)"/>
              <use href="#eu-star-int" transform="rotate(210)"/>
              <use href="#eu-star-int" transform="rotate(240)"/>
              <use href="#eu-star-int" transform="rotate(270)"/>
              <use href="#eu-star-int" transform="rotate(300)"/>
              <use href="#eu-star-int" transform="rotate(330)"/>
            </g>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 112 International Emergency</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">European & International Rescue Number</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 2. 🟣 BOUTON SMS EMERGENCY WITH GPS -->
      <button type="button" onclick="sendEmergencySms('')" class="emergency-big-btn bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-700 hover:from-indigo-500 text-white border-purple-400/40">
        <span class="emergency-btn-badge">SMS</span>
        <div class="emergency-flag-container" title="International">
          <span class="text-2xl">🌐</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 Emergency SMS</span>
            <span class="text-xs bg-purple-900/80 px-2 py-0.5 rounded-full border border-purple-300/50 font-mono">with GPS</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">Send emergency SMS with full GPS coordinates</div>
        </div>
        <i data-lucide="message-square" class="w-7 h-7 text-white shrink-0"></i>
      </button>
    `;
  }

  lucide.createIcons();
}

function initiateEmergencyCall(number, serviceName, description) {
  makeEmergencyCall(number, serviceName);
}

function makeEmergencyCall(number, serviceName) {
  copyEmergencyGpsCoords();
  sendGpsNotification();
  showToast(`📞 Appel vers le ${number} en cours... Vos coordonnées GPS sont copiées !`, 'success');

  // Déclencher l'appel téléphonique nativement
  setTimeout(() => {
    window.location.href = `tel:${number.replace(/\s+/g, '')}`;
  }, 100);
}

function sendEmergencySms(number) {
  copyEmergencyGpsCoords();
  sendGpsNotification();

  const lat = state.myUser.lat || 45.8920;
  const lon = state.myUser.lon || 6.1550;
  const ele = state.myUser.ele || 0;
  const acc = state.myUser.accuracy || 10;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  const dmsStr = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
  const ddStr = `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const myName = state.myUser.name || 'Randonneur';

  const smsText = `🚨 URGENCE RANDOTRACKER (${myName})\nPosition : ${ddStr}\nFormat DMS : ${dmsStr}\nAlt : ${Math.round(ele)}m (±${Math.round(acc)}m)\nHeure : ${time}`;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const separator = isIOS ? '&' : '?';
  const targetNum = number ? number.replace(/\s+/g, '') : '';
  const smsUrl = targetNum ? `sms:${targetNum}${separator}body=${encodeURIComponent(smsText)}` : `sms:${separator}body=${encodeURIComponent(smsText)}`;

  showToast(`💬 SMS d'urgence prérempli avec vos coordonnées GPS exactes !`, 'info');

  setTimeout(() => {
    window.location.href = smsUrl;
  }, 100);
}

function sendGpsNotification(customTitle, customBody) {
  const lat = state.myUser.lat || 45.8920;
  const lon = state.myUser.lon || 6.1550;
  const ele = state.myUser.ele || 0;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  const defaultTitle = `🚨 GPS Secours : ${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
  const defaultBody = `Alt : ${Math.round(ele)}m • ${toDMS(lat, true)} ${toDMS(lon, false)} (Copié au presse-papier)`;

  const title = customTitle || defaultTitle;
  const body = customBody || defaultBody;
  const tag = customTitle ? `rando-msg-${Date.now()}` : 'rando-emergency-gps';
  const iconUrl = new URL('icon-192.png', window.location.href).href;

  const notifOptions = {
    body: body,
    icon: iconUrl,
    badge: iconUrl,
    tag: tag,
    renotify: true,
    silent: false,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 300]
  };

  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        let shown = false;
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistration().then(reg => {
            if (reg && reg.showNotification) {
              reg.showNotification(title, notifOptions);
              shown = true;
            }
          }).catch(() => {});
        }
        if (!shown && navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            if (reg && reg.showNotification) {
              reg.showNotification(title, notifOptions);
              shown = true;
            }
          }).catch(() => {});
        }
        if (!shown) {
          try {
            new Notification(title, notifOptions);
          } catch (e) {}
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            sendGpsNotification(customTitle, customBody);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[Notification Système / Montre]', e);
  }
}

async function testWatchNotification() {
  // 1. Toujours jouer l'alerte sonore et la vibration haptique en premier
  playAnnouncementAlert();

  if (!('Notification' in window)) {
    showToast('⚠️ Notifications système non supportées sur ce navigateur.', 'warning');
    return;
  }

  try {
    let perm = Notification.permission;
    if (perm === 'default') {
      showToast('🔔 Demande d\'autorisation des notifications...', 'info');
      perm = await Notification.requestPermission();
    }

    if (perm === 'granted') {
      sendGpsNotification('📢 Test RandoTracker', 'Vibration et notification reçues avec succès sur votre montre et téléphone !');
      showToast('🔔 Notification envoyée au téléphone et à la montre !', 'success');
    } else if (perm === 'denied') {
      showToast('⚠️ Notifications bloquées dans le navigateur.', 'error');
      alert('Les notifications sont bloquées pour ce site.\n\nDans Chrome, appuyez sur l\'icône des paramètres à gauche de l\'adresse web (ou dans Paramètres Android > Applications > Chrome > Notifications) et activez « Autoriser les notifications ».');
    } else {
      showToast('❌ Permission de notification non accordée.', 'error');
    }
  } catch (e) {
    console.error('[Test Notif]', e);
    showToast('❌ Erreur lors du test de notification', 'error');
  }
}

function notifyEmergencyCallTriggered(serviceName, number) {
  const banner = document.getElementById('emergency-call-in-progress');
  const serviceEl = document.getElementById('emergency-call-service-name');
  if (banner && serviceEl) {
    serviceEl.textContent = serviceName || `Numéro ${number}`;
    banner.classList.remove('hidden');
  }
  showToast(`📞 Action d'urgence déclenchée ! Les coordonnées restent affichées en haut.`, 'info');
}

function dismissEmergencyCallBanner() {
  const banner = document.getElementById('emergency-call-in-progress');
  if (banner) banner.classList.add('hidden');
}

function toggleEmergencyModal() {
  const modal = document.getElementById('emergency-modal');
  if (!modal) return;
  if (!modal.classList.contains('hidden')) {
    closeEmergencyModal();
  } else {
    openEmergencyModal();
  }
}

function openEmergencyModal() {
  closeAllDrawers();
  updateEmergencyModalGpsData();
  const modal = document.getElementById('emergency-modal');
  if (modal) {
    modal.classList.remove('hidden');
    pushModalState('emergency-modal');
  }

  // Copie automatique préventive et envoi de notification au lancement
  copyEmergencyGpsCoords();
  sendGpsNotification();

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
  if (state.map) {
    setTimeout(() => state.map.invalidateSize(), 100);
  }
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
        setTimeout(() => { copyTextEl.textContent = 'Copier GPS'; }, 3000);
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
async function requestScreenWakeLock() {
  return requestWakeLock();
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
  // Navigation inférieure (4 touches géantes outdoor - Assignation directe sans doublon)
  const navSos = document.getElementById('nav-btn-sos');
  if (navSos) {
    navSos.onclick = (e) => {
      if (e) e.preventDefault();
      toggleEmergencyModal();
    };
  }

  const navGps = document.getElementById('nav-btn-gps');
  if (navGps) {
    navGps.onclick = (e) => {
      if (e) e.preventDefault();
      onNavGpsClick();
    };
  }

  const navTraces = document.getElementById('nav-btn-traces');
  if (navTraces) {
    navTraces.onclick = (e) => {
      if (e) e.preventDefault();
      onNavTracesClick();
    };
  }

  const navUsers = document.getElementById('nav-btn-users');
  if (navUsers) {
    navUsers.onclick = (e) => {
      if (e) e.preventDefault();
      toggleUsersDrawer();
    };
  }

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
      closeElevationDrawer();
    });
  }

  // Modal Fonds de Carte (IGN / Topo / Satellite / OSM)
  const layerModal = document.getElementById('layer-modal');
  const openLayerBtn = document.getElementById('open-layer-modal-btn');
  const closeLayerBtn = document.getElementById('close-layer-modal-btn');

  if (openLayerBtn) openLayerBtn.addEventListener('click', () => {
    layerModal.classList.remove('hidden');
    pushModalState('layer-modal');
  });
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
      if (roomModal) {
        roomModal.classList.remove('hidden');
        pushModalState('room-modal');
      }
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
      pushModalState('about-modal');
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
    pushModalState('profile-modal');
  };

  const openProfileBtn = document.getElementById('open-profile-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-modal-btn');
  const cancelProfileBtn = document.getElementById('cancel-profile-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');

  if (openProfileBtn) openProfileBtn.addEventListener('click', openProfile);
  if (editProfileBtn) editProfileBtn.addEventListener('click', openProfile);
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfileModal);
  if (cancelProfileBtn) cancelProfileBtn.addEventListener('click', closeProfileModal);

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

  // Boutons de réglage de l'échelle d'affichage & lisibilité outdoor
  document.querySelectorAll('.ui-scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = btn.getAttribute('data-scale');
      if (scale) applyUiScale(scale);
    });
  });
}

// Watchdog de nettoyage automatique des participants inactifs (> 5 heures de silence)
function cleanStaleUsers() {
  const now = Date.now();
  const maxAgeMs = 5 * 3600 * 1000; // 5 heures pour préserver les positions en zone blanche
  let changed = false;

  deduplicateUsersByName();

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
// GESTION DU ZOOM DYNAMIQUE DES POPUPS ET FENÊTRES
// ============================================================================
function applySavedPopupZoom(popupEl) {
  if (!popupEl) return;
  const currentZoom = parseFloat(localStorage.getItem('rando_popup_zoom') || '1.0');
  const wrapper = popupEl.querySelector('.leaflet-popup-content-wrapper') || popupEl;
  const content = popupEl.querySelector('.leaflet-popup-content') || wrapper;
  
  wrapper.dataset.zoomLevel = currentZoom.toString();
  content.style.fontSize = `${15 * currentZoom}px`;
  content.style.minWidth = `${Math.round(280 * currentZoom)}px`;
  content.style.maxWidth = `${Math.round(360 * currentZoom)}px`;

  const badges = popupEl.querySelectorAll('.popup-zoom-level-badge');
  badges.forEach(b => b.textContent = `${Math.round(currentZoom * 100)}%`);
}

function adjustPopupZoom(btn, delta) {
  const popupEl = btn.closest('.leaflet-popup') || btn.closest('.leaflet-popup-content-wrapper');
  if (!popupEl) return;
  const wrapper = popupEl.querySelector('.leaflet-popup-content-wrapper') || popupEl;
  const content = popupEl.querySelector('.leaflet-popup-content') || wrapper;

  let currentZoom = parseFloat(wrapper.dataset.zoomLevel || localStorage.getItem('rando_popup_zoom') || '1.0');
  currentZoom = Math.max(0.75, Math.min(1.6, Math.round((currentZoom + delta) * 10) / 10));
  
  wrapper.dataset.zoomLevel = currentZoom.toString();
  localStorage.setItem('rando_popup_zoom', currentZoom.toString());

  content.style.fontSize = `${15 * currentZoom}px`;
  content.style.minWidth = `${Math.round(280 * currentZoom)}px`;
  content.style.maxWidth = `${Math.round(360 * currentZoom)}px`;

  const badges = popupEl.querySelectorAll('.popup-zoom-level-badge');
  badges.forEach(b => b.textContent = `${Math.round(currentZoom * 100)}%`);
}

function adjustElevationDrawerZoom(delta) {
  const drawer = document.getElementById('elevation-drawer');
  if (!drawer) return;
  let currentZoom = parseFloat(drawer.dataset.uiZoom || localStorage.getItem('rando_ele_ui_zoom') || '1.0');
  currentZoom = Math.max(0.75, Math.min(1.5, Math.round((currentZoom + delta) * 10) / 10));
  drawer.dataset.uiZoom = currentZoom.toString();
  localStorage.setItem('rando_ele_ui_zoom', currentZoom.toString());

  const badge = document.getElementById('ele-ui-zoom-badge');
  if (badge) badge.textContent = `${Math.round(currentZoom * 100)}%`;

  drawer.style.fontSize = `${14 * currentZoom}px`;
  const statValues = drawer.querySelectorAll('#ele-stat-dist, #ele-stat-gain, #ele-stat-minmax, #ele-stat-slope');
  statValues.forEach(el => {
    el.style.fontSize = `${14 * currentZoom}px`;
  });

  if (state.chartInstance) {
    state.chartInstance.resize();
  }
}

/// ============================================================================
// GUIDE DE DÉMARRAGE RAPIDE / ONBOARDING (GPS ET BATTERIE SANS RESTRICTION)
// ============================================================================
function checkOnboardingStatus() {
  const hasAccepted = localStorage.getItem('rando_onboarding_accepted');
  if (!hasAccepted) {
    setTimeout(() => {
      openOnboardingModal();
    }, 500);
  }
}

function openOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) {
    modal.classList.remove('hidden');
    pushModalState('onboarding-modal');
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  }
}

function closeOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.add('hidden');
}

function acceptOnboarding() {
  localStorage.setItem('rando_onboarding_accepted', 'true');
  closeOnboardingModal();
  showToast('✅ Réglages validés ! Démarrage du suivi GPS...', 'success');

  // Demande des permissions système
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission().catch(() => {});
  }

  // Activer le maintien d'écran et le GPS
  requestWakeLock();
  startGpsWatch(true);
}

// ============================================================================
// GARDIEN SANCTUAIRE ANTI-DISPARITION DES BOUTONS (PIXEL & SMARTPHONES ANDROID)
// ============================================================================
function ensureBarsVisible() {
  // A. Mise à jour de la variable CSS dynamique de hauteur pour Pixel / Android
  const currentHeight = window.innerHeight || document.documentElement.clientHeight;
  document.documentElement.style.setProperty('--app-height', `${currentHeight}px`);

  // B. Rétablir immédiatement l'en-tête supérieur si altéré (Z-Index 2000)
  const header = document.querySelector('.app-header');
  if (header) {
    header.classList.remove('hidden', 'drawer-closed');
    header.style.visibility = 'visible';
    header.style.opacity = '1';
    header.style.display = 'flex';
    header.style.top = '0px';
    header.style.left = '0px';
    header.style.width = '100vw';
    header.style.zIndex = '2000';
    header.style.transform = 'translate3d(0, 0, 0)';
  }

  // C. Rétablir immédiatement la barre de navigation inférieure si altérée (Z-Index 2000)
  const bottomNav = document.querySelector('.app-bottom-nav');
  if (bottomNav) {
    bottomNav.classList.remove('hidden', 'drawer-closed');
    bottomNav.style.visibility = 'visible';
    bottomNav.style.opacity = '1';
    bottomNav.style.display = 'grid';
    bottomNav.style.bottom = '0px';
    bottomNav.style.left = '0px';
    bottomNav.style.width = '100vw';
    bottomNav.style.zIndex = '2000';
    bottomNav.style.transform = 'translate3d(0, 0, 0)';
  }
}

// Installation des écouteurs de sécurité Pixel / Android
function initPixelSanctuaryGuardians() {
  // A. Écouteurs de redimensionnement et orientation
  window.addEventListener('resize', () => {
    ensureBarsVisible();
    if (state.map) setTimeout(() => state.map.invalidateSize(), 80);
  });
  window.addEventListener('orientationchange', () => {
    ensureBarsVisible();
    if (state.map) setTimeout(() => state.map.invalidateSize(), 120);
  });

  // B. Visual Viewport API (Prévient les décalages de barre d'adresse et gestes plein écran Pixel)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      ensureBarsVisible();
      if (state.map) setTimeout(() => state.map.invalidateSize(), 80);
    });
  }

  // C. Fermeture de clavier virtuel (Inputs et Textareas)
  document.addEventListener('focusout', (e) => {
    if (e.target.matches('input, textarea, select')) {
      setTimeout(() => {
        ensureBarsVisible();
        if (state.map) state.map.invalidateSize();
      }, 100);
    }
  });

  // D. Reconnexion WakeLock si retour au premier plan
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureBarsVisible();
      if (state.map) setTimeout(() => state.map.invalidateSize(), 100);
      if (state.isTrackingGps) {
        requestWakeLock();
      }
    }
  });
}

// ============================================================================
// SYSTÈME DE DÉPLACEMENT LIBRE DES FENÊTRES ET POPUPS (DRAGGABLE MODALS & POPUPS)
// ============================================================================
function makePopupDraggable(popupEl) {
  if (!popupEl || popupEl.dataset.draggableActive) return;
  popupEl.dataset.draggableActive = 'true';

  const handle = popupEl.querySelector('.popup-drag-bar') || popupEl.querySelector('.leaflet-popup-content-wrapper') || popupEl;
  const wrapper = popupEl.querySelector('.leaflet-popup-content-wrapper') || popupEl;
  handle.style.cursor = 'grab';

  let isDragging = false;
  let startX = 0, startY = 0;
  let currentOffsetX = parseFloat(wrapper.dataset.dragX || '0');
  let currentOffsetY = parseFloat(wrapper.dataset.dragY || '0');

  const onDragStart = (e) => {
    if (e.target.closest('button, a, input, select, textarea, label, .popup-zoom-btn, details, summary, i, svg, [onclick]')) {
      return;
    }
    isDragging = true;
    handle.style.cursor = 'grabbing';

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX - currentOffsetX;
    startY = clientY - currentOffsetY;

    if (state.map && state.map.dragging) {
      state.map.dragging.disable();
    }

    window.addEventListener('mousemove', onDragMove, { passive: false });
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    currentOffsetX = clientX - startX;
    currentOffsetY = clientY - startY;

    wrapper.dataset.dragX = currentOffsetX.toString();
    wrapper.dataset.dragY = currentOffsetY.toString();
    wrapper.style.transform = `translate3d(${currentOffsetX}px, ${currentOffsetY}px, 0px)`;
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    handle.style.cursor = 'grab';

    if (state.map && state.map.dragging) {
      state.map.dragging.enable();
    }

    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
  };

  handle.addEventListener('mousedown', onDragStart);
  handle.addEventListener('touchstart', onDragStart, { passive: false });
}

function makeModalDraggable(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const card = modal.querySelector('.bg-slate-900') || modal.querySelector('.emergency-modal-inner') || modal;
  if (!card || card.dataset.draggableActive) return;
  card.dataset.draggableActive = 'true';

  const handle = modal.querySelector('.modal-drag-bar') || card.querySelector('.border-b, .border-b-2') || card;
  handle.classList.add('draggable-header-handle');
  handle.style.cursor = 'grab';

  let isDragging = false;
  let startX = 0, startY = 0;
  let curX = parseFloat(card.dataset.dragX || '0');
  let curY = parseFloat(card.dataset.dragY || '0');

  const onStart = (e) => {
    if (e.target.closest('button, a, input, select, textarea, label, .modal-close-btn, .popup-zoom-btn, details, summary, i, svg, [onclick]')) return;
    isDragging = true;
    handle.style.cursor = 'grabbing';

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX - curX;
    startY = clientY - curY;

    if (state.map && state.map.dragging) {
      state.map.dragging.disable();
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  const onMove = (e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    curX = clientX - startX;
    curY = clientY - startY;

    card.dataset.dragX = curX.toString();
    card.dataset.dragY = curY.toString();
    card.style.transform = `translate3d(${curX}px, ${curY}px, 0px)`;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    handle.style.cursor = 'grab';

    if (state.map && state.map.dragging) {
      state.map.dragging.enable();
    }

    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
  };

  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, { passive: false });
}

function initAllDraggableModals() {
  const modalIds = [
    'tracks-modal', 'layer-modal', 'room-modal', 'profile-modal',
    'invite-modal', 'announcement-modal', 'received-announcement-modal',
    'about-modal', 'onboarding-modal', 'elevation-drawer'
  ];
  modalIds.forEach(id => makeModalDraggable(id));
}

// ============================================================================
// DÉMARRAGE DE L'APPLICATION (BOOTSTRAP DEFENSIVE & ROBUSTE)
// ============================================================================
function bootApp() {
  console.log('[RandoTracker] Démarrage du système...');
  try { initPWA(); } catch(e) { console.error('[Init PWA]', e); }
  try { initMap(); } catch(e) { console.error('[Init Map]', e); }
  try { initUserRole(); } catch(e) { console.error('[Init UserRole]', e); }
  try { loadUserProfile(); } catch(e) { console.error('[Init UserProfile]', e); }
  try { setupEventListeners(); } catch(e) { console.error('[Init EventListeners]', e); }
  try { initRealtimeSync(); } catch(e) { console.error('[Init RealtimeSync]', e); }
  try { initPixelSanctuaryGuardians(); } catch(e) { console.error('[Init PixelGuardians]', e); }
  try { initAllDraggableModals(); } catch(e) { console.error('[Init DraggableModals]', e); }

  // Ancrage initial robuste dans l'historique pour empêcher tout swipe-back destructif
  try {
    history.replaceState({ randoMain: true }, '', window.location.href);
    history.pushState({ randoMain: true }, '', window.location.href);
  } catch (e) {}

  try { createOrUpdateUserMarker(state.myUser); } catch(e) { console.error('[Init UserMarker]', e); }
  try { loadSavedOtherUsersFromStorage(); } catch(e) { console.error('[Init SavedUsers]', e); }
  try { renderUsersList(); } catch(e) { console.error('[Init UsersList]', e); }

  // CHARGEMENT DE LA SESSION PERSISTANTE (SI RANDONNÉE EN COURS < 8H/24H)
  try {
    const hasRestored = loadHikeSessionFromStorage();
    if (!hasRestored) {
      renderQuickTracksBar();
    }
  } catch(e) { console.error('[Init HikeSession]', e); }

  try {
    startHeartbeat();
    setInterval(cleanStaleUsers, 10000); // Surveillance toutes les 10s
  } catch(e) { console.error('[Init Heartbeat]', e); }

  try {
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch(e) { console.error('[Init Lucide]', e); }

  try { ensureBarsVisible(); } catch(e) { console.error('[Init EnsureBars]', e); }

  // Retries garantis pour le rendu des icônes Lucide et le recalcul géométrique de Leaflet
  setTimeout(() => {
    try {
      if (window.lucide && lucide.createIcons) lucide.createIcons();
      if (state.map) state.map.invalidateSize();
    } catch(e) {}
  }, 150);

  setTimeout(() => {
    try {
      if (window.lucide && lucide.createIcons) lucide.createIcons();
      if (state.map) state.map.invalidateSize();
    } catch(e) {}
  }, 600);

  // VÉRIFICATION DU GUIDE ONBOARDING (1er démarrage) OU DÉMARRAGE DIRECT GPS
  try {
    const hasAcceptedOnboarding = localStorage.getItem('rando_onboarding_accepted');
    if (!hasAcceptedOnboarding) {
      checkOnboardingStatus();
    } else if (navigator.geolocation) {
      console.log('[GPS] Démarrage automatique de la géolocalisation...');
      startGpsWatch(true);
    }
  } catch(e) { console.error('[Init Onboarding/GPS]', e); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

// ============================================================================
// GESTION DE L'HISTORIQUE & PROTECTION ANTI-DISPARITION / SWIPE-BACK (ANDROID / PIXEL)
// ============================================================================
function pushModalState(modalId) {
  try {
    history.pushState({ modal: modalId, randoTracker: true }, '');
  } catch (e) {}
}

function isAnyModalOrDrawerOpen() {
  const modals = [
    'invite-modal', 'announcement-modal', 'received-announcement-modal',
    'tracks-modal', 'layer-modal', 'room-modal', 'profile-modal', 'about-modal',
    'emergency-modal', 'onboarding-modal'
  ];
  for (const id of modals) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) return true;
  }
  const usersPanel = document.getElementById('users-panel');
  if (usersPanel && !usersPanel.classList.contains('drawer-closed') && usersPanel.classList.contains('drawer-open')) return true;
  const eleDrawer = document.getElementById('elevation-drawer');
  if (eleDrawer && !eleDrawer.classList.contains('hidden')) return true;
  return false;
}

function closeAllModalsAndDrawers() {
  closeAllDrawers();
  closeEmergencyModal();
  const modals = [
    'invite-modal', 'announcement-modal', 'received-announcement-modal',
    'tracks-modal', 'layer-modal', 'room-modal', 'profile-modal', 'about-modal',
    'elevation-drawer', 'onboarding-modal'
  ];
  modals.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (state.map) {
    setTimeout(() => state.map.invalidateSize(), 120);
  }
  ensureBarsVisible();
}

// Interception des gestes retour (swipe gauche-droite sur Pixel/Samsung ou bouton retour système)
window.addEventListener('popstate', (e) => {
  if (isAnyModalOrDrawerOpen()) {
    closeAllModalsAndDrawers();
  }
  try {
    history.pushState({ randoMain: true }, '', window.location.href);
  } catch (err) {}
  ensureBarsVisible();
});

// EXPORTS GLOBAUX WINDOW (Sécurité d'appel pour tous les boutons HTML inline)
window.toggleEmergencyModal = toggleEmergencyModal;
window.openEmergencyModal = openEmergencyModal;
window.closeEmergencyModal = closeEmergencyModal;
window.renderEmergencyActionsPad = renderEmergencyActionsPad;
window.initiateEmergencyCall = initiateEmergencyCall;
window.notifyEmergencyCallTriggered = notifyEmergencyCallTriggered;
window.dismissEmergencyCallBanner = dismissEmergencyCallBanner;
window.closeProfileModal = closeProfileModal;
window.onNavGpsClick = onNavGpsClick;
window.onNavTracesClick = onNavTracesClick;
window.toggleUsersDrawer = toggleUsersDrawer;
window.closeAllDrawers = closeAllDrawers;
window.openTracksModal = openTracksModal;
window.closeTracksModal = closeTracksModal;
window.openInviteModal = openInviteModal;
window.closeInviteModal = () => { const m = document.getElementById('invite-modal'); if (m) m.classList.add('hidden'); };
window.openAnnouncementModal = openAnnouncementModal;
window.closeAnnouncementModal = closeAnnouncementModal;
window.openElevationDrawer = openElevationDrawer;
window.closeElevationDrawer = closeElevationDrawer;
window.toggleElevationFullscreen = toggleElevationFullscreen;
window.zoomInElevation = zoomInElevation;
window.zoomOutElevation = zoomOutElevation;
window.resetElevationZoom = resetElevationZoom;
window.panElevation = panElevation;
window.fitMapToZoomedSection = fitMapToZoomedSection;
window.handleElevationMinimapClick = handleElevationMinimapClick;
window.renderElevationChart = renderElevationChart;
window.setTrackColor = setTrackColor;
window.cycleTrackColor = cycleTrackColor;
window.ensureBarsVisible = ensureBarsVisible;
window.deleteParticipant = deleteParticipant;
window.clearOnlyParticipants = clearOnlyParticipants;
window.clearHikeSession = clearHikeSession;
window.fitAllTracks = fitAllTracks;
window.copyEmergencyGpsCoords = copyEmergencyGpsCoords;
window.toggleGroupSosAlert = toggleGroupSosAlert;
window.setBaseLayer = setBaseLayer;
window.centerOnUser = centerOnUser;
window.applyUiScale = applyUiScale;
window.loadSavedUiScale = loadSavedUiScale;
window.getMyGpsString = getMyGpsString;
window.insertGpsInCustomAnnouncement = insertGpsInCustomAnnouncement;
window.pushModalState = pushModalState;
window.makeEmergencyCall = makeEmergencyCall;
window.sendEmergencySms = sendEmergencySms;
window.sendGpsNotification = sendGpsNotification;
window.switchEmergencyTab = switchEmergencyTab;
window.dialerAppend = dialerAppend;
window.dialerBackspace = dialerBackspace;
window.dialerClear = dialerClear;
window.dialerSetNumber = dialerSetNumber;
window.dialerCall = dialerCall;
window.dialerSms = dialerSms;
window.isAnyModalOrDrawerOpen = isAnyModalOrDrawerOpen;
window.closeAllModalsAndDrawers = closeAllModalsAndDrawers;
window.makePopupDraggable = makePopupDraggable;
window.makeModalDraggable = makeModalDraggable;
window.initAllDraggableModals = initAllDraggableModals;
window.playOffTrackAlertSound = playOffTrackAlertSound;
window.playAnnouncementAlert = playAnnouncementAlert;
window.adjustPopupZoom = adjustPopupZoom;
window.adjustElevationDrawerZoom = adjustElevationDrawerZoom;
window.isOffTrackSoundEnabled = isOffTrackSoundEnabled;
window.setOffTrackSoundEnabled = setOffTrackSoundEnabled;
window.checkOnboardingStatus = checkOnboardingStatus;
window.openOnboardingModal = openOnboardingModal;
window.closeOnboardingModal = closeOnboardingModal;
window.acceptOnboarding = acceptOnboarding;
window.requestWakeLock = requestWakeLock;
window.releaseWakeLock = releaseWakeLock;
window.testWatchNotification = testWatchNotification;
window.locateAnnouncementSender = locateAnnouncementSender;
window.closeReceivedAnnouncementModal = closeReceivedAnnouncementModal;



