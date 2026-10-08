/**
 * RandoTracker v20 - Application Mobile PWA de Randonnée & Suivi Multi-Marcheurs
 * Cartes Officielles IGN Géoplateforme (France) & IGN España (MTN Topo 1:25k),
 * Version Organisateur (Privilèges GPX, Invitations, Purge) & Mode Invité Simplifié,
 * Auto-Commutation Intelligente selon la Géolocalisation & Coordonnées GPX,
 * Multi-Traces GPX (jusqu'à 5), Calcul Automatique de Progression & ETA.
 */

// ============================================================================
// SYSTÈME DE LOGGING UNIFIÉ & PERSISTANT (RING BUFFER + LOCALSTORAGE + EXPORT)
// ============================================================================
const RandoLogger = (function() {
  const MAX_MEMORY_LOGS = 400;
  const MAX_STORAGE_LOGS = 120;
  const STORAGE_KEY = 'rando_system_logs_v1';
  let activeFilter = 'ALL';
  let persistTimeout = null;
  let isLogsModalOpen = false;

  let logs = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      logs = JSON.parse(saved);
      if (!Array.isArray(logs)) logs = [];
    }
  } catch (e) {
    logs = [];
  }

  function formatTime(d) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function persistLogs() {
    try {
      const subset = logs.slice(-MAX_STORAGE_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
    } catch (e) {}
  }

  function addLog(level, tag, message, data = null) {
    const now = new Date();
    let dataStr = '';
    if (data !== null && data !== undefined) {
      try {
        dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      } catch (e) {
        dataStr = '[Object non sérialisable]';
      }
    }

    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      time: formatTime(now),
      timestamp: now.getTime(),
      level: level.toUpperCase(), // INFO, WARN, ERROR, DEBUG, GPS, MQTT
      tag: tag ? tag.replace(/[\[\]]/g, '').trim().toUpperCase() : 'APP',
      message: String(message || ''),
      data: dataStr
    };

    logs.push(entry);
    if (logs.length > MAX_MEMORY_LOGS) {
      logs.shift();
    }

    if (!persistTimeout) {
      persistTimeout = setTimeout(() => {
        persistTimeout = null;
        persistLogs();
      }, 2000);
    }

    if (isLogsModalOpen && typeof renderLogsList === 'function') {
      try { renderLogsList(); } catch (e) {}
    }

    return entry;
  }

  // Interception sécurisée de la console
  const origLog = console.log ? console.log.bind(console) : () => {};
  const origWarn = console.warn ? console.warn.bind(console) : () => {};
  const origError = console.error ? console.error.bind(console) : () => {};
  const origInfo = console.info ? console.info.bind(console) : origLog;

  function parseAndLog(defaultLevel, args) {
    if (!args || args.length === 0) return;
    const first = String(args[0] || '');
    let tag = 'APP';
    let msg = first;
    let level = defaultLevel;

    const tagMatch = first.match(/^\[([A-Za-z0-9_-]+)\]/);
    if (tagMatch) {
      tag = tagMatch[1];
      msg = first.substring(tagMatch[0].length).trim();
      const upperTag = tag.toUpperCase();
      if (upperTag.includes('GPS') || upperTag.includes('POS')) level = 'GPS';
      else if (upperTag.includes('MQTT') || upperTag.includes('ROOM') || upperTag.includes('BROADCAST')) level = 'MQTT';
    }

    let extra = null;
    if (args.length > 1) {
      extra = args.length === 2 ? args[1] : args.slice(1);
    }

    addLog(level, tag, msg, extra);
  }

  console.log = function(...args) {
    origLog(...args);
    parseAndLog('INFO', args);
  };
  console.info = function(...args) {
    origInfo(...args);
    parseAndLog('INFO', args);
  };
  console.warn = function(...args) {
    origWarn(...args);
    parseAndLog('WARN', args);
  };
  console.error = function(...args) {
    origError(...args);
    parseAndLog('ERROR', args);
  };

  return {
    info: (tag, msg, data) => addLog('INFO', tag, msg, data),
    warn: (tag, msg, data) => addLog('WARN', tag, msg, data),
    error: (tag, msg, data) => addLog('ERROR', tag, msg, data),
    debug: (tag, msg, data) => addLog('DEBUG', tag, msg, data),
    gps: (msg, data) => addLog('GPS', 'GPS', msg, data),
    mqtt: (msg, data) => addLog('MQTT', 'MQTT', msg, data),
    getLogs: () => [...logs],
    clear: () => {
      logs = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      if (typeof renderLogsList === 'function') renderLogsList();
    },
    exportAsText: () => {
      const lines = [
        `=== RANDOTRACKER RAPPORT DE DIAGNOSTIC & LOGS ===`,
        `Généré le : ${new Date().toLocaleString('fr-FR')}`,
        `Version : v1.4.12 (50) • Cache v88`,
        `User Agent : ${navigator.userAgent}`,
        `Salon : ${typeof state !== 'undefined' ? state.roomCode : 'N/A'}`,
        `Moi : ${typeof state !== 'undefined' && state.myUser ? state.myUser.name : 'N/A'} (ID: ${typeof state !== 'undefined' && state.myUser ? state.myUser.id : 'N/A'})`,
        `Position : ${typeof state !== 'undefined' && state.myUser && typeof state.myUser.lat === 'number' ? `${state.myUser.lat.toFixed(6)}, ${state.myUser.lon.toFixed(6)} (Alt: ${Math.round(state.myUser.ele || 0)}m)` : 'Non fixée'}`,
        `Mode Natif Android : ${window.IS_NATIVE_ANDROID_APP ? 'OUI' : 'NON'}`,
        `Service Worker : ${'serviceWorker' in navigator ? 'Disponible' : 'Non'}`,
        `====================================================\n`
      ];

      logs.forEach(l => {
        lines.push(`[${l.time}] [${l.level}] [${l.tag}] ${l.message} ${l.data ? `| ${l.data}` : ''}`);
      });
      return lines.join('\n');
    },
    setModalOpen: (isOpen) => { isLogsModalOpen = isOpen; },
    getFilter: () => activeFilter,
    setFilter: (f) => { activeFilter = f; }
  };
})();

// ============================================================================
// GARDIEN GLOBAL ANTI-CRASH & CAPTURE D'ERREURS DANS LES LOGS
// ============================================================================
window.addEventListener('error', function(e) {
  RandoLogger.error('RUNTIME', e.message, { filename: e.filename, lineno: e.lineno, colno: e.colno });
  try {
    if (typeof ensureBarsVisible === 'function') ensureBarsVisible();
  } catch (err) {}
});

window.addEventListener('unhandledrejection', function(e) {
  const reason = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled rejection';
  RandoLogger.error('PROMISE', reason);
});

// ============================================================================
// ASSAINISSEMENT IMMÉDIAT DU STOCKAGE LOCAL (ÉRADICATION GHOSTS GUIDE & ANIMATEUR)
// ============================================================================
(function sanitizeLegacyStorage() {
  try {
    const savedName = (localStorage.getItem('rando_user_name') || '').trim().toLowerCase();
    if (savedName === 'guide' || savedName === 'animateur' || savedName === 'guide de tête' || savedName === 'guide de tete') {
      localStorage.removeItem('rando_user_name');
    }
    const savedRole = (localStorage.getItem('rando_user_role') || '').trim().toLowerCase();
    if (savedRole === 'guide' || savedRole === 'animateur' || savedRole === 'guide de tête' || savedRole === 'guide de tete') {
      localStorage.setItem('rando_user_role', 'Randonneur');
    }
    const otherUsersStr = localStorage.getItem('rando_saved_other_users');
    if (otherUsersStr) {
      const parsed = JSON.parse(otherUsersStr);
      if (parsed && Array.isArray(parsed.users)) {
        parsed.users = parsed.users.filter(u => {
          const n = (u && u.name ? u.name.trim().toLowerCase() : '');
          return n !== 'guide' && n !== 'animateur' && n !== 'guide de tête' && n !== 'guide de tete';
        });
        localStorage.setItem('rando_saved_other_users', JSON.stringify(parsed));
      }
    }
    // Nettoyage des coordonnées résiduelles Annecy des anciennes versions
    const savedLat = parseFloat(localStorage.getItem('rando_last_lat'));
    const savedLon = parseFloat(localStorage.getItem('rando_last_lon'));
    if (!isNaN(savedLat) && !isNaN(savedLon)) {
      if (Math.abs(savedLat - 45.8960) < 0.02 && Math.abs(savedLon - 6.1680) < 0.02) {
        localStorage.removeItem('rando_last_lat');
        localStorage.removeItem('rando_last_lon');
      }
    }
  } catch (e) {}
})();

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
// CONFIGURATION MONÉTISATION : GOOGLE ADMOB & AMAZON PARTENAIRES
// ============================================================================
const MONETIZATION_CONFIG = {
  // Google AdMob & AdSense (Éditeur officiel)
  admob: {
    publisherId: 'ca-pub-1457919469523324',
    appId: 'ca-app-pub-1457919469523324~7359434004',
    appOpenAdUnitId: 'ca-app-pub-1457919469523324/7772255130',
    slotId: '7772255130',
    enabled: true
  },
  // Amazon Partenaires (Tag certifié multi-produits)
  amazon: {
    tag: 'watermetrics-21',
    // Suggestions d'équipements pour la modale Traces GPX
    trackSuggestions: [
      {
        icon: '🥾',
        badge: 'Équipement Recommandé',
        title: 'Bâtons de Randonnée Anti-Chocs',
        desc: 'Soulagez vos genoux et gagnez en stabilité en montée comme en descente.',
        btnText: 'Voir les bâtons',
        searchQuery: 'batons randonnee telescopiques anti chocs legers'
      },
      {
        icon: '👟',
        badge: 'Confort & Protection',
        title: 'Chaussures & Chaussettes Anti-Ampoules',
        desc: 'Adhérence tout-terrain Vibram et imperméabilité Gore-Tex pour vos parcours.',
        btnText: 'Voir les chaussures',
        searchQuery: 'chaussures randonnee homme femme gore tex vibram'
      },
      {
        icon: '🎒',
        badge: 'Portage & Hydratation',
        title: 'Sacs à Dos Légers & Gourdes Filtrantes',
        desc: 'Portage ergonomique ventilé et eau potable garantie partout en montagne.',
        btnText: 'Voir les sacs & gourdes',
        searchQuery: 'sac a dos randonnee legere gourde filtrante poche a eau'
      }
    ],
    // Suggestions d'équipements pour la modale Mon Profil
    profileSuggestions: [
      {
        icon: '🔋',
        badge: 'Autonomie GPS Recommandée',
        title: 'Batterie Externe Étanche 20 000 mAh',
        desc: 'Gardez votre smartphone et le suivi GPS allumés toute la journée sans coupure.',
        btnText: 'Voir les batteries GPS',
        searchQuery: 'batterie externe powerbank 20000mah etanche antichoc randonnee'
      },
      {
        icon: '🔦',
        badge: 'Sécurité & Visibilité',
        title: 'Lampes Frontales Puissantes & Rechargeables',
        desc: 'Éclairage haute puissance et autonomie en cas de fin de randonnée tardive.',
        btnText: 'Voir les lampes frontales',
        searchQuery: 'lampe frontale puissante rechargeable usb rando trail'
      },
      {
        icon: '🩹',
        badge: 'Sécurité du Groupe',
        title: 'Trousses de Secours Compactes & Couvertures',
        desc: 'Matériel de premiers soins indispensable pour parer aux petits imprévus.',
        btnText: 'Voir les trousses de secours',
        searchQuery: 'trousse de secours compacte randonnee montagne premier secours'
      }
    ]
  }
};

let currentTrackAdIndex = 0;
let currentProfileAdIndex = 0;

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
    name: 'Randonneur',
    role: 'Randonneur',
    icon: '🥾',
    color: '#10b981',
    assignedTrackId: 'auto', // 'auto' ou l'ID d'une trace GPX
    lat: null,
    lon: null,
    ele: null,
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
// PONT NATIF ANDROID : SYNCHRONISATION ARRIÈRE-PLAN ÉCRAN ÉTEINT
// ============================================================================
function syncNativeAndroidSession() {
  if (window.AndroidBridge) {
    try {
      const room = state.roomCode || 'RANDO-2026';
      const uid = (state.myUser && state.myUser.id) ? state.myUser.id : 'anonymous';
      const name = (state.myUser && state.myUser.name) ? state.myUser.name : 'Randonneur';
      const role = (state.myUser && state.myUser.role) ? state.myUser.role : 'Randonneur';
      const color = (state.myUser && state.myUser.color) ? state.myUser.color : '#059669';
      const icon = (state.myUser && state.myUser.icon) ? state.myUser.icon : '🥾';
      const isSos = !!(state.myUser && state.myUser.isSos);

      if (typeof window.AndroidBridge.syncTrackingSession === 'function') {
        window.AndroidBridge.syncTrackingSession(room, uid, name, role, color, icon, isSos);
        console.log('[NativeBridge] Session synchronisée avec Android Service (syncTrackingSession):', room, name);
      } else if (typeof window.AndroidBridge.updateSession === 'function') {
        window.AndroidBridge.updateSession(
          room,
          uid,
          name,
          icon,
          color,
          state.myUser?.assignedTrackId || 'auto',
          state.isTrackingGps !== false
        );
        console.log('[NativeBridge] Session synchronisée avec Android Service (updateSession):', room, name);
      }
    } catch (e) {
      console.warn('[NativeBridge] Erreur sync session:', e);
    }
  }
}

window.onNativeAndroidReady = function() {
  syncNativeAndroidSession();
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
  if (!user || user.lat === null || user.lat === undefined || isNaN(user.lat) ||
      user.lon === null || user.lon === undefined || isNaN(user.lon)) {
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
    } else {
      saveOtherUsersToStorage();
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
    showToast('En attente de la transmission des traces de la rando...', 'info');
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

  const urlParams = new URLSearchParams(window.location.search);
  const isGuest = !!urlParams.get('room') || (window.location.hash && window.location.hash.includes('room='));

  let savedName = localStorage.getItem('rando_user_name');
  const savedRole = localStorage.getItem('rando_user_role');
  const savedIcon = localStorage.getItem('rando_user_icon');
  const savedColor = localStorage.getItem('rando_user_color');
  const savedTrack = localStorage.getItem('rando_user_track');
  const savedDuration = localStorage.getItem('rando_share_duration');

  // Purger les anciens libellés par défaut "Animateur", "Guide", "Guide de tête"
  const cleanSavedName = (savedName || '').trim().toLowerCase();
  if (cleanSavedName === 'animateur' || cleanSavedName === 'guide' || cleanSavedName === 'guide de tête' || cleanSavedName === 'guide de tete') {
    savedName = '';
    localStorage.removeItem('rando_user_name');
  }

  if (savedName && savedName.trim() !== '') {
    state.myUser.name = savedName;
  } else {
    state.myUser.name = 'Randonneur';
  }

  const cleanSavedRole = (savedRole || '').trim().toLowerCase();
  if (cleanSavedRole === 'animateur' || cleanSavedRole === 'guide' || cleanSavedRole === 'guide de tête' || cleanSavedRole === 'guide de tete') {
    state.myUser.role = 'Randonneur';
    localStorage.setItem('rando_user_role', 'Randonneur');
  } else if (savedRole && savedRole.trim() !== '') {
    state.myUser.role = savedRole;
  } else {
    state.myUser.role = 'Randonneur';
    localStorage.setItem('rando_user_role', 'Randonneur');
  }

  if (savedIcon) {
    state.myUser.icon = savedIcon;
  } else {
    state.myUser.icon = '🥾';
  }

  if (savedColor) {
    state.myUser.color = savedColor;
  } else {
    state.myUser.color = '#10b981';
  }
  
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

function formatAvatarHtml(icon, extraClass = '') {
  if (!icon) return '<span>🥾</span>';
  if (icon === '🐱_pink' || icon === 'cat_pink' || icon === 'chat_rose' || (typeof icon === 'string' && icon.includes('cat_pink_icon'))) {
    return `<img src="cat_pink_icon.png?v=69" alt="Chat Rose" class="w-full h-full object-cover rounded-full pointer-events-none select-none ${extraClass}" />`;
  }
  if (icon === '🐱' || icon === 'cat' || icon === 'chat' || (typeof icon === 'string' && icon.includes('cat_icon'))) {
    return `<img src="cat_icon.png?v=69" alt="Chat Jaune" class="w-full h-full object-cover rounded-full pointer-events-none select-none ${extraClass}" />`;
  }
  return `<span>${icon}</span>`;
}

function updateProfileUI() {
  const headerBadge = document.getElementById('header-avatar-badge');
  if (headerBadge) {
    headerBadge.innerHTML = formatAvatarHtml(state.myUser.icon);
    headerBadge.style.backgroundColor = state.myUser.color;
  }

  const myName = document.getElementById('my-name-display');
  const myRole = document.getElementById('my-role-display');
  const myAvatar = document.getElementById('my-avatar-display');

  if (myName) myName.textContent = state.myUser.name;
  if (myRole) myRole.textContent = state.myUser.role;
  if (myAvatar) {
    myAvatar.innerHTML = formatAvatarHtml(state.myUser.icon);
    myAvatar.style.backgroundColor = state.myUser.color;
  }

  const inputName = document.getElementById('input-user-name');
  const inputRole = document.getElementById('input-user-role');
  const inputDuration = document.getElementById('input-share-duration');
  const inputTrack = document.getElementById('input-user-track');
  const soundToggle = document.getElementById('toggle-offtrack-sound');

  if (inputName) {
    const n = (state.myUser.name || '').trim();
    inputName.value = (!['randonneur', 'marcheur', 'participant', 'guide', 'animateur'].includes(n.toLowerCase())) ? n : '';
  }
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
    const btnIcon = btn.getAttribute('data-icon');
    const isSelected = btnIcon === state.myUser.icon || 
      (btnIcon === '🐱' && (state.myUser.icon === '🐱' || state.myUser.icon === 'cat' || state.myUser.icon === 'chat' || (typeof state.myUser.icon === 'string' && state.myUser.icon.includes('cat_icon.png')))) ||
      (btnIcon === '🐱_pink' && (state.myUser.icon === '🐱_pink' || state.myUser.icon === 'cat_pink' || (typeof state.myUser.icon === 'string' && state.myUser.icon.includes('cat_pink_icon'))));
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

  // Gestion de l'affichage contextuel de la carte Application Native Android
  const downloadBtn = document.getElementById('native-app-download-btn');
  const activeBadge = document.getElementById('native-app-active-badge');
  const statusText = document.getElementById('native-app-status-text');
  const subtitleText = document.getElementById('native-app-subtitle');

  if (window.IS_NATIVE_ANDROID_APP || (typeof AndroidBridge !== 'undefined')) {
    if (activeBadge) activeBadge.classList.remove('hidden');
    if (downloadBtn) downloadBtn.style.display = 'none';
    if (subtitleText) subtitleText.textContent = 'Version Play Store / Native Active';
    if (statusText) {
      statusText.innerHTML = '<span class="text-emerald-300 font-bold">✅ Application Native Active :</span> Le suivi GPS en continu, l\'écran éteint dans la poche et les alertes d\'arrière-plan sont pleinement fonctionnels.';
    }
  } else {
    if (activeBadge) activeBadge.classList.add('hidden');
    if (downloadBtn) downloadBtn.style.display = 'flex';
    if (subtitleText) subtitleText.textContent = 'Suivi GPS matériel écran éteint (Bouton Power)';
    if (statusText) {
      statusText.textContent = "Pour éteindre complètement l'écran avec le bouton physique Power sans aucune coupure GPS par Android :";
    }
  }
}

function closeProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) profileModal.classList.add('hidden');
  closeAllDrawers(); // Ferme également le panneau participants pour revenir directement sur la carte
}

// ============================================================================
// GESTION DES ESPACES PUBLICITAIRES : ADMOB & AMAZON PARTENAIRES
// ============================================================================
function renderTrackAdBanner() {
  const container = document.getElementById('tracks-modal-ad-banner');
  if (!container) return;
  const items = MONETIZATION_CONFIG.amazon.trackSuggestions;
  if (!items || items.length === 0) return;
  const item = items[currentTrackAdIndex % items.length];
  currentTrackAdIndex++;

  const queryUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(item.searchQuery)}&tag=${encodeURIComponent(MONETIZATION_CONFIG.amazon.tag)}`;

  container.innerHTML = `
    <div class="rando-ad-banner-left">
      <span class="rando-ad-icon">${item.icon}</span>
      <div class="rando-ad-text-wrap">
        <span class="rando-ad-tag">✨ Sponsorisé • ${item.badge}</span>
        <h5 class="rando-ad-title">${item.title}</h5>
        <p class="rando-ad-desc">${item.desc}</p>
      </div>
    </div>
    <a href="${queryUrl}" target="_blank" rel="noopener sponsored" class="rando-ad-btn">
      <span>${item.btnText}</span>
      <span>→</span>
    </a>
  `;
}

function renderProfileAdBanner() {
  const container = document.getElementById('profile-modal-ad-banner');
  if (!container) return;
  const items = MONETIZATION_CONFIG.amazon.profileSuggestions;
  if (!items || items.length === 0) return;
  const item = items[currentProfileAdIndex % items.length];
  currentProfileAdIndex++;

  const queryUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(item.searchQuery)}&tag=${encodeURIComponent(MONETIZATION_CONFIG.amazon.tag)}`;

  container.innerHTML = `
    <div class="rando-ad-banner-left">
      <span class="rando-ad-icon">${item.icon}</span>
      <div class="rando-ad-text-wrap">
        <span class="rando-ad-tag">🔋 Sponsorisé • ${item.badge}</span>
        <h5 class="rando-ad-title">${item.title}</h5>
        <p class="rando-ad-desc">${item.desc}</p>
      </div>
    </div>
    <a href="${queryUrl}" target="_blank" rel="noopener sponsored" class="rando-ad-btn">
      <span>${item.btnText}</span>
      <span>→</span>
    </a>
  `;
}

function checkAndDisplayAppOpenAd() {
  // Entièrement désactivé : Ne jamais afficher d'interstitiel bloquant au démarrage
  const modal = document.getElementById('app-open-ad-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function closeAppOpenAd() {
  const modal = document.getElementById('app-open-ad-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function openProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;
  updateProfileUI();
  renderProfileAdBanner();
  profileModal.classList.remove('hidden');
  pushModalState('profile-modal');
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
  syncNativeAndroidSession();
  saveHikeSessionToStorage();
  createOrUpdateUserMarker(state.myUser);
  deduplicateUsersByName();
  renderUsersList();
  closeProfileModal();
  broadcastMyPosition();
  publishMessage({
    type: 'user_updated',
    user: state.myUser
  });
  showToast(`Profil enregistré : ${state.myUser.name} (${state.myUser.icon})`, 'success');
}

// ============================================================================
// SERVICE WORKER & PWA
// ============================================================================
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=82')
      .then((reg) => {
        console.log('[PWA] Service Worker v82 actif:', reg.scope);
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
  const hasSavedPos = !isNaN(savedLat) && !isNaN(savedLon) && !(Math.abs(savedLat - 45.8960) < 0.02 && Math.abs(savedLon - 6.1680) < 0.02);
  const initialCenter = hasSavedPos ? [savedLat, savedLon] : [46.603354, 1.888334];
  const initialZoom = hasSavedPos ? 14 : 6;

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

  // 3. Fond UK Ordnance Survey / Topo (Sentiers & Relief Royaume-Uni) - Optimisé avec support OS Data Hub
  initOrdnanceSurveyLayer();

  // 4. Fond Swisstopo (Carte Nationale Suisse Alpin Topo) - Optimisé
  state.layers.swisstopo = L.tileLayer(
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank">swisstopo</a>',
      updateWhenIdle: true,
      updateInterval: 150,
      keepBuffer: 1
    }
  );

  // 5. Fond OpenTopoMap (Courbes de niveau & Sentiers Monde) - Optimisé
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
        makeElementPinchZoomable(popupEl);
        if (typeof L !== 'undefined' && L.DomEvent) {
          L.DomEvent.disableClickPropagation(popupEl);
          L.DomEvent.disableScrollPropagation(popupEl);
        }
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
    uk_topo: 'UK Ordnance',
    swisstopo: 'Swisstopo',
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
// GESTION DU FOND ORDNANCE SURVEY UK (OFFICIEL OS DATA HUB & SECOURS OPENTOPO)
// ============================================================================
const DEFAULT_OS_API_KEY = 'E5c4VX6vG0L4FANTJzfnlocpeW8em8Km';

function initOrdnanceSurveyLayer() {
  const osKey = (localStorage.getItem('rando_os_api_key') || DEFAULT_OS_API_KEY).trim();
  if (state.layers.uk_topo && state.map && state.map.hasLayer(state.layers.uk_topo)) {
    state.map.removeLayer(state.layers.uk_topo);
  }

  if (osKey) {
    // Flux officiel Ordnance Survey Maps API (ZXY Web Mercator Outdoor 3857) avec secours OpenTopoMap transparent
    state.layers.uk_topo = L.tileLayer(
      `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${encodeURIComponent(osKey)}`,
      {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.ordnancesurvey.co.uk/" target="_blank">Ordnance Survey</a> (OS Maps Outdoor) & OpenTopoMap UK',
        updateWhenIdle: true,
        updateInterval: 150,
        keepBuffer: 1
      }
    );

    // Repli automatique dalle par dalle si la clé n'est pas activée sur le projet OS Data Hub
    state.layers.uk_topo.on('tileerror', function(error) {
      if (error && error.tile && error.coords) {
        const c = error.coords;
        error.tile.src = `https://a.tile.opentopomap.org/${c.z}/${c.x}/${c.y}.png`;
      }
    });
  } else {
    // Flux topographique OpenTopoMap UK (Secours gratuit sans clé)
    state.layers.uk_topo = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 17,
        attribution: '&copy; <a href="https://www.ordnancesurvey.co.uk/" target="_blank">Ordnance Survey OpenData</a> & OpenTopoMap UK',
        subdomains: 'abc',
        updateWhenIdle: true,
        updateInterval: 150,
        keepBuffer: 1
      }
    );
  }

  if (state.activeLayerName === 'uk_topo' && state.map) {
    state.layers.uk_topo.addTo(state.map);
  }
}

function saveOrdnanceSurveyApiKey(key) {
  const cleanKey = (key || '').trim();
  if (cleanKey) {
    localStorage.setItem('rando_os_api_key', cleanKey);
    showToast('🔑 Clé Ordnance Survey enregistrée ! Fond OS Outdoor activé.', 'success');
  } else {
    localStorage.removeItem('rando_os_api_key');
    showToast('Mode libre OpenTopo UK activé (sans clé).', 'info');
  }
  initOrdnanceSurveyLayer();
  updateOsApiKeyUI();
}

function updateOsApiKeyUI() {
  const input = document.getElementById('os-api-key-input');
  const badge = document.getElementById('os-key-status-badge');
  const customKey = (localStorage.getItem('rando_os_api_key') || '').trim();
  const effectiveKey = customKey || DEFAULT_OS_API_KEY;
  if (input) input.value = effectiveKey;
  if (badge) {
    if (effectiveKey) {
      badge.textContent = '🟢 Clé OS Active (OS Maps Outdoor)';
      badge.className = 'text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40';
    } else {
      badge.textContent = '🌐 Mode Libre OpenTopo (Sans clé)';
      badge.className = 'text-[10px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40';
    }
  }
}

// ============================================================================
// AUTO-DÉTECTION DU PAYS ET COMMUTATION INTELLIGENTE DU FOND DE CARTE
// ============================================================================
function detectCountry(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return 'FR';
  }

  // 1. ROYAUME-UNI (UK : Angleterre, Écosse, Pays de Galles, Irlande du Nord)
  if (lat >= 49.8 && lat <= 60.9 && lon >= -8.6 && lon <= 1.8) {
    return 'UK';
  }

  // 2. SUISSE (CH)
  if (lat >= 45.8 && lat <= 47.85 && lon >= 5.95 && lon <= 10.5) {
    return 'CH';
  }

  // 3. ESPAGNE (ES)
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

  // 4. FRANCE (FR)
  // DROM-COM
  if (lat >= -21.5 && lat <= -20.8 && lon >= 55.1 && lon <= 56.0) return 'FR'; // La Réunion
  if (lat >= 15.8 && lat <= 16.6 && lon >= -61.9 && lon <= -61.0) return 'FR'; // Guadeloupe
  if (lat >= 14.3 && lat <= 14.9 && lon >= -61.3 && lon <= -60.7) return 'FR'; // Martinique
  if (lat >= 2.0 && lat <= 6.0 && lon >= -55.0 && lon <= -51.0) return 'FR';   // Guyane
  if (lat >= -13.1 && lat <= -12.5 && lon >= 45.0 && lon <= 45.4) return 'FR'; // Mayotte
  // Corse
  if (lat >= 41.3 && lat <= 43.1 && lon >= 8.5 && lon <= 9.6) return 'FR';
  // France Métropolitaine
  if (lat >= 42.3 && lat <= 51.2 && lon >= -5.2 && lon <= 8.3) {
    return 'FR';
  }

  return 'OTHER';
}

function autoSelectMapLayerForCoords(lat, lon, reason = 'gps') {
  const country = detectCountry(lat, lon);
  const current = state.activeLayerName;

  if (country === 'UK') {
    if (current !== 'uk_topo' && current !== 'satellite') {
      setBaseLayer('uk_topo');
      const prefix = reason === 'gpx' ? '🇬🇧 Trace au Royaume-Uni' : '🇬🇧 Position au Royaume-Uni';
      showToast(`${prefix} : Fond UK Ordnance / Topo activé`, 'info');
    }
  } else if (country === 'ES') {
    if (current !== 'ign_es' && current !== 'satellite') {
      setBaseLayer('ign_es');
      const prefix = reason === 'gpx' ? '🇪🇸 Trace en Espagne' : '🇪🇸 Position en Espagne';
      showToast(`${prefix} : Fond IGN España (MTN Topo) activé`, 'info');
    }
  } else if (country === 'CH') {
    if (current !== 'swisstopo' && current !== 'satellite') {
      setBaseLayer('swisstopo');
      const prefix = reason === 'gpx' ? '🇨🇭 Trace en Suisse' : '🇨🇭 Position en Suisse';
      showToast(`${prefix} : Fond Swisstopo activé`, 'info');
    }
  } else if (country === 'FR') {
    if (current === 'ign_es' || current === 'uk_topo' || current === 'swisstopo') {
      setBaseLayer('ign');
      const prefix = reason === 'gpx' ? '🇫🇷 Trace en France' : '🇫🇷 Position en France';
      showToast(`${prefix} : Fond IGN France activé`, 'info');
    }
  } else {
    // Zone internationale (Italie, etc.)
    if (current === 'ign' || current === 'ign_es' || current === 'uk_topo' || current === 'swisstopo') {
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
  if (lat1 === null || lat1 === undefined || isNaN(lat1) ||
      lon1 === null || lon1 === undefined || isNaN(lon1) ||
      lat2 === null || lat2 === undefined || isNaN(lat2) ||
      lon2 === null || lon2 === undefined || isNaN(lon2)) {
    return 0;
  }
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
    <div class="space-y-2.5 p-1 min-w-[260px] max-w-[320px] overflow-hidden box-border">
      <!-- Barre de déplacement & Zoom de la fenêtre popup -->
      <div class="popup-drag-bar flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span class="flex items-center gap-1.5 cursor-grab shrink-0">
          <span class="text-emerald-400 font-mono text-sm leading-none">⠿</span>
          <span class="font-black text-slate-100">Déplacer</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="adjustPopupZoom(this, -0.15)" class="popup-zoom-btn" title="Réduire la taille">A-</button>
          <span class="popup-zoom-level-badge text-[10px] font-mono text-emerald-400 px-1 font-black">100%</span>
          <button type="button" onclick="adjustPopupZoom(this, 0.15)" class="popup-zoom-btn" title="Agrandir la taille">A+</button>
        </div>
        <span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate hidden sm:inline">Trace</span>
      </div>

      <div class="flex items-center gap-2.5 pb-2 border-b-2 border-slate-700">
        <span class="w-5 h-5 rounded-full shadow-lg shrink-0 border-2 border-white" style="background-color: ${track.color.hex}"></span>
        <h4 class="font-black text-base sm:text-lg text-white truncate leading-tight flex-1 min-w-0" title="${track.name}">${track.name}</h4>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm text-slate-200">
        <div class="bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wide truncate">Distance</span>
          <b class="text-white text-sm sm:text-base mt-0.5 font-mono truncate">${track.totalDistance.toFixed(1)} km</b>
        </div>
        <div class="bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wide truncate">Dénivelé +</span>
          <b class="text-emerald-400 text-sm sm:text-base mt-0.5 font-mono truncate">+${track.eleGain} m</b>
        </div>
        <div class="bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wide truncate">Alt. Min</span>
          <b class="text-white text-sm sm:text-base mt-0.5 font-mono truncate">${track.minEle} m</b>
        </div>
        <div class="bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wide truncate">Alt. Max</span>
          <b class="text-white text-sm sm:text-base mt-0.5 font-mono truncate">${track.maxEle} m</b>
        </div>
      </div>
      <button onclick="openElevationDrawer('${track.id}')" class="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition">
        <span>📈 Profil Altimétrique</span>
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
  renderTrackAdBanner();
  modal.classList.remove('hidden');
  pushModalState('tracks-modal');
}

function closeTracksModal() {
  const modal = document.getElementById('tracks-modal');
  if (modal) modal.classList.add('hidden');
}

// ============================================================================
// GESTIONNAIRE DES FONDS DE CARTE (MODALE & SÉLECTEUR HEADER)
// ============================================================================
function openLayerModal() {
  const layerModal = document.getElementById('layer-modal');
  if (!layerModal) return;
  if (typeof updateOsApiKeyUI === 'function') updateOsApiKeyUI();
  layerModal.classList.remove('hidden');
  pushModalState('layer-modal');
}

function closeLayerModal() {
  const layerModal = document.getElementById('layer-modal');
  if (layerModal) layerModal.classList.add('hidden');
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
            ${state.isOrganizer ? 'Chargez 1 à 5 fichiers GPX pour vos différents groupes de marcheurs.' : 'En attente de la transmission des parcours de la randonnée...'}
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

  if (allPoints.length > 0 && state.map) {
    const bounds = L.latLngBounds(allPoints);
    state.map.fitBounds(bounds, { padding: [50, 50] });
  } else if (state.isTrackingGps && state.map && state.myUser.lat !== null && state.myUser.lon !== null && !isNaN(state.myUser.lat) && !isNaN(state.myUser.lon)) {
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
    makeElementInteractive(drawer);
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
// SUIVI DES RANDONNEURS SUR LA CARTE AVEC DÉCALAGE ANTI-SUPERPOSITION (COLOCALISATION)
// ============================================================================
function getUserColocalizationOffset(user) {
  if (!user || typeof user.lat !== 'number' || typeof user.lon !== 'number') {
    return { dx: 0, dy: 0 };
  }

  // Rassembler tous les marcheurs valides actifs présents sur la carte
  const allUsers = [state.myUser, ...Array.from(state.otherUsers.values())]
    .filter(u => u && typeof u.lat === 'number' && typeof u.lon === 'number');

  // Trouver ceux qui sont colocalisés (à moins de 6 mètres)
  const cluster = allUsers.filter(u => {
    const d = calculateDistance(user.lat, user.lon, u.lat, u.lon);
    return d < 0.006; // 6 mètres
  });

  if (cluster.length <= 1) {
    return { dx: 0, dy: 0 };
  }

  // Tri stable et déterministe (par id)
  cluster.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  const idx = cluster.findIndex(u => u.id === user.id);
  if (idx === -1) return { dx: 0, dy: 0 };

  const N = cluster.length;
  if (N === 2) {
    // 2 marcheurs colocalisés : éventail côte à côte gauche / droite (-24px / +24px)
    const dx = (idx === 0) ? -24 : 24;
    return { dx, dy: 0 };
  }

  // 3 marcheurs ou plus : rosace circulaire équilibrée (rayon 28px)
  const radius = 28;
  const angle = (2 * Math.PI * idx) / N - (Math.PI / 2);
  const dx = Math.round(Math.cos(angle) * radius);
  const dy = Math.round(Math.sin(angle) * radius);
  return { dx, dy };
}

function refreshColocalizedMarkers(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return;
  const allUsers = [state.myUser, ...Array.from(state.otherUsers.values())];
  allUsers.forEach(u => {
    if (u && typeof u.lat === 'number' && typeof u.lon === 'number') {
      const d = calculateDistance(lat, lon, u.lat, u.lon);
      if (d < 0.006) {
        const off = getUserColocalizationOffset(u);
        const pin = document.getElementById(`marker-${u.id}`);
        if (pin) {
          pin.style.transform = (off.dx !== 0 || off.dy !== 0) ? `translate(${off.dx}px, ${off.dy}px)` : '';
        }
      }
    }
  });
}

function generateUserPopupHtml(userId) {
  const isMe = (userId === state.myUser.id);
  const user = isMe ? state.myUser : state.otherUsers.get(userId);
  if (!user) return '';

  const now = Date.now();
  const timeSinceSeenMs = now - (user.lastSeen || now);
  const isZoneBlanche = !isMe && timeSinceSeenMs > 2 * 60 * 1000;
  const minSinceSeen = Math.max(1, Math.round(timeSinceSeenMs / 60000));

  // Rôle spécifique uniquement si Guide / Serre-file / Secours
  let roleBadge = '';
  if (user.role) {
    const r = user.role.toLowerCase();
    if (r.includes('guide')) roleBadge = '👑 ';
    else if (r.includes('serre-file')) roleBadge = '🛡️ ';
    else if (r.includes('secours') || r.includes('sécurité') || r.includes('pc')) roleBadge = '🚑 ';
  }

  // Nom affiché : pour "Moi", si le prénom n'a pas encore été personnalisé, afficher "Moi"
  let rawName = (user.name || '').trim();
  let displayName = rawName;
  if (isMe && (!rawName || rawName.toLowerCase() === 'randonneur' || rawName.toLowerCase() === 'marcheur')) {
    displayName = 'Moi';
  } else if (!rawName) {
    displayName = isMe ? 'Moi' : 'Randonneur';
  }

  const hasMePos = typeof state.myUser.lat === 'number' && typeof state.myUser.lon === 'number' && !isNaN(state.myUser.lat) && !isNaN(state.myUser.lon);
  const hasUserPos = typeof user.lat === 'number' && typeof user.lon === 'number' && !isNaN(user.lat) && !isNaN(user.lon);
  const distFromMe = isMe ? 0 : ((hasMePos && hasUserPos) ? calculateDistance(state.myUser.lat, state.myUser.lon, user.lat, user.lon) : null);
  const distFromMeStr = distFromMe === null ? '--' : (distFromMe < 1 ? `${Math.round(distFromMe * 1000)} m` : `${distFromMe.toFixed(1)} km`);
  const progress = computeTrackProgress(user);

  // Récupérer tous les autres membres du groupe pour calculer les distances directes à vol d'oiseau
  const allGroupUsers = [state.myUser, ...Array.from(state.otherUsers.values())];
  const otherGroupMembers = allGroupUsers.filter(p => p && p.id !== user.id && typeof p.lat === 'number' && typeof p.lon === 'number');

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

  return `
    <div class="p-1.5 space-y-2.5 min-w-[260px] max-w-[320px] overflow-hidden box-border">
      <!-- Barre de déplacement & Zoom de la fenêtre popup -->
      <div class="popup-drag-bar flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span class="flex items-center gap-1.5 cursor-grab shrink-0">
          <span class="text-emerald-400 font-mono text-sm leading-none">⠿</span>
          <span class="font-black text-slate-100">Déplacer</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="adjustPopupZoom(this, -0.15)" class="popup-zoom-btn" title="Réduire la taille">A-</button>
          <span class="popup-zoom-level-badge text-[10px] font-mono text-emerald-400 px-1 font-black">100%</span>
          <button type="button" onclick="adjustPopupZoom(this, 0.15)" class="popup-zoom-btn" title="Agrandir la taille">A+</button>
        </div>
        <span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate hidden sm:inline">${isMe ? 'Moi' : 'Profil'}</span>
      </div>

      <!-- En-tête Participant GÉANT -->
      <div class="flex items-center gap-2.5 pb-2.5 border-b-2 border-slate-700/80">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl shrink-0 border-2 border-white/80 overflow-hidden" style="background-color: ${user.color || '#059669'}">
          ${formatAvatarHtml(user.icon || '🌲')}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-black text-base sm:text-lg text-white truncate leading-tight">${displayName} ${isMe ? '<span class="text-xs text-emerald-400 font-bold ml-1">(Moi)</span>' : ''}</div>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
            <span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold border border-slate-700 text-[11px] truncate">${user.role || 'Randonneur'}</span>
            ${!isMe ? `<span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40 text-[11px] truncate">📍 ${distFromMeStr}</span>` : ''}
            ${progress ? `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 text-[11px] shrink-0">ETA ${progress.etaShort}</span>` : ''}
            ${isZoneBlanche ? `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 text-[11px] truncate">🌲 ${minSinceSeen}m</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Grille 4 Cartes Statistiques Haut Contraste -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 sm:p-2.5 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Vitesse Moy.</span>
          <span class="text-sm sm:text-base font-black text-white mt-0.5 font-mono truncate">${(user.movingAvgSpeed && user.movingAvgSpeed > 0 ? user.movingAvgSpeed : (user.speed || 0)).toFixed(1)} <span class="text-[10px] font-bold text-slate-400">km/h</span></span>
        </div>
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 sm:p-2.5 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Altitude</span>
          <span class="text-sm sm:text-base font-black text-white mt-0.5 font-mono truncate">${Math.round(user.ele || 0)} <span class="text-[10px] font-bold text-slate-400">m</span></span>
        </div>
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 sm:p-2.5 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Batterie</span>
          <span class="text-sm sm:text-base font-black mt-0.5 font-mono truncate ${user.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${user.battery || 90}%</span>
        </div>
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 sm:p-2.5 flex flex-col min-w-0 overflow-hidden shadow-inner">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Écart Trace</span>
            ${ecartStatusTag ? `<span class="text-[9px] font-black uppercase px-1 py-0.2 rounded shrink-0 ${isFarFromTrack ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">${ecartStatusTag}</span>` : ''}
          </div>
          <span class="text-sm sm:text-base font-black ${ecartDisplayColor} mt-0.5 font-mono truncate">${ecartDisplayVal}</span>
        </div>
      </div>

      <!-- Distances directes aux autres marcheurs (à vol d'oiseau) -->
      ${otherGroupMembers.length > 0 ? `
        <div class="p-2.5 rounded-2xl bg-slate-900/95 border border-slate-800 space-y-1.5 shadow-inner">
          <div class="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span class="text-blue-400">📏</span>
              <span>Distances aux autres marcheurs</span>
            </span>
            <span class="text-[9px] text-slate-400 font-semibold">(vol d'oiseau)</span>
          </div>
          <div class="space-y-1 max-h-[130px] overflow-y-auto pr-0.5 custom-scrollbar">
            ${otherGroupMembers.map(p => {
              const d = calculateDistance(user.lat, user.lon, p.lat, p.lon);
              const dStr = d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(2)} km`;
              const isPMe = (p.id === state.myUser.id);
              const pName = (isPMe && (!p.name || p.name.toLowerCase() === 'randonneur' || p.name.toLowerCase() === 'marcheur')) ? 'Moi' : (p.name || 'Marcheur');
              return `
                <div class="flex items-center justify-between py-1 px-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                  <div class="flex items-center gap-2 truncate max-w-[170px]">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: ${p.color || '#10b981'};"></span>
                    <span class="font-bold text-slate-200 truncate flex items-center gap-1"><span class="w-4 h-4 inline-flex items-center justify-center shrink-0 overflow-hidden">${formatAvatarHtml(p.icon || '🥾')}</span> <span>${pName}</span> ${isPMe ? '<span class="text-[10px] text-emerald-400 font-bold">(Moi)</span>' : ''}</span>
                  </div>
                  <span class="font-mono font-black text-blue-400 text-xs shrink-0">${dStr}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

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
        <span class="${isZoneBlanche ? 'text-amber-300 font-bold' : 'text-slate-200'}">${new Date(user.lastSeen || now).toLocaleTimeString()} ${isZoneBlanche ? `(il y a ${minSinceSeen} min)` : ''}</span>
      </div>

      ${(!isMe) ? `
        <div class="pt-2 border-t border-slate-700/80">
          <button onclick="deleteParticipant('${user.id}')" class="w-full py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 text-red-300 hover:text-white border border-red-500/50 hover:border-red-400 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md" title="Supprimer ce marcheur de la session">
            <i data-lucide="user-x" class="w-4 h-4 text-red-400"></i>
            <span>Supprimer ce marcheur</span>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function refreshActiveUserPopups() {
  state.userMarkers.forEach((marker, userId) => {
    if (marker && marker.isPopupOpen && marker.isPopupOpen()) {
      marker.setPopupContent(generateUserPopupHtml(userId));
      if (window.lucide && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  });
}

function createOrUpdateUserMarker(user) {
  if (!user || user.lat === null || user.lat === undefined || isNaN(user.lat) ||
      user.lon === null || user.lon === undefined || isNaN(user.lon)) {
    return;
  }
  if (!state.map) return;
  let marker = state.userMarkers.get(user.id);
  const isMe = user.id === state.myUser.id;
  const now = Date.now();
  const timeSinceSeenMs = now - (user.lastSeen || now);
  const isZoneBlanche = !isMe && timeSinceSeenMs > 2 * 60 * 1000;
  const minSinceSeen = Math.max(1, Math.round(timeSinceSeenMs / 60000));

  const sosClass = user.isSos ? 'is-sos' : '';
  const liveClass = (!user.isSos && !isZoneBlanche) ? 'is-live' : '';
  
  // Rôle spécifique uniquement si Guide / Serre-file / Secours (pas d'icône redondante pour les marcheurs standards)
  let roleBadge = '';
  if (user.role) {
    const r = user.role.toLowerCase();
    if (r.includes('guide')) roleBadge = '👑 ';
    else if (r.includes('serre-file')) roleBadge = '🛡️ ';
    else if (r.includes('secours') || r.includes('sécurité') || r.includes('pc')) roleBadge = '🚑 ';
  }

  // Nom affiché : pour "Moi", si le prénom n'a pas encore été personnalisé, afficher "Moi"
  let rawName = (user.name || '').trim();
  let displayName = rawName;
  if (isMe && (!rawName || rawName.toLowerCase() === 'randonneur' || rawName.toLowerCase() === 'marcheur')) {
    displayName = 'Moi';
  } else if (!rawName) {
    displayName = isMe ? 'Moi' : 'Randonneur';
  }

  const offset = getUserColocalizationOffset(user);
  const transformStyle = (offset.dx !== 0 || offset.dy !== 0) ? `transform: translate(${offset.dx}px, ${offset.dy}px);` : '';

  const html = `
    <div class="user-marker-pin" id="marker-${user.id}" style="${transformStyle}">
      <div class="user-avatar-bubble ${liveClass} ${sosClass}" style="background-color: ${user.color || '#059669'}; ${isZoneBlanche ? 'opacity: 0.85; filter: saturate(0.8);' : ''}">
        ${formatAvatarHtml(user.icon || '🥾')}
      </div>
      <div class="user-label-tag" style="${isZoneBlanche ? 'border-color: #f59e0b; background: rgba(15,23,42,0.95);' : ''}">
        ${roleBadge ? `<span>${roleBadge}</span>` : ''}
        <span>${displayName}</span>
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
    marker.bindPopup(() => generateUserPopupHtml(user.id));
  } else {
    marker.setLatLng([user.lat, user.lon]);
    marker.setIcon(customIcon);
    marker.bindPopup(() => generateUserPopupHtml(user.id));
    if (marker.isPopupOpen && marker.isPopupOpen()) {
      marker.setPopupContent(generateUserPopupHtml(user.id));
      if (window.lucide && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }

  // Actualiser instantanément la disposition des autres marcheurs colocalisés proches
  setTimeout(() => refreshColocalizedMarkers(user.lat, user.lon), 50);
}

function removeUserMarker(userId) {
  const marker = state.userMarkers.get(userId);
  if (marker) {
    state.map.removeLayer(marker);
    state.userMarkers.delete(userId);
  }
}

// ============================================================================
// DÉDUPLICATION AUTOMATIQUE INTELLIGENTE DES RANDONNEURS (ANTI-DOUBLONS GHOSTS & ACCENTS)
// ============================================================================
function normalizeHikerName(name) {
  if (!name) return '';
  return name
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function deduplicateUsersByName() {
  const genericNormalized = new Set(['randonneur', 'marcheur', 'participant', 'guide', 'guidedetete', 'animateur', '']);
  const byNormName = new Map();

  // Purger les marqueurs orphelins sur la carte Leaflet
  const activeIds = new Set([state.myUser.id, ...Array.from(state.otherUsers.keys())]);
  state.userMarkers.forEach((marker, markerId) => {
    if (!activeIds.has(markerId)) {
      if (state.map && state.map.hasLayer(marker)) {
        state.map.removeLayer(marker);
      }
      state.userMarkers.delete(markerId);
    }
  });

  state.otherUsers.forEach((user, id) => {
    // 0. Si mon propre ID s'est retrouvé dans otherUsers, le retirer
    if (id === state.myUser.id || user.id === state.myUser.id) {
      removeUserMarker(id);
      state.otherUsers.delete(id);
      return;
    }

    if (!user.name || !user.name.trim()) {
      user.name = 'Randonneur';
    }

    const uNorm = normalizeHikerName(user.name);

    // Si c'est un nom personnalisé (non-générique) et qu'il existe déjà un autre participant avec ce même nom exact,
    // fusionner pour garder la session la plus récente (gestion des reconnexions)
    if (uNorm && !genericNormalized.has(uNorm)) {
      if (byNormName.has(uNorm)) {
        const existing = byNormName.get(uNorm);
        const existingTime = existing.lastSeen || 0;
        const thisTime = user.lastSeen || 0;

        // Conserver la session la plus fraîche/active
        if (thisTime >= existingTime) {
          removeUserMarker(existing.id);
          state.otherUsers.delete(existing.id);
          byNormName.set(uNorm, user);
        } else {
          removeUserMarker(id);
          state.otherUsers.delete(id);
        }
      } else {
        byNormName.set(uNorm, user);
      }
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
    const hasMePos = typeof state.myUser.lat === 'number' && typeof state.myUser.lon === 'number' && !isNaN(state.myUser.lat) && !isNaN(state.myUser.lon);
    const hasUserPos = typeof u.lat === 'number' && typeof u.lon === 'number' && !isNaN(u.lat) && !isNaN(u.lon);
    const dist = (hasMePos && hasUserPos) ? calculateDistance(state.myUser.lat, state.myUser.lon, u.lat, u.lon) : null;
    const distStr = dist === null ? '--' : (dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`);
    const timeSinceMs = now - (u.lastSeen || now);
    const isZoneBlanche = timeSinceMs > 2 * 60 * 1000;
    const minAgo = Math.max(1, Math.round(timeSinceMs / 60000));
    const progress = computeTrackProgress(u);

    return `
      <div class="p-4 rounded-3xl bg-slate-800/95 border-2 ${u.isSos ? 'border-red-500 bg-red-950/40 shadow-red-500/20' : isZoneBlanche ? 'border-amber-500/50 bg-slate-850' : 'border-slate-700'} hover:border-slate-500 transition flex flex-col gap-3 cursor-pointer active:scale-98 shadow-xl" onclick="centerOnUser('${u.id}')">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0 flex-1">
            <div class="w-14 h-14 rounded-full flex items-center justify-center text-3xl font-black text-white shrink-0 shadow-lg relative border-2 border-white/90 overflow-hidden" style="background-color: ${u.color || '#3b82f6'}; ${isZoneBlanche ? 'opacity: 0.85;' : ''}">
              ${formatAvatarHtml(u.icon || '🥾')}
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

  if (user.lat === null || user.lat === undefined || isNaN(user.lat) ||
      user.lon === null || user.lon === undefined || isNaN(user.lon)) {
    showToast(`Position de ${user.name || 'ce marcheur'} en attente du GPS...`, 'info');
    return;
  }

  if (state.map) {
    state.map.setView([user.lat, user.lon], 16, { animate: true });
  }
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

    let justResumed = false;
    if (dtSec > 0 && dtSec < 180) {
      const dtMs = dtSec * 1000;
      const wasPaused = state.myUser.isAutoPaused;
      if (isMoving) {
        state.myUser.isAutoPaused = false;
        state.myUser.movingTimeMs = (state.myUser.movingTimeMs || 0) + dtMs;
        state.myUser.movingDistance = (state.myUser.movingDistance || 0) + stepDist;
        if (wasPaused) {
          justResumed = true;
        }
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

    broadcastMyPosition(justResumed);

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

  // 1. Activer le battement de cœur d'arrière-plan Web Worker & Forçage matériel 3.5s
  startGpsWorkerHeartbeat(onPositionSuccess);

  // 2. Activer le maintien d'activité média système (pour écran éteint dans la poche)
  startBackgroundKeepAlive();

  // 3. Activer le maintien d'écran allumé (pour téléphone dans la poche écran allumé)
  requestWakeLock();
}

// ============================================================================
// GARDIEN DE VEILLE ÉCRAN & GESTION WAKELOCK (POCHE ÉCRAN ALLUMÉ)
// ============================================================================
let screenWakeLock = null;
let isWakeLockRequested = false;

async function requestWakeLock() {
  isWakeLockRequested = true;
  if ('wakeLock' in navigator) {
    try {
      if (screenWakeLock && !screenWakeLock.released) return;
      screenWakeLock = await navigator.wakeLock.request('screen');
      screenWakeLock.addEventListener('release', () => {
        screenWakeLock = null;
        // Si le GPS tourne toujours et que l'écran/onglet est visible, ré-enclencher immédiatement
        if (isWakeLockRequested && state.isTrackingGps && document.visibilityState === 'visible') {
          setTimeout(requestWakeLock, 500);
        }
      });
      console.log('[WakeLock] Maintien écran actif et sécurisé');
    } catch (err) {
      console.warn('[WakeLock] Non activé:', err);
    }
  }
}

function releaseWakeLock() {
  isWakeLockRequested = false;
  if (screenWakeLock) {
    try {
      screenWakeLock.release();
    } catch (e) {}
    screenWakeLock = null;
  }
}

// ============================================================================
// MAINTIEN D'ARRIÈRE-PLAN AUDIO & MEDIASESSION (POCHE ÉCRAN ÉTEINT / DOZE MODE)
// ============================================================================
let silentAudioKeeper = null;
let silentAudioBlobUrl = null;
let audioContextKeeper = null;
let audioOscillator = null;
let isAudioUnlocked = false;

function createSilentAudioBlobUrl() {
  if (silentAudioBlobUrl) return silentAudioBlobUrl;
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * 2; // 2 secondes de silence PCM
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM Format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true); // 8-bit
    writeString(36, 'data');
    view.setUint32(40, numSamples, true);
    for (let i = 0; i < numSamples; i++) {
      view.setUint8(44 + i, 128); // 128 = valeur neutre silence en 8-bit
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    silentAudioBlobUrl = URL.createObjectURL(blob);
    return silentAudioBlobUrl;
  } catch (e) {
    return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  }
}

function unlockAndStartKeepAlive() {
  if (isAudioUnlocked) {
    if (audioContextKeeper && audioContextKeeper.state === 'suspended') {
      audioContextKeeper.resume().catch(() => {});
    }
    if (silentAudioKeeper && silentAudioKeeper.paused) {
      silentAudioKeeper.play().catch(() => {});
    }
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!audioContextKeeper) {
        audioContextKeeper = new AudioCtx();
      }
      if (audioContextKeeper.state === 'suspended') {
        audioContextKeeper.resume().catch(() => {});
      }
      if (!audioOscillator) {
        try {
          audioOscillator = audioContextKeeper.createOscillator();
          const gainNode = audioContextKeeper.createGain();
          gainNode.gain.value = 0.00001; // Ultra-faible inaudible mais actif pour garder le sous-système audio Android éveillé
          audioOscillator.connect(gainNode);
          gainNode.connect(audioContextKeeper.destination);
          audioOscillator.start();
        } catch (e) {}
      }
    }

    if (!silentAudioKeeper) {
      const audioUrl = createSilentAudioBlobUrl();
      silentAudioKeeper = new Audio(audioUrl);
      silentAudioKeeper.loop = true;
      silentAudioKeeper.volume = 0.001; // Inaudible mais actif pour le système
    }
    const playPromise = silentAudioKeeper.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[KeepAlive] Lecture audio différée:', err);
      });
    }

    isAudioUnlocked = true;
    console.log('[KeepAlive] Moteur audio et maintien d\'arrière-plan déverrouillé avec succès');

    // Enregistrement MediaSession Système pour empêcher Android d'endormir le JS
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'RandoTracker • Suivi GPS en direct',
          artist: `Groupe : ${state.roomCode} (${state.myUser.name})`,
          album: 'Position partagée en direct dans la poche',
          artwork: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
          if (silentAudioKeeper) silentAudioKeeper.play().catch(() => {});
          if (audioContextKeeper && audioContextKeeper.state === 'suspended') audioContextKeeper.resume().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (silentAudioKeeper) silentAudioKeeper.play().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
        });
      } catch (e) {
        console.warn('[MediaSession] Non disponible:', e);
      }
    }
  } catch (e) {
    console.warn('[KeepAlive] Erreur initialisation audio:', e);
  }
}

// Auto-déverrouillage instantané sur le moindre toucher ou interaction utilisateur
['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach(evt => {
  window.addEventListener(evt, unlockAndStartKeepAlive, { passive: true });
});

function startBackgroundKeepAlive() {
  // Dans l'application native Android, le service d'arrière-plan natif (Foreground Service)
  // possède son propre WakeLock système et gère l'activité sans nécessiter de maintien audio.
  if (window.IS_NATIVE_ANDROID_APP) {
    return;
  }
  unlockAndStartKeepAlive();
}

function stopBackgroundKeepAlive() {
  if (silentAudioKeeper) {
    try {
      silentAudioKeeper.pause();
    } catch (e) {}
  }
  if (audioContextKeeper && audioContextKeeper.state === 'running') {
    try {
      audioContextKeeper.suspend().catch(() => {});
    } catch (e) {}
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}

// ============================================================================
// CHRONOMÈTRE D'ARRIÈRE-PLAN WEB WORKER & DUAL-ENGINE GPS WATCHDOG (CADENCE OPTIMISÉE)
// ============================================================================
let gpsHeartbeatWorker = null;
let gpsForcedInterval = null;

function startGpsWorkerHeartbeat(onSuccessCallback) {
  stopGpsWorkerHeartbeat();

  // Dans l'application native Android, le service natif Foreground Service se charge
  // du polling matériel et du broadcast MQTT. Pas de boucle redondante en JS.
  if (window.IS_NATIVE_ANDROID_APP) {
    return;
  }

  try {
    const workerScript = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, 7000);
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    gpsHeartbeatWorker = new Worker(workerUrl);
    gpsHeartbeatWorker.onmessage = function(e) {
      if (e.data === 'tick' && state.isTrackingGps) {
        const now = Date.now();
        const lastTime = state.lastGpsTimestamp || 0;

        // 1. Interrogation matérielle GPS si aucun point récent (< 7s)
        if (now - lastTime >= 7000 && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            onSuccessCallback,
            (err) => { console.warn('[GPS Worker Heartbeat] Refresh matériel passif:', err.code); },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }

        // 2. Reconnexion automatique MQTT si déconnecté en arrière-plan
        if (!mqttClient || !mqttClient.connected) {
          console.log('[GPS Worker Heartbeat] MQTT déconnecté, reconnexion immédiate...');
          initMqttSync();
        } else if (state.lastGpsPos) {
          // 3. Maintien d'émission réseau MQTT en arrière-plan vers les autres marcheurs
          broadcastMyPosition(false);
        }

        // 4. Maintien Audio
        if (audioContextKeeper && audioContextKeeper.state === 'suspended') {
          audioContextKeeper.resume().catch(() => {});
        }
        if (silentAudioKeeper && silentAudioKeeper.paused) {
          silentAudioKeeper.play().catch(() => {});
        }

        // 5. Gardien WakeLock si l'écran est resté allumé
        if (document.visibilityState === 'visible' && !screenWakeLock) {
          requestWakeLock();
        }
      }
    };
    gpsHeartbeatWorker.postMessage('start');
  } catch (e) {
    console.warn('[GPS Worker] Fallback standard timer:', e);
  }

  // Fallback thread principal à 7000ms au cas où Web Worker est désactivé
  startGpsForcedWatchdog(onSuccessCallback);
}

function stopGpsWorkerHeartbeat() {
  if (gpsHeartbeatWorker) {
    try {
      gpsHeartbeatWorker.postMessage('stop');
      gpsHeartbeatWorker.terminate();
    } catch (e) {}
    gpsHeartbeatWorker = null;
  }
  stopGpsForcedWatchdog();
}

function startGpsForcedWatchdog(onSuccessCallback) {
  if (gpsForcedInterval) clearInterval(gpsForcedInterval);
  if (window.IS_NATIVE_ANDROID_APP) return;

  gpsForcedInterval = setInterval(() => {
    if (state.isTrackingGps && navigator.geolocation) {
      const now = Date.now();
      const lastTime = state.lastGpsTimestamp || 0;
      if (now - lastTime >= 7000) {
        navigator.geolocation.getCurrentPosition(
          onSuccessCallback,
          (e) => { console.warn('[GPS Watchdog] Polling passif:', e.code); },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }, 7000);
}

function stopGpsForcedWatchdog() {
  if (gpsForcedInterval) {
    clearInterval(gpsForcedInterval);
    gpsForcedInterval = null;
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

  stopGpsWorkerHeartbeat();
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
// MODE POCHE ÉCO-ÉNERGIE & ANTI-VEILLE TACTILE (POUR NAVIGATEURS MOBILES)
// ============================================================================
let pocketModeInterval = null;

function enterPocketMode() {
  const overlay = document.getElementById('pocket-mode-overlay');
  if (!overlay) return;

  // 1. S'assurer que le suivi GPS est bien démarré
  if (!state.isTrackingGps) {
    state.gpsStartTime = Date.now();
    startGpsWatch(true);
  }

  // 2. Maintien forcé de l'écran éveillé et du flux GPS via WakeLock
  requestWakeLock();
  startBackgroundKeepAlive();

  // 3. Afficher l'écran noir ultra-économe
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  pushModalState('pocket-mode-overlay');

  // 4. Mettre à jour l'horloge et la télémétrie en direct
  updatePocketModeTelemetry();
  if (pocketModeInterval) clearInterval(pocketModeInterval);
  pocketModeInterval = setInterval(updatePocketModeTelemetry, 1000);

  showToast('🔒 Mode Poche activé : Écran noir économe & touches sécurisées', 'success');
}

let pocketHoldTimer = null;
let pocketHoldStartTime = 0;
const POCKET_HOLD_DURATION_MS = 1800; // 1.8 secondes pour déverrouiller

function startPocketHoldUnlock(e) {
  if (e && e.cancelable) {
    e.preventDefault();
  }
  if (pocketHoldTimer) return;

  pocketHoldStartTime = Date.now();
  const progressBar = document.getElementById('pocket-unlock-progress');
  const unlockText = document.getElementById('pocket-unlock-text');
  const unlockIcon = document.getElementById('pocket-unlock-icon');

  if (unlockText) unlockText.textContent = 'Maintenir appuyé...';
  if (unlockIcon) unlockIcon.classList.add('animate-pulse');

  // Retour haptique immédiat à l'appui
  if (window.AndroidBridge && typeof window.AndroidBridge.vibratePhone === 'function') {
    window.AndroidBridge.vibratePhone(35);
  } else if (navigator.vibrate) {
    try { navigator.vibrate(35); } catch (err) {}
  }

  pocketHoldTimer = setInterval(() => {
    const elapsed = Date.now() - pocketHoldStartTime;
    const pct = Math.min(100, Math.round((elapsed / POCKET_HOLD_DURATION_MS) * 100));

    if (progressBar) progressBar.style.width = `${pct}%`;

    if (elapsed >= POCKET_HOLD_DURATION_MS) {
      // Déverrouillage complété avec succès
      clearInterval(pocketHoldTimer);
      pocketHoldTimer = null;
      if (progressBar) progressBar.style.width = '100%';

      if (window.AndroidBridge && typeof window.AndroidBridge.vibratePhone === 'function') {
        window.AndroidBridge.vibratePhone(80);
      } else if (navigator.vibrate) {
        try { navigator.vibrate([50, 40, 70]); } catch (err) {}
      }

      exitPocketMode();
    }
  }, 25);
}

function cancelPocketHoldUnlock(e) {
  if (pocketHoldTimer) {
    clearInterval(pocketHoldTimer);
    pocketHoldTimer = null;
  }
  const progressBar = document.getElementById('pocket-unlock-progress');
  const unlockText = document.getElementById('pocket-unlock-text');
  const unlockIcon = document.getElementById('pocket-unlock-icon');

  if (progressBar) progressBar.style.width = '0%';
  if (unlockText) unlockText.textContent = 'Maintenir 2s pour déverrouiller';
  if (unlockIcon) unlockIcon.classList.remove('animate-pulse');
}

function exitPocketMode() {
  cancelPocketHoldUnlock();
  const overlay = document.getElementById('pocket-mode-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
  if (pocketModeInterval) {
    clearInterval(pocketModeInterval);
    pocketModeInterval = null;
  }
  showToast('🔓 Écran déverrouillé', 'info');
  ensureBarsVisible();
}

function updatePocketModeTelemetry() {
  const overlay = document.getElementById('pocket-mode-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const clockEl = document.getElementById('pocket-clock');
  if (clockEl) clockEl.textContent = `${hours}:${minutes}`;

  const dateEl = document.getElementById('pocket-date');
  if (dateEl) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    dateEl.textContent = now.toLocaleDateString('fr-FR', options);
  }

  const speedEl = document.getElementById('pocket-speed');
  const distEl = document.getElementById('pocket-dist');
  const eleEl = document.getElementById('pocket-ele');
  const batteryEl = document.getElementById('pocket-battery');
  const roomEl = document.getElementById('pocket-room');
  const gpsStatusEl = document.getElementById('pocket-gps-status');

  const speedVal = (state.myUser.movingAvgSpeed && state.myUser.movingAvgSpeed > 0)
    ? state.myUser.movingAvgSpeed.toFixed(1)
    : (state.myUser.speed || 0).toFixed(1);
  if (speedEl) speedEl.textContent = `${speedVal} km/h`;

  const distVal = state.myUser.movingDistance || 0;
  if (distEl) distEl.textContent = `${distVal.toFixed(1)} km`;

  if (eleEl) eleEl.textContent = `${Math.round(state.myUser.ele || 0)} m`;
  if (batteryEl) batteryEl.textContent = `🔋 ${state.myUser.battery || 90}%`;
  if (roomEl) roomEl.textContent = `👥 ${state.roomCode}`;

  if (gpsStatusEl) {
    const acc = state.myUser.accuracy ? ` (±${Math.round(state.myUser.accuracy)}m)` : '';
    gpsStatusEl.textContent = `GPS Actif${acc} • Suivi en Poche`;
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
// SCANNER QR CODE INTÉGRÉ (CAMÉRA) & REJOINDRE SALON & SAISIE PRÉNOM
// ============================================================================
let html5QrCodeScanner = null;
let selectedPromptIcon = '🐺';
let selectedPromptColor = '#9333ea';

function openQrScanner() {
  const modal = document.getElementById('qr-scan-modal');
  if (modal) {
    modal.classList.remove('hidden');
    pushModalState('qr-scan-modal');
  }

  const inviteModal = document.getElementById('invite-modal');
  if (inviteModal) inviteModal.classList.add('hidden');
  const roomModal = document.getElementById('room-modal');
  if (roomModal) roomModal.classList.add('hidden');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('Chargement du module caméra...', 'info');
    setTimeout(startCameraScanner, 800);
    return;
  }
  startCameraScanner();
}

function startCameraScanner() {
  const qrReaderEl = document.getElementById('qr-reader-view');
  if (!qrReaderEl || typeof Html5Qrcode === 'undefined') return;

  if (html5QrCodeScanner) {
    try {
      html5QrCodeScanner.stop().then(() => {
        html5QrCodeScanner.clear();
        html5QrCodeScanner = null;
        launchCamera();
      }).catch(() => {
        html5QrCodeScanner = null;
        launchCamera();
      });
      return;
    } catch (e) {
      html5QrCodeScanner = null;
    }
  }
  launchCamera();
}

function launchCamera() {
  try {
    html5QrCodeScanner = new Html5Qrcode("qr-reader-view");
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    html5QrCodeScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        console.log('[QR Scanner] QR Code détecté:', decodedText);
        onQrCodeScanned(decodedText);
      },
      (errorMessage) => {
        // Balayage en cours
      }
    ).catch(err => {
      console.warn('[QR Scanner] Caméra arrière indisponible, essai caméra par défaut:', err);
      html5QrCodeScanner.start(
        { facingMode: "user" },
        config,
        (decodedText) => {
          onQrCodeScanned(decodedText);
        },
        () => {}
      ).catch(e => {
        console.error('[QR Scanner] Échec total accès caméra:', e);
        showToast('Impossible d\'accéder à la caméra. Autorisez l\'accès ou saisissez le code.', 'error');
      });
    });
  } catch (err) {
    console.error('[QR Scanner] Erreur start camera:', err);
  }
}

function closeQrScanner() {
  const modal = document.getElementById('qr-scan-modal');
  if (modal) modal.classList.add('hidden');

  if (html5QrCodeScanner) {
    try {
      html5QrCodeScanner.stop().then(() => {
        html5QrCodeScanner.clear();
        html5QrCodeScanner = null;
      }).catch(() => {
        html5QrCodeScanner = null;
      });
    } catch (e) {
      html5QrCodeScanner = null;
    }
  }
}

function onQrCodeScanned(decodedText) {
  if (!decodedText) return;
  closeQrScanner();

  let roomCode = null;
  try {
    if (decodedText.includes('room=')) {
      const url = new URL(decodedText, window.location.origin);
      roomCode = url.searchParams.get('room');
      if (!roomCode && url.hash && url.hash.includes('room=')) {
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        roomCode = hashParams.get('room');
      }
    } else if (decodedText.includes('#room=')) {
      roomCode = decodedText.split('#room=')[1].split('&')[0];
    } else if (/^[A-Za-z0-9_-]{3,24}$/.test(decodedText.trim())) {
      roomCode = decodedText.trim();
    }
  } catch (e) {
    const match = decodedText.match(/[?&#]room=([A-Za-z0-9_-]+)/i);
    if (match) roomCode = match[1];
  }

  if (roomCode) {
    showToast(`📸 QR Code lu : Salon ${roomCode}`, 'success');
    joinRoomDirectly(roomCode);
  } else {
    showToast(`QR Code détecté : ${decodedText.substring(0, 30)}...`, 'info');
  }
}

function joinRoomDirectly(newRoomCode) {
  if (!newRoomCode) return;
  const sanitized = newRoomCode.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '_');
  if (!sanitized) return;

  console.log('[Room] Rejoint le salon:', sanitized);

  // Nettoyer les anciens participants de l'ancien salon
  state.otherUsers.forEach((u, id) => removeUserMarker(id));
  state.otherUsers.clear();
  localStorage.removeItem(`rando_users_${state.roomCode}`);

  state.roomCode = sanitized;
  updateRoomDisplay();
  loadSavedOtherUsersFromStorage();

  // Fermer les modales ouvertes
  const modalsToClose = ['room-modal', 'invite-modal', 'qr-scan-modal'];
  modalsToClose.forEach(mId => {
    const el = document.getElementById(mId);
    if (el) el.classList.add('hidden');
  });

  // Réinitialiser le BroadcastChannel local
  if (state.broadcastChannel) {
    try { state.broadcastChannel.close(); } catch (e) {}
  }
  try {
    state.broadcastChannel = new BroadcastChannel(`rando_${state.roomCode}`);
    state.broadcastChannel.onmessage = (event) => handleIncomingMessage(event.data);
  } catch (e) {}

  // Relancer la synchronisation MQTT
  if (mqttClient) {
    try { mqttClient.end(true); } catch(e) {}
    mqttClient = null;
  }
  initMqttSync();
  syncNativeAndroidSession();
  saveHikeSessionToStorage();

  // Vérifier et demander le prénom si générique
  checkAndPromptUserName();

  showToast(`✅ Connecté au salon : ${state.roomCode}`, 'success');
}

function checkAndPromptUserName() {
  // Mode non-bloquant : Ne jamais ouvrir automatiquement de modale bloquante au démarrage
}

function openNamePromptModal() {
  const modal = document.getElementById('name-prompt-modal');
  const input = document.getElementById('input-prompt-user-name');
  if (input) {
    const current = (state.myUser.name || '').trim();
    input.value = (!['animateur', 'randonneur', 'participant', 'marcheur', 'guide', 'guide de tête', 'guide de tete'].includes(current.toLowerCase())) ? current : '';
    setTimeout(() => input.focus(), 300);
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    pushModalState('name-prompt-modal');
  }
}

function closeNamePromptModal() {
  const modal = document.getElementById('name-prompt-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function savePromptUserName() {
  const input = document.getElementById('input-prompt-user-name');
  const enteredName = input ? input.value.trim() : '';
  if (enteredName) {
    state.myUser.name = enteredName;
  } else {
    state.myUser.name = 'Randonneur';
  }
  state.myUser.icon = selectedPromptIcon || '🥾';
  state.myUser.color = selectedPromptColor || '#10b981';
  state.myUser.role = 'Randonneur';

  localStorage.setItem('rando_user_name', state.myUser.name);
  localStorage.setItem('rando_user_icon', state.myUser.icon);
  localStorage.setItem('rando_user_color', state.myUser.color);
  localStorage.setItem('rando_user_role', state.myUser.role);

  updateProfileUI();
  syncNativeAndroidSession();
  createOrUpdateUserMarker(state.myUser);
  deduplicateUsersByName();
  renderUsersList();
  broadcastMyPosition();
  publishMessage({
    type: 'user_updated',
    user: state.myUser
  });
  closeNamePromptModal();
  showToast(`Bienvenue ${state.myUser.name} ! Profil mis à jour.`, 'success');
}

// ============================================================================
// ============================================================================
// SYNCHRONISATION EN TEMPS RÉEL (MQTT 4G/5G/Wi-Fi & BroadcastChannel)
// ============================================================================
let mqttClient = null;
const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];
let currentBrokerIndex = 0;
let mqttErrorCount = 0;

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

  if (mqttClient && mqttClient.connected) {
    return;
  }

  if (mqttClient) {
    try { mqttClient.end(true); } catch (e) {}
    mqttClient = null;
  }

  const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const topic = `randotracker/v1/rooms/${sanitizedRoom}/events`;
  const clientId = `rando_${state.myUser.id}_${Math.random().toString(36).substr(2, 6)}`;

  const brokerUrl = MQTT_BROKERS[currentBrokerIndex];
  console.log(`[MQTT] Connexion au broker (${brokerUrl}) [Salon: ${state.roomCode}]...`);

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 2000,
      keepalive: 15
    });

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connecté avec succès au salon:', state.roomCode, 'sur', brokerUrl);
      mqttErrorCount = 0;
      updateConnectionStatus(true);
      mqttClient.subscribe([topic], { qos: 1 }, (err) => {
        if (!err) {
          console.log(`[MQTT] Abonné au topic : ${topic}`);

          // Nettoyer tout ancien message retained résiduel
          const announceTopic = `randotracker/v1/rooms/${sanitizedRoom}/announcement`;
          try { mqttClient.publish(announceTopic, '', { retain: true, qos: 0 }); } catch (e) {}
          
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
      console.warn('[MQTT] Erreur:', brokerUrl, err);
      mqttErrorCount++;
      if (mqttErrorCount >= 2) {
        currentBrokerIndex = (currentBrokerIndex + 1) % MQTT_BROKERS.length;
        console.log('[MQTT] Basculement vers broker alternatif:', MQTT_BROKERS[currentBrokerIndex]);
        mqttErrorCount = 0;
        setTimeout(initMqttSync, 1000);
      }
      updateConnectionStatus(false);
    });

    mqttClient.on('offline', () => {
      console.log('[MQTT] Hors-ligne');
      updateConnectionStatus(false);
    });

    mqttClient.on('reconnect', () => {
      console.log('[MQTT] Reconnexion...');
    });
  } catch (e) {
    console.warn('[MQTT] Erreur initialisation:', e);
    updateConnectionStatus(false);
  }
}

function publishMessage(payload) {
  try {
    payload.senderId = state.myUser.id;
    payload.room = state.roomCode;
    payload.timestamp = payload.timestamp || Date.now();

    const msgStr = JSON.stringify(payload);

    if (mqttClient && mqttClient.connected) {
      const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
      const topic = `randotracker/v1/rooms/${sanitizedRoom}/events`;
      const qos = (payload.type === 'broadcast_announcement' || payload.type === 'group_sos_alert' || payload.type === 'sync_tracks') ? 1 : 0;
      mqttClient.publish(topic, msgStr, { qos: qos });
    }

    if (state.broadcastChannel) {
      try { state.broadcastChannel.postMessage(payload); } catch (e) {}
    }
  } catch (e) {
    console.warn('[PublishMessage] Erreur:', e);
  }
}

let lastMqttBroadcastTime = 0;
let pendingBroadcastTimeout = null;

function broadcastMyPosition(forceNow = false) {
  try {
    const now = Date.now();
    state.myUser.lastSeen = now;
    createOrUpdateUserMarker(state.myUser);
    renderUsersList();
    refreshActiveUserPopups();

    // Si on tourne dans l'application native Android avec le Foreground Service actif,
    // le service natif gère lui-même l'acquisition matérielle GPS et la publication MQTT.
    if (window.IS_NATIVE_ANDROID_APP && !forceNow) {
      return;
    }

    // Calcul de la cadence adaptative :
    // 1. Haute urgence / Alerte (SOS ou >50m sortie de trace) : 2.5 secondes
    // 2. Pause / Stationnaire (< 0.8 km/h ou auto-pause) : 45 secondes (Eco-Pause)
    // 3. Déplacement normal à pied : 7.0 secondes (Cadence optimale marcheur ~1.1 m/s)
    let minCadenceMs = 7000;
    const isStationary = state.myUser.isAutoPaused || (typeof state.myUser.speed === 'number' && state.myUser.speed < 0.8 && (!state.lastGpsPos || state.myUser.speed <= 0.2));
    const isUrgent = state.myUser.isSos || state.wasOffTrackAlerted || (state.offTrackCounter && state.offTrackCounter >= 2);

    if (isUrgent) {
      minCadenceMs = 2500;
    } else if (isStationary) {
      minCadenceMs = 45000;
    } else {
      minCadenceMs = 7000;
    }

    const elapsed = now - lastMqttBroadcastTime;
    if (!forceNow && elapsed < minCadenceMs) {
      if (!pendingBroadcastTimeout) {
        pendingBroadcastTimeout = setTimeout(() => {
          pendingBroadcastTimeout = null;
          broadcastMyPosition(false);
        }, minCadenceMs - elapsed);
      }
      return;
    }

    if (pendingBroadcastTimeout) {
      clearTimeout(pendingBroadcastTimeout);
      pendingBroadcastTimeout = null;
    }

    lastMqttBroadcastTime = now;

    publishMessage({
      type: 'update_position',
      user: state.myUser
    });
  } catch (e) {
    console.warn('[BroadcastMyPosition] Erreur:', e);
  }
}

function handleIncomingMessage(data) {
  try {
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
        if (!user.lastSeen) user.lastSeen = Date.now();
        state.otherUsers.set(user.id, user);
        deduplicateUsersByName();
        createOrUpdateUserMarker(user);
        saveOtherUsersToStorage();
        renderUsersList();
        refreshActiveUserPopups();
        showToast(`👋 ${user.name || 'Un marcheur'} a rejoint la rando !`, 'info');

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
          if (!user.lastSeen) user.lastSeen = Date.now();
          state.otherUsers.set(user.id, user);
          deduplicateUsersByName();
          createOrUpdateUserMarker(user);
          saveOtherUsersToStorage();
          renderUsersList();
          refreshActiveUserPopups();
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
      const msgKey = `${data.senderId || data.author || 'anon'}_${data.timestamp || 0}_${(data.text || '').substring(0, 30)}`;
      if (isAnnouncementAlreadySeen(msgKey)) return;
      markAnnouncementSeen(msgKey);

      handleReceivedAnnouncement(data);
    } else if (data.type === 'user_left') {
      state.otherUsers.delete(data.userId);
      removeUserMarker(data.userId);
      saveOtherUsersToStorage();
      renderUsersList();
    }
  } catch (err) {
    console.warn('[HandleIncomingMessage] Erreur isolée:', err);
  }
}

function isAnnouncementAlreadySeen(msgKey) {
  try {
    const seen = JSON.parse(sessionStorage.getItem('rando_seen_announcements') || '[]');
    return seen.includes(msgKey);
  } catch (e) {
    return false;
  }
}

function markAnnouncementSeen(msgKey) {
  try {
    let seen = JSON.parse(sessionStorage.getItem('rando_seen_announcements') || '[]');
    if (!seen.includes(msgKey)) {
      seen.push(msgKey);
      if (seen.length > 50) seen = seen.slice(-50);
      sessionStorage.setItem('rando_seen_announcements', JSON.stringify(seen));
    }
  } catch (e) {}
}

// ============================================================================
// DIFFUSION DE MESSAGES EN DIRECT POUR TOUT LE GROUPE (TOUS LES MARCHEURS)
// ============================================================================
function getMyGpsString() {
  if (state.myUser.lat === null || state.myUser.lat === undefined || isNaN(state.myUser.lat) ||
      state.myUser.lon === null || state.myUser.lon === undefined || isNaN(state.myUser.lon)) {
    return '';
  }
  const lat = state.myUser.lat;
  const lon = state.myUser.lon;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  const altStr = (state.myUser.ele !== undefined && state.myUser.ele !== null && !isNaN(state.myUser.ele)) ? ` (Alt: ${Math.round(state.myUser.ele)}m)` : '';
  return `📍 GPS: ${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}${altStr} - `;
}

function insertGpsInCustomAnnouncement() {
  const customInput = document.getElementById('announcement-custom-input');
  if (customInput) {
    const gpsStr = getMyGpsString();
    if (!gpsStr) {
      showToast('📡 Acquisition du signal GPS en cours...', 'info');
      return;
    }
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
    // Préremplissage automatique uniquement si les coordonnées GPS réelles sont disponibles
    const gpsStr = getMyGpsString();
    customInput.value = gpsStr || '';
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

  const hasRealGps = state.myUser.lat !== null && state.myUser.lat !== undefined && !isNaN(state.myUser.lat) &&
                     state.myUser.lon !== null && state.myUser.lon !== undefined && !isNaN(state.myUser.lon);
  const lat = hasRealGps ? state.myUser.lat : null;
  const lon = hasRealGps ? state.myUser.lon : null;
  const ele = hasRealGps ? state.myUser.ele : null;

  // Enrichir systématiquement avec la position GPS exacte UNIQUEMENT si le GPS réel est acquis
  if (hasRealGps && !msgText.includes('📍 GPS:')) {
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
    lat: lat,
    lon: lon,
    ele: ele,
    timestamp: Date.now()
  };

  if (lat !== null && lon !== null) {
    state.lastAnnouncementCoords = { lat, lon, author: payload.author };
  } else {
    state.lastAnnouncementCoords = null;
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
  try {
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch (e) {}
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

  // 2. Sauvegarde persistante pour réouverture immédiate en cas de clic sur notification
  try {
    localStorage.setItem('rando_last_announcement', JSON.stringify({
      ...data,
      author,
      icon,
      role,
      text,
      lat: annLat,
      lon: annLon,
      ele: data.ele,
      timestamp: data.timestamp || Date.now()
    }));
  } catch (e) {}

  // 3. Notification système Android & Montres connectées (Garmin / Suunto) avec transmission des données complètes
  sendGpsNotification(`📢 Message de ${author} (${role})`, text, {
    ...data,
    author,
    icon,
    role,
    text,
    lat: annLat,
    lon: annLon,
    ele: data.ele,
    timestamp: data.timestamp || Date.now()
  });

  // 4. Afficher la popup modale de réception
  const rxModal = document.getElementById('received-announcement-modal');
  const rxSender = document.getElementById('rx-announcement-sender');
  const rxTime = document.getElementById('rx-announcement-time');
  const rxText = document.getElementById('rx-announcement-text');
  const rxBubble = document.getElementById('rx-announcement-icon-bubble');

  if (rxSender) rxSender.textContent = `Message de ${author} (${role})`;
  if (rxTime) rxTime.textContent = `Reçu à ${timeStr}`;
  if (rxText) rxText.textContent = text;
  if (rxBubble) {
    rxBubble.innerHTML = formatAvatarHtml(icon);
    if (data.color) rxBubble.style.borderColor = data.color;
  }

  if (rxModal) rxModal.classList.remove('hidden');

  // 5. Afficher le bandeau persistant en haut de la carte
  displayAnnouncementBanner(author, icon, role, text, data.timestamp);
}

function closeReceivedAnnouncementModal() {
  const rxModal = document.getElementById('received-announcement-modal');
  if (rxModal) rxModal.classList.add('hidden');
}

function locateAnnouncementSender() {
  let targetLat = null;
  let targetLon = null;
  let targetAuthor = 'le marcheur';

  if (state.lastAnnouncementCoords &&
      typeof state.lastAnnouncementCoords.lat === 'number' && !isNaN(state.lastAnnouncementCoords.lat) &&
      typeof state.lastAnnouncementCoords.lon === 'number' && !isNaN(state.lastAnnouncementCoords.lon)) {
    targetLat = state.lastAnnouncementCoords.lat;
    targetLon = state.lastAnnouncementCoords.lon;
    targetAuthor = state.lastAnnouncementCoords.author || 'le marcheur';
  } else if (state.lastAnnouncementCoords && state.lastAnnouncementCoords.author) {
    // Si l'annonce n'avait pas encore le GPS au moment de l'envoi, chercher sa position live reçue depuis
    const authorName = (state.lastAnnouncementCoords.author || '').trim().toLowerCase();
    const user = Array.from(state.otherUsers.values()).find(u => (u.name || '').trim().toLowerCase() === authorName);
    if (user && typeof user.lat === 'number' && !isNaN(user.lat) && typeof user.lon === 'number' && !isNaN(user.lon)) {
      targetLat = user.lat;
      targetLon = user.lon;
      targetAuthor = user.name;
    }
  }

  if (targetLat !== null && targetLon !== null && state.map) {
    state.map.setView([targetLat, targetLon], 16, { animate: true });
    closeReceivedAnnouncementModal();
    showToast(`📍 Carte centrée sur ${targetAuthor}`, 'info');
  } else {
    showToast('Position GPS non disponible pour ce marcheur pour l\'instant', 'warning');
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

  const hasGps = state.myUser.lat !== null && state.myUser.lat !== undefined && !isNaN(state.myUser.lat) &&
                 state.myUser.lon !== null && state.myUser.lon !== undefined && !isNaN(state.myUser.lon);
  const lat = hasGps ? state.myUser.lat : null;
  const lon = hasGps ? state.myUser.lon : null;
  const ele = hasGps ? state.myUser.ele : 0;
  const acc = hasGps ? (state.myUser.accuracy || 10) : null;
  const autoCountry = hasGps ? detectCountry(lat, lon) : 'FR';
  const country = state.selectedEmergencyCountry || autoCountry;

  // 1. Affichage Degrés Décimaux (DD)
  let ddStr = 'Recherche du signal GPS...';
  const decimalEl = document.getElementById('emergency-gps-decimal');
  if (hasGps) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'O';
    ddStr = `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
    if (decimalEl) decimalEl.textContent = ddStr;
  } else {
    if (decimalEl) decimalEl.textContent = `📡 Recherche du signal GPS...`;
  }

  // 2. Affichage Degrés Minutes Secondes (DMS)
  const dmsEl = document.getElementById('emergency-gps-dms');
  if (dmsEl) {
    if (hasGps) {
      dmsEl.textContent = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
    } else {
      dmsEl.textContent = `Patientez pour le verrouillage satellite`;
    }
  }

  // 3. Métadonnées (Altitude, Précision)
  const metaEl = document.getElementById('emergency-gps-meta');
  if (metaEl) {
    if (hasGps) {
      const altStr = (ele !== null && !isNaN(ele)) ? `Alt : ${Math.round(ele)} m • ` : '';
      metaEl.textContent = `${altStr}Précision : ±${Math.round(acc || 10)} m`;
    } else {
      metaEl.textContent = `Veuillez vous placer à ciel ouvert`;
    }
  }

  // 4. Guide de dictée vocale
  const dictateCoords = document.getElementById('dictate-coords');
  const dictateAlt = document.getElementById('dictate-alt');
  if (dictateCoords) dictateCoords.textContent = ddStr;
  if (dictateAlt) dictateAlt.textContent = hasGps ? `${Math.round(ele)} m` : '-- m';

  // 5. Tag Pays
  const countryTag = document.getElementById('emergency-country-tag');
  if (countryTag) {
    if (country === 'FR') {
      countryTag.textContent = '🇫🇷 France';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    } else if (country === 'UK') {
      countryTag.textContent = '🇬🇧 Royaume-Uni (UK)';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/40';
    } else if (country === 'CH') {
      countryTag.textContent = '🇨🇭 Suisse';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/40';
    } else if (country === 'ES') {
      countryTag.textContent = '🇪🇸 Espagne';
      countryTag.className = 'text-[9px] font-black px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
    } else {
      countryTag.textContent = '🇪🇺 Europe / Inter';
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

function selectEmergencyCountry(countryCode) {
  state.selectedEmergencyCountry = countryCode;
  updateEmergencyModalGpsData();
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

  const hasGps = state.myUser.lat !== null && state.myUser.lat !== undefined && !isNaN(state.myUser.lat) &&
                 state.myUser.lon !== null && state.myUser.lon !== undefined && !isNaN(state.myUser.lon);
  const autoCountry = hasGps ? detectCountry(state.myUser.lat, state.myUser.lon) : 'FR';
  const country = state.selectedEmergencyCountry || autoCountry;

  // Mise à jour visuelle des onglets pays
  document.querySelectorAll('.emergency-country-tab-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-country') === country;
    if (isThis) {
      btn.className = 'emergency-country-tab-btn px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs border border-emerald-400 flex items-center gap-1 shrink-0 transition active:scale-95 shadow-md';
    } else {
      btn.className = 'emergency-country-tab-btn px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700 flex items-center gap-1 shrink-0 transition active:scale-95 hover:bg-slate-750';
    }
  });

  if (country === 'UK') {
    numList.innerHTML = `
      <!-- 1. 🔴 BOUTON 999 MOUNTAIN RESCUE & POLICE (Royaume-Uni 🇬🇧) -->
      <button type="button" onclick="makeEmergencyCall('999')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">999</span>
        <div class="emergency-flag-container" title="United Kingdom">
          <span class="text-2xl">🇬🇧</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>🚨 999 Mountain Rescue</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">Police, Mountain Rescue, Ambulance, Coastguard</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 2. 🔴 BOUTON 112 EUROPE & UK -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="UK & Europe">
          <span class="text-2xl">🇬🇧</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 112 UK & Europe Emergency</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">Standard mobile emergency service UK</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 3. 🟣 BOUTON SMS 999 D'URGENCE AVEC GPS -->
      <button type="button" onclick="sendEmergencySms('999')" class="emergency-big-btn bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-700 hover:from-indigo-500 text-white border-purple-400/40">
        <span class="emergency-btn-badge">999</span>
        <div class="emergency-flag-container" title="UK emergencySMS">
          <span class="text-2xl">🇬🇧</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 SMS 999 d'Urgence UK</span>
            <span class="text-xs bg-purple-900/80 px-2 py-0.5 rounded-full border border-purple-300/50 font-mono">avec GPS</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">emergencySMS UK : texte de détresse avec coordonnées GPS</div>
        </div>
        <i data-lucide="message-square" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 4. 🟢 BOUTON 111 NHS MEDICAL NON-VITAL -->
      <button type="button" onclick="makeEmergencyCall('111')" class="emergency-big-btn bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">111</span>
        <div class="emergency-flag-container" title="NHS UK">
          <span class="text-2xl">🩺</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 111 NHS Medical Advice</span>
          </div>
          <div class="emergency-btn-sub text-emerald-100 opacity-90 truncate">Urgences médicales non vitales / Conseils de santé</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>
    `;
  } else if (country === 'CH') {
    numList.innerHTML = `
      <!-- 1. 🔴 BOUTON 1414 REGA SECOURS AERIEN & MONTAGNE (Suisse 🇨🇭) -->
      <button type="button" onclick="makeEmergencyCall('1414')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">1414</span>
        <div class="emergency-flag-container" title="Rega Suisse">
          <span class="text-2xl">🇨🇭</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>🚁 1414 REGA Secours Montagne</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">Garde aérienne suisse / Sauvetage hélicoptère alpin</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 2. 🟢 BOUTON 144 URGENCES MEDICALES SUISSE -->
      <button type="button" onclick="makeEmergencyCall('144')" class="emergency-big-btn bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">144</span>
        <div class="emergency-flag-container" title="Suisse Ambulance">
          <span class="text-2xl">🇨🇭</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 144 Urgences Médicales</span>
          </div>
          <div class="emergency-btn-sub text-emerald-100 opacity-90 truncate">Ambulances et détresse vitale Suisse</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 3. 🔴 BOUTON 112 POLICE & GENERAL -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="Suisse">
          <span class="text-2xl">🇨🇭</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 112 Urgences Générales</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">Centrale d'alarme et police Suisse</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 4. 🟣 BOUTON SMS URGENCE AVEC GPS -->
      <button type="button" onclick="sendEmergencySms('')" class="emergency-big-btn bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-700 hover:from-indigo-500 text-white border-purple-400/40">
        <span class="emergency-btn-badge">SMS</span>
        <div class="emergency-flag-container" title="Suisse">
          <span class="text-2xl">🇨🇭</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 SMS d'Urgence Suisse</span>
            <span class="text-xs bg-purple-900/80 px-2 py-0.5 rounded-full border border-purple-300/50 font-mono">avec GPS</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">Message d'alerte avec coordonnées GPS précises</div>
        </div>
        <i data-lucide="message-square" class="w-7 h-7 text-white shrink-0"></i>
      </button>
    `;
  } else if (country === 'ES') {
    numList.innerHTML = `
      <!-- 1. 🔴 BOUTON 112 EMERGENCIAS (Europe 🇪🇺 & España 🇪🇸) -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="España">
          <span class="text-2xl">🇪🇸</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 112 Emergencias España</span>
          </div>
          <div class="emergency-btn-sub text-red-100 opacity-90 truncate">Bomberos, Guardia Civil, Rescate GREIM</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 2. 🛡️ BOUTON 062 GUARDIA CIVIL / GREIM RESCATE -->
      <button type="button" onclick="makeEmergencyCall('062')" class="emergency-big-btn bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 hover:from-emerald-600 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">062</span>
        <div class="emergency-flag-container" title="Guardia Civil GREIM">
          <span class="text-2xl">🇪🇸</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>🛡️ 062 Guardia Civil GREIM</span>
          </div>
          <div class="emergency-btn-sub text-emerald-100 opacity-90 truncate">Secours en montagne direct / Rescate en montaña</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 3. 🟢 BOUTON 061 URGENCIAS SANITARIAS -->
      <button type="button" onclick="makeEmergencyCall('061')" class="emergency-big-btn bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">061</span>
        <div class="emergency-flag-container" title="España">
          <span class="text-2xl">🇪🇸</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>📞 061 Urgencias Sanitarias</span>
          </div>
          <div class="emergency-btn-sub text-emerald-100 opacity-90 truncate">Ambulancia y atención médica urgente</div>
        </div>
        <i data-lucide="phone-forwarded" class="w-7 h-7 text-white shrink-0"></i>
      </button>

      <!-- 4. 🟣 BOUTON 112 SMS CON GPS -->
      <button type="button" onclick="sendEmergencySms('112')" class="emergency-big-btn bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-700 hover:from-indigo-500 text-white border-purple-400/40">
        <span class="emergency-btn-badge">SMS</span>
        <div class="emergency-flag-container" title="España">
          <span class="text-2xl">🇪🇸</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 SMS de Emergencia</span>
            <span class="text-xs bg-purple-900/80 px-2 py-0.5 rounded-full border border-purple-300/50 font-mono">con GPS</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">Mensaje de auxilio con coordenadas GPS</div>
        </div>
        <i data-lucide="message-square" class="w-7 h-7 text-white shrink-0"></i>
      </button>
    `;
  } else if (country === 'FR') {
    numList.innerHTML = `
      <!-- 1. 🟢 BOUTON 15 SAMU (France 🇫🇷) -->
      <button type="button" onclick="makeEmergencyCall('15')" class="emergency-big-btn bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40">
        <span class="emergency-btn-badge">15</span>
        <div class="emergency-flag-container" title="France">
          <span class="text-2xl">🇫🇷</span>
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

      <!-- 2. 🔴 BOUTON 112 POMPIERS & SECOURS MONTAGNE (Europe 🇪🇺 & France) -->
      <button type="button" onclick="makeEmergencyCall('112')" class="emergency-big-btn bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white border-red-400/40">
        <span class="emergency-btn-badge">112</span>
        <div class="emergency-flag-container" title="France & Europe">
          <span class="text-2xl">🇫🇷</span>
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
          <span class="text-2xl">🇫🇷</span>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="emergency-btn-title flex items-center gap-2">
            <span>💬 SMS d'Urgence National</span>
            <span class="text-xs bg-purple-900/80 px-2 py-0.5 rounded-full border border-purple-300/50 font-mono">avec GPS</span>
          </div>
          <div class="emergency-btn-sub text-purple-100 opacity-90 truncate">Zone blanche voix / Sourd / Muet / Blessé silencieux</div>
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
          <span class="text-2xl">🇪🇺</span>
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

  const hasGps = state.myUser.lat !== null && state.myUser.lat !== undefined && !isNaN(state.myUser.lat) &&
                 state.myUser.lon !== null && state.myUser.lon !== undefined && !isNaN(state.myUser.lon);
  const lat = hasGps ? state.myUser.lat : null;
  const lon = hasGps ? state.myUser.lon : null;
  const ele = hasGps ? state.myUser.ele : 0;
  const acc = hasGps ? (state.myUser.accuracy || 10) : null;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const myName = state.myUser.name || 'Randonneur';

  let posInfo = "Position : Signal GPS en cours d'acquisition";
  if (hasGps) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'O';
    const dmsStr = `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
    const ddStr = `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
    posInfo = `Position : ${ddStr}\nFormat DMS : ${dmsStr}\nAlt : ${Math.round(ele)}m (±${Math.round(acc || 10)}m)`;
  }

  const smsText = `🚨 URGENCE RANDOTRACKER (${myName})\n${posInfo}\nHeure : ${time}`;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const separator = isIOS ? '&' : '?';
  const targetNum = number ? number.replace(/\s+/g, '') : '';
  const smsUrl = targetNum ? `sms:${targetNum}${separator}body=${encodeURIComponent(smsText)}` : `sms:${separator}body=${encodeURIComponent(smsText)}`;

  showToast(`💬 SMS d'urgence prérempli avec vos coordonnées GPS !`, 'info');

  setTimeout(() => {
    window.location.href = smsUrl;
  }, 100);
}

function sendGpsNotification(customTitle, customBody, extraData) {
  const hasGps = state.myUser.lat !== null && state.myUser.lat !== undefined && !isNaN(state.myUser.lat) &&
                 state.myUser.lon !== null && state.myUser.lon !== undefined && !isNaN(state.myUser.lon);
  const lat = hasGps ? state.myUser.lat : null;
  const lon = hasGps ? state.myUser.lon : null;
  const ele = hasGps ? state.myUser.ele : 0;

  let defaultTitle = `🚨 GPS Secours : En attente de signal...`;
  let defaultBody = `Acquisition satellite en cours (Ciel ouvert conseillé)`;
  if (hasGps) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'O';
    defaultTitle = `🚨 GPS Secours : ${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
    defaultBody = `Alt : ${Math.round(ele)}m • ${toDMS(lat, true)} ${toDMS(lon, false)} (Copié au presse-papier)`;
  }

  const title = customTitle || defaultTitle;
  const body = customBody || defaultBody;
  const tag = customTitle ? `rando-msg-${Date.now()}` : 'rando-emergency-gps';
  const iconUrl = new URL('icon-192.png', window.location.href).href;

  const dataPayload = extraData || {
    type: customTitle ? 'announcement' : 'emergency',
    title: title,
    body: body,
    text: body,
    author: customTitle || 'Annonce RandoTracker',
    timestamp: Date.now()
  };

  // Sauvegarder la dernière notification pour ouverture automatique
  try {
    localStorage.setItem('rando_last_announcement', JSON.stringify(dataPayload));
    if (navigator.setAppBadge) {
      navigator.setAppBadge(1).catch(() => {});
    }
  } catch(e) {}

  // 1. Déclenchement via le pont natif Android (pour affichage instantané dans Android et réveil des montres Bluetooth)
  if (window.AndroidBridge && typeof window.AndroidBridge.showMessageNotification === 'function') {
    try {
      window.AndroidBridge.showMessageNotification(
        title, 
        body, 
        dataPayload.type || 'announcement', 
        dataPayload.author || (customTitle || 'RandoTracker')
      );
    } catch (errBridge) {
      console.warn('[NativeBridge Notification Error]', errBridge);
    }
  }

  // 2. Déclenchement Web Notification standard (pour le mode PWA navigateur Chrome)
  const notifOptions = {
    body: body,
    icon: iconUrl,
    badge: iconUrl,
    tag: tag,
    data: dataPayload,
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
            sendGpsNotification(customTitle, customBody, extraData);
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

  // 2. Si nous sommes dans l'application native Android, déclencher directement la notification système native
  if (window.AndroidBridge && typeof window.AndroidBridge.showMessageNotification === 'function') {
    sendGpsNotification('📢 Test RandoTracker', 'Vibration et notification reçues avec succès sur votre montre et téléphone !', {
      type: 'announcement',
      author: 'Test RandoTracker'
    });
    showToast('🔔 Notification envoyée au téléphone et à la montre !', 'success');
    return;
  }

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
  const hasGps = state.myUser.lat !== null && state.myUser.lat !== undefined && !isNaN(state.myUser.lat) &&
                 state.myUser.lon !== null && state.myUser.lon !== undefined && !isNaN(state.myUser.lon);
  if (!hasGps) {
    showToast("Position GPS en attente de premier signal...", "info");
    return;
  }
  const lat = state.myUser.lat;
  const lon = state.myUser.lon;
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
  syncNativeAndroidSession();
  broadcastMyPosition(true);
}

// Heartbeat périodique avec cadence adaptative pour garantir la présence
let heartbeatInterval = null;
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (window.IS_NATIVE_ANDROID_APP) return;

  heartbeatInterval = setInterval(() => {
    if (mqttClient && mqttClient.connected) {
      broadcastMyPosition(false);
    }
  }, 7000);
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
      broadcastMyPosition(true);
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
    broadcastMyPosition(true);
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

  if (openLayerBtn) openLayerBtn.addEventListener('click', openLayerModal);
  if (closeLayerBtn) closeLayerBtn.addEventListener('click', closeLayerModal);

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
          syncNativeAndroidSession();
          saveHikeSessionToStorage();
        }
        roomModal.classList.add('hidden');
        showToast(`Salon connecté : ${state.roomCode}`, 'success');
      }
    });
  }

  // Scanner QR Code Camera & Boutons Déclencheurs
  const scanRoomBtn = document.getElementById('btn-scan-qr-room');
  if (scanRoomBtn) scanRoomBtn.addEventListener('click', openQrScanner);

  const scanDrawerBtn = document.getElementById('drawer-scan-btn');
  if (scanDrawerBtn) scanDrawerBtn.addEventListener('click', openQrScanner);

  const scanInviteBtn = document.getElementById('btn-scan-qr-from-invite');
  if (scanInviteBtn) scanInviteBtn.addEventListener('click', openQrScanner);

  const closeQrScanBtn = document.getElementById('close-qr-scan-btn');
  if (closeQrScanBtn) closeQrScanBtn.addEventListener('click', closeQrScanner);

  const cancelQrScanBtn = document.getElementById('cancel-qr-scan-btn');
  if (cancelQrScanBtn) cancelQrScanBtn.addEventListener('click', closeQrScanner);

  // Modale Accueil Nouveau Marcheur / Saisie Prénom
  const savePromptUserBtn = document.getElementById('save-prompt-user-btn');
  if (savePromptUserBtn) savePromptUserBtn.addEventListener('click', savePromptUserName);

  const inputPromptName = document.getElementById('input-prompt-user-name');
  if (inputPromptName) {
    inputPromptName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        savePromptUserName();
      }
    });
  }

  document.querySelectorAll('.prompt-avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prompt-avatar-btn').forEach(b => {
        b.classList.remove('border-emerald-400', 'scale-110', 'bg-emerald-600/30', 'border-purple-500', 'bg-purple-600/30', 'ring-2', 'ring-emerald-400');
        b.classList.add('border-transparent');
        if (!b.classList.contains('overflow-hidden')) {
          b.classList.add('bg-slate-800');
        }
      });
      btn.classList.remove('border-transparent', 'bg-slate-800');
      btn.classList.add('border-emerald-400', 'scale-110', 'ring-2', 'ring-emerald-400');
      if (!btn.classList.contains('overflow-hidden')) {
        btn.classList.add('bg-emerald-600/30');
      }
      selectedPromptIcon = btn.getAttribute('data-icon') || '🐺';
      selectedPromptColor = btn.getAttribute('data-color') || '#9333ea';
    });
  });

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
  const openProfileBtn = document.getElementById('open-profile-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-modal-btn');
  const cancelProfileBtn = document.getElementById('cancel-profile-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');

  if (openProfileBtn) openProfileBtn.addEventListener('click', openProfileModal);
  if (editProfileBtn) editProfileBtn.addEventListener('click', openProfileModal);
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

  let currentZoom = parseFloat(wrapper.dataset.pinchScale || wrapper.dataset.zoomLevel || localStorage.getItem('rando_popup_zoom') || '1.0');
  currentZoom = Math.max(0.70, Math.min(2.80, Math.round((currentZoom + delta) * 10) / 10));
  
  wrapper.dataset.pinchScale = currentZoom.toString();
  wrapper.dataset.zoomLevel = currentZoom.toString();
  localStorage.setItem('rando_popup_zoom', currentZoom.toString());

  const curX = parseFloat(wrapper.dataset.dragX || '0');
  const curY = parseFloat(wrapper.dataset.dragY || '0');
  wrapper.style.transformOrigin = 'center top';
  wrapper.style.transform = `translate3d(${curX}px, ${curY}px, 0px) scale(${currentZoom})`;

  const badges = popupEl.querySelectorAll('.popup-zoom-level-badge, .pinch-zoom-feedback-badge');
  badges.forEach(b => {
    b.textContent = `${Math.round(currentZoom * 100)}%`;
  });
}

function adjustElevationDrawerZoom(delta) {
  const drawer = document.getElementById('elevation-drawer');
  if (!drawer) return;
  let currentZoom = parseFloat(drawer.dataset.pinchScale || drawer.dataset.uiZoom || localStorage.getItem('rando_ele_ui_zoom') || '1.0');
  currentZoom = Math.max(0.70, Math.min(2.80, Math.round((currentZoom + delta) * 10) / 10));
  drawer.dataset.pinchScale = currentZoom.toString();
  drawer.dataset.uiZoom = currentZoom.toString();
  localStorage.setItem('rando_ele_ui_zoom', currentZoom.toString());

  const badge = document.getElementById('ele-ui-zoom-badge');
  if (badge) badge.textContent = `${Math.round(currentZoom * 100)}%`;

  const curX = parseFloat(drawer.dataset.dragX || '0');
  const curY = parseFloat(drawer.dataset.dragY || '0');
  drawer.style.transformOrigin = 'center top';
  drawer.style.transform = `translate3d(${curX}px, ${curY}px, 0px) scale(${currentZoom})`;

  if (state.chartInstance) {
    state.chartInstance.resize();
  }
}

/// ============================================================================
// GUIDE DE DÉMARRAGE RAPIDE / ONBOARDING (GPS ET BATTERIE SANS RESTRICTION)
// ============================================================================
function checkOnboardingStatus() {
  // Mode non-bloquant : Ne jamais ouvrir de modale bloquante au démarrage
}

function openOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    pushModalState('onboarding-modal');
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  }
}

function closeOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
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
    window.visualViewport.addEventListener('scroll', () => {
      ensureBarsVisible();
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

  // E. Gardien actif anti-disparition Pixel
  setInterval(() => {
    ensureBarsVisible();
  }, 2000);
}

// ============================================================================
// CONTRÔLEUR UNIFIÉ DE DÉPLACEMENT & ZOOM TACTILE À 2 DOIGTS (100% ISOLÉ & FLUIDE)
// ============================================================================
function makeElementInteractive(containerEl, customCardSelector, customHandleSelector) {
  if (!containerEl || containerEl.dataset.interactiveActive) return;
  containerEl.dataset.interactiveActive = 'true';

  const card = (customCardSelector ? containerEl.querySelector(customCardSelector) : null) ||
               containerEl.querySelector('.bg-slate-900, .custom-modal-card, .leaflet-popup-content-wrapper, .emergency-modal-inner') ||
               containerEl;

  const handle = (customHandleSelector ? containerEl.querySelector(customHandleSelector) : null) ||
                 containerEl.querySelector('.popup-drag-bar, .modal-drag-bar, .draggable-header-handle') ||
                 card.querySelector('.border-b, .border-b-2') ||
                 card;

  handle.classList.add('draggable-header-handle');
  handle.style.cursor = 'grab';

  let isDragging = false;
  let isPinching = false;
  let dragStartX = 0, dragStartY = 0;
  let curX = parseFloat(card.dataset.dragX || '0');
  let curY = parseFloat(card.dataset.dragY || '0');
  let curScale = parseFloat(card.dataset.pinchScale || card.dataset.zoomLevel || card.dataset.uiZoom || '1.0');
  let pinchStartDist = 0;
  let pinchStartScale = 1.0;
  let lastTapTime = 0;

  // Création dynamique de la bulle de feedback visuel de zoom
  let zoomBadge = card.querySelector('.pinch-zoom-feedback-badge');
  if (!zoomBadge) {
    zoomBadge = document.createElement('div');
    zoomBadge.className = 'pinch-zoom-feedback-badge';
    card.style.position = 'relative';
    card.appendChild(zoomBadge);
  }

  const showZoomBadge = (scale) => {
    const pct = Math.round(scale * 100);
    zoomBadge.textContent = `🔍 ${pct}%`;
    zoomBadge.classList.add('is-visible');

    const headerBadges = card.querySelectorAll('.popup-zoom-level-badge, #ele-ui-zoom-badge');
    headerBadges.forEach(b => b.textContent = `${pct}%`);

    clearTimeout(zoomBadge._hideTimer);
    zoomBadge._hideTimer = setTimeout(() => {
      zoomBadge.classList.remove('is-visible');
    }, 1100);
  };

  const applyTransform = (smooth = false) => {
    if (smooth) {
      card.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => { card.style.transition = ''; }, 240);
    }
    card.style.transformOrigin = 'center top';
    card.style.transform = `translate3d(${curX}px, ${curY}px, 0px) scale(${curScale})`;
    card.dataset.dragX = curX.toString();
    card.dataset.dragY = curY.toString();
    card.dataset.pinchScale = curScale.toString();
    card.dataset.zoomLevel = curScale.toString();
    card.dataset.uiZoom = curScale.toString();
  };

  const getDistance = (t1, t2) => {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // --- SOURIS (DESKTOP) ---
  const onMouseDown = (e) => {
    if (e.target.closest('button, a, input, select, textarea, label, .modal-close-btn, .popup-zoom-btn, details, summary, i, svg, [onclick]')) {
      return;
    }
    isDragging = true;
    handle.style.cursor = 'grabbing';
    dragStartX = e.clientX - curX;
    dragStartY = e.clientY - curY;

    if (state.map && state.map.dragging) state.map.dragging.disable();

    const onMouseMove = (ev) => {
      if (!isDragging) return;
      if (ev.cancelable) ev.preventDefault();
      curX = ev.clientX - dragStartX;
      curY = ev.clientY - dragStartY;
      applyTransform(false);
    };

    const onMouseUp = () => {
      isDragging = false;
      handle.style.cursor = 'grab';
      if (state.map && state.map.dragging) state.map.dragging.enable();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', onMouseDown);

  // --- TOUCH TACTILE (SMARTPHONE / TABLETTE) ---
  const onTouchStart = (e) => {
    // Si l'élément est masqué, ignorer totalement
    if (containerEl.classList.contains('hidden') || containerEl.style.display === 'none') {
      return;
    }

    // Ne jamais bloquer les clics sur les boutons / liens / champs
    const isInteractive = e.target.closest('button, a, input, select, textarea, label, .modal-close-btn, .popup-zoom-btn, details, summary, i, svg, [onclick]');
    if (isInteractive) {
      return;
    }

    // 1 doigt : Vérifier Double-Tap ou Début de Déplacement (Drag)
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTime < 300) {
        // Double-tap : Réinitialisation instantanée à 100%
        curScale = 1.0;
        applyTransform(true);
        showZoomBadge(1.0);
        lastTapTime = 0;
        e.stopPropagation();
        return;
      }
      lastTapTime = now;

      // Si le doigt est posé sur la poignée de déplacement (header / bar)
      const onHandle = handle.contains(e.target);
      if (onHandle) {
        isDragging = true;
        handle.style.cursor = 'grabbing';
        dragStartX = e.touches[0].clientX - curX;
        dragStartY = e.touches[0].clientY - curY;
        if (state.map && state.map.dragging) state.map.dragging.disable();
        e.stopPropagation();
      }
    }

    // 2 doigts : Démarrer le Pinch-to-Zoom sur la carte
    if (e.touches.length === 2 && (card.contains(e.target) || handle.contains(e.target))) {
      isDragging = false;
      isPinching = true;
      if (e.cancelable) e.preventDefault();
      pinchStartDist = getDistance(e.touches[0], e.touches[1]);
      pinchStartScale = curScale;
      if (state.map) {
        if (state.map.touchZoom) state.map.touchZoom.disable();
        if (state.map.dragging) state.map.dragging.disable();
      }
      e.stopPropagation();
    }
  };

  const onTouchMove = (e) => {
    // Gestion Zoom 2 doigts
    if (isPinching && e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const dist = getDistance(e.touches[0], e.touches[1]);
      if (pinchStartDist > 0) {
        const factor = dist / pinchStartDist;
        curScale = Math.max(0.70, Math.min(2.80, Math.round(pinchStartScale * factor * 100) / 100));
        applyTransform(false);
        showZoomBadge(curScale);
      }
      return;
    }

    // Gestion Déplacement 1 doigt sur la poignée
    if (isDragging && e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      curX = e.touches[0].clientX - dragStartX;
      curY = e.touches[0].clientY - dragStartY;
      applyTransform(false);
    }
  };

  const onTouchEnd = (e) => {
    if (isPinching) {
      e.stopPropagation();
      if (e.touches.length < 2) {
        isPinching = false;
        pinchStartDist = 0;
        if (state.map && state.map.touchZoom) state.map.touchZoom.enable();
      }
    }

    if (isDragging) {
      e.stopPropagation();
      if (e.touches.length === 0) {
        isDragging = false;
        handle.style.cursor = 'grab';
        if (state.map && state.map.dragging) state.map.dragging.enable();
      }
    }
  };

  handle.addEventListener('touchstart', onTouchStart, { passive: false });
  if (card !== handle) {
    card.addEventListener('touchstart', onTouchStart, { passive: false });
  }
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: false });
  window.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

function makePopupDraggable(popupEl) {
  makeElementInteractive(popupEl, '.leaflet-popup-content-wrapper', '.popup-drag-bar');
}

function makeModalDraggable(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  makeElementInteractive(modal);
}

function makeElementPinchZoomable(containerEl) {
  makeElementInteractive(containerEl);
}

function initAllDraggableModals() {
  const modalIds = [
    'tracks-modal', 'layer-modal', 'room-modal', 'profile-modal',
    'invite-modal', 'announcement-modal', 'received-announcement-modal',
    'about-modal', 'onboarding-modal', 'elevation-drawer', 'users-panel',
    'emergency-modal'
  ];
  modalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      makeElementInteractive(el);
    }
  });
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
  try { syncNativeAndroidSession(); } catch(e) { console.error('[Init AndroidBridge]', e); }
  try { initPixelSanctuaryGuardians(); } catch(e) { console.error('[Init PixelGuardians]', e); }
  try { initAllDraggableModals(); } catch(e) { console.error('[Init DraggableModals]', e); }

  // Ancrage initial robuste dans l'historique pour empêcher tout swipe-back destructif
  try {
    history.replaceState({ randoMain: true }, '', window.location.href);
    history.pushState({ randoMain: true }, '', window.location.href);
  } catch (e) {}

  try { createOrUpdateUserMarker(state.myUser); } catch(e) { console.error('[Init UserMarker]', e); }
  try { loadSavedOtherUsersFromStorage(); } catch(e) { console.error('[Init SavedUsers]', e); }
  try { deduplicateUsersByName(); } catch(e) { console.error('[Init Deduplicate]', e); }
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

  // Initialisation Service Worker et Notifications
  try {
    initServiceWorkerNotificationListener();
    checkPendingNotification();
  } catch(e) { console.error('[Init SW/Notif]', e); }

  // DÉMARRAGE DIRECT GPS SANS MODALE BLOQUANTE
  try {
    if (navigator.geolocation) {
      console.log('[GPS] Démarrage automatique de la géolocalisation...');
      startGpsWatch(true);
    }
    checkAndDisplayAppOpenAd();
  } catch(e) { console.error('[Init GPS]', e); }
}

function checkPendingNotification() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('open_announcement') || urlParams.has('notif')) {
      const lastAnn = localStorage.getItem('rando_last_announcement');
      if (lastAnn) {
        const parsed = JSON.parse(lastAnn);
        const notifKey = 'notif_opened_' + (parsed.timestamp || 0);
        if (!sessionStorage.getItem(notifKey)) {
          sessionStorage.setItem(notifKey, '1');
          if (Date.now() - (parsed.timestamp || 0) < 30 * 60 * 1000) { // < 30 min
            setTimeout(() => {
              handleReceivedAnnouncement(parsed);
            }, 350);
          }
        }
      }
      // Nettoyer l'URL proprement sans recharger
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  } catch (e) {
    console.warn('[Check Pending Notif]', e);
  }
}

function initServiceWorkerNotificationListener() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        const d = event.data.data;
        if (d && (d.text || d.body)) {
          handleReceivedAnnouncement({
            author: d.author || event.data.title || 'Message du Groupe',
            role: d.role || 'Randonneur',
            icon: d.icon || '📢',
            color: d.color || '#059669',
            text: d.text || d.body,
            lat: d.lat,
            lon: d.lon,
            ele: d.ele,
            timestamp: d.timestamp || Date.now()
          });
        } else if (event.data.body) {
          handleReceivedAnnouncement({
            author: event.data.title || 'Message du Groupe',
            role: 'Randonneur',
            icon: '📢',
            color: '#059669',
            text: event.data.body,
            timestamp: Date.now()
          });
        }
      }
    });
  }
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
    'emergency-modal', 'onboarding-modal', 'app-open-ad-modal',
    'qr-scan-modal', 'name-prompt-modal', 'pocket-mode-overlay'
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
  closeAppOpenAd();
  closeQrScanner();
  closeNamePromptModal();
  exitPocketMode();
  const modals = [
    'invite-modal', 'announcement-modal', 'received-announcement-modal',
    'tracks-modal', 'layer-modal', 'room-modal', 'profile-modal', 'about-modal',
    'elevation-drawer', 'onboarding-modal', 'app-open-ad-modal',
    'qr-scan-modal', 'name-prompt-modal', 'pocket-mode-overlay'
  ];
  modals.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });
  if (state.map) {
    setTimeout(() => state.map.invalidateSize(), 120);
  }
  ensureBarsVisible();
}

function handleNativeBackPress() {
  if (isAnyModalOrDrawerOpen()) {
    closeAllModalsAndDrawers();
    ensureBarsVisible();
    return true;
  }
  ensureBarsVisible();
  return false;
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

window.handleNativeBackPress = handleNativeBackPress;

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
window.openLayerModal = openLayerModal;
window.closeLayerModal = closeLayerModal;
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
window.makeElementPinchZoomable = makeElementPinchZoomable;
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
window.openProfileModal = openProfileModal;
window.checkAndDisplayAppOpenAd = checkAndDisplayAppOpenAd;
window.closeAppOpenAd = closeAppOpenAd;
window.renderTrackAdBanner = renderTrackAdBanner;
window.renderProfileAdBanner = renderProfileAdBanner;
window.MONETIZATION_CONFIG = MONETIZATION_CONFIG;
window.startBackgroundKeepAlive = startBackgroundKeepAlive;
window.stopBackgroundKeepAlive = stopBackgroundKeepAlive;
window.startGpsWorkerHeartbeat = startGpsWorkerHeartbeat;
window.stopGpsWorkerHeartbeat = stopGpsWorkerHeartbeat;
window.enterPocketMode = enterPocketMode;
window.exitPocketMode = exitPocketMode;
window.startPocketHoldUnlock = startPocketHoldUnlock;
window.cancelPocketHoldUnlock = cancelPocketHoldUnlock;
window.updatePocketModeTelemetry = updatePocketModeTelemetry;

// ============================================================================
// RECHERCHE DE VILLE / COMMUNE SUR LA CARTE & CADRAGE IMMÉDIAT
// ============================================================================
let citySearchDebounceTimer = null;

function handleCitySearchInput(event) {
  const input = document.getElementById('city-search-input');
  const clearBtn = document.getElementById('city-search-clear-btn');
  const resultsDropdown = document.getElementById('city-search-results');
  if (!input) return;

  const query = input.value.trim();
  if (clearBtn) {
    if (query.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  if (citySearchDebounceTimer) {
    clearTimeout(citySearchDebounceTimer);
  }

  if (query.length < 2) {
    if (resultsDropdown) {
      resultsDropdown.classList.add('hidden');
      resultsDropdown.innerHTML = '';
    }
    return;
  }

  citySearchDebounceTimer = setTimeout(() => {
    fetchCitySuggestions(query);
  }, 250);
}

function clearCitySearch() {
  const input = document.getElementById('city-search-input');
  const clearBtn = document.getElementById('city-search-clear-btn');
  const resultsDropdown = document.getElementById('city-search-results');
  if (input) input.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');
  if (resultsDropdown) {
    resultsDropdown.classList.add('hidden');
    resultsDropdown.innerHTML = '';
  }
}

async function triggerCitySearch() {
  const input = document.getElementById('city-search-input');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;

  await fetchCitySuggestions(query, true);
}

async function fetchCitySuggestions(query, autoSelectFirst = false) {
  const resultsDropdown = document.getElementById('city-search-results');
  if (!resultsDropdown) return;

  try {
    // 1. Recherche prioritaire sur l'API Adresse officielle française (rapide, précis, sans clé)
    let suggestions = [];
    try {
      const respGov = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&limit=5`);
      if (respGov.ok) {
        const dataGov = await respGov.json();
        if (dataGov && dataGov.features && dataGov.features.length > 0) {
          suggestions = dataGov.features.map(f => ({
            name: f.properties.name || f.properties.city,
            context: f.properties.context || `${f.properties.postcode || ''} ${f.properties.city || ''}`,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            country: 'France 🇫🇷'
          }));
        }
      }
    } catch (e) {
      console.warn('[CitySearch] API Adresse non disponible, fallback OSM:', e);
    }

    // 2. Fallback Nominatim OpenStreetMap (monde entier) si aucun résultat français
    if (suggestions.length === 0) {
      try {
        const respOsm = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
        if (respOsm.ok) {
          const dataOsm = await respOsm.json();
          if (Array.isArray(dataOsm) && dataOsm.length > 0) {
            suggestions = dataOsm.map(item => ({
              name: item.name || item.display_name.split(',')[0],
              context: item.display_name,
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              country: item.address ? (item.address.country || '') : ''
            }));
          }
        }
      } catch (e) {
        console.warn('[CitySearch] Nominatim indisponible:', e);
      }
    }

    if (suggestions.length === 0) {
      resultsDropdown.innerHTML = `
        <div class="p-4 text-sm text-amber-300 font-black text-center">
          ⚠️ Aucune commune trouvée pour "${query}"
        </div>
      `;
      resultsDropdown.classList.remove('hidden');
      return;
    }

    if (autoSelectFirst && suggestions.length > 0) {
      const top = suggestions[0];
      selectSearchedCity(top.lat, top.lon, top.name, top.context);
      return;
    }

    // Rendu de la liste déroulante des résultats avec lisibilité et contraste maximum
    resultsDropdown.innerHTML = suggestions.map((s, idx) => `
      <div class="city-search-item flex items-center justify-between text-left cursor-pointer p-3.5 sm:p-4 hover:bg-slate-800 active:bg-emerald-950/90 transition border-b border-slate-700/80 last:border-0" onclick="selectSearchedCity(${s.lat}, ${s.lon}, '${s.name.replace(/'/g, "\\'")}', '${(s.context || '').replace(/'/g, "\\'")}')">
        <div class="min-w-0 flex-1 pr-2.5">
          <div class="text-sm sm:text-base font-black text-amber-300 truncate flex items-center gap-1.5">
            <span class="text-emerald-400 shrink-0 text-base">📍</span>
            <span class="truncate">${s.name}</span>
          </div>
          <div class="text-xs sm:text-sm text-slate-200 font-bold truncate mt-0.5">
            ${s.context}
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 text-xs font-black shrink-0">
          Zoomer ➔
        </span>
      </div>
    `).join('');

    resultsDropdown.classList.remove('hidden');
  } catch (e) {
    console.error('[CitySearch] Erreur recherche ville:', e);
  }
}

function selectSearchedCity(lat, lon, name, context) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;

  const resultsDropdown = document.getElementById('city-search-results');
  const input = document.getElementById('city-search-input');
  const clearBtn = document.getElementById('city-search-clear-btn');

  if (input) input.value = name;
  if (clearBtn) clearBtn.classList.remove('hidden');
  if (resultsDropdown) {
    resultsDropdown.classList.add('hidden');
    resultsDropdown.innerHTML = '';
  }

  if (!state.map) return;

  // Cadrage fluide vers la ville trouvée (zoom 13 adapté randonnée & topographie)
  state.map.flyTo([lat, lon], 13, {
    animate: true,
    duration: 1.5
  });

  // Marqueur visuel animé sur la ville trouvée
  if (state.citySearchMarker) {
    try { state.map.removeLayer(state.citySearchMarker); } catch (e) {}
    state.citySearchMarker = null;
  }

  const cityIcon = L.divIcon({
    className: 'city-search-pin',
    html: `
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 border-2 border-white text-white flex items-center justify-center text-xl shadow-2xl animate-bounce">
        📍
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });

  state.citySearchMarker = L.marker([lat, lon], { icon: cityIcon }).addTo(state.map);
  state.citySearchMarker.bindPopup(`
    <div class="p-2 text-center">
      <div class="font-black text-sm text-slate-900">📍 ${name}</div>
      ${context ? `<div class="text-[11px] text-slate-600 font-bold mt-0.5">${context}</div>` : ''}
    </div>
  `).openPopup();

  showToast(`📍 Carte centrée sur : ${name}`, 'success');
}

// ============================================================================
// ARRÊT PROPRE DU SUIVI GPS & DÉCONNEXION COMPLÈTE DE L'APPLICATION
// ============================================================================
function stopTrackingAndExitApp() {
  if (!confirm('Voulez-vous arrêter le suivi GPS et quitter la session ?\n\nVotre position ne sera plus transmise au groupe et le service d\'arrière-plan sera immédiatement coupé.')) {
    return;
  }

  try {
    // 1. Couper les moteurs de maintien d'arrière-plan
    stopGpsWorkerHeartbeat();
    stopBackgroundKeepAlive();
    releaseWakeLock();

    // 2. Stopper la géolocalisation matérielle
    stopGpsWatch();

    // 3. Informer le service natif Android d'arrêter le Foreground Service
    if (window.AndroidBridge && typeof window.AndroidBridge.stopTrackingService === 'function') {
      try {
        window.AndroidBridge.stopTrackingService();
        console.log('[StopTracking] Service natif Android stoppé avec succès.');
      } catch (e) {
        console.warn('[StopTracking] Erreur stop native bridge:', e);
      }
    }

    // 4. Envoyer un message de déconnexion et couper MQTT
    if (mqttClient) {
      try {
        publishMessage({
          type: 'user_left',
          user: state.myUser
        });
        mqttClient.end(true);
      } catch (e) {}
      mqttClient = null;
    }

    // 5. Mettre à jour l'état et l'interface
    state.isTrackingGps = false;
    state.gpsStartTime = null;

    closeProfileModal();
    updateConnectionStatus(false);
    showToast('🛑 Suivi GPS arrêté. Batterie et réseau libérés.', 'info');
  } catch (e) {
    console.error('[StopTracking] Erreur lors de l\'arrêt du suivi:', e);
  }
}

// ============================================================================
// GESTIONNAIRE D'AFFICHAGE DU JOURNAL DES LOGS & DIAGNOSTIC
// ============================================================================
function openLogsModal() {
  const modal = document.getElementById('logs-modal');
  if (!modal) return;
  RandoLogger.setModalOpen(true);
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  pushModalState('logs-modal');

  updateLogsTelemetryUI();
  renderLogsList();
}

function closeLogsModal() {
  const modal = document.getElementById('logs-modal');
  if (!modal) return;
  RandoLogger.setModalOpen(false);
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

function updateLogsTelemetryUI() {
  const gpsElem = document.getElementById('diag-gps-status');
  const mqttElem = document.getElementById('diag-mqtt-status');
  const bgElem = document.getElementById('diag-bg-status');

  if (gpsElem) {
    if (state.lastGpsPos) {
      const acc = state.lastGpsAccuracy ? Math.round(state.lastGpsAccuracy) : 5;
      gpsElem.textContent = `Fixé (±${acc}m)`;
      gpsElem.className = 'text-emerald-400 text-xs font-mono mt-0.5';
    } else {
      gpsElem.textContent = state.isTrackingGps ? 'Recherche...' : 'Inactif';
      gpsElem.className = 'text-amber-400 text-xs font-mono mt-0.5';
    }
  }

  if (mqttElem) {
    const isConn = mqttClient && mqttClient.connected;
    mqttElem.textContent = isConn ? `OK (${state.roomCode})` : 'Déconnecté';
    mqttElem.className = isConn ? 'text-blue-400 text-xs font-mono mt-0.5' : 'text-red-400 text-xs font-mono mt-0.5';
  }

  if (bgElem) {
    bgElem.textContent = window.IS_NATIVE_ANDROID_APP ? 'Android Natif' : (screenWakeLock ? 'WakeLock Web' : 'Standard Web');
  }
}

function setLogsFilter(filter) {
  RandoLogger.setFilter(filter);
  const btns = document.querySelectorAll('.logs-filter-btn');
  btns.forEach(b => {
    if (b.getAttribute('data-filter') === filter) {
      b.className = 'logs-filter-btn px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs';
    } else {
      b.className = 'logs-filter-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white font-bold text-xs';
    }
  });
  renderLogsList();
}

function renderLogsList() {
  const container = document.getElementById('logs-container');
  const summary = document.getElementById('logs-status-summary');
  const searchInput = document.getElementById('logs-search-input');
  if (!container) return;

  const logs = RandoLogger.getLogs();
  const filter = RandoLogger.getFilter();
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = logs.filter(l => {
    if (filter === 'ERROR' && l.level !== 'ERROR' && l.level !== 'WARN') return false;
    if (filter === 'GPS' && l.level !== 'GPS' && !l.tag.includes('GPS') && !l.tag.includes('POS')) return false;
    if (filter === 'MQTT' && l.level !== 'MQTT' && !l.tag.includes('MQTT') && !l.tag.includes('ROOM') && !l.tag.includes('BROADCAST')) return false;
    if (search) {
      const matchMsg = (l.message || '').toLowerCase().includes(search);
      const matchTag = (l.tag || '').toLowerCase().includes(search);
      const matchData = (l.data || '').toLowerCase().includes(search);
      if (!matchMsg && !matchTag && !matchData) return false;
    }
    return true;
  });

  if (summary) {
    summary.textContent = `${logs.length} événement(s) (${filtered.length} affiché(s))`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-500 font-bold text-xs">
        Aucun log correspondant au filtre sélectionné
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(l => {
    let entryClass = 'log-entry-info';
    let badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (l.level === 'ERROR') {
      entryClass = 'log-entry-error';
      badgeBg = 'bg-red-500/20 text-red-300 border-red-500/40';
    } else if (l.level === 'WARN') {
      entryClass = 'log-entry-warn';
      badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else if (l.level === 'GPS') {
      entryClass = 'log-entry-gps';
      badgeBg = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    } else if (l.level === 'MQTT') {
      entryClass = 'log-entry-info';
      badgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }

    return `
      <div class="log-entry ${entryClass}">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span class="font-mono text-slate-300">${l.time}</span>
          <span class="log-badge border ${badgeBg}">${l.level}</span>
          <span class="font-black text-slate-200">[${l.tag}]</span>
        </div>
        <div class="text-white text-xs mt-0.5 select-text font-mono">${escapeHtml(l.message)}</div>
        ${l.data ? `<div class="text-[10px] text-slate-400 font-mono select-text bg-slate-900/90 p-1.5 rounded-lg mt-1 border border-slate-800 break-all">${escapeHtml(l.data)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function copyLogsToClipboard() {
  const text = RandoLogger.exportAsText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Logs copiés dans le presse-papiers !', 'success');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('📋 Logs copiés dans le presse-papiers !', 'success');
}

function downloadLogsFile() {
  const text = RandoLogger.exportAsText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `randotracker_diagnostic_logs_${nowStr}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 Fichier de logs téléchargé !', 'success');
}

function clearAllLogs() {
  if (!confirm('Voulez-vous effacer tout l\'historique des logs enregistrés ?')) return;
  RandoLogger.clear();
  showToast('🗑️ Journal des logs effacé.', 'info');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// QR Scanner & Saisie Prénom Marcheur
window.openQrScanner = openQrScanner;
window.closeQrScanner = closeQrScanner;
window.onQrCodeScanned = onQrCodeScanned;
window.joinRoomDirectly = joinRoomDirectly;
window.checkAndPromptUserName = checkAndPromptUserName;
window.openNamePromptModal = openNamePromptModal;
window.closeNamePromptModal = closeNamePromptModal;
window.savePromptUserName = savePromptUserName;
window.generateUserPopupHtml = generateUserPopupHtml;
window.refreshActiveUserPopups = refreshActiveUserPopups;
window.initOrdnanceSurveyLayer = initOrdnanceSurveyLayer;
window.saveOrdnanceSurveyApiKey = saveOrdnanceSurveyApiKey;
window.updateOsApiKeyUI = updateOsApiKeyUI;
window.selectEmergencyCountry = selectEmergencyCountry;
window.handleCitySearchInput = handleCitySearchInput;
window.clearCitySearch = clearCitySearch;
window.triggerCitySearch = triggerCitySearch;
window.fetchCitySuggestions = fetchCitySuggestions;
window.selectSearchedCity = selectSearchedCity;
window.stopTrackingAndExitApp = stopTrackingAndExitApp;
window.RandoLogger = RandoLogger;
window.openLogsModal = openLogsModal;
window.closeLogsModal = closeLogsModal;
window.setLogsFilter = setLogsFilter;
window.renderLogsList = renderLogsList;
window.copyLogsToClipboard = copyLogsToClipboard;
window.downloadLogsFile = downloadLogsFile;
window.clearAllLogs = clearAllLogs;
window.state = state;


