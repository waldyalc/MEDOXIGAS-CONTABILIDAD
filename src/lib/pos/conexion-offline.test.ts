import { describe, expect, it } from "vitest";

import { config as configProxy } from "@/proxy";

import {
  claveEstadoConexionSesion,
  estadoPopoverSincronizacion,
  estadoTrasSondeo,
  FALLOS_PARA_OFFLINE,
  guardarEstadoConexionSesion,
  leerEstadoConexionInicial,
  RUTA_SONDEO,
  registrarOfflineInmediato,
  registrarSondeo,
  SALUD_CONEXION_INICIAL,
  textoEstadoOffline,
} from "./conexion-offline";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

function crearAlmacenamientoPrueba() {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      datos.set(clave, valor);
    },
    removeItem: (clave: string) => {
      datos.delete(clave);
    },
  };
}

describe("estado de conexión del pie del POS", () => {
  it("un fallo aislado del sondeo no cambia el estado mostrado", () => {
    const salud = registrarSondeo(SALUD_CONEXION_INICIAL, false);
    expect(salud.fallos).toBe(1);
    expect(salud.conectado).toBe(true);
    expect(estadoTrasSondeo("online", salud.conectado)).toBe("online");
  });

  it(`solo tras ${FALLOS_PARA_OFFLINE} fallos seguidos el pie pasa a «Sin conexión»`, () => {
    let salud = { ...SALUD_CONEXION_INICIAL };
    for (let intento = 1; intento < FALLOS_PARA_OFFLINE; intento += 1) {
      salud = registrarSondeo(salud, false);
      expect(salud.conectado).toBe(true);
      expect(estadoTrasSondeo("online", salud.conectado)).toBe("online");
    }
    salud = registrarSondeo(salud, false);
    expect(salud.conectado).toBe(false);
    expect(estadoTrasSondeo("online", salud.conectado)).toBe("offline");
    expect(estadoTrasSondeo("offline", salud.conectado)).toBe("offline");
  });

  it("cualquier respuesta buena resetea el contador y vuelve a «En línea» al instante", () => {
    let salud = { fallos: FALLOS_PARA_OFFLINE, conectado: false };
    salud = registrarSondeo(salud, true);
    expect(salud).toEqual(SALUD_CONEXION_INICIAL);
    expect(estadoTrasSondeo("offline", salud.conectado)).toBe("online");

    // Dos fallos, un acierto y dos fallos más: sigue en línea, nunca se pega.
    for (const respondio of [false, false, true, false, false]) {
      salud = registrarSondeo(salud, respondio);
      expect(salud.conectado).toBe(true);
    }
  });

  it("uno o dos fallos aislados mantienen la conexión para tolerar un retraso de 10–15 s", () => {
    let salud = { ...SALUD_CONEXION_INICIAL };
    salud = registrarSondeo(salud, false);
    expect(salud).toEqual({ fallos: 1, conectado: true });
    salud = registrarSondeo(salud, false);
    expect(salud).toEqual({ fallos: 2, conectado: true });
    expect(estadoTrasSondeo("online", salud.conectado)).toBe("online");
  });

  it("arranca offline cuando sessionStorage ya tenía un offline confirmado", () => {
    const almacenamiento = crearAlmacenamientoPrueba();
    const clave = claveEstadoConexionSesion("empresa/terminal-1");
    expect(clave).toBe("pos:conexion:empresa/terminal-1");
    almacenamiento.setItem(clave, "offline");
    expect(leerEstadoConexionInicial("empresa/terminal-1", almacenamiento, true)).toEqual({
      estado: "offline",
      salud: { fallos: FALLOS_PARA_OFFLINE, conectado: false },
    });
  });

  it("el estado inicial respeta el navegador sin red y arranca en línea sin marca guardada", () => {
    const almacenamiento = crearAlmacenamientoPrueba();
    expect(leerEstadoConexionInicial("empresa/terminal-1", almacenamiento, false)).toEqual({
      estado: "offline",
      salud: { fallos: FALLOS_PARA_OFFLINE, conectado: false },
    });
    expect(leerEstadoConexionInicial("empresa/terminal-1", almacenamiento, true)).toEqual({
      estado: "online",
      salud: SALUD_CONEXION_INICIAL,
    });
  });

  it("guarda el offline confirmado y lo limpia al reconectar", () => {
    const almacenamiento = crearAlmacenamientoPrueba();
    const clave = claveEstadoConexionSesion("empresa/terminal-1");
    guardarEstadoConexionSesion("empresa/terminal-1", false, almacenamiento);
    expect(almacenamiento.getItem(clave)).toBe("offline");
    expect(leerEstadoConexionInicial("empresa/terminal-1", almacenamiento, true).estado).toBe("offline");
    guardarEstadoConexionSesion("empresa/terminal-1", true, almacenamiento);
    expect(almacenamiento.getItem(clave)).toBeNull();
    expect(leerEstadoConexionInicial("empresa/terminal-1", almacenamiento, true).estado).toBe("online");
  });

  it("tolera sessionStorage nulo o bloqueado sin romper el arranque del POS", () => {
    const bloqueado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(leerEstadoConexionInicial("empresa/terminal-1", null, true).estado).toBe("online");
    expect(leerEstadoConexionInicial("empresa/terminal-1", bloqueado, true).estado).toBe("online");
    expect(() => guardarEstadoConexionSesion("empresa/terminal-1", false, bloqueado)).not.toThrow();
    expect(() => guardarEstadoConexionSesion("empresa/terminal-1", true, null)).not.toThrow();
  });

  it("si el navegador ya sabe que no hay red, el pie pasa a «Sin conexión» al instante", () => {
    const salud = registrarSondeo(SALUD_CONEXION_INICIAL, false, true);
    expect(salud).toEqual({ fallos: FALLOS_PARA_OFFLINE, conectado: false });
    expect(estadoTrasSondeo("online", salud.conectado)).toBe("offline");
  });

  it("un sondeo lento durante una subida no interrumpe «Subiendo ventas…»", () => {
    const salud = registrarSondeo(SALUD_CONEXION_INICIAL, false);
    expect(estadoTrasSondeo("sincronizando", salud.conectado)).toBe("sincronizando");
  });

  it("sin red confirmada por el navegador pasa a «Sin conexión» al instante, incluso si estaba sincronizando", () => {
    const salud = registrarOfflineInmediato();
    expect(salud.fallos).toBe(FALLOS_PARA_OFFLINE);
    expect(salud.conectado).toBe(false);
    expect(estadoTrasSondeo("online", salud.conectado, true)).toBe("offline");
    expect(estadoTrasSondeo("sincronizando", salud.conectado, true)).toBe("offline");
  });

  it("un error de almacenamiento nunca deja el pie trabado en «Preparando la cola local…»", () => {
    const error = "No se puede guardar en este navegador. No cobres offline hasta habilitar IndexedDB.";
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: false, error })).toBe(error);
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: false })).toBe(
      "Preparando la cola local…",
    );
    // Ya preparado, el error de una operación suelta no cambia el pie.
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: true, error })).toBe(
      "0 operaciones por subir · En línea",
    );
  });

  it("el popover de sincronización usa los tres textos exactos de Alegra", () => {
    expect(estadoPopoverSincronizacion({ estado: "sincronizando", porSubir: 2, fallidas: 0 })).toEqual({
      estado: "sincronizando",
      titulo: "Sincronizando",
      descripcion: "Estamos guardando las ventas que hiciste sin conexión, en un momento estará todo listo.",
    });
    expect(estadoPopoverSincronizacion({ estado: "online", porSubir: 2, fallidas: 0 })).toEqual({
      estado: "pendiente",
      titulo: "Sincronización pendiente",
      descripcion:
        "Te recomendamos revisar las ventas pendientes por sincronizar para evitar la pérdida de su información.",
    });
    expect(estadoPopoverSincronizacion({ estado: "online", porSubir: 0, fallidas: 1 }).estado).toBe("pendiente");
    expect(estadoPopoverSincronizacion({ estado: "online", porSubir: 0, fallidas: 0 })).toEqual({
      estado: "al-dia",
      titulo: "Sincronización al día",
      descripcion: "Todo está disponible para que registres tus ventas",
    });
  });

  it("sin fallidas reales el pie nunca dice «Error al subir»", () => {
    const normal = textoEstadoOffline({ estado: "online", porSubir: 1, fallidas: 0, preparado: true });
    expect(normal).toBe("1 operación por subir · En línea");
    expect(normal).not.toContain("Error al subir");

    const reintentando = textoEstadoOffline({ estado: "sincronizando", porSubir: 1, fallidas: 0, preparado: true });
    expect(reintentando).toBe("Subiendo ventas… 1 por subir");
    expect(reintentando).not.toContain("Error al subir");
  });

  it("una venta fallida real sí muestra «Error al subir» y cuenta la bandeja", () => {
    const una = textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 1, preparado: true });
    expect(una).toBe("Error al subir — 1 venta con problema");
    const dos = textoEstadoOffline({ estado: "online", porSubir: 3, fallidas: 2, preparado: true });
    expect(dos).toBe("Error al subir — 2 ventas con problema · 3 por subir");
  });

  it("«Sin conexión» solo aparece con el estado confirmado y sin fallidas", () => {
    expect(textoEstadoOffline({ estado: "offline", porSubir: 2, fallidas: 0, preparado: true })).toBe(
      "Sin conexión — 2 ventas por subir",
    );
    expect(textoEstadoOffline({ estado: "offline", porSubir: 1, fallidas: 0, preparado: true })).toBe(
      "Sin conexión — 1 venta por subir",
    );
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: true })).toBe(
      "0 operaciones por subir · En línea",
    );
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: false })).toBe(
      "Preparando la cola local…",
    );
  });

  it("un error de almacenamiento se ve en el pie, no queda escondido en «Preparando…»", () => {
    const aviso = "No se puede guardar en este navegador. No cobres offline hasta habilitar IndexedDB.";
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: false, error: aviso })).toBe(
      aviso,
    );
    // El aviso de almacenamiento gana también al «Sin conexión»: sin IndexedDB no hay POS offline.
    expect(textoEstadoOffline({ estado: "offline", porSubir: 0, fallidas: 0, preparado: false, error: aviso })).toBe(
      aviso,
    );
  });

  it("el provider decide el estado con la máquina de sondeos y no con un fallo suelto", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider).toContain("registrarSondeo");
    expect(provider).toContain("estadoTrasSondeo");
    expect(provider).toContain("textoEstadoOffline");
    expect(provider).not.toContain('setEstado("offline")');
    expect(provider).not.toContain('setEstado("error")');
    expect(provider).not.toContain("hayProblema");
    expect(provider).not.toContain('if (error) return "Error al subir');
  });

  it("el pie recibe el error de almacenamiento y el «sin red» del navegador", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    // `error` tiene que llegar a textoEstadoOffline o el pie no puede avisarlo.
    expect(provider).toContain("preparado, error");
    // Y registrarSondeo recibe el navigator.onLine para el «Sin conexión» inmediato.
    expect(provider).toContain("respondio, !navigator.onLine");
  });

  it("el provider re-cachea /pos al cambiar de turno con serialización y atiende el offline al instante", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    const sw = leer("public/pos-sw.js");
    expect(provider).toContain("registrarOfflineInmediato");
    expect(provider).toMatch(/\}, \[ambito, turnoId\]\);/);
    expect(provider).toContain("turnoId: turnoObjetivo");
    expect(provider).toContain("reprepararPendiente");
    expect(provider).toContain("estadoTrasSondeo(actual, false, true)");
    expect(provider).toContain('window.addEventListener("offline", alPerderConexion)');
    expect(provider).toContain("recargarManual");
    expect(provider).toContain("tokenRecargaCache");
    expect(provider).toContain("estadoProductos");
    expect(provider).toContain("estadoClientes");
    expect(provider).toContain("ErrorImpedimentoCierreOffline");
    expect(sw).toContain("generacionPreparacion");
    expect(sw).toContain("turnoId");
  });

  it("el latido pega a un estático del CDN, no a /login", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(RUTA_SONDEO).not.toContain("/login");
    expect(provider).toContain("fetch(RUTA_SONDEO");
    expect(provider).not.toContain('fetch("/login"');
    // Si el estático desaparece, el latido daría 404 y el POS se pintaría offline.
    expect(existsSync(join(process.cwd(), "public", RUTA_SONDEO)), `Falta public${RUTA_SONDEO}`).toBe(true);
  });

  it("un aviso de la recarga offline no se pinta como error de subida", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider).toContain("avisoRecarga");
    expect(provider).not.toContain('setError("La recarga offline no está preparada');
    expect(provider).not.toContain('setError("No se pudo preparar la recarga offline');
  });

  it("el provider restaura un offline confirmado y acelera el sondeo sin bajar la tolerancia", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider).toContain("leerEstadoConexionInicial");
    expect(provider).toContain("guardarEstadoConexionSesion");
    expect(provider).toContain("window.sessionStorage");
    expect(provider).toContain('if (inicial.estado === "offline") aplicarOfflineInmediato();');
    expect(provider).toContain("POS_RED_DEGRADADA");
    expect(provider).toContain("recibirRedDegradada");
    expect(provider).toContain("programarSondeoAcelerado");
    expect(provider).toContain("AbortSignal.timeout(4_000)");
    expect(provider).not.toContain("AbortSignal.timeout(5_000)");
  });

  it("las peticiones RSC de las pantallas del POS pasan por el cortacircuito del Service Worker", () => {
    const sw = leer("public/pos-sw.js");
    expect(sw).toContain("function esPeticionRscPos(solicitud, url)");
    expect(sw).toContain("RUTAS_POS.includes(url.pathname)");
    expect(sw).toContain('solicitud.headers.get("RSC") === "1"');
    expect(sw).toContain('url.searchParams.has("_rsc")');
    expect(sw).toContain("async function servirRscPos(evento, solicitud, url)");
    expect(sw).toContain("self.navigator && self.navigator.onLine === false");
    expect(sw).toContain("return await redConEspera(solicitud);");
    expect(sw).toContain("POS_RED_DEGRADADA");
    expect(sw).toContain("Response.error()");
    const inicioFetch = sw.indexOf('self.addEventListener("fetch"');
    const bloqueFetch = sw.slice(inicioFetch);
    const posRsc = bloqueFetch.indexOf("esPeticionRscPos(solicitud, url)");
    const posNavegacion = bloqueFetch.indexOf("esNavegacionPos(solicitud, url)");
    const posEstatico = bloqueFetch.indexOf("esRecursoEstatico(url)");
    expect(posRsc).toBeGreaterThanOrEqual(0);
    expect(posNavegacion).toBeGreaterThanOrEqual(0);
    expect(posEstatico).toBeGreaterThanOrEqual(0);
    expect(posRsc).toBeLessThan(posNavegacion);
    expect(posRsc).toBeLessThan(posEstatico);
  });

  it("el Service Worker guarda las cinco pantallas del POS y corta la red a los 3 s", () => {
    const sw = leer("public/pos-sw.js");
    const inicio = sw.indexOf("const RUTAS_POS");
    const bloque = sw.slice(inicio, sw.indexOf("];", inicio));
    for (const ruta of ["/pos", "/pos/historial", "/pos/pagos", "/pos/turnos", "/pos/devoluciones"]) {
      expect(
        bloque,
        `Falta ${ruta} en RUTAS_POS: esa pantalla del menú no abriría sin internet (Tarea 2 de 3).`,
      ).toContain(`"${ruta}"`);
    }
    expect(sw, "La navegación cacheada debe cortar la red a los 3 s y servir la copia local").toContain(
      "AbortController",
    );
    expect(sw, "El timeout de red debe ser de 3,000 ms, no el de la subida de ventas").toContain(
      "const ESPERA_RED = 3_000;",
    );
    expect(sw, "Una ruta secundaria caída no puede romper toda la preparación").toContain("Promise.allSettled");
    expect(sw, "El logo de la empresa se guarda en ASSETS con su fallo aislado").toContain("guardarLogo");
    expect(sw, "Los chunks referenciados dentro del payload RSC también deben entrar al caché").toContain(
      String.raw`\/_next\/static\/[^\s"'<>\\]+?\.(?:js|css)/g`,
    );
  });

  it("el aviso beforeunload protege cerrar la pestaña, pero se omite en navegación interna del POS", () => {
    const offline = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    const carrito = leer("src/app/(pos)/pos/_components/carrito-pos-provider.tsx");
    for (const [nombre, fuente] of [
      ["offline-pos-provider.tsx", offline],
      ["carrito-pos-provider.tsx", carrito],
    ] as const) {
      expect(fuente, `${nombre} debe importar el candado de navegación interna`).toContain(
        'from "@/lib/pos/navegacion-interna"',
      );
      expect(fuente, `${nombre} debe omitir el popup solo en navegación interna`).toContain(
        "if (esNavegacionInternaPos()) return;",
      );
      expect(fuente, `${nombre} debe seguir protegiendo el cierre de la pestaña`).toContain("evento.preventDefault();");
      expect(fuente, `${nombre} debe conservar returnValue para el diálogo nativo`).toContain(
        'evento.returnValue = "";',
      );
      expect(fuente.indexOf("if (esNavegacionInternaPos()) return;")).toBeLessThan(
        fuente.indexOf("evento.preventDefault();"),
      );
    }
  });

  it("todos los enlaces internos del POS pasan por EnlacePos", () => {
    const enlace = leer("src/app/(pos)/pos/_components/enlace-pos.tsx");
    expect(enlace).toContain('"use client"');
    expect(enlace).toContain('estado === "offline" && !externo');
    expect(enlace).toContain("<a {...props} href={href} onClick={alHacerClick} />");
    expect(enlace).toContain("<Link {...props} href={href} onClick={alHacerClick} />");
    for (const modificador of [
      "evento.metaKey",
      "evento.ctrlKey",
      "evento.shiftKey",
      "evento.altKey",
      "evento.button !== 0",
    ]) {
      expect(enlace, `EnlacePos debe respetar ${modificador} para abrir en otra pestaña`).toContain(modificador);
    }
    const marca = enlace.indexOf("marcarNavegacionInternaPos();");
    const clickDelConsumidor = enlace.indexOf("onClick?.(evento)");
    expect(marca).toBeGreaterThanOrEqual(0);
    expect(clickDelConsumidor).toBeGreaterThanOrEqual(0);
    expect(marca, "La marca tiene que existir antes de que el <a> dispare beforeunload").toBeLessThan(
      clickDelConsumidor,
    );

    const archivos = [
      "src/app/(pos)/pos/_components/menu-pos.tsx",
      "src/app/(pos)/pos/_components/estado-turno-pos.tsx",
      "src/app/(pos)/pos/_components/barra-superior-pos.tsx",
      "src/app/(pos)/pos/_components/vender/barra-inferior-pos.tsx",
      "src/app/(pos)/pos/_components/vender/mas-opciones-pos.tsx",
      "src/app/(pos)/pos/_components/pagos/pagos-pos.tsx",
    ];
    for (const ruta of archivos) {
      const fuente = leer(ruta);
      expect(fuente, `${ruta} debe usar EnlacePos`).toContain("EnlacePos");
      expect(fuente, `${ruta} no debe navegar internamente con Link crudo`).not.toContain('from "next/link"');
    }
  });

  it("un 5xx temporal no destruye la copia offline cacheada del POS", () => {
    const sw = leer("public/pos-sw.js");
    const inicio = sw.indexOf("async function revalidarDocumento");
    const fin = sw.indexOf("async function servirRecurso", inicio);
    const bloque = sw.slice(inicio, fin);
    expect(bloque).toContain("respuesta.status === 401");
    expect(bloque).toContain("respuesta.status === 403");
    expect(bloque).toContain('respuesta.redirected && destino === "/login"');
    expect(bloque).toContain("if (!respuesta.ok) return null;");
    expect(bloque, "La limpieza solo puede ocurrir cuando la sesión realmente venció").not.toContain(
      "if (respuesta.redirected || !respuesta.ok)",
    );
    expect(bloque.indexOf("if (sesionVencida)")).toBeLessThan(bloque.indexOf("if (!respuesta.ok) return null;"));
  });

  it("el Service Worker sirve chunks inmutables y pantallas cacheadas al instante (cache-first / stale-while-revalidate)", () => {
    const sw = leer("public/pos-sw.js");
    const inicioDoc = sw.indexOf("async function servirDocumento");
    const finDoc = sw.indexOf("async function servirRecurso", inicioDoc);
    const bloqueDoc = sw.slice(inicioDoc, finDoc);
    expect(bloqueDoc, "Las pantallas cacheadas deben responder al instante y revalidar en waitUntil").toContain(
      "evento.waitUntil(revalidarDocumento(cache, solicitud, url))",
    );
    expect(bloqueDoc).toContain("return guardada;");

    const finRec = sw.indexOf("async function servirImagen", finDoc);
    const bloqueRec = sw.slice(finDoc, finRec);
    expect(
      bloqueRec.indexOf("await assets.match(solicitud)"),
      "/_next/static/* debe ser cache-first: esperar la red añade segundos offline",
    ).toBeLessThan(bloqueRec.indexOf("await fetch(solicitud)"));
  });

  it("el provider pide disco persistente y avisa cuando la sesión vence", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider, "Sin navigator.storage.persist el navegador puede borrar la cola offline").toContain(
      "navigator.storage?.persist?.()",
    );
    expect(provider, "El contexto debe exponer sesionRequerida para el aviso de la barra").toContain("sesionRequerida");
    expect(provider, "El logo de la empresa viaja al Service Worker para cachearlo").toContain("logoUrl");
  });

  it("la PWA del POS se instala y arranca en /pos con el teal de Alegra", () => {
    expect(existsSync(join(process.cwd(), "src", "app", "manifest.ts")), "Falta src/app/manifest.ts").toBe(true);
    const manifiesto = leer("src/app/manifest.ts");
    expect(manifiesto, "La app instalada debe abrir directo en la caja").toContain('start_url: "/pos"');
    expect(manifiesto, "El color de la PWA es el teal del POS (#00b19d)").toContain("#00b19d");
    expect(manifiesto, "La app instalada se abre sin barra del navegador").toContain('display: "standalone"');
  });

  it("el manifest, el Service Worker y el logo no pasan por la puerta de login", () => {
    const patron = new RegExp(`^${configProxy.matcher[0]}$`);
    for (const ruta of ["/manifest.webmanifest", "/pos-sw.js", RUTA_SONDEO]) {
      expect(
        patron.test(ruta),
        `${ruta} entra al proxy y acaba redirigido a /login: la PWA, el SW o el latido no funcionarían.`,
      ).toBe(false);
    }
    for (const ruta of ["/pos", "/pos/historial", "/dashboard", "/login"]) {
      expect(patron.test(ruta), `${ruta} quedó fuera del proxy y abriría sin sesión`).toBe(true);
    }
  });
});
