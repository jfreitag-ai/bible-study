/* Study Companion offline support.
   Bump VERSION whenever you upload changed files so visitors get the update. */
const VERSION = "sc-v26";
const DATA = "sc-data";
const SHELL = ["./", "index.html", "manifest.webmanifest", "nt/index.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== DATA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function put(cacheName, req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(cacheName).then(c => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // The page itself: network first so updates arrive; saved copy when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => res.ok ? put(VERSION, "index.html", res) : caches.match("index.html").then(hit => hit || res))
      .catch(() => caches.match("index.html")));
    return;
  }
  if (url.origin === location.origin) {
    // Study Bible text: network first (fresh after updates), saved copy offline.
    if (url.pathname.includes("/nt/")) {
      e.respondWith(fetch(req).then(res => put(DATA, req, res)).catch(() => caches.match(req)));
      return;
    }
    // Maps and charts, icons, other files: saved copy first.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(url.pathname.includes("/img/") ? DATA : VERSION, req, res))));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(VERSION, req, res))));
  }
});
