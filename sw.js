/* MOON-RZ Academy — Service Worker
   Le document HTML est TOUJOURS rechargé depuis le réseau quand on est en ligne
   (cache: "reload" -> contourne le cache HTTP du navigateur), avec repli sur le
   cache hors-ligne. Les requêtes externes (API Binance) ne sont PAS interceptées. */
const CACHE = "moonrz-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./qrcode.js",
  "./assets/moon.jpg",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Même-origine GET uniquement. Le reste (Binance, etc.) -> réseau direct.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Le document principal : réseau frais obligatoire (contourne le cache HTTP).
  const isDoc = req.mode === "navigate" || url.pathname === "/" ||
                url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  const fetchReq = isDoc ? new Request(req.url, { cache: "reload" }) : req;

  e.respondWith(
    fetch(fetchReq)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});
