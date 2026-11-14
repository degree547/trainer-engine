// Service Worker: speichert alle App-Dateien, damit die App offline läuft.
// Bei jeder inhaltlichen Änderung CACHE_VERSION erhöhen und neue Dateien in DATEIEN eintragen.

const CACHE_VERSION = 'v9';
const CACHE_NAME = `trainer-engine-${CACHE_VERSION}`;

const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/app.js',
  'src/engine/m1-kern.js',
  'src/engine/m2-lernlogik.js',
  'src/engine/m3-fragetypen.js',
  'src/engine/m4-gamification.js',
  'src/engine/m5-statistik.js',
  'src/engine/m7-speicherung.js',
  'src/engine/m8-inhaltsformat.js',
  'src/ui/dom.js',
  'src/ui/i18n.js',
  'src/ui/start.js',
  'src/ui/runde.js',
  'src/ui/fortschritt.js',
  'src/ui/statistik.js',
  'src/ui/styles.css',
  'src/i18n/de.json',
  'src/i18n/en.json',
  'content/beispiel/beispiel.json',
  'content/sks/sks.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(DATEIEN))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n.startsWith('trainer-engine-') && n !== CACHE_NAME).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Zuerst aus dem Cache, sonst aus dem Netz (und dann für später merken).
self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(anfrage, { ignoreSearch: true }).then((gespeichert) => {
      if (gespeichert) return gespeichert;
      return fetch(anfrage).then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(anfrage, kopie));
        }
        return antwort;
      }).catch(() => (anfrage.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }),
  );
});
