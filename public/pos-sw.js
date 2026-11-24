const PREFIJO = "medoxigas-pos-v1-";
const META = `${PREFIJO}meta`;
const ASSETS = `${PREFIJO}assets`;
const LLAVE = new URL("/pos-offline-identidad", self.location.origin).href;
// Las cinco pantallas del menú del POS: la app local completa, sin internet.
const RUTAS_POS = ["/pos", "/pos/historial", "/pos/pagos", "/pos/turnos", "/pos/devoluciones"];
// Si la red no contesta en 3 s, se sirve la copia cacheada sin dejar la caja esperando.
const ESPERA_RED = 3_000;

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

function urlDeRuta(ruta) {
  return new URL(ruta, self.location.origin).href;
}

function esRecursoEstatico(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function recursosEstaticos(html) {
  const recursos = new Set();
  for (const coincidencia of html.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
    const url = new URL(coincidencia[1].replaceAll("&amp;", "&"), self.location.origin);
    if (esRecursoEstatico(url)) recursos.add(url.href);
  }
  return recursos;
}

function recursosCargadosValidos(recursosCargados) {
  const recursos = new Set();
  for (const cargado of Array.isArray(recursosCargados) ? recursosCargados : []) {
    if (typeof cargado !== "string") continue;
    const url = new URL(cargado, self.location.origin);
    if (esRecursoEstatico(url)) recursos.add(url.href);
  }
  return recursos;
}

async function descargarDocumento(ruta) {
  const respuesta = await fetch(urlDeRuta(ruta), {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  if (!respuesta.ok || !respuesta.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`${ruta}: HTTP ${respuesta.status}`);
  }
  return respuesta;
}

/** Rutas secundarias con `allSettled`: una caída no tumba toda la preparación. */
async function descargarSecundarias() {
  const resultados = await Promise.allSettled(
    RUTAS_POS.filter((ruta) => ruta !== "/pos").map(async (ruta) => ({
      clave: urlDeRuta(ruta),
      respuesta: await descargarDocumento(ruta),
    })),
  );
  const documentos = [];
  for (const resultado of resultados) {
    if (resultado.status !== "fulfilled") continue;
    documentos.push([resultado.value.clave, resultado.value.respuesta, await resultado.value.respuesta.clone().text()]);
  }
  return documentos;
}

async function guardarRecursos(recursos) {
  const assets = await caches.open(ASSETS);
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
}

/** El logo es opcional: ni CORS ni un fallo de red pueden romper la preparación. */
async function guardarLogo(logoUrl) {
  try {
    if (typeof logoUrl !== "string" || logoUrl.trim() === "") return;
    const url = new URL(logoUrl, self.location.origin);
    if (url.origin !== self.location.origin && url.protocol !== "https:") return;
    const respuesta = await fetch(url.href, { cache: "reload" });
    if (respuesta.ok) await (await caches.open(ASSETS)).put(url.href, respuesta);
  } catch {
    // Sin logo cacheado el POS funciona igual: se ignora el fallo.
  }
}

let generacionPreparacion = 0;

async function preparar(ambito, recursosCargados = [], turnoId = null, logoUrl = null) {
  if (typeof ambito !== "string" || !/^[a-zA-Z0-9/-]{1,150}$/.test(ambito)) return false;
  const generacion = ++generacionPreparacion;
  const anterior = await identidad();
  if (anterior && anterior.ambito !== ambito) await limpiar();
  const principal = await fetch(urlDeRuta("/pos"), {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  if (!principal.ok || !principal.headers.get("content-type")?.includes("text/html")) return false;
  if (generacion !== generacionPreparacion) return false;
  const documentos = [
    [urlDeRuta("/pos"), principal, await principal.clone().text()],
    ...(await descargarSecundarias()),
  ];
  const recursos = recursosCargadosValidos(recursosCargados);
  for (const html of documentos.map((documento) => documento[2])) {
    for (const recurso of recursosEstaticos(html)) recursos.add(recurso);
  }
  await guardarRecursos(recursos);
  await guardarLogo(logoUrl);
  if (generacion !== generacionPreparacion) return false;
  const cache = await caches.open(`${PREFIJO}${ambito}`);
  for (const [clave, respuesta] of documentos) await cache.put(clave, respuesta);
  await (await caches.open(META)).put(
    LLAVE,
    Response.json({
      ambito,
      turnoId: turnoId ?? null,
      logoUrl: logoUrl ?? null,
      hasta: Date.now() + 8 * 60 * 60 * 1000,
    }),
  );
  return true;
}

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "LIMPIAR") evento.waitUntil(limpiar());
  if (evento.data?.tipo === "PREPARAR") {
    const turnoId = evento.data.turnoId ?? null;
    evento.waitUntil(
      preparar(evento.data.ambito, evento.data.recursos, turnoId, evento.data.logoUrl ?? null)
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

/**
 * Navegación local-first: con copia cacheada, la red tiene 3 s; si tarda o
 * falla se devuelve la copia al instante. La clave ignora la query string.
 */
async function redConEspera(solicitud) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), ESPERA_RED);
  try {
    return await fetch(solicitud, { signal: controlador.signal });
  } finally {
    // Si la red llegó a tiempo, se deja terminar el cuerpo sin abortarlo a mitad.
    clearTimeout(temporizador);
  }
}

/**
 * Solo las cinco pantallas exactas del menú, nunca por prefijo: `/pos/algo` no
 * tiene copia local. La caja (`/pos`) se evalúa primero porque es la que abre
 * la app instalada.
 */
function esNavegacionPos(solicitud, url) {
  if (solicitud.mode !== "navigate" || url.origin !== self.location.origin) return false;
  return url.pathname === "/pos" || RUTAS_POS.includes(url.pathname);
}

/**
 * La caja refresca su copia en la URL exacta `/pos`; las demás pantallas se
 * guardan sin query string para que cualquier parámetro abra la misma copia.
 */
async function guardarDocumento(cache, url, respuesta) {
  if (!respuesta.headers.get("content-type")?.includes("text/html")) return;
  if (url.pathname === "/pos") await cache.put(new URL("/pos", self.location.origin), respuesta.clone());
  else await cache.put(urlDeRuta(url.pathname), respuesta.clone());
}

async function servirDocumento(solicitud, url) {
  const datos = await identidad();
  if (!datos) return fetch(solicitud);
  const cache = await caches.open(`${PREFIJO}${datos.ambito}`);
  const clave = urlDeRuta(url.pathname);
  const guardada = (await cache.match(clave)) ?? (await cache.match(solicitud));
  if (!guardada) return fetch(solicitud);
  try {
    const respuesta = await redConEspera(solicitud);
    if (respuesta.redirected || !respuesta.ok) {
      // Sesión vencida: el shell redirige a /login y la copia local ya no sirve.
      await limpiar();
      return respuesta;
    }
    try {
      await guardarDocumento(cache, url, respuesta);
    } catch {
      // Cuota llena: la copia anterior sigue sirviendo.
    }
    return respuesta;
  } catch {
    return guardada;
  }
}

async function servirRecurso(solicitud) {
  const assets = await caches.open(ASSETS);
  try {
    const respuesta = await fetch(solicitud);
    // Un fallo de cuota en cache.put nunca debe descartar una respuesta fresca de red.
    try {
      if (respuesta.ok) await assets.put(solicitud, respuesta.clone());
    } catch {
      // Ignora errores de escritura en Cache Storage sin perder la respuesta real.
    }
    return respuesta;
  } catch (causa) {
    const guardada = await assets.match(solicitud);
    if (guardada) return guardada;
    throw causa;
  }
}

/** Logo de la empresa: si la red falla, se sirve la copia de ASSETS. */
async function servirImagen(solicitud) {
  try {
    return await fetch(solicitud);
  } catch (causa) {
    const assets = await caches.open(ASSETS);
    const guardada = await assets.match(solicitud);
    if (guardada) return guardada;
    throw causa;
  }
}

self.addEventListener("fetch", (evento) => {
  const solicitud = evento.request;
  if (solicitud.method !== "GET") return;
  const url = new URL(solicitud.url);
  if (esNavegacionPos(solicitud, url)) {
    evento.respondWith(servirDocumento(solicitud, url));
    return;
  }
  if (esRecursoEstatico(url)) {
    evento.respondWith(servirRecurso(solicitud));
    return;
  }
  if (solicitud.destination === "image") evento.respondWith(servirImagen(solicitud));
});
