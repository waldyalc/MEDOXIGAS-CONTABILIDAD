import { describe, expect, it } from "vitest";

import {
  estadoPopoverSincronizacion,
  estadoTrasSondeo,
  FALLOS_PARA_OFFLINE,
  RUTA_SONDEO,
  registrarOfflineInmediato,
  registrarSondeo,
  SALUD_CONEXION_INICIAL,
  textoEstadoOffline,
} from "./conexion-offline";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

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

  it("un sondeo lento durante una subida no interrumpe «Subiendo ventas…»", () => {
    const salud = registrarSondeo(SALUD_CONEXION_INICIAL, false);
    expect(estadoTrasSondeo("sincronizando", salud.conectado)).toBe("sincronizando");
  });

  it("sin red confirmada por el navegador pasa a «Sin conexión» al instante, sin esperar 3 fallos", () => {
    const salud = registrarOfflineInmediato();
    expect(salud.fallos).toBe(FALLOS_PARA_OFFLINE);
    expect(salud.conectado).toBe(false);
    expect(estadoTrasSondeo("online", salud.conectado)).toBe("offline");
    expect(estadoTrasSondeo("sincronizando", salud.conectado)).toBe("sincronizando");
  });

  it("un error de almacenamiento nunca deja el pie trabado en «Preparando la cola local…»", () => {
    const error = "No se puede guardar en este navegador. No cobres offline hasta habilitar IndexedDB.";
    expect(textoEstadoOffline({ estado: "online", porSubir: 0, fallidas: 0, preparado: false, error })).toBe(
      "Error de almacenamiento local — sin modo offline",
    );
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

  it("el provider re-cachea /pos al cambiar de turno y atiende el offline al instante", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider).toContain("registrarOfflineInmediato");
    expect(provider).toMatch(/\}, \[ambito, turnoId\]\);/);
    expect(provider).toContain("turnoSolicitado.current = turnoId");
    expect(provider).toContain('window.addEventListener("offline", alPerderConexion)');
    expect(provider).toContain("recargarManual");
    expect(provider).toContain("tokenRecargaCache");
    expect(provider).toContain("estadoProductos");
    expect(provider).toContain("estadoClientes");
    expect(provider).toContain("ErrorImpedimentoCierreOffline");
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
});
