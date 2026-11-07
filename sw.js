/* Petitgatoo · Service Worker
   - App shell em cache (abre mesmo sem internet)
   - HTML: rede primeiro (você sempre recebe a versão nova), cache como reserva
   - Bibliotecas/fontes de CDN: cache com atualização em segundo plano
   - Firebase (Firestore/Auth): NUNCA interceptado, dados sempre vão direto à rede
   Para forçar atualização nos aparelhos, troque o número em VERSION. */
const VERSION = "ptg-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];
const STATIC_HOSTS = [
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "www.gstatic.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Páginas (HTML): rede primeiro, cache como reserva
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Arquivos do próprio app (ícones, manifest) e CDNs estáticas: cache + atualização em segundo plano
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req).then((cached) => {
          const net = fetch(req)
            .then((res) => {
              if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || net;
        })
      )
    );
  }
  // Qualquer outra coisa (Firebase, APIs) passa direto, sem cache.
});
