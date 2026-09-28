/**
 * RandoTracker - Application Mobile PWA & Suivi de Randonnée Multi-Groupes 4G
 * Cartographie IGN / OpenTopoMap, Traces GPX, Géolocalisation Auto & Invitations QR Code
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
  tracks: [],
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
  otherUsers: new Map(),
  userMarkers: new Map(),
  trackLayers: new Map(),
  chartInstance: null,
  isTrackingGps: false,
  gpsWatchId: null,
  accuracyCircle: null,
  isSimulating: false,
  simulationInterval: null,
  ws: null,
  broadcastChannel: null,
  peer: null,
  peerConnections: new Map(),
  hoverMarker: null,
  activeDrawer: null,
  qrCodeInstance: null
};

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(msg, type = 'info') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800';
  toast.className = `fixed top-24 left-1/2 -translate-x-1/2 z-50 ${bgColor} text-white text-sm sm:text-base font-black px-5 py-3 rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-3 transition-all duration-300 transform translate-y-0`;
  toast.innerHTML = `
    <span>${type === 'success' ? '📍' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${msg}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

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
}

// ============================================================================
// INITIALISATION DE LA CARTE & DES FONDS DE CARTE
// ============================================================================
function initMap() {
  state.map = L.map('map', {
    center: [45.8960, 6.1680],
    zoom: 13,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  // 1. Fond IGN Géoplateforme (Plan IGN V2 Open)
  state.layers.ign = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.ign.fr/" target="_blank">IGN</a>'
    }
  );

  // 2. Fond OpenTopoMap (Courbes de niveau & Sentiers)
  state.layers.opentopo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap'
    }
  );

  // 3. Fond IGN Orthophoto (Photos Aériennes Satellite)
  state.layers.satellite = L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    {
      maxZoom: 19,
      attribution: '&copy; IGN Satellite'
    }
  );

  // 4. Fond OpenStreetMap standard
  state.layers.osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }
  );

  state.layers.ign.addTo(state.map);

  // Support Glisser-Déposer de fichiers GPX directement sur la carte
  const mapDiv = document.getElementById('map');
  mapDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  mapDiv.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.gpx')) {
        const text = await file.text();
        const parsed = parseGpxContent(text, file.name);
        addTrackToState(parsed);
      }
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
// GESTION DU PARSING & CHARGEMENT DE JUSQU'À 5 TRACES GPX
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
    alert(`Limite de ${MAX_TRACKS} traces atteinte. Veuillez en supprimer une avant d'en ajouter.`);
    return false;
  }

  const colorIndex = state.tracks.length % TRACK_COLORS.length;
  track.color = TRACK_COLORS[colorIndex];

  state.tracks.push(track);
  renderTrackOnMap(track);
  renderTracksList();
  updateTracksBadge();
  fitAllTracks();
  showToast(`Trace ajoutée : ${track.name}`, 'success');
  return true;
}

function renderTrackOnMap(track) {
  const layerGroup = L.layerGroup();
  const latlngs = track.points.map(p => [p.lat, p.lon]);

  const borderPolyline = L.polyline(latlngs, {
    color: '#0f172a',
    weight: 8,
    opacity: 0.75,
    lineCap: 'round',
    lineJoin: 'round'
  });

  const mainPolyline = L.polyline(latlngs, {
    color: track.color.hex,
    weight: 5,
    opacity: 0.98,
    lineCap: 'round',
    lineJoin: 'round'
  });

  mainPolyline.bindPopup(`
    <div class="space-y-2 p-1 min-w-[210px]">
      <div class="flex items-center gap-2.5">
        <span class="w-4 h-4 rounded-full shadow" style="background-color: ${track.color.hex}"></span>
        <h4 class="font-black text-base text-white">${track.name}</h4>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm text-slate-200 pt-2 border-t border-slate-700">
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
      html: `<div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-xs font-black text-white shadow-lg">D</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon }).bindTooltip(`Départ : ${track.name}`, { direction: 'top' });
    layerGroup.addLayer(startMarker);
  }

  // Marqueur Arrivée
  if (track.points.length > 1) {
    const endPt = track.points[track.points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `<div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-sm font-black text-white shadow-lg">🏁</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
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
  closeAllDrawers();
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
    state.map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function renderTracksList() {
  const container = document.getElementById('tracks-list-container');
  if (!container) return;

  if (state.tracks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400 text-sm font-semibold">
        <i data-lucide="map-pin-off" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
        Aucune trace GPX chargée.<br/>Cliquez sur "Charger GPX" pour en ajouter jusqu'à 5.
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.tracks.map((track) => `
    <div class="p-4 sm:p-5 rounded-3xl bg-slate-800/90 border-2 ${track.visible ? 'border-slate-700' : 'border-slate-800 opacity-60'} hover:border-slate-500 transition flex flex-col gap-3 shadow-xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-5 h-5 rounded-full shrink-0 shadow-md" style="background-color: ${track.color.hex}"></span>
          <h4 class="font-black text-base sm:text-lg text-white truncate" title="${track.name}">${track.name}</h4>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="zoomToTrack('${track.id}')" class="p-2.5 rounded-2xl text-slate-200 hover:text-white bg-slate-750 hover:bg-slate-700 active:scale-90 border border-slate-700 shadow" title="Centrer la carte sur cette trace">
            <i data-lucide="focus" class="w-5 h-5"></i>
          </button>
          <button onclick="toggleTrackVisibility('${track.id}')" class="p-2.5 rounded-2xl text-slate-200 hover:text-white bg-slate-750 hover:bg-slate-700 active:scale-90 border border-slate-700 shadow" title="${track.visible ? 'Masquer' : 'Afficher'}">
            <i data-lucide="${track.visible ? 'eye' : 'eye-off'}" class="w-5 h-5"></i>
          </button>
          <button onclick="removeTrack('${track.id}')" class="p-2.5 rounded-2xl text-slate-400 hover:text-red-400 bg-slate-750 hover:bg-slate-700 active:scale-90 border border-slate-700 shadow" title="Supprimer">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs sm:text-sm text-slate-200 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
        <div class="flex items-center gap-2.5">
          <i data-lucide="navigation" class="w-5 h-5 text-emerald-400"></i>
          <span>Distance : <b class="text-white text-base">${track.totalDistance.toFixed(1)} km</b></span>
        </div>
        <div class="flex items-center gap-2.5">
          <i data-lucide="trending-up" class="w-5 h-5 text-emerald-400"></i>
          <span>D+ : <b class="text-emerald-400 text-base">+${track.eleGain} m</b></span>
        </div>
      </div>

      <button onclick="openElevationDrawer('${track.id}')" class="w-full py-3 px-4 rounded-2xl bg-slate-700/80 hover:bg-slate-700 text-slate-100 text-sm font-black flex items-center justify-center gap-2.5 transition active:scale-98 shadow-md">
        <i data-lucide="bar-chart-2" class="w-5 h-5 text-emerald-400"></i>
        <span>Voir le Profil Altimétrique</span>
      </button>
    </div>
  `).join('');

  lucide.createIcons();
}

function updateTracksBadge() {
  const count = state.tracks.length;
  const panelBadge = document.getElementById('tracks-badge');
  const navBadge = document.getElementById('nav-tracks-badge');
  if (panelBadge) panelBadge.textContent = `${count}/${MAX_TRACKS}`;
  if (navBadge) navBadge.textContent = count;
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
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
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
  marker.bindPopup(`
    <div class="p-1 space-y-2.5 min-w-[230px]">
      <div class="flex items-center gap-3 pb-2.5 border-b border-slate-700">
        <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white shadow-lg" style="background-color: ${user.color}">
          ${user.icon || '🌲'}
        </div>
        <div>
          <div class="font-black text-base text-white">${user.name} ${isMe ? '(Moi)' : ''}</div>
          <div class="text-xs text-emerald-400 font-bold">${user.role}</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5 text-sm text-slate-200">
        <div>Vitesse : <b class="text-white">${(user.speed || 0).toFixed(1)} km/h</b></div>
        <div>Altitude : <b class="text-white">${Math.round(user.ele || 0)} m</b></div>
        <div>Batterie : <b class="${user.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${user.battery || 90}%</b></div>
        <div>Écart : <b class="text-blue-400">${isMe ? '0 m' : distFromMe < 1 ? Math.round(distFromMe * 1000) + ' m' : distFromMe.toFixed(1) + ' km'}</b></div>
      </div>

      ${user.isSos ? `
        <div class="p-2.5 rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-300 text-xs font-black flex items-center gap-2">
          <i data-lucide="alert-triangle" class="w-5 h-5 text-red-400"></i>
          <span>ALERTE SOS SIGNALÉE !</span>
        </div>
      ` : ''}

      <div class="text-[11px] text-slate-400 pt-1 border-t border-slate-800 text-right">
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

  const panelBadge = document.getElementById('users-badge');
  const navBadge = document.getElementById('nav-users-badge');
  if (panelBadge) panelBadge.textContent = `${totalCount}/${MAX_USERS}`;
  if (navBadge) navBadge.textContent = totalCount;

  document.getElementById('my-speed-stat').textContent = `${(state.myUser.speed || 0).toFixed(1)} km/h`;
  document.getElementById('my-ele-stat').textContent = `${Math.round(state.myUser.ele || 0)} m`;
  document.getElementById('my-battery-stat').textContent = `${state.myUser.battery || 92}%`;

  const otherUsersList = Array.from(state.otherUsers.values());

  if (otherUsersList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-sm font-semibold">
        <i data-lucide="user-x" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
        Aucun autre randonneur connecté pour le moment.<br/>
        Cliquez sur <b class="text-blue-400">« Inviter des participants »</b> pour partager le QR Code.
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = otherUsersList.map(u => {
    const dist = calculateDistance(state.myUser.lat, state.myUser.lon, u.lat, u.lon);
    const distStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;

    return `
      <div class="p-4 rounded-3xl bg-slate-800/90 border-2 ${u.isSos ? 'border-red-500/80 bg-red-950/30' : 'border-slate-700'} hover:border-slate-500 transition flex items-center justify-between cursor-pointer active:scale-98 shadow-xl" onclick="centerOnUser('${u.id}')">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-lg relative border-2 border-white/90" style="background-color: ${u.color || '#3b82f6'}">
            ${u.icon || '🥾'}
            ${u.isSos ? '<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white animate-ping"></span>' : ''}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-black text-base sm:text-lg text-white truncate">${u.name}</span>
              ${u.isSos ? '<span class="text-xs font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">SOS</span>' : ''}
            </div>
            <div class="text-xs sm:text-sm text-slate-300 font-semibold truncate">${u.role}</div>
          </div>
        </div>

        <div class="text-right shrink-0">
          <div class="font-black text-base sm:text-lg text-blue-400">${distStr}</div>
          <div class="text-xs sm:text-sm text-slate-300 font-bold flex items-center justify-end gap-1.5 mt-0.5">
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
  closeAllDrawers();
}

// ============================================================================
// GESTION DES TIROIRS / PANNEAUX MOBILES
// ============================================================================
function openDrawer(panelName) {
  const tracksPanel = document.getElementById('tracks-panel');
  const usersPanel = document.getElementById('users-panel');
  const backdrop = document.getElementById('drawer-backdrop');

  if (panelName === 'tracks') {
    tracksPanel.classList.remove('drawer-closed');
    tracksPanel.classList.add('drawer-open');
    usersPanel.classList.add('drawer-closed');
    usersPanel.classList.remove('drawer-open');
    state.activeDrawer = 'tracks';
    if (backdrop) backdrop.classList.remove('hidden');

    document.getElementById('nav-btn-tracks').classList.add('text-emerald-400');
    document.getElementById('nav-btn-users').classList.remove('text-emerald-400');
    document.getElementById('nav-btn-map').classList.remove('text-emerald-400');
  } else if (panelName === 'users') {
    usersPanel.classList.remove('drawer-closed');
    usersPanel.classList.add('drawer-open');
    tracksPanel.classList.add('drawer-closed');
    tracksPanel.classList.remove('drawer-open');
    state.activeDrawer = 'users';
    if (backdrop) backdrop.classList.remove('hidden');

    document.getElementById('nav-btn-users').classList.add('text-emerald-400');
    document.getElementById('nav-btn-tracks').classList.remove('text-emerald-400');
    document.getElementById('nav-btn-map').classList.remove('text-emerald-400');
  }
}

function closeAllDrawers() {
  const tracksPanel = document.getElementById('tracks-panel');
  const usersPanel = document.getElementById('users-panel');
  const backdrop = document.getElementById('drawer-backdrop');

  if (tracksPanel) {
    tracksPanel.classList.add('drawer-closed');
    tracksPanel.classList.remove('drawer-open');
  }
  if (usersPanel) {
    usersPanel.classList.add('drawer-closed');
    usersPanel.classList.remove('drawer-open');
  }
  if (backdrop) backdrop.classList.add('hidden');

  state.activeDrawer = null;

  document.getElementById('nav-btn-map').classList.add('text-emerald-400');
  document.getElementById('nav-btn-tracks').classList.remove('text-emerald-400');
  document.getElementById('nav-btn-users').classList.remove('text-emerald-400');
}

// ============================================================================
// GÉOLOCALISATION GPS AUTOMATIQUE & INSTANTANÉE
// ============================================================================
function startGpsWatch(useHighAccuracy = true) {
  const navBubble = document.getElementById('nav-gps-bubble');
  const navIcon = document.getElementById('nav-gps-icon');
  const navLabel = document.getElementById('nav-gps-label');
  const bannerText = document.getElementById('gps-banner-text');

  if (navLabel) navLabel.textContent = 'Recherche...';
  if (navBubble) navBubble.className = 'w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center';
  if (navIcon) navIcon.className = 'w-8 h-8 text-amber-400 animate-spin';
  if (bannerText) bannerText.textContent = '📍 Recherche de vos coordonnées GPS...';

  const onPositionSuccess = (pos) => {
    state.isTrackingGps = true;
    state.myUser.lat = pos.coords.latitude;
    state.myUser.lon = pos.coords.longitude;
    state.myUser.ele = pos.coords.altitude !== null && !isNaN(pos.coords.altitude) ? Math.round(pos.coords.altitude) : state.myUser.ele;
    state.myUser.speed = pos.coords.speed ? (pos.coords.speed * 3.6) : 0.0;
    state.myUser.accuracy = pos.coords.accuracy || 10;

    const accStr = `±${Math.round(pos.coords.accuracy)}m`;
    if (navLabel) navLabel.textContent = `GPS (${accStr})`;
    if (navBubble) navBubble.className = 'w-16 h-16 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-2xl animate-pulse';
    if (navIcon) navIcon.className = 'w-8 h-8 text-white';
    if (bannerText) bannerText.textContent = `📍 Position GPS verrouillée (${accStr})`;

    // Cercle vert de précision
    if (!state.accuracyCircle) {
      state.accuracyCircle = L.circle([state.myUser.lat, state.myUser.lon], {
        radius: pos.coords.accuracy || 20,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.14,
        weight: 2
      }).addTo(state.map);
    } else {
      state.accuracyCircle.setLatLng([state.myUser.lat, state.myUser.lon]);
      state.accuracyCircle.setRadius(pos.coords.accuracy || 20);
    }

    broadcastMyPosition();
    state.map.setView([state.myUser.lat, state.myUser.lon], 16, { animate: true });
    showToast(`GPS connecté (Précision : ${accStr})`, 'success');
  };

  const onPositionError = (err) => {
    console.warn(`[GPS] Erreur (${useHighAccuracy}):`, err.code, err.message);

    if (useHighAccuracy) {
      console.log('[GPS] Bascule en mode normal...');
      startGpsWatch(false);
      return;
    }

    stopGpsWatch();
    let explication = err.message;
    if (err.code === 1) {
      explication = "Autorisation GPS refusée. Veuillez autoriser l'accès à la position dans votre navigateur.";
    } else if (err.code === 2) {
      explication = "Signal GPS indisponible. Activez le service de localisation de votre appareil.";
    } else if (err.code === 3) {
      explication = "Délai de réponse GPS dépassé.";
    }

    if (bannerText) bannerText.textContent = `⚠️ GPS : ${explication}`;
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
  state.isTrackingGps = false;

  const navBubble = document.getElementById('nav-gps-bubble');
  const navIcon = document.getElementById('nav-gps-icon');
  const navLabel = document.getElementById('nav-gps-label');
  const bannerText = document.getElementById('gps-banner-text');

  if (navLabel) navLabel.textContent = 'Mon GPS';
  if (navBubble) navBubble.className = 'w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-xl';
  if (navIcon) navIcon.className = 'w-8 h-8 text-slate-300';
  if (bannerText) bannerText.textContent = 'GPS désactivé. Appuyez sur « Mon GPS » pour activer.';
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
    startGpsWatch(true);
  }
}

// ============================================================================
// SYSTÈME D'INVITATION DES PARTICIPANTS (QR CODE + WHATSAPP / SMS)
// ============================================================================
function getInviteUrl() {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}#room=${state.roomCode}`;
}

function openInviteModal() {
  const modal = document.getElementById('invite-modal');
  const urlDisplay = document.getElementById('invite-room-url');
  const qrcodeContainer = document.getElementById('qrcode');
  const inviteUrl = getInviteUrl();

  urlDisplay.textContent = inviteUrl;
  qrcodeContainer.innerHTML = '';

  // Générer le QR Code
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
      // Fallback API QR
      qrcodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}" alt="QR Code" class="w-[220px] h-[220px] rounded-xl" />`;
    }
  } catch (e) {
    qrcodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}" alt="QR Code" class="w-[220px] h-[220px] rounded-xl" />`;
  }

  modal.classList.remove('hidden');
}

async function shareInviteLink() {
  const inviteUrl = getInviteUrl();
  const title = `RandoTracker - Salon ${state.roomCode}`;
  const text = `Rejoins notre randonnée en direct sur la carte détaillée avec le salon ${state.roomCode} :`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text,
        url: inviteUrl
      });
      showToast('Invitation partagée !', 'success');
      return;
    } catch (err) {
      // L'utilisateur a annulé ou le partage a échoué
    }
  }

  // Fallback : Copie dans le presse-papier
  copyInviteLink();
}

function copyInviteLink() {
  const inviteUrl = getInviteUrl();
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast('Lien copié dans le presse-papier !', 'success');
  }).catch(() => {
    prompt('Copiez ce lien d\'invitation :', inviteUrl);
  });
}

// ============================================================================
// SYNCHRONISATION 4G & SALONS
// ============================================================================
function initRealtimeSync() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room') || window.location.hash.replace('#room=', '');
  if (roomParam) {
    state.roomCode = roomParam.toUpperCase().trim();
  } else {
    const savedRoom = localStorage.getItem('rando_room_code');
    if (savedRoom) state.roomCode = savedRoom;
  }
  updateRoomDisplay();

  try {
    state.broadcastChannel = new BroadcastChannel(`rando_${state.roomCode}`);
    state.broadcastChannel.onmessage = (event) => handleIncomingMessage(event.data);
  } catch (e) {}

  connectWebSocket();
  initPeerJS();
}

function updateRoomDisplay() {
  const badge = document.getElementById('active-room-name');
  const input = document.getElementById('input-room-code');
  if (badge) badge.textContent = state.roomCode;
  if (input) input.value = state.roomCode;
  localStorage.setItem('rando_room_code', state.roomCode);
}

function initPeerJS() {
  if (typeof Peer === 'undefined') return;

  try {
    const sanitizedRoom = state.roomCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const myPeerId = `${sanitizedRoom}_${state.myUser.id}`;

    if (state.peer) state.peer.destroy();

    state.peer = new Peer(myPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    state.peer.on('connection', (conn) => {
      state.peerConnections.set(conn.peer, conn);
      conn.on('open', () => conn.send({ type: 'update_position', user: state.myUser }));
      conn.on('data', (data) => handleIncomingMessage(data));
      conn.on('close', () => state.peerConnections.delete(conn.peer));
    });
  } catch (err) {}
}

function connectWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    state.ws.onopen = () => broadcastMyPosition();
    state.ws.onmessage = (event) => {
      try { handleIncomingMessage(JSON.parse(event.data)); } catch (e) {}
    };
    state.ws.onclose = () => setTimeout(connectWebSocket, 5000);
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

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }

  state.peerConnections.forEach((conn) => {
    if (conn.open) {
      try { conn.send(payload); } catch (e) {}
    }
  });

  if (state.broadcastChannel) {
    state.broadcastChannel.postMessage(payload);
  }
}

function handleIncomingMessage(data) {
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
// CHARGEMENT DES TRACES PAR DÉFAUT
// ============================================================================
function generateDemoTrackPoints(centerLat, centerLon, radiusKm, numPoints, baseEle, maxEle, irregularity = 0.3) {
  const pts = [];
  let totalDist = 0;
  let eleGain = 0;
  let prevLat = null, prevLon = null, prevEle = null;

  for (let i = 0; i < numPoints; i++) {
    const t = (2 * Math.PI * i) / (numPoints - 1);
    const r = radiusKm * (1 + irregularity * Math.sin(3 * t) + 0.18 * Math.cos(5 * t));
    const dlat = (r * Math.cos(t)) / 111.0;
    const dlon = (r * Math.sin(t)) / (111.0 * Math.cos((centerLat * Math.PI) / 180));
    const lat = centerLat + dlat;
    const lon = centerLon + dlon;

    const eleRatio = 0.5 * (1 - Math.cos(2 * t)) + 0.25 * Math.sin(3 * t);
    const ele = Math.round(baseEle + (maxEle - baseEle) * Math.max(0, Math.min(1, eleRatio)));

    if (prevLat !== null) {
      const dist = calculateDistance(prevLat, prevLon, lat, lon);
      totalDist += dist;
      if (ele > prevEle) eleGain += (ele - prevEle);
    }

    pts.push({ lat, lon, ele, distanceFromStart: totalDist });
    prevLat = lat; prevLon = lon; prevEle = ele;
  }

  return { points: pts, totalDistance: totalDist, eleGain, minEle: baseEle, maxEle };
}

async function loadDemoTracks() {
  let loadedCount = 0;
  const files = [
    { url: './tracks/parcours_1_vert_6km.gpx', name: 'Niveau 1 - Boucle Découverte (6 km)' },
    { url: './tracks/parcours_2_bleu_12km.gpx', name: 'Niveau 2 - Balcon Panoramique (12 km)' },
    { url: './tracks/parcours_3_rouge_18km.gpx', name: 'Niveau 3 - Traversée des Crêtes (18 km)' }
  ];

  for (const item of files) {
    try {
      const resp = await fetch(item.url);
      if (resp.ok) {
        const text = await resp.text();
        const parsed = parseGpxContent(text, item.name);
        addTrackToState(parsed);
        loadedCount++;
      }
    } catch (e) {}
  }

  if (loadedCount === 0) {
    const p1 = generateDemoTrackPoints(45.8920, 6.1550, 1.1, 90, 450, 690, 0.25);
    addTrackToState({ id: 'demo_1', name: 'Niveau 1 - Boucle Découverte (6 km)', points: p1.points, totalDistance: p1.totalDistance, eleGain: p1.eleGain, minEle: p1.minEle, maxEle: p1.maxEle, visible: true });

    const p2 = generateDemoTrackPoints(45.8960, 6.1700, 2.2, 140, 450, 1030, 0.35);
    addTrackToState({ id: 'demo_2', name: 'Niveau 2 - Balcon Panoramique (12 km)', points: p2.points, totalDistance: p2.totalDistance, eleGain: p2.eleGain, minEle: p2.minEle, maxEle: p2.maxEle, visible: true });

    const p3 = generateDemoTrackPoints(45.9010, 6.1850, 3.4, 200, 450, 1600, 0.45);
    addTrackToState({ id: 'demo_3', name: 'Niveau 3 - Traversée des Crêtes (18 km)', points: p3.points, totalDistance: p3.totalDistance, eleGain: p3.eleGain, minEle: p3.minEle, maxEle: p3.maxEle, visible: true });
  }
}

// ============================================================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// ============================================================================
function setupEventListeners() {
  // Navigation Tab Bar en bas
  document.getElementById('nav-btn-map').addEventListener('click', () => {
    closeAllDrawers();
    fitAllTracks();
  });

  document.getElementById('nav-btn-tracks').addEventListener('click', () => {
    if (state.activeDrawer === 'tracks') closeAllDrawers();
    else openDrawer('tracks');
  });

  document.getElementById('nav-btn-users').addEventListener('click', () => {
    if (state.activeDrawer === 'users') closeAllDrawers();
    else openDrawer('users');
  });

  document.getElementById('nav-btn-gps').addEventListener('click', toggleGps);
  document.getElementById('refresh-gps-banner-btn').addEventListener('click', () => startGpsWatch(true));

  // Boutons flottants
  document.getElementById('center-my-gps-btn').addEventListener('click', () => {
    if (state.isTrackingGps) {
      state.map.setView([state.myUser.lat, state.myUser.lon], 16, { animate: true });
    } else {
      toggleGps();
    }
  });

  document.getElementById('fit-all-btn').addEventListener('click', fitAllTracks);

  // Invitations
  document.getElementById('header-invite-btn').addEventListener('click', openInviteModal);
  document.getElementById('drawer-invite-btn').addEventListener('click', openInviteModal);
  document.getElementById('close-invite-modal-btn').addEventListener('click', () => document.getElementById('invite-modal').classList.add('hidden'));
  document.getElementById('share-native-btn').addEventListener('click', shareInviteLink);
  document.getElementById('copy-link-btn').addEventListener('click', copyInviteLink);

  // Fermetures tiroirs
  document.getElementById('close-tracks-panel-btn').addEventListener('click', closeAllDrawers);
  document.getElementById('close-users-panel-btn').addEventListener('click', closeAllDrawers);
  document.getElementById('drawer-backdrop').addEventListener('click', closeAllDrawers);

  // Recharger démo
  document.getElementById('load-sample-tracks-btn').addEventListener('click', () => {
    state.tracks.forEach(t => {
      const l = state.trackLayers.get(t.id);
      if (l) state.map.removeLayer(l);
    });
    state.tracks = [];
    state.trackLayers.clear();
    loadDemoTracks();
  });

  // Import GPX Multifichiers (1 à 5)
  const gpxInput = document.getElementById('gpx-file-input');
  gpxInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    let countAdded = 0;
    for (const file of files) {
      if (state.tracks.length >= MAX_TRACKS) {
        alert(`Vous avez atteint la limite de ${MAX_TRACKS} traces GPX.`);
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
      closeAllDrawers();
    }
  });

  // Fermer profil altimétrique
  document.getElementById('close-ele-drawer-btn').addEventListener('click', () => {
    document.getElementById('elevation-drawer').classList.add('hidden');
    if (state.hoverMarker) {
      state.map.removeLayer(state.hoverMarker);
      state.hoverMarker = null;
    }
  });

  // Modale Fonds de Carte
  const layerModal = document.getElementById('layer-modal');
  document.getElementById('open-layer-modal-btn').addEventListener('click', () => layerModal.classList.remove('hidden'));
  document.getElementById('close-layer-modal-btn').addEventListener('click', () => layerModal.classList.add('hidden'));

  document.querySelectorAll('.layer-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setBaseLayer(btn.getAttribute('data-layer'));
      layerModal.classList.add('hidden');
    });
  });

  // Modale Code de Salon 4G
  const roomModal = document.getElementById('room-modal');
  const inputRoom = document.getElementById('input-room-code');
  document.getElementById('open-room-btn').addEventListener('click', () => {
    inputRoom.value = state.roomCode;
    roomModal.classList.remove('hidden');
  });
  document.getElementById('close-room-modal-btn').addEventListener('click', () => roomModal.classList.add('hidden'));
  document.getElementById('cancel-room-btn').addEventListener('click', () => roomModal.classList.add('hidden'));
  document.getElementById('save-room-btn').addEventListener('click', () => {
    const val = inputRoom.value.toUpperCase().trim();
    if (val) {
      state.roomCode = val;
      updateRoomDisplay();
      initPeerJS();
      roomModal.classList.add('hidden');
      showToast(`Salon 4G connecté : ${state.roomCode}`, 'success');
    }
  });

  // SOS
  const sosBtn = document.getElementById('sos-toggle-btn');
  const sosText = document.getElementById('sos-btn-text');
  sosBtn.addEventListener('click', () => {
    state.myUser.isSos = !state.myUser.isSos;
    if (state.myUser.isSos) {
      sosBtn.classList.remove('bg-red-600/20', 'text-red-400');
      sosBtn.classList.add('bg-red-600', 'text-white', 'animate-pulse');
      sosText.textContent = '⚠️ ALERTE SOS ACTIVE (ANNULER)';
      showToast('🚨 ALERTE SOS ENVOYÉE AU GROUPE !', 'error');
    } else {
      sosBtn.classList.add('bg-red-600/20', 'text-red-400');
      sosBtn.classList.remove('bg-red-600', 'text-white', 'animate-pulse');
      sosText.textContent = '🚨 SIGNALER UN PROBLÈME / SOS';
      showToast('Alerte SOS désactivée', 'info');
    }
    broadcastMyPosition();
  });

  // Profil
  const profileModal = document.getElementById('profile-modal');
  const openProfile = () => {
    document.getElementById('input-user-name').value = state.myUser.name;
    document.getElementById('input-user-role').value = state.myUser.role;
    profileModal.classList.remove('hidden');
  };

  document.getElementById('open-profile-btn').addEventListener('click', openProfile);
  document.getElementById('edit-profile-btn').addEventListener('click', openProfile);
  document.getElementById('close-profile-modal-btn').addEventListener('click', () => profileModal.classList.add('hidden'));
  document.getElementById('cancel-profile-btn').addEventListener('click', () => profileModal.classList.add('hidden'));

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-opt').forEach(b => b.classList.replace('border-white', 'border-transparent'));
      btn.classList.replace('border-transparent', 'border-white');
      state.myUser.color = btn.getAttribute('data-color');
      state.myUser.icon = btn.getAttribute('data-icon');
    });
  });

  document.getElementById('save-profile-btn').addEventListener('click', () => {
    const name = document.getElementById('input-user-name').value.trim();
    const role = document.getElementById('input-user-role').value;
    if (name) state.myUser.name = name;
    if (role) state.myUser.role = role;

    document.getElementById('header-avatar-badge').textContent = state.myUser.icon;
    document.getElementById('header-avatar-badge').style.backgroundColor = state.myUser.color;

    document.getElementById('my-name-display').textContent = state.myUser.name;
    document.getElementById('my-role-display').textContent = state.myUser.role;
    document.getElementById('my-avatar-display').textContent = state.myUser.icon;
    document.getElementById('my-avatar-display').style.backgroundColor = state.myUser.color;

    profileModal.classList.add('hidden');
    broadcastMyPosition();
    showToast('Profil mis à jour', 'success');
  });
}

// ============================================================================
// DÉMARRAGE AUTOMATIQUE AVEC GÉOLOCALISATION IMMÉDIATE
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

  // DÉCLENCHEMENT AUTOMATIQUE DE LA GÉOLOCALISATION AU DÉMARRAGE
  if (navigator.geolocation) {
    console.log('[GPS] Démarrage automatique de la géolocalisation...');
    startGpsWatch(true);
  }
});
