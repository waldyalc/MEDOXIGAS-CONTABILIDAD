const PREFIJO = "medoxigas-pos-v1-";
const META = `${PREFIJO}meta`;
const ASSETS = `${PREFIJO}assets`;
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

let generacionPreparacion = 0;

async function preparar(ambito, recursosCargados = [], turnoId = null) {
  if (typeof ambito !== "string" || !/^[a-zA-Z0-9/-]{1,150}$/.test(ambito)) return false;
  const generacion = ++generacionPreparacion;
  const anterior = await identidad();
  if (anterior && anterior.ambito !== ambito) await limpiar();
  const datos = { ambito, turnoId: turnoId ?? null, hasta: Date.now() + 8 * 60 * 60 * 1000 };
  const cache = await caches.open(`${PREFIJO}${ambito}`);
  const documento = await fetch("/pos", { credentials: "same-origin", cache: "no-store", redirect: "error" });
  if (!documento.ok || !documento.headers.get("content-type")?.includes("text/html")) return false;
  if (generacion !== generacionPreparacion) return false;
  const html = await documento.clone().text();
  const assets = await caches.open(ASSETS);
  const recursos = new Set();
  for (const cargado of Array.isArray(recursosCargados) ? recursosCargados : []) {
    if (typeof cargado !== "string") continue;
    const ruta = new URL(cargado, self.location.origin);
    if (ruta.origin === self.location.origin && ruta.pathname.startsWith("/_next/static/")) recursos.add(ruta.href);
  }
  for (const coincidencia of html.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
    const ruta = new URL(coincidencia[1].replaceAll("&amp;", "&"), self.location.origin);
    if (ruta.origin === self.location.origin && ruta.pathname.startsWith("/_next/static/")) recursos.add(ruta.href);
  }
  await Promise.all(
    [...recursos].map(async (ruta) => {
      let respuesta;
      try {
        respuesta = await fetch(ruta, { cache: "reload" });
      } catch (causa) {
        throw new Error(`${ruta}: ${causa instanceof Error ? causa.message : String(causa)}`);
      }
      if (!respuesta.ok) throw new Error(`${ruta}: HTTP ${respuesta.status}`);
      await assets.put(ruta, respuesta);
    }),
  );
  if (generacion !== generacionPreparacion) return false;
  await cache.put(new URL("/pos", self.location.origin), documento);
  await (await caches.open(META)).put(LLAVE, Response.json(datos));
  return true;
}

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "LIMPIAR") evento.waitUntil(limpiar());
  if (evento.data?.tipo === "PREPARAR") {
    const turnoId = evento.data.turnoId ?? null;
    evento.waitUntil(
      preparar(evento.data.ambito, evento.data.recursos, turnoId)
        .then((listo) =>
          evento.source?.postMessage({
            tipo: listo ? "POS_CACHE_LISTO" : "POS_CACHE_ERROR",
            ambito: evento.data.ambito,
            turnoId,
          }),
        )
        .catch((causa) =>
          evento.source?.postMessage({
            tipo: "POS_CACHE_ERROR",
            ambito: evento.data.ambito,
            turnoId,
            detalle: causa instanceof Error ? causa.message : String(causa),
          }),
        ),
    );
  }
  if (evento.data?.tipo === "COMPROBAR") {
    evento.waitUntil(
      identidad().then((datos) =>
        evento.source?.postMessage({
          tipo: datos?.ambito === evento.data.ambito ? "POS_CACHE_LISTO" : "POS_CACHE_ERROR",
          ambito: evento.data.ambito,
          turnoId: datos?.turnoId ?? null,
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
      const cache = recurso ? await caches.open(ASSETS) : datos ? await caches.open(`${PREFIJO}${datos.ambito}`) : null;
      try {
        const respuesta = await fetch(solicitud);
        // Un fallo de cuota en cache.put nunca debe descartar una respuesta fresca de red.
        try {
          if (recurso && respuesta.ok && cache) await cache.put(solicitud, respuesta.clone());
          if (
            documento &&
            respuesta.ok &&
            !respuesta.redirected &&
            cache &&
            respuesta.headers.get("content-type")?.includes("text/html")
          ) {
            await cache.put(new URL("/pos", self.location.origin), respuesta.clone());
          }
          if (documento && (respuesta.redirected || !respuesta.ok)) await limpiar();
        } catch {
          // Ignora errores de escritura en Cache Storage sin perder la respuesta real.
        }
        return respuesta;
      } catch (causa) {
        const guardada = cache && (await cache.match(documento ? new URL("/pos", self.location.origin) : solicitud));
        if (guardada) return guardada;
        throw causa;
      }
    })(),
  );
});
