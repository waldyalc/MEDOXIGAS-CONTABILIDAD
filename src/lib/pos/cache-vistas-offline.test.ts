import { describe, expect, it } from "vitest";

import type { DetalleVentaPOS } from "@/app/(pos)/pos/_components/tipos";

import {
  type DetalleVentaCacheado,
  filtrarFilasHistorialLocal,
  MAX_DETALLES_VENTA_CACHE,
  type MapaDetallesVentaCache,
  recortarDetallesVentaCache,
  sumarVentasLocalesAResumenTurno,
} from "./cache-vistas-offline";
import type { OperacionOffline } from "./cola-offline";
import type { HistorialPOSFila, ResumenTurno } from "./tipos";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COMPONENTES = join(process.cwd(), "src", "app", "(pos)", "pos", "_components");
const leer = (ruta: string) => readFileSync(join(COMPONENTES, ruta), "utf8");

function fila(cambios: Partial<HistorialPOSFila> = {}): HistorialPOSFila {
  return {
    id: "factura-1",
    numero: 12,
    ncf: "B0200000012",
    tipo_comprobante: "02",
    fecha: "2026-11-24",
    creado_en: "2026-11-24T10:00:00.000Z",
    contacto_id: "contacto-1",
    cliente_nombre: "ZZTEST Cliente",
    terminal_id: "terminal-1",
    terminal_nombre: "Caja 1",
    turno_id: "turno-1",
    turno_numero: 3,
    estado: "pagada",
    total: "236.00",
    pagado: "236.00",
    retenido: "0.00",
    credito: "0.00",
    saldo: "0.00",
    metodos: ["efectivo"],
    ...cambios,
  };
}

function detalleCache(id: string, guardadoEn: number): DetalleVentaCacheado {
  return {
    detalle: { factura: { id } } as unknown as DetalleVentaPOS,
    ticket: {} as unknown as DetalleVentaCacheado["ticket"],
    guardadoEn,
  };
}

function operacion(cambios: Partial<OperacionOffline> = {}): OperacionOffline {
  return {
    uuid: "uuid-1",
    ambito: "usuario/terminal",
    secuencia: 1,
    tipo: "venta",
    turnoId: "turno-1",
    folio: "B0200000001",
    payload: { pagos: [{ metodo: "efectivo", monto: "236.00" }] },
    snapshot: {
      venta: {
        factura: { total: "236.00" },
        pagos: [{ metodo: "efectivo", monto: "236.00" }],
      },
      ticket: { total: "236.00" },
    },
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    error: null,
    resultado: null,
    ...cambios,
  };
}

function resumenTurno(): ResumenTurno {
  return {
    ventas: {
      total: "100.00",
      cantidad: 2,
      cobrado: "100.00",
      por_metodo: { efectivo: "100.00", tarjeta: "0.00", transferencia: "0.00", credito: "0.00" },
      por_cuenta: [{ cuenta_id: "cuenta-efectivo", cuenta_nombre: "Caja", metodo: "efectivo", monto: "100.00" }],
    },
    ingresos: {
      total: "0.00",
      cantidad: 0,
      por_motivo: { fondo_caja: "0.00", cobro_factura: "0.00", otro: "0.00" },
    },
    retiros: {
      total: "0.00",
      cantidad: 0,
      por_motivo: { retiro_caja: "0.00", gasto_menor: "0.00", deposito_banco: "0.00", otro: "0.00" },
    },
    devoluciones: { cantidad: 0, total: "0.00", efectivo: "0.00", credito: "0.00" },
    efectivo: {
      base_inicial: "50.00",
      ventas_efectivo: "100.00",
      ingresos_efectivo: "0.00",
      retiros_efectivo: "0.00",
      devoluciones_efectivo: "0.00",
      efectivo_esperado: "150.00",
      efectivo_real: null,
      diferencia: null,
      congelado: false,
    },
    movimientos: [],
  };
}

describe("caché de las vistas offline del POS", () => {
  it("recorta los detalles de venta a los 30 más recientes sin tocar el mapa original", () => {
    const mapa: MapaDetallesVentaCache = {};
    for (let indice = 0; indice < MAX_DETALLES_VENTA_CACHE + 5; indice += 1) {
      mapa[`factura-${indice}`] = detalleCache(`factura-${indice}`, 1_000 + indice);
    }

    const recortado = recortarDetallesVentaCache(mapa);

    expect(Object.keys(recortado)).toHaveLength(MAX_DETALLES_VENTA_CACHE);
    expect(Object.keys(recortado)).not.toContain("factura-0");
    expect(Object.keys(recortado)).toContain(`factura-${MAX_DETALLES_VENTA_CACHE + 4}`);
    expect(Object.keys(mapa), "El mapa leído de IndexedDB no se muta").toHaveLength(MAX_DETALLES_VENTA_CACHE + 5);
  });

  it("filtra las ventas cacheadas por NCF, número, cliente y estado", () => {
    const filas = [
      fila(),
      fila({ id: "factura-2", numero: 13, ncf: "B0200000013", cliente_nombre: "Colmado La Esquina" }),
      fila({ id: "factura-3", numero: 14, ncf: null, estado: "anulada", cliente_nombre: "Pedro Pérez" }),
    ];

    expect(filtrarFilasHistorialLocal(filas)).toHaveLength(3);
    expect(filtrarFilasHistorialLocal(filas, { q: "B0200000013" }).map((f) => f.id)).toEqual(["factura-2"]);
    expect(filtrarFilasHistorialLocal(filas, { q: "14" }).map((f) => f.id)).toEqual(["factura-3"]);
    expect(filtrarFilasHistorialLocal(filas, { q: "esquina" }).map((f) => f.id)).toEqual(["factura-2"]);
    expect(filtrarFilasHistorialLocal(filas, { estado: "anulada" }).map((f) => f.id)).toEqual(["factura-3"]);
    expect(filtrarFilasHistorialLocal(filas, { q: "no existe" })).toEqual([]);
  });

  it("suma en vivo las ventas pendientes del turno abierto con centavos exactos", () => {
    const base = resumenTurno();
    const operaciones = [
      operacion(),
      // Sin `snapshot.venta`: cae al payload y al total del ticket.
      operacion({
        uuid: "uuid-2",
        turnoId: "turno-1",
        snapshot: { ticket: { total: "118.00" } },
        payload: { pagos: [{ metodo: "tarjeta_credito", monto: "118.00" }] },
      }),
      // No cuentan: otro turno, fallida o movimiento de caja.
      operacion({ uuid: "uuid-3", turnoId: "turno-2" }),
      operacion({ uuid: "uuid-4", estado: "fallida" }),
      operacion({ uuid: "uuid-5", tipo: "movimiento" }),
      // Snapshot roto: se ignora sin lanzar.
      operacion({ uuid: "uuid-6", snapshot: null, payload: {} }),
    ];

    const { resumen, pendientesSumadas } = sumarVentasLocalesAResumenTurno(base, operaciones, "turno-1");

    expect(pendientesSumadas).toBe(2);
    expect(resumen.ventas.cantidad).toBe(4);
    expect(resumen.ventas.total).toBe("454.00");
    expect(resumen.ventas.cobrado).toBe("454.00");
    expect(resumen.ventas.por_metodo.efectivo).toBe("336.00");
    expect(resumen.ventas.por_metodo.tarjeta).toBe("118.00");
    expect(resumen.ventas.por_metodo.transferencia).toBe("0.00");
    expect(resumen.ventas.por_metodo.credito, "Las ventas locales de contado no son crédito").toBe("0.00");
    expect(resumen.efectivo.ventas_efectivo).toBe("336.00");
    expect(resumen.efectivo.efectivo_esperado).toBe("386.00");
    expect(resumen.efectivo.base_inicial, "La base inicial no se toca").toBe("50.00");
    expect(resumen.ventas.por_cuenta, "El desglose por cuenta del servidor se conserva").toBe(base.ventas.por_cuenta);
    expect(base.ventas.total, "El resumen original queda intacto").toBe("100.00");
    expect(base.ventas.cantidad).toBe(2);
    expect(base.efectivo.efectivo_esperado).toBe("150.00");
  });

  it("sin ventas pendientes devuelve el mismo resumen y cero pendientes", () => {
    const base = resumenTurno();
    const { resumen, pendientesSumadas } = sumarVentasLocalesAResumenTurno(
      base,
      [operacion({ estado: "sincronizada" })],
      "turno-1",
    );

    expect(pendientesSumadas).toBe(0);
    expect(resumen.ventas).toEqual(base.ventas);
    expect(resumen.efectivo).toEqual(base.efectivo);
  });
});

/**
 * Candados de las pantallas: las cuatro vistas leen y guardan su caché, la
 * venta pasada se reimprime sin red y el turno abierto suma lo pendiente.
 */
describe("pantallas de las vistas offline", () => {
  it("Ventas guarda el historial, hidrata sin conexión y pre-descarga los detalles", () => {
    const historial = leer("historial/historial-pos.tsx");

    for (const texto of [
      "guardarVistaHistorialOffline",
      "leerVistaHistorialOffline",
      "leerDetalleVentaOffline",
      "MAX_PREDESCARGAS_HISTORIAL",
      "TAMANO_LOTE_PREDESCARGA",
      "detalleVentaPOS",
      "ticketVentaPOS",
    ]) {
      expect(historial, `Falta «${texto}» en Ventas`).toContain(texto);
    }
    expect(historial, "No puede mostrar el vacío si hay ventas locales").not.toContain("filas.length === 0 ? (");
  });

  it("el detalle de una venta pasada se abre desde el caché o avisa que no está en el dispositivo", () => {
    const detalle = leer("historial/detalle-venta-pos.tsx");

    expect(detalle).toContain("leerDetalleVentaOffline");
    expect(detalle).toContain("guardarDetalleVentaOffline");
    expect(detalle).toContain("Esta venta no está guardada en este dispositivo. Conéctate a internet para verla.");
    expect(detalle, "El detalle no usa el azul de Medoxigas fuera de lo ya pendiente").not.toMatch(/#1e56c7/);
  });

  it("Turnos hidrata su caché y suma las ventas pendientes del turno abierto", () => {
    const turnos = leer("turnos/turnos-pos.tsx");

    expect(turnos).toContain("guardarVistaTurnosOffline");
    expect(turnos).toContain("leerVistaTurnosOffline");
    expect(turnos).toContain("sumarVentasLocalesAResumenTurno");
    expect(turnos).toContain("de sincronizar");
    expect(turnos).toContain("Conéctate a internet para ver el detalle de este cierre anterior.");
  });

  it("Pagos y Devoluciones hidratan sus filas sin romper el candado del panel lateral", () => {
    const pagos = leer("pagos/pagos-pos.tsx");
    expect(pagos).toContain("guardarVistaPagosOffline");
    expect(pagos).toContain("leerVistaPagosOffline");
    expect(pagos).toContain("w-full!");
    expect(pagos).toContain("sm:max-w-[480px]!");

    const devoluciones = leer("devoluciones/devoluciones-pos.tsx");
    expect(devoluciones).toContain("guardarVistaDevolucionesOffline");
    expect(devoluciones).toContain("leerVistaDevolucionesOffline");
    expect(devoluciones).toContain("Conéctate a internet para registrar una devolución o nota de crédito.");
  });
});
