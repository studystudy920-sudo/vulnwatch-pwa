// ===== VulnWatch Service Worker =====
// iOS Safari / Chrome 対応のオフラインキャッシュ戦略

const CACHE_VERSION = 'v3';
const STATIC_CACHE = 'vulnwatch-static-' + CACHE_VERSION;
const API_CACHE = 'vulnwatch-api-' + CACHE_VERSION;
const API_CACHE_MAX_AGE = 1000 * 60 * 30;

const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || await fetchPromise || offlineResponse();
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || offlineJsonResponse();
  }
}

function offlineResponse() {
  return new Response(
    '<html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>VulnWatch</h2><p>Offline</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function offlineJsonResponse() {
  return new Response(
    JSON.stringify({ error: 'offline' }),
    { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}

function isApiRequest(url) {
  return url.hostname === 'services.nvd.nist.gov'
    || url.hostname === 'jvndb.jvn.jp'
    || url.hostname === 'generativelanguage.googleapis.com'
    || url.hostname === 'api.allorigins.win';
}
