const staticCacheName = "static-site-cache-v1";
const assets = [
  "./index.html",
  "./styles/topic-viewer.css",
  "./scripts/topic-viewer.js",
  "./favicon.ico",
  "./manifest.json",
  "./images/icons/icon-128x128.png",
  "./images/icons/icon-192x192.png",
  "./images/icons/icon-256x256.png",
  "./images/icons/icon-512x512.png",
];

self.addEventListener("install", installEvent => {
  console.log("Install event triggered");

  installEvent.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll(assets).catch(err => {
        console.error('Failed to cache assets:', err);
      });
    })
  );
});

self.addEventListener('fetch', fetchEvent => {
  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then(res => {
      return res || fetch(fetchEvent.request);
    })
  );
});

// Evento activate para eliminar cachés antiguos
self.addEventListener('activate', activateEvent => {
  console.log('Activate event triggered');
  activateEvent.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== staticCacheName) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});
