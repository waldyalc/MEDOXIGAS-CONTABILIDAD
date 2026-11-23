import { beforeEach, describe, expect, it, vi } from "vitest";

import { nuevaOperacionOffline } from "./cola-offline";
import { transportarOperacionOffline } from "./transporte-offline";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

const TERMINAL = "11111111-1111-4111-8111-111111111111";
const PRODUCTO = "22222222-2222-4222-8222-222222222222";
const TURNO = "88888888-8888-4888-8888-888888888888";

function venta(secuencia = 1) {
  return nuevaOperacionOffline({
    ambito: `usuario/${TERMINAL}`,
    tipo: "venta",
    turnoId: TURNO,
    secuencia,
    payload: {
      terminal_id: TERMINAL,
      contacto_defecto_id: null,
      contacto_id: null,
      lista_precio_id: null,
      numeracion_id: null,
      vendedor_id: null,
      fecha: "2026-11-23",
      lineas: [
        {
          producto_id: PRODUCTO,
          cantidad: "1",
          precio: "100",
          descuento_pct: "0",
          itbis_tasa: "18",
          unidad_id: null,
          impuesto_id: null,
        },
      ],
      pagos: [{ metodo: "efectivo", monto: "118", monto_recibido: "120" }],
    },
    snapshot: { ticket: { cliente: { nombre: "ZZTEST" }, total: "118.00" } },
  });
}

describe("transporte offline con pos_sincronizar_operacion", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("envía el UUID y el payload de la RPC de venta en una sola llamada directa", async () => {
    rpc.mockResolvedValue({
      data: {
        factura: { id: "factura-1", numero: 7, ncf: "B0200000007" },
        contacto: {},
        empresa: null,
        terminal: {},
        turno: {},
        lineas: [],
        pagos: [],
        impuestos: [],
        totales: {},
      },
      error: null,
    });
    const operacion = venta();
    const resultado = await transportarOperacionOffline(operacion, TERMINAL);
    expect(resultado.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [nombre, argumentos] = rpc.mock.calls[0] ?? [];
    expect(nombre).toBe("pos_sincronizar_operacion");
    expect(argumentos).toMatchObject({
      p: {
        client_uuid: operacion.uuid,
        terminal_id: TERMINAL,
        turno_id: TURNO,
        tipo: "venta",
        payload: {
          terminal_id: TERMINAL,
          pagos: [{ metodo: "efectivo", monto: "118", monto_recibido: "120" }],
        },
      },
    });
    expect(resultado.ok && resultado.resultado).toMatchObject({ factura: { ncf: "B0200000007" } });
  });

  it("marca fallida una venta rechazada por existencia y la conserva para reintentar", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "no hay existencia suficiente del producto Cánula", code: "P0001" },
    });
    const operacion = venta();
    const resultado = await transportarOperacionOffline(operacion, TERMINAL);
    expect(resultado).toMatchObject({ ok: false, transitorio: false });
    expect(resultado.ok ? "" : resultado.error).toContain("existencia");
  });

  it("reintenta con el mismo UUID cuando se pierde la respuesta", async () => {
    rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    rpc.mockResolvedValueOnce({ data: null, error: { message: "sin conexión", code: "08006" } });
    const operacion = venta();
    const primera = await transportarOperacionOffline(operacion, TERMINAL);
    const segunda = await transportarOperacionOffline(operacion, TERMINAL);
    expect(primera).toMatchObject({ ok: false, transitorio: true });
    expect(segunda).toMatchObject({ ok: false, transitorio: true });
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p: { client_uuid: operacion.uuid } });
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p: { client_uuid: operacion.uuid } });
  });
});
