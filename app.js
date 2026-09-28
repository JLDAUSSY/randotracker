/**
 * RandoTracker v16 - Application Mobile PWA de Randonnée & Suivi Multi-Marcheurs
 * Cartes Officielles IGN Géoplateforme & OpenTopoMap, Multi-Traces GPX (jusqu'à 5),
 * Calcul Automatique de Progression & Heure d'Arrivée Estimée (ETA),
 * Synchronisation Temps Réel MQTT 4G/5G, Zero-Config QR Code.
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
// ÉTAT GLOBAL DE L'APPLICATION
// ============================================================================
const state = {
  map: null,
  activeLayerName: 'ign',
  layers: {},
  tracks: [],
  roomCode: 'RANDO-2026',
  myUser: {
    id: 'u_' + Math.random().toString(36).substr(2, 7),
    name: 'Jean-Luc',
    role: 'Randonneur',
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
  hasAutoCenteredGps: false
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

    const remainingHours = Math.max(1, Math.ceil((sessionData.savedAt + maxAgeMs - now) / 3600000));
    showToast(`Randonnée restaurée : ${state.tracks.length} trace(s) (Valide encore ${remainingHours}h)`, 'success');
    return true;
  } catch (e) {
    console.warn('[Storage] Erreur chargement session:', e);
    return false;
  }
}

function clearHikeSession() {
  if (state.tracks.length === 0) return;
  if (!confirm('Voulez-vous effacer toutes les traces GPX pour démarrer une nouvelle randonnée ?')) return;

  state.tracks.forEach(t => {
    const l = state.trackLayers.get(t.id);
    if (l) state.map.removeLayer(l);
  });
  state.tracks = [];
  state.trackLayers.clear();
  state.myUser.assignedTrackId = 'auto';
  localStorage.removeItem('rando_saved_session');
  renderQuickTracksBar();
  renderUsersList();
  showToast('Session réinitialisée. Prêt pour une nouvelle rando !', 'info');

  publishMessage({
    type: 'clear_tracks',
    from: state.myUser.id
  });
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

  if (savedName && savedName !== 'Jean') {
    state.myUser.name = savedName;
  } else {
    state.myUser.name = 'Jean-Luc';
    localStorage.setItem('rando_user_name', 'Jean-Luc');
  }

  if (savedRole) state.myUser.role = savedRole;
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

  if (inputName) inputName.value = state.myUser.name;
  if (inputRole) inputRole.value = state.myUser.role;
  if (inputDuration) inputDuration.value = String(state.shareDurationHours);

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

  if (name) state.myUser.name = name;
  if (role) state.myUser.role = role;
  state.myUser.assignedTrackId = trackId || 'auto';
  state.shareDurationHours = Math.min(ABSOLUTE_MAX_HOURS, Math.max(1, isNaN(duration) ? 8 : duration));

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
    navigator.serviceWorker.register('./sw.js?v=15')
      .then((reg) => {
        console.log('[PWA] Service Worker v15 actif:', reg.scope);
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
  state.map = L.map('map', {
    center: [45.8960, 6.1680],
    zoom: 13,
    zoomControl: false,
    preferCanvas: true
  });

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  // 1. Fond IGN Géoplateforme (Plan IGN V2)
  state.layers.ign = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.ign.fr/" target="_blank">IGN</a>',
      updateWhenIdle: false,
      keepBuffer: 3
    }
  );

  // 2. Fond OpenTopoMap (Courbes de niveau & Sentiers)
  state.layers.opentopo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap',
      updateWhenIdle: false,
      keepBuffer: 3
    }
  );

  // 3. Fond IGN Orthophoto (Photos Aériennes Satellite)
  state.layers.satellite = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; IGN Satellite',
      updateWhenIdle: false,
      keepBuffer: 3
    }
  );

  // 4. Fond OpenStreetMap standard
  state.layers.osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
      updateWhenIdle: false,
      keepBuffer: 3
    }
  );

  state.layers.ign.addTo(state.map);

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
    ign: 'IGN Plan',
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
// BANDEAU FLOTTANT RAPIDE DES TRACES GPX
// ============================================================================
function renderQuickTracksBar() {
  const bar = document.getElementById('quick-tracks-bar');
  const headerNewBtn = document.getElementById('header-new-hike-btn');

  if (headerNewBtn) {
    if (state.tracks.length > 0) headerNewBtn.classList.remove('hidden');
    else headerNewBtn.classList.add('hidden');
  }

  if (!bar) return;

  if (state.tracks.length === 0) {
    bar.innerHTML = `
      <div class="flex items-center gap-2 bg-slate-900/95 border-2 border-emerald-500/60 rounded-2xl p-1.5 shadow-2xl">
        <label for="gpx-file-input" class="cursor-pointer flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-4 py-2.5 rounded-xl shadow transition active:scale-95">
          <i data-lucide="upload-cloud" class="w-5 h-5"></i>
          <span>📂 Charger vos GPX (jusqu'à 5)</span>
        </label>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const tracksHtml = state.tracks.map((track) => `
    <div class="flex items-center gap-1 bg-slate-900/95 border-2 ${track.visible ? 'border-slate-700' : 'border-slate-800 opacity-50'} rounded-2xl px-3 py-2 shadow-2xl shrink-0">
      <button onclick="toggleTrackVisibility('${track.id}')" class="flex items-center gap-2 text-white font-black text-sm active:scale-95" title="Afficher/Masquer">
        <span class="w-4 h-4 rounded-full shadow shrink-0" style="background-color: ${track.color.hex}"></span>
        <span class="truncate max-w-[110px] sm:max-w-[160px]">${track.name}</span>
        <span class="text-xs text-emerald-400 font-black">${track.totalDistance.toFixed(1)}km</span>
      </button>
      <button onclick="openElevationDrawer('${track.id}')" class="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800" title="Profil altimétrique">
        <i data-lucide="bar-chart-2" class="w-4 h-4 text-emerald-400"></i>
      </button>
      <button onclick="zoomToTrack('${track.id}')" class="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800" title="Centrer">
        <i data-lucide="maximize" class="w-4 h-4"></i>
      </button>
      <button onclick="removeTrack('${track.id}')" class="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800" title="Supprimer">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');

  const addPill = state.tracks.length < MAX_TRACKS ? `
    <label for="gpx-file-input" class="cursor-pointer flex items-center gap-1.5 bg-slate-900/95 border-2 border-dashed border-emerald-500/80 hover:border-emerald-400 text-emerald-400 rounded-2xl px-3 py-2 font-black text-xs shadow-2xl shrink-0 active:scale-95">
      <i data-lucide="plus" class="w-4 h-4"></i>
      <span>GPX (${state.tracks.length}/5)</span>
    </label>
  ` : '';

  const clearPill = `
    <button onclick="clearHikeSession()" class="flex items-center gap-1.5 bg-red-950/90 hover:bg-red-900 border-2 border-red-500/80 text-red-200 font-black text-xs px-3.5 py-2 rounded-2xl shadow-2xl shrink-0 active:scale-95 transition" title="Effacer toutes les traces pour démarrer une nouvelle rando">
      <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
      <span>Nouvelle Rando</span>
    </button>
  `;

  bar.innerHTML = tracksHtml + addPill + clearPill;
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

  const sosClass = user.isSos ? 'is-sos' : '';
  const liveClass = !user.isSos ? 'is-live' : '';
  const roleBadge = user.role.includes('Guide') ? '👑' : user.role.includes('Serre-file') ? '🛡️' : '🥾';

  const html = `
    <div class="user-marker-pin" id="marker-${user.id}">
      <div class="user-avatar-bubble ${liveClass} ${sosClass}" style="background-color: ${user.color || '#059669'};">
        <span>${user.icon || '🌲'}</span>
      </div>
      <div class="user-label-tag">
        <span>${roleBadge}</span>
        <span>${user.name}</span>
        ${user.isSos ? '<span class="text-red-400 font-black ml-1 animate-pulse">SOS</span>' : ''}
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
    <div class="p-1 space-y-2.5 min-w-[240px]">
      <div class="flex items-center gap-3 pb-2.5 border-b border-slate-700">
        <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white shadow-lg" style="background-color: ${user.color}">
          ${user.icon || '🌲'}
        </div>
        <div>
          <div class="font-black text-base text-white">${user.name} ${isMe ? '(Moi)' : ''}</div>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-xs text-slate-300 font-bold">${user.role}</span>
            ${progress ? `<span class="text-xs text-amber-400 font-black">• ETA ${progress.etaShort}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs text-slate-200">
        <div>Vitesse : <b class="text-white">${(user.speed || 0).toFixed(1)} km/h</b></div>
        <div>Altitude : <b class="text-white">${Math.round(user.ele || 0)} m</b></div>
        <div>Batterie : <b class="${user.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${user.battery || 90}%</b></div>
        <div>Écart : <b class="text-blue-400">${isMe ? '0 m' : distFromMe < 1 ? Math.round(distFromMe * 1000) + ' m' : distFromMe.toFixed(1) + ' km'}</b></div>
      </div>

      ${progress ? `
        <div class="p-2.5 rounded-2xl bg-slate-900 border border-slate-750 space-y-1.5 mt-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-300 flex items-center gap-1.5 truncate max-w-[140px]">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${progress.trackColor};"></span>
              <span class="truncate">${progress.trackName}</span>
            </span>
            <span class="font-black text-emerald-400 text-xs font-mono">${progress.progressPct}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${progress.progressPct}%; background-color: ${progress.trackColor};"></div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
            <span>Reste <b>${progress.remainingDist.toFixed(1)} km</b> (+${progress.remainingEleGain}m)</span>
            <span class="text-amber-400 font-black">ETA : ${progress.etaString}</span>
          </div>
        </div>
      ` : ''}

      ${user.isSos ? `
        <div class="p-2.5 rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-300 text-xs font-black flex items-center gap-2">
          <i data-lucide="alert-triangle" class="w-5 h-5 text-red-400"></i>
          <span>ALERTE SOS SIGNALÉE !</span>
        </div>
      ` : ''}

      <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-800 text-right">
        Mis à jour : ${new Date(user.lastSeen).toLocaleTimeString()}
      </div>
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
  const maxAgeMs = 24 * 3600 * 1000;

  state.otherUsers.forEach((user, id) => {
    if (now - user.lastSeen > maxAgeMs) {
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
    const isStale = (now - u.lastSeen) > (15 * 60 * 1000);
    const progress = computeTrackProgress(u);

    return `
      <div class="p-4 rounded-3xl bg-slate-800/90 border-2 ${u.isSos ? 'border-red-500/80 bg-red-950/30' : isStale ? 'border-slate-800 opacity-70' : 'border-slate-700'} hover:border-slate-500 transition flex flex-col gap-2.5 cursor-pointer active:scale-98 shadow-xl" onclick="centerOnUser('${u.id}')">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-13 h-13 rounded-full flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-lg relative border-2 border-white/90" style="background-color: ${u.color || '#3b82f6'}">
              ${u.icon || '🥾'}
              ${u.isSos ? '<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white animate-ping"></span>' : ''}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-black text-base text-white truncate">${u.name}</span>
                ${u.isSos ? '<span class="text-xs font-black px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">SOS</span>' : ''}
                ${isStale ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">Signal Ancien</span>' : ''}
              </div>
              <div class="flex items-center gap-2 text-xs mt-0.5">
                <span class="text-slate-300 font-semibold truncate">${u.role}</span>
                <span class="text-amber-400 font-black shrink-0">• ETA ${progress ? progress.etaShort : '--:--'}</span>
              </div>
            </div>
          </div>

          <div class="text-right shrink-0">
            <div class="font-black text-base text-blue-400">${distStr}</div>
            <div class="text-xs text-slate-300 font-bold flex items-center justify-end gap-1.5 mt-0.5">
              <span>${(u.speed || 0).toFixed(1)} km/h</span>
              <span>•</span>
              <span class="${u.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${u.battery}%</span>
            </div>
          </div>
        </div>

        ${progress ? `
          <div class="pt-2 border-t border-slate-750 flex flex-col gap-1.5 text-xs">
            <div class="flex items-center justify-between text-slate-300">
              <span class="font-bold flex items-center gap-1.5 truncate max-w-[180px]">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${progress.trackColor};"></span>
                <span class="truncate">${progress.trackName}</span>
              </span>
              <span class="font-black text-emerald-400 font-mono">${progress.progressPct}%</span>
            </div>
            <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" style="width: ${progress.progressPct}%; background-color: ${progress.trackColor};"></div>
            </div>
            <div class="flex items-center justify-between text-slate-300 text-[11px]">
              <span>Reste <b>${progress.remainingDist.toFixed(1)} km</b> (+${progress.remainingEleGain}m)</span>
              <span class="text-amber-400 font-black">ETA : ${progress.etaString}</span>
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
// TIROIR DES PARTICIPANTS (SANS VOILE NOIR SUR LA CARTE)
// ============================================================================
function toggleUsersDrawer() {
  const usersPanel = document.getElementById('users-panel');
  if (!usersPanel) return;

  if (state.activeDrawer === 'users') {
    closeAllDrawers();
  } else {
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    state.activeDrawer = 'users';
    const navUsers = document.getElementById('nav-btn-users');
    if (navUsers) navUsers.classList.add('text-blue-400');
  }
}

function openDrawer(panelName) {
  const usersPanel = document.getElementById('users-panel');
  if (panelName === 'users' && usersPanel) {
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    state.activeDrawer = 'users';
    const navUsers = document.getElementById('nav-btn-users');
    if (navUsers) navUsers.classList.add('text-blue-400');
  }
}

function closeAllDrawers() {
  const usersPanel = document.getElementById('users-panel');
  if (usersPanel) {
    usersPanel.classList.add('drawer-closed');
    usersPanel.classList.remove('drawer-open');
  }
  const navUsers = document.getElementById('nav-btn-users');
  if (navUsers) navUsers.classList.remove('text-blue-400');
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
  if (navBubble) navBubble.className = 'w-18 h-18 rounded-full bg-amber-500/20 border-4 border-amber-500 flex items-center justify-center';
  if (navIcon) navIcon.className = 'w-9 h-9 text-amber-400 animate-spin';

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

    const accStr = `±${Math.round(pos.coords.accuracy)}m`;
    if (navLabel) navLabel.textContent = `GPS (${accStr})`;
    if (navBubble) navBubble.className = 'w-18 h-18 rounded-full bg-emerald-600 border-4 border-white flex items-center justify-center shadow-2xl animate-pulse';
    if (navIcon) navIcon.className = 'w-9 h-9 text-white';

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

    if (!state.hasAutoCenteredGps) {
      state.map.setView([state.myUser.lat, state.myUser.lon], 16, { animate: true });
      state.hasAutoCenteredGps = true;
      showToast(`Position GPS trouvée (${accStr}) - Partage actif (${state.shareDurationHours}h max)`, 'success');
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

  state.isTrackingGps = false;
  state.gpsStartTime = null;

  const navBubble = document.getElementById('nav-gps-bubble');
  const navIcon = document.getElementById('nav-gps-icon');
  const navLabel = document.getElementById('nav-gps-label');

  if (navLabel) navLabel.textContent = 'Mon GPS';
  if (navBubble) navBubble.className = 'w-18 h-18 rounded-full bg-slate-800 border-4 border-slate-600 flex items-center justify-center shadow-xl';
  if (navIcon) navIcon.className = 'w-9 h-9 text-slate-300';
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
          
          // Annoncer notre arrivée dans le salon
          publishMessage({
            type: 'user_joined',
            user: state.myUser,
            hasTracks: state.tracks.length > 0
          });

          // Si nous avons déjà des traces chargées, les envoyer immédiatement
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

  if (data.type === 'user_joined') {
    const user = data.user;
    if (user) {
      state.otherUsers.set(user.id, user);
      createOrUpdateUserMarker(user);
      renderUsersList();
      showToast(`👋 ${user.name} a rejoint la rando !`, 'info');

      // Si nous avons des traces GPX chargées, nous les envoyons au nouvel arrivant
      if (state.tracks.length > 0) {
        publishMessage({
          type: 'sync_tracks',
          from: state.myUser.id,
          tracks: state.tracks
        });
        publishMessage({
          type: 'update_position',
          user: state.myUser
        });
      }
    }
  } else if (data.type === 'sync_tracks') {
    // Réception des traces GPX de la rando envoyées par Jean-Luc ou le guide
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
  } else if (data.type === 'update_position' || data.type === 'user_updated') {
    const user = data.user;
    if (user) {
      if (state.otherUsers.size < (MAX_USERS - 1) || state.otherUsers.has(user.id)) {
        state.otherUsers.set(user.id, user);
        createOrUpdateUserMarker(user);
        renderUsersList();
      }
    }
  } else if (data.type === 'clear_tracks') {
    state.tracks.forEach(t => {
      const l = state.trackLayers.get(t.id);
      if (l) state.map.removeLayer(l);
    });
    state.tracks = [];
    state.trackLayers.clear();
    state.myUser.assignedTrackId = 'auto';
    renderQuickTracksBar();
    renderUsersList();
    showToast('Traces réinitialisées par le guide.', 'info');
  } else if (data.type === 'user_left') {
    state.otherUsers.delete(data.userId);
    removeUserMarker(data.userId);
    renderUsersList();
  }
}

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
        state.roomCode = val;
        updateRoomDisplay();
        initMqttSync();
        saveHikeSessionToStorage();
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

  // Alerte SOS Randonneur
  const sosBtn = document.getElementById('sos-toggle-btn');
  const sosText = document.getElementById('sos-btn-text');
  if (sosBtn) {
    sosBtn.addEventListener('click', () => {
      state.myUser.isSos = !state.myUser.isSos;
      if (state.myUser.isSos) {
        sosBtn.classList.remove('bg-red-600/20', 'text-red-400');
        sosBtn.classList.add('bg-red-600', 'text-white', 'animate-pulse');
        if (sosText) sosText.textContent = '⚠️ ALERTE SOS ACTIVE (ANNULER)';
        showToast('🚨 ALERTE SOS ENVOYÉE AU GROUPE !', 'error');
      } else {
        sosBtn.classList.add('bg-red-600/20', 'text-red-400');
        sosBtn.classList.remove('bg-red-600', 'text-white', 'animate-pulse');
        if (sosText) sosText.textContent = '🚨 SIGNALER UN PROBLÈME / SOS';
        showToast('Alerte SOS désactivée', 'info');
      }
      broadcastMyPosition();
    });
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
}

// ============================================================================
// DÉMARRAGE DE L'APPLICATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initMap();
  loadUserProfile();
  setupEventListeners();
  initRealtimeSync();

  createOrUpdateUserMarker(state.myUser);
  renderUsersList();

  // CHARGEMENT DE LA SESSION PERSISTANTE (SI RANDONNÉE EN COURS < 8H/24H)
  const hasRestored = loadHikeSessionFromStorage();
  if (!hasRestored) {
    renderQuickTracksBar();
  }

  lucide.createIcons();

  // DÉMARRAGE IMMÉDIAT DE LA GÉOLOCALISATION GPS
  if (navigator.geolocation) {
    console.log('[GPS] Démarrage automatique de la géolocalisation...');
    startGpsWatch(true);
  }
});
