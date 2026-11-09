const CACHE_NAME = 'keybreakers-v4-world-map';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/story.js',
  '/pixel-art.js',
  '/timed-speech.js',
  '/illustrations.js',
  '/world-map.js',
  '/world-map.css',
  '/encounter-map.js',
  '/calculation-tools.js',
  '/calculation-tools.css',
  '/adventure.css',
  '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first for APIs, cache fallback for static assets
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request));
  } else {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
