/* Service worker do Buscador de CEP.
   Estratégia: rede primeiro (com revalidação) e cache como reserva offline.
   Assim uma atualização nunca fica presa em cache antigo. */

const CACHE = "buscador-cep-v4";

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

async function redePrimeiro(req) {
  try {
    // cache: "no-cache" força revalidar com o servidor, ignorando HTTP cache velho
    const resposta = await fetch(req, { cache: "no-cache" });
    if (resposta && resposta.ok) {
      const copia = resposta.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
    }
    return resposta;
  } catch {
    const salvo = await caches.match(req);
    return salvo || Response.error();
  }
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Consultas ao ViaCEP nunca passam pelo cache
  if (url.hostname.endsWith("viacep.com.br")) return;

  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    evento.respondWith(
      redePrimeiro(req).catch(() =>
        caches.match("/index.html").then((r) => r || caches.match("/offline.html"))
      )
    );
    return;
  }

  evento.respondWith(redePrimeiro(req));
});
