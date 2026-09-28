// Service Worker pour RandoTracker PWA
const CACHE_NAME = 'rando-tracker-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './tracks/parcours_1_vert_6km.gpx',
  './tracks/parcours_2_bleu_12km.gpx',
  './tracks/parcours_3_rouge_18km.gpx'
];

// Installation : Mise en cache des fichiers essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des ressources statiques');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie Réseau avec repli sur le Cache (Network-first avec fallback Cache)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes WebSocket
  if (url.pathname.startsWith('/ws') || event.request.url.startsWith('ws:') || event.request.url.startsWith('wss:')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la requête réussit et qu'il s'agit d'une tuile de carte ou asset externe, on la met en cache dynamique
        if (response.status === 200 && (url.hostname.includes('tile') || url.hostname.includes('geopf.fr') || url.hostname.includes('unpkg.com') || url.hostname.includes('cdn.'))) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // En cas de coupure 4G/Hors-ligne, renvoyer depuis le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
