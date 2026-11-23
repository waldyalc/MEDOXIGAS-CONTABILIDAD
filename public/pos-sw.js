const PREFIJO = "medoxigas-pos-v1-";
const META = `${PREFIJO}meta`;
const LLAVE = new URL("/pos-offline-identidad", self.location.origin).href;

self.addEventListener("install", (evento) => evento.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

async function limpiar() {
  for (const nombre of await caches.keys()) {
    if (nombre.startsWith(PREFIJO)) await caches.delete(nombre);
  }
}

async function identidad() {
  const respuesta = await (await caches.open(META)).match(LLAVE);
  if (!respuesta) return null;
  const datos = await respuesta.json();
  return datos.hasta > Date.now() ? datos : null;
}

async function preparar(ambito) {
  if (typeof ambito !== "string" || !/^[a-zA-Z0-9/-]{1,150}$/.test(ambito)) return;
  const anterior = await identidad();
  if (anterior && anterior.ambito !== ambito) await limpiar();
  const datos = { ambito, hasta: Date.now() + 8 * 60 * 60 * 1000 };
  const cache = await caches.open(`${PREFIJO}${ambito}`);
  const documento = await fetch("/pos", { credentials: "same-origin", cache: "no-store", redirect: "error" });
  if (!documento.ok || !documento.headers.get("content-type")?.includes("text/html")) return;
  const html = await documento.clone().text();
  const recursos = new Set();
  for (const coincidencia of html.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
    const ruta = new URL(coincidencia[1].replaceAll("&amp;", "&"), self.location.origin);
    if (ruta.origin === self.location.origin && ruta.pathname.startsWith("/_next/static/")) recursos.add(ruta.href);
  }
  await Promise.all(
    [...recursos].map(async (ruta) => {
      const respuesta = await fetch(ruta, { cache: "reload" });
      if (!respuesta.ok) throw new Error("No se pudo preparar un recurso del POS.");
      await cache.put(ruta, respuesta);
    }),
  );
  await cache.put(new URL("/pos", self.location.origin), documento);
  await (await caches.open(META)).put(LLAVE, Response.json(datos));
  return true;
}

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "LIMPIAR") evento.waitUntil(limpiar());
  if (evento.data?.tipo === "PREPARAR") {
    evento.waitUntil(
      preparar(evento.data.ambito)
        .then((listo) =>
          evento.source?.postMessage({
            tipo: listo ? "POS_CACHE_LISTO" : "POS_CACHE_ERROR",
            ambito: evento.data.ambito,
          }),
        )
        .catch(() => evento.source?.postMessage({ tipo: "POS_CACHE_ERROR", ambito: evento.data.ambito })),
    );
  }
  if (evento.data?.tipo === "COMPROBAR") {
    evento.waitUntil(
      identidad().then((datos) =>
        evento.source?.postMessage({
          tipo: datos?.ambito === evento.data.ambito ? "POS_CACHE_LISTO" : "POS_CACHE_ERROR",
          ambito: evento.data.ambito,
        }),
      ),
    );
  }
});

self.addEventListener("fetch", (evento) => {
  const solicitud = evento.request;
  const url = new URL(solicitud.url);
  if (solicitud.method !== "GET" || url.origin !== self.location.origin) return;
  const documento = solicitud.mode === "navigate" && url.pathname === "/pos";
  const recurso = url.pathname.startsWith("/_next/static/");
  if (!documento && !recurso) return;
  evento.respondWith(
    (async () => {
      const datos = await identidad();
      const cache = datos ? await caches.open(`${PREFIJO}${datos.ambito}`) : null;
      try {
        const respuesta = await fetch(solicitud);
        if (recurso && respuesta.ok && cache) await cache.put(solicitud, respuesta.clone());
        if (documento && (respuesta.redirected || !respuesta.ok)) await limpiar();
        return respuesta;
      } catch (causa) {
        const guardada = cache && (await cache.match(documento ? new URL("/pos", self.location.origin) : solicitud));
        if (guardada) return guardada;
        throw causa;
      }
    })(),
  );
});
