const CACHE_NAME = "nexus-laboratoire-v51";
const APP_SHELL = [
  "./index.html",
  "./styles.css?v=24",
  "./question-engine.js?v=29",
  "./learning-model.js?v=1",
  "./game-model.js?v=9",
  "./app.js?v=30",
  "./exerciseurs/index.html",
  "./exerciseurs/styles.css?v=3",
  "./exerciseurs/app.js?v=4",
  "./manifest.webmanifest",
  "./assets/favicon-64.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    APP_SHELL.map(url => new Request(url, { cache: "reload" }))
  )));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    const isExerciseLab = new URL(event.request.url).pathname.includes("/exerciseurs");
    const fallback = isExerciseLab ? "./exerciseurs/index.html" : "./index.html";
    event.respondWith(
      fetch(new Request(event.request, { cache: "reload" })).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(fallback, copy));
        return response;
      }).catch(() => caches.match(fallback))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (!response || response.status !== 200 || response.type === "opaque") return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => undefined))
  );
});
