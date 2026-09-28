/**
 * RandoTracker - Application PWA & Suivi de Randonnée Multi-Groupes 4G
 * Cartographie IGN / OpenTopoMap, Traces GPX & Synchronisation WebRTC / 4G
 */

// ============================================================================
// CONSTANTES & CONFIGURATION
// ============================================================================
const MAX_TRACKS = 5;
const MAX_USERS = 10;

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
  tracks: [], // Array of parsed track objects
  roomCode: 'RANDO-2026',
  myUser: {
    id: 'u_' + Math.random().toString(36).substr(2, 7),
    name: 'Jean Dupont',
    role: 'Guide de tête',
    icon: '🌲',
    color: '#059669',
    lat: 45.8920,
    lon: 6.1550,
    ele: 450,
    speed: 0.0,
    battery: 92,
    isSos: false,
    lastSeen: Date.now()
  },
  otherUsers: new Map(), // key: userId, value: userObject
  userMarkers: new Map(), // key: userId, value: Leaflet Marker
  trackLayers: new Map(), // key: trackId, value: Leaflet LayerGroup
  chartInstance: null,
  isTrackingGps: false,
  gpsWatchId: null,
  isSimulating: false,
  simulationInterval: null,
  ws: null,
  broadcastChannel: null,
  peer: null,
  peerConnections: new Map(),
  hoverMarker: null,
  deferredPwaPrompt: null
};

// ============================================================================
// ENREGISTREMENT DU SERVICE WORKER (PWA & MODE HORS-LIGNE)
// ============================================================================
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[PWA] Service Worker actif:', reg.scope))
        .catch((err) => console.log('[PWA] Erreur Service Worker:', err));
    });
  }

  // Écouter l'événement d'installation PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPwaPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.classList.remove('hidden');
      installBtn.addEventListener('click', () => {
        installBtn.classList.add('hidden');
        if (state.deferredPwaPrompt) {
          state.deferredPwaPrompt.prompt();
          state.deferredPwaPrompt = null;
        }
      });
    }
  });
}

// ============================================================================
// INITIALISATION DE LA CARTE & DES FONDS DE CARTE
// ============================================================================
function initMap() {
  // Centre initial : Région des Alpes / Lac d'Annecy
  state.map = L.map('map', {
    center: [45.8960, 6.1680],
    zoom: 13,
    zoomControl: false
  });

  // Repositionner le contrôle de zoom en bas à droite
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  // 1. Fond IGN Géoplateforme (Plan IGN V2 Open)
  state.layers.ign = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.ign.fr/" target="_blank">IGN - Géoplateforme</a>'
    }
  );

  // 2. Fond OpenTopoMap (Courbes de niveau & Sentiers)
  state.layers.opentopo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }
  );

  // 3. Fond IGN Orthophoto (Photos Aériennes Satellite)
  state.layers.satellite = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.ign.fr/">IGN Orthophoto</a>'
    }
  );

  // 4. Fond OpenStreetMap standard
  state.layers.osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  );

  // Activer IGN par défaut
  state.layers.ign.addTo(state.map);
}

function setBaseLayer(layerKey) {
  if (!state.layers[layerKey]) return;

  if (state.layers[state.activeLayerName]) {
    state.map.removeLayer(state.layers[state.activeLayerName]);
  }

  state.layers[layerKey].addTo(state.map);
  state.activeLayerName = layerKey;

  // Mise à jour des boutons Desktop
  document.querySelectorAll('.map-layer-btn').forEach(btn => {
    btn.classList.remove('bg-emerald-600', 'text-white', 'shadow');
    btn.classList.add('text-slate-300');
  });

  const activeBtn = document.getElementById(`map-btn-${layerKey}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-300');
    activeBtn.classList.add('bg-emerald-600', 'text-white', 'shadow');
  }

  // Mise à jour des boutons Mobiles
  document.querySelectorAll('.mobile-map-opt').forEach(btn => {
    if (btn.getAttribute('data-layer') === layerKey) {
      btn.classList.add('bg-emerald-600', 'text-white');
      btn.classList.remove('text-slate-300', 'hover:bg-slate-800');
    } else {
      btn.classList.remove('bg-emerald-600', 'text-white');
      btn.classList.add('text-slate-300', 'hover:bg-slate-800');
    }
  });
}

// ============================================================================
// GESTION DU PARSING & AFFICHAGE DES TRACES GPX (Jusqu'à 5 traces)
// ============================================================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
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

  const trkpts = xmlDoc.querySelectorAll('trkpt');
  if (trkpts.length === 0) {
    throw new Error('Aucun point de trace (<trkpt>) trouvé dans ce fichier GPX.');
  }

  const points = [];
  let totalDistance = 0;
  let eleGain = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;

  let prevLat = null;
  let prevLon = null;
  let prevEle = null;

  trkpts.forEach((pt) => {
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

      points.push({
        lat,
        lon,
        ele,
        distanceFromStart: totalDistance
      });

      prevLat = lat;
      prevLon = lon;
      prevEle = ele;
    }
  });

  return {
    id: 'track_' + Math.random().toString(36).substr(2, 9),
    name: name,
    points: points,
    totalDistance: totalDistance,
    eleGain: Math.round(eleGain),
    minEle: minEle === Infinity ? 0 : Math.round(minEle),
    maxEle: maxEle === -Infinity ? 0 : Math.round(maxEle),
    visible: true
  };
}

function addTrackToState(track) {
  if (state.tracks.length >= MAX_TRACKS) {
    alert(`Limite de ${MAX_TRACKS} traces atteinte. Veuillez en supprimer une avant d'en ajouter une autre.`);
    return false;
  }

  const colorIndex = state.tracks.length % TRACK_COLORS.length;
  track.color = TRACK_COLORS[colorIndex];

  state.tracks.push(track);
  renderTrackOnMap(track);
  renderTracksList();
  updateTracksBadge();
  fitAllTracks();
  return true;
}

function renderTrackOnMap(track) {
  const layerGroup = L.layerGroup();
  const latlngs = track.points.map(p => [p.lat, p.lon]);

  const borderPolyline = L.polyline(latlngs, {
    color: '#0f172a',
    weight: 7,
    opacity: 0.7,
    lineCap: 'round',
    lineJoin: 'round'
  });

  const mainPolyline = L.polyline(latlngs, {
    color: track.color.hex,
    weight: 4.5,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round'
  });

  mainPolyline.bindPopup(`
    <div class="space-y-1.5 p-1 min-w-[200px]">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background-color: ${track.color.hex}"></span>
        <h4 class="font-bold text-sm text-white">${track.name}</h4>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1 border-t border-slate-700">
        <div>Distance : <b class="text-white">${track.totalDistance.toFixed(1)} km</b></div>
        <div>Dénivelé + : <b class="text-emerald-400">+${track.eleGain} m</b></div>
        <div>Altitude Min : <b class="text-white">${track.minEle} m</b></div>
        <div>Altitude Max : <b class="text-white">${track.maxEle} m</b></div>
      </div>
    </div>
  `);

  layerGroup.addLayer(borderPolyline);
  layerGroup.addLayer(mainPolyline);

  // Marqueur Départ
  if (track.points.length > 0) {
    const startPt = track.points[0];
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: `<div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md">D</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon }).bindTooltip(`Départ : ${track.name}`, { direction: 'top' });
    layerGroup.addLayer(startMarker);
  }

  // Marqueur Arrivée
  if (track.points.length > 1) {
    const endPt = track.points[track.points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `<div class="w-6 h-6 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[11px] font-black text-white shadow-md">🏁</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const endMarker = L.marker([endPt.lat, endPt.lon], { icon: endIcon }).bindTooltip(`Arrivée : ${track.name}`, { direction: 'top' });
    layerGroup.addLayer(endMarker);
  }

  if (track.visible) {
    layerGroup.addTo(state.map);
  }

  state.trackLayers.set(track.id, layerGroup);
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
  renderTracksList();
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
  renderTracksList();
  updateTracksBadge();
}

function zoomToTrack(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (!track || track.points.length === 0) return;

  const latlngs = track.points.map(p => [p.lat, p.lon]);
  const bounds = L.latLngBounds(latlngs);
  state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
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
    state.map.fitBounds(bounds, { padding: [60, 60] });
  }
}

function renderTracksList() {
  const container = document.getElementById('tracks-list-container');
  if (!container) return;

  if (state.tracks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500 text-xs">
        <i data-lucide="map-pin-off" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        Aucune trace GPX chargée.<br/>Cliquez sur "Importer" ou "Démo".
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.tracks.map((track) => `
    <div class="p-3 rounded-xl bg-slate-800/80 border ${track.visible ? 'border-slate-700' : 'border-slate-800 opacity-60'} hover:border-slate-600 transition flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style="background-color: ${track.color.hex}"></span>
          <h4 class="font-bold text-xs sm:text-sm text-white truncate" title="${track.name}">${track.name}</h4>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="zoomToTrack('${track.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700" title="Centrer la carte sur cette trace">
            <i data-lucide="focus" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="toggleTrackVisibility('${track.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700" title="${track.visible ? 'Masquer' : 'Afficher'}">
            <i data-lucide="${track.visible ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="removeTrack('${track.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700" title="Supprimer">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded-lg">
        <div class="flex items-center gap-1.5">
          <i data-lucide="navigation" class="w-3 h-3 text-slate-400"></i>
          <span><b>${track.totalDistance.toFixed(1)}</b> km</span>
        </div>
        <div class="flex items-center gap-1.5">
          <i data-lucide="trending-up" class="w-3 h-3 text-emerald-400"></i>
          <span><b>+${track.eleGain}</b> m D+</span>
        </div>
      </div>

      <button onclick="openElevationDrawer('${track.id}')" class="w-full py-1 px-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition">
        <i data-lucide="bar-chart-2" class="w-3 h-3 text-emerald-400"></i>
        <span>Voir le Profil Altimétrique</span>
      </button>
    </div>
  `).join('');

  lucide.createIcons();
}

function updateTracksBadge() {
  const count = state.tracks.length;
  const countBadge = document.getElementById('tracks-count-badge');
  const panelBadge = document.getElementById('tracks-badge');
  if (countBadge) countBadge.textContent = count;
  if (panelBadge) panelBadge.textContent = `${count}/${MAX_TRACKS}`;
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

  title.textContent = `Profil : ${track.name}`;
  stats.textContent = `${track.totalDistance.toFixed(1)} km | +${track.eleGain}m D+ (Min: ${track.minEle}m / Max: ${track.maxEle}m)`;
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
  gradient.addColorStop(0, track.color.hex + '99');
  gradient.addColorStop(1, track.color.hex + '05');

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Altitude (m)',
        data: elevationData,
        borderColor: track.color.hex,
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: track.color.hex,
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          bodyFont: { weight: 'bold' },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 8,
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
          ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      },
      onHover: (event, activeElements) => {
        if (activeElements && activeElements.length > 0) {
          const index = activeElements[0].index * step;
          if (index < track.points.length) {
            const pt = track.points[index];
            updateHoverMapMarker(pt.lat, pt.lon, pt.ele);
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
      html: '<div class="w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-lg animate-ping"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    state.hoverMarker = L.marker([lat, lon], { icon: icon }).addTo(state.map);
  } else {
    state.hoverMarker.setLatLng([lat, lon]);
  }
}

// ============================================================================
// GESTION DES RANDONNEURS GÉOLOCALISÉS (Jusqu'à 10)
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
        ${user.isSos ? '<span class="text-red-400 font-bold ml-1">SOS</span>' : ''}
      </div>
    </div>
  `;

  const customIcon = L.divIcon({
    className: 'custom-user-leaflet-icon',
    html: html,
    iconSize: [50, 70],
    iconAnchor: [25, 45],
    popupAnchor: [0, -45]
  });

  if (!marker) {
    marker = L.marker([user.lat, user.lon], { icon: customIcon }).addTo(state.map);
    state.userMarkers.set(user.id, marker);
  } else {
    marker.setLatLng([user.lat, user.lon]);
    marker.setIcon(customIcon);
  }

  const distFromMe = isMe ? 0 : calculateDistance(state.myUser.lat, state.myUser.lon, user.lat, user.lon);
  marker.bindPopup(`
    <div class="p-1 space-y-2 min-w-[210px]">
      <div class="flex items-center gap-2.5 pb-2 border-b border-slate-700">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow" style="background-color: ${user.color}">
          ${user.icon || '🌲'}
        </div>
        <div>
          <div class="font-bold text-sm text-white">${user.name} ${isMe ? '(Moi)' : ''}</div>
          <div class="text-[11px] text-emerald-400 font-medium">${user.role}</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div>Vitesse : <b class="text-white">${(user.speed || 0).toFixed(1)} km/h</b></div>
        <div>Altitude : <b class="text-white">${Math.round(user.ele || 0)} m</b></div>
        <div>Batterie : <b class="${user.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${user.battery || 90}%</b></div>
        <div>Écart à moi : <b class="text-blue-400">${isMe ? '0 m' : distFromMe < 1 ? Math.round(distFromMe * 1000) + ' m' : distFromMe.toFixed(1) + ' km'}</b></div>
      </div>

      ${user.isSos ? `
        <div class="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-red-400"></i>
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

  const allUsers = [state.myUser, ...Array.from(state.otherUsers.values())].slice(0, MAX_USERS);
  const totalCount = allUsers.length;

  const countBadge = document.getElementById('users-count-badge');
  const panelBadge = document.getElementById('users-badge');
  if (countBadge) countBadge.textContent = `${totalCount}/${MAX_USERS}`;
  if (panelBadge) panelBadge.textContent = `${totalCount}/${MAX_USERS}`;

  document.getElementById('my-speed-stat').textContent = `${(state.myUser.speed || 0).toFixed(1)} km/h`;
  document.getElementById('my-ele-stat').textContent = `${Math.round(state.myUser.ele || 0)} m`;
  document.getElementById('my-battery-stat').textContent = `${state.myUser.battery || 92}%`;

  const otherUsersList = Array.from(state.otherUsers.values());

  if (otherUsersList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        <i data-lucide="user-x" class="w-6 h-6 mx-auto mb-1.5 opacity-50"></i>
        Aucun autre randonneur connecté.<br/>Partagez le code <b class="text-emerald-400">${state.roomCode}</b> en 4G.
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = otherUsersList.map(u => {
    const dist = calculateDistance(state.myUser.lat, state.myUser.lon, u.lat, u.lon);
    const distStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;

    return `
      <div class="p-2.5 rounded-xl bg-slate-800/80 border ${u.isSos ? 'border-red-500/60 bg-red-950/20' : 'border-slate-700'} hover:border-slate-500 transition flex items-center justify-between cursor-pointer" onclick="centerOnUser('${u.id}')">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow relative" style="background-color: ${u.color || '#3b82f6'}">
            ${u.icon || '🥾'}
            ${u.isSos ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 border border-white animate-ping"></span>' : ''}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-xs sm:text-sm text-white truncate">${u.name}</span>
              ${u.isSos ? '<span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-600 text-white animate-pulse">SOS</span>' : ''}
            </div>
            <div class="text-[11px] text-slate-400 truncate">${u.role}</div>
          </div>
        </div>

        <div class="text-right text-xs shrink-0">
          <div class="font-bold text-blue-400">${distStr}</div>
          <div class="text-[10px] text-slate-400 flex items-center justify-end gap-1">
            <span>${(u.speed || 0).toFixed(1)} km/h</span>
            <span>•</span>
            <span class="${u.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${u.battery}%</span>
          </div>
        </div>
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
  if (marker) {
    marker.openPopup();
  }
}

// ============================================================================
// SYNCHRONISATION 4G (WebRTC PeerJS + WebSockets + BroadcastChannel)
// ============================================================================

function initRealtimeSync() {
  // 1. Détecter le code de salon dans l'URL ou localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room') || window.location.hash.replace('#room=', '');
  if (roomParam) {
    state.roomCode = roomParam.toUpperCase().trim();
  } else {
    const savedRoom = localStorage.getItem('rando_room_code');
    if (savedRoom) state.roomCode = savedRoom;
  }
  updateRoomDisplay();

  // 2. BroadcastChannel pour synchronisation immédiate multi-onglets en local
  try {
    state.broadcastChannel = new BroadcastChannel(`rando_channel_${state.roomCode}`);
    state.broadcastChannel.onmessage = (event) => {
      handleIncomingRealtimeMessage(event.data);
    };
  } catch (e) {
    console.warn('BroadcastChannel non supporté:', e);
  }

  // 3. WebSocket vers le serveur local (si disponible)
  connectWebSocket();

  // 4. Initialisation WebRTC PeerJS pour la 4G distante entre téléphones
  initPeerJS();
}

function updateRoomDisplay() {
  const badge = document.getElementById('active-room-name');
  const preview = document.getElementById('preview-room-code');
  const input = document.getElementById('input-room-code');
  if (badge) badge.textContent = state.roomCode;
  if (preview) preview.textContent = state.roomCode;
  if (input) input.value = state.roomCode;
  localStorage.setItem('rando_room_code', state.roomCode);
}

function initPeerJS() {
  if (typeof Peer === 'undefined') return;

  try {
    // ID unique basé sur le code de salon
    const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const myPeerId = `${sanitizedRoom}_${state.myUser.id}`;

    if (state.peer) {
      state.peer.destroy();
    }

    state.peer = new Peer(myPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    state.peer.on('open', (id) => {
      console.log('[PeerJS 4G] Connecté avec ID:', id);
      document.getElementById('connection-status-dot').className = 'inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      document.getElementById('connection-status-text').textContent = `4G Live (${state.roomCode})`;
    });

    state.peer.on('connection', (conn) => {
      setupPeerConnection(conn);
    });

    state.peer.on('error', (err) => {
      console.warn('[PeerJS 4G] Notice:', err.type);
    });
  } catch (err) {
    console.warn('[PeerJS] Erreur initialisation:', err);
  }
}

function setupPeerConnection(conn) {
  state.peerConnections.set(conn.peer, conn);

  conn.on('open', () => {
    // Envoyer ma position au pair
    conn.send({
      type: 'update_position',
      user: state.myUser
    });
  });

  conn.on('data', (data) => {
    handleIncomingRealtimeMessage(data);
  });

  conn.on('close', () => {
    state.peerConnections.delete(conn.peer);
  });
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
      broadcastMyPosition();
    };

    state.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingRealtimeMessage(data);
      } catch (err) {}
    };

    state.ws.onclose = () => {
      setTimeout(connectWebSocket, 5000);
    };
  } catch (e) {}
}

function broadcastMyPosition() {
  state.myUser.lastSeen = Date.now();
  createOrUpdateUserMarker(state.myUser);
  renderUsersList();

  const payload = {
    type: 'update_position',
    room: state.roomCode,
    user: state.myUser
  };

  // 1. Broadcast WebSocket (serveur)
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }

  // 2. Broadcast WebRTC 4G direct
  state.peerConnections.forEach((conn) => {
    if (conn.open) {
      try { conn.send(payload); } catch (e) {}
    }
  });

  // 3. Broadcast multi-onglets local
  if (state.broadcastChannel) {
    state.broadcastChannel.postMessage(payload);
  }
}

function handleIncomingRealtimeMessage(data) {
  if (!data || !data.type) return;

  if (data.type === 'init_state' && Array.isArray(data.users)) {
    data.users.forEach(u => {
      if (u.id !== state.myUser.id && state.otherUsers.size < (MAX_USERS - 1)) {
        state.otherUsers.set(u.id, u);
        createOrUpdateUserMarker(u);
      }
    });
    renderUsersList();
  } else if (data.type === 'update_position' || data.type === 'user_updated') {
    const user = data.user;
    if (user && user.id !== state.myUser.id) {
      if (state.otherUsers.size < (MAX_USERS - 1) || state.otherUsers.has(user.id)) {
        state.otherUsers.set(user.id, user);
        createOrUpdateUserMarker(user);
        renderUsersList();
      }
    }
  } else if (data.type === 'user_left') {
    state.otherUsers.delete(data.userId);
    removeUserMarker(data.userId);
    renderUsersList();
  } else if (data.type === 'all_users_cleared') {
    state.otherUsers.forEach((_, id) => removeUserMarker(id));
    state.otherUsers.clear();
    renderUsersList();
  }
}

// ============================================================================
// GÉOLOCALISATION GPS RÉELLE
// ============================================================================
function toggleGpsTracking() {
  const btn = document.getElementById('gps-track-btn');
  const label = document.getElementById('gps-status-label');
  const icon = document.getElementById('gps-icon');

  if (state.isTrackingGps) {
    if (state.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(state.gpsWatchId);
      state.gpsWatchId = null;
    }
    state.isTrackingGps = false;
    label.textContent = 'Activer mon GPS';
    icon.classList.remove('text-emerald-400', 'animate-pulse');
    icon.classList.add('text-slate-400');
    btn.classList.remove('border-emerald-500');
  } else {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    state.isTrackingGps = true;
    label.textContent = 'GPS Actif (Suivi en cours)';
    icon.classList.remove('text-slate-400');
    icon.classList.add('text-emerald-400', 'animate-pulse');
    btn.classList.add('border-emerald-500');

    state.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        state.myUser.lat = pos.coords.latitude;
        state.myUser.lon = pos.coords.longitude;
        state.myUser.ele = pos.coords.altitude || state.myUser.ele;
        state.myUser.speed = pos.coords.speed ? (pos.coords.speed * 3.6) : state.myUser.speed;
        broadcastMyPosition();
        state.map.setView([state.myUser.lat, state.myUser.lon], 15);
      },
      (err) => {
        console.warn('Erreur GPS:', err.message);
        alert(`Information GPS : ${err.message}. Vous pouvez utiliser la simulation pour tester.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );
  }
}

// ============================================================================
// MOTEUR DE SIMULATION MULTI-RANDONNEURS (Pour tester jusqu'à 10 marcheurs)
// ============================================================================
const SIMULATED_NAMES = [
  { name: 'Claire Martin', role: 'Guide adjointe', icon: '🦊', color: '#dc2626' },
  { name: 'Lucas Bernard', role: 'Randonneur (Niv 1)', icon: '🦅', color: '#2563eb' },
  { name: 'Sophie Petit', role: 'Randonneur (Niv 2)', icon: '🐻', color: '#d97706' },
  { name: 'Thomas Roux', role: 'Randonneur (Niv 3)', icon: '🐺', color: '#9333ea' },
  { name: 'Camille Leroy', role: 'Serre-file', icon: '🏔️', color: '#0d9488' },
  { name: 'Maxime Dubois', role: 'Randonneur', icon: '🥾', color: '#4f46e5' }
];

function toggleSimulation() {
  const btn = document.getElementById('toggle-simulation-btn');
  const btnText = document.getElementById('sim-btn-text');

  if (state.isSimulating) {
    clearInterval(state.simulationInterval);
    state.isSimulating = false;
    btn.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40');
    btn.classList.add('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');
    btnText.textContent = 'Simuler 6 randonneurs';
  } else {
    if (state.tracks.length === 0) {
      alert('Veuillez d\'abord charger au moins une trace GPX (ou cliquer sur "Démo").');
      return;
    }

    state.isSimulating = true;
    btn.classList.remove('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');
    btn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40');
    btnText.textContent = 'Arrêter simulation';

    const simUsers = [];
    SIMULATED_NAMES.forEach((cfg, i) => {
      const track = state.tracks[i % state.tracks.length];
      const stepProgression = Math.floor((track.points.length / (SIMULATED_NAMES.length + 1)) * (i + 1));
      const pt = track.points[stepProgression] || track.points[0];

      simUsers.push({
        id: `sim_user_${i}`,
        name: cfg.name,
        role: cfg.role,
        icon: cfg.icon,
        color: cfg.color,
        trackId: track.id,
        pointIndex: stepProgression,
        lat: pt.lat,
        lon: pt.lon,
        ele: pt.ele,
        speed: 3.8 + (Math.random() * 1.4),
        battery: 95 - (i * 6),
        isSos: i === 3 && Math.random() > 0.7,
        lastSeen: Date.now()
      });
    });

    simUsers.forEach(u => {
      state.otherUsers.set(u.id, u);
      createOrUpdateUserMarker(u);
    });
    renderUsersList();

    state.simulationInterval = setInterval(() => {
      simUsers.forEach(u => {
        const track = state.tracks.find(t => t.id === u.trackId) || state.tracks[0];
        if (!track || track.points.length === 0) return;

        u.pointIndex = (u.pointIndex + 1) % track.points.length;
        const pt = track.points[u.pointIndex];

        u.lat = pt.lat;
        u.lon = pt.lon;
        u.ele = pt.ele;
        u.speed = 3.6 + Math.sin(u.pointIndex) * 1.2;
        u.lastSeen = Date.now();

        state.otherUsers.set(u.id, u);
        createOrUpdateUserMarker(u);
      });
      renderUsersList();
    }, 2000);
  }
}

function clearSimulatedUsers() {
  const simIds = [];
  state.otherUsers.forEach((_, id) => {
    if (id.startsWith('sim_user_')) {
      simIds.push(id);
    }
  });

  simIds.forEach(id => {
    state.otherUsers.delete(id);
    removeUserMarker(id);
  });

  if (state.isSimulating) {
    toggleSimulation();
  }

  renderUsersList();
}

// ============================================================================
// CHARGEMENT DES FICHIERS DE DÉMONSTRATION PAR DÉFAUT
// ============================================================================
async function loadDemoTracks() {
  const demoFiles = [
    { url: 'tracks/parcours_1_vert_6km.gpx', name: 'Niveau 1 - Boucle Découverte (6 km)' },
    { url: 'tracks/parcours_2_bleu_12km.gpx', name: 'Niveau 2 - Balcon Panoramique (12 km)' },
    { url: 'tracks/parcours_3_rouge_18km.gpx', name: 'Niveau 3 - Traversée des Crêtes (18 km)' }
  ];

  for (const item of demoFiles) {
    try {
      const resp = await fetch(item.url);
      if (resp.ok) {
        const xmlText = await resp.text();
        const parsed = parseGpxContent(xmlText, item.name);
        addTrackToState(parsed);
      }
    } catch (err) {
      console.warn(`Impossible de charger ${item.url}:`, err);
    }
  }
}

// ============================================================================
// GESTIONNAIRES D'ÉVÉNEMENTS & UI
// ============================================================================
function setupEventListeners() {
  document.getElementById('map-btn-ign').addEventListener('click', () => setBaseLayer('ign'));
  document.getElementById('map-btn-opentopo').addEventListener('click', () => setBaseLayer('opentopo'));
  document.getElementById('map-btn-satellite').addEventListener('click', () => setBaseLayer('satellite'));
  document.getElementById('map-btn-osm').addEventListener('click', () => setBaseLayer('osm'));

  const mobileMapBtn = document.getElementById('mobile-map-select-btn');
  const mobileMapModal = document.getElementById('mobile-map-modal');
  mobileMapBtn.addEventListener('click', () => {
    mobileMapModal.classList.toggle('hidden');
  });

  document.querySelectorAll('.mobile-map-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.getAttribute('data-layer');
      setBaseLayer(layer);
      mobileMapModal.classList.add('hidden');
    });
  });

  const tracksPanel = document.getElementById('tracks-panel');
  const usersPanel = document.getElementById('users-panel');

  document.getElementById('toggle-tracks-panel-btn').addEventListener('click', () => {
    tracksPanel.classList.toggle('-translate-x-[110%]');
    tracksPanel.classList.toggle('translate-x-0');
  });

  document.getElementById('close-tracks-panel-btn').addEventListener('click', () => {
    tracksPanel.classList.add('-translate-x-[110%]');
    tracksPanel.classList.remove('translate-x-0');
  });

  document.getElementById('toggle-users-panel-btn').addEventListener('click', () => {
    usersPanel.classList.toggle('translate-x-[110%]');
    usersPanel.classList.toggle('translate-x-0');
  });

  document.getElementById('close-users-panel-btn').addEventListener('click', () => {
    usersPanel.classList.add('translate-x-[110%]');
    usersPanel.classList.remove('translate-x-0');
  });

  document.getElementById('fit-all-btn').addEventListener('click', fitAllTracks);
  document.getElementById('gps-track-btn').addEventListener('click', toggleGpsTracking);
  document.getElementById('toggle-simulation-btn').addEventListener('click', toggleSimulation);
  document.getElementById('clear-sim-users-btn').addEventListener('click', clearSimulatedUsers);

  document.getElementById('load-sample-tracks-btn').addEventListener('click', () => {
    state.tracks.forEach(t => {
      const l = state.trackLayers.get(t.id);
      if (l) state.map.removeLayer(l);
    });
    state.tracks = [];
    state.trackLayers.clear();
    loadDemoTracks();
  });

  const gpxInput = document.getElementById('gpx-file-input');
  gpxInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (state.tracks.length >= MAX_TRACKS) {
        alert(`Vous ne pouvez pas charger plus de ${MAX_TRACKS} traces GPX simultanément.`);
        break;
      }
      try {
        const text = await file.text();
        const parsed = parseGpxContent(text, file.name);
        addTrackToState(parsed);
      } catch (err) {
        alert(`Erreur lors du traitement de ${file.name} : ${err.message}`);
      }
    }
    gpxInput.value = '';
  });

  document.getElementById('close-ele-drawer-btn').addEventListener('click', () => {
    document.getElementById('elevation-drawer').classList.add('hidden');
    if (state.hoverMarker) {
      state.map.removeLayer(state.hoverMarker);
      state.hoverMarker = null;
    }
  });

  const sosBtn = document.getElementById('sos-toggle-btn');
  const sosText = document.getElementById('sos-btn-text');
  sosBtn.addEventListener('click', () => {
    state.myUser.isSos = !state.myUser.isSos;
    if (state.myUser.isSos) {
      sosBtn.classList.remove('bg-red-600/20', 'text-red-400');
      sosBtn.classList.add('bg-red-600', 'text-white', 'animate-pulse');
      sosText.textContent = '⚠️ SOS ACTIF (Annuler)';
    } else {
      sosBtn.classList.add('bg-red-600/20', 'text-red-400');
      sosBtn.classList.remove('bg-red-600', 'text-white', 'animate-pulse');
      sosText.textContent = 'Signaler Problème / SOS';
    }
    broadcastMyPosition();
  });

  // Gestion Modal Code de Salon 4G
  const roomModal = document.getElementById('room-modal');
  const openRoomBtn = document.getElementById('open-room-btn');
  const closeRoomModalBtn = document.getElementById('close-room-modal-btn');
  const cancelRoomBtn = document.getElementById('cancel-room-btn');
  const saveRoomBtn = document.getElementById('save-room-btn');
  const inputRoomCode = document.getElementById('input-room-code');

  openRoomBtn.addEventListener('click', () => {
    inputRoomCode.value = state.roomCode;
    roomModal.classList.remove('hidden');
  });

  const closeRoom = () => roomModal.classList.add('hidden');
  closeRoomModalBtn.addEventListener('click', closeRoom);
  cancelRoomBtn.addEventListener('click', closeRoom);

  saveRoomBtn.addEventListener('click', () => {
    const val = inputRoomCode.value.toUpperCase().trim();
    if (val) {
      state.roomCode = val;
      updateRoomDisplay();
      initPeerJS();
      closeRoom();
    }
  });

  // Modal Profil
  const profileModal = document.getElementById('profile-modal');
  const openProfileBtn = document.getElementById('open-profile-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
  const cancelProfileBtn = document.getElementById('cancel-profile-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');

  const openProfile = () => {
    document.getElementById('input-user-name').value = state.myUser.name;
    document.getElementById('input-user-role').value = state.myUser.role;
    profileModal.classList.remove('hidden');
  };

  openProfileBtn.addEventListener('click', openProfile);
  editProfileBtn.addEventListener('click', openProfile);

  const closeProfile = () => profileModal.classList.add('hidden');
  closeProfileModalBtn.addEventListener('click', closeProfile);
  cancelProfileBtn.addEventListener('click', closeProfile);

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-opt').forEach(b => b.classList.replace('border-white', 'border-transparent'));
      btn.classList.replace('border-transparent', 'border-white');
      state.myUser.color = btn.getAttribute('data-color');
      state.myUser.icon = btn.getAttribute('data-icon');
    });
  });

  saveProfileBtn.addEventListener('click', () => {
    const name = document.getElementById('input-user-name').value.trim();
    const role = document.getElementById('input-user-role').value;
    if (name) state.myUser.name = name;
    if (role) state.myUser.role = role;

    document.getElementById('header-user-name').textContent = `${state.myUser.name} (Moi)`;
    document.getElementById('header-user-role').textContent = state.myUser.role;
    document.getElementById('header-avatar-badge').textContent = state.myUser.icon;
    document.getElementById('header-avatar-badge').style.backgroundColor = state.myUser.color;

    document.getElementById('my-name-display').textContent = state.myUser.name;
    document.getElementById('my-role-display').textContent = state.myUser.role;
    document.getElementById('my-avatar-display').textContent = state.myUser.icon;
    document.getElementById('my-avatar-display').style.backgroundColor = state.myUser.color;

    closeProfile();
    broadcastMyPosition();
  });
}

// ============================================================================
// DÉMARRAGE DE L'APPLICATION
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  initPWA();
  initMap();
  setupEventListeners();
  initRealtimeSync();

  createOrUpdateUserMarker(state.myUser);
  renderUsersList();

  await loadDemoTracks();
  lucide.createIcons();
});
