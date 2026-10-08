// Service Worker pour RandoTracker PWA - Version 88
const CACHE_NAME = 'rando-tracker-v88';
const TILES_CACHE_NAME = 'rando-tiles-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css?v=88',
  './app.js?v=88',
  './manifest.json',
  './logo.png',
  './cat_icon.png',
  './cat_icon.png?v=80',
  './cat_pink_icon.png',
  './cat_pink_icon.png?v=80',
  './ads.txt',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './favicon.png',
  './RandoTracker_Mode_d_emploi.pdf',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installation v88...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => console.warn('[SW] Non mis en cache:', url, err)))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation v88...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILES_CACHE_NAME) {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/ws') || event.request.url.startsWith('ws:') || event.request.url.startsWith('wss:')) {
    return;
  }

  // 1. STRATÉGIE CACHE-FIRST ULTRA-RAPIDE POUR LES TUILES DE CARTE (IGN, OpenTopo, OSM)
  const isMapTile = url.hostname.includes('data.geopf.fr') ||
                    url.hostname.includes('opentopomap.org') ||
                    url.hostname.includes('openstreetmap.org') ||
                    url.hostname.includes('ign.es');

  if (isMapTile) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Tuile déjà en cache : affichage INSTANTANÉ (0 ms)
          return cachedResponse;
        }
        // Sinon, téléchargement réseau et mise en cache automatique
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(TILES_CACHE_NAME).then((tileCache) => tileCache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => {
          return new Response('', { status: 408, statusText: 'Tile Offline' });
        });
      })
    );
    return;
  }

  // 2. STRATÉGIE NETWORK-FIRST POUR LES FICHIERS DE L'APPLICATION
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }
  const notifData = event.notification.data || {};
  const notifTitle = event.notification.title || '';
  const notifBody = event.notification.body || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Si une fenêtre de RandoTracker est déjà ouverte, lui donner le focus et lui envoyer le contenu du message
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'postMessage' in focusedClient) {
              focusedClient.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: notifData,
                title: notifTitle,
                body: notifBody
              });
            } else if ('postMessage' in client) {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: notifData,
                title: notifTitle,
                body: notifBody
              });
            }
          });
        }
      }
      // 2. Sinon, ouvrir l'application avec le paramètre d'affichage direct du message
      if (clients.openWindow) {
        return clients.openWindow('./?open_announcement=1');
      }
    })
  );
});

