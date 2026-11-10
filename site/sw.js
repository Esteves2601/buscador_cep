/* Service worker do Buscador de CEP.
   Guarda o app em cache para abrir offline; as consultas ao ViaCEP
   continuam indo direto para a internet. */

const CACHE = "buscador-cep-v1";

const SHELL = [
  "/",
  "/index.html",
  "/estilo.css",
  "/app.js",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icone-192.png",
  "/icone-512.png",
  "/apple-touch-icon.png",
  "/offline.html",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Consultas ao ViaCEP nunca são cacheadas
  if (url.hostname.endsWith("viacep.com.br")) return;

  if (url.origin !== self.location.origin) return;

  // Navegação: tenta a rede, cai para o app salvo (funciona offline)
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req).catch(() => caches.match("/index.html").then((r) => r || caches.match("/offline.html")))
    );
    return;
  }

  // Demais arquivos: cache primeiro, rede depois
  evento.respondWith(
    caches.match(req).then(
      (salvo) =>
        salvo ||
        fetch(req).then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia));
          return resposta;
        })
    )
  );
});
