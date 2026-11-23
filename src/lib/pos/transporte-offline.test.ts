import { beforeEach, describe, expect, it, vi } from "vitest";

import { nuevaOperacionOffline, type OperacionOffline, sincronizarColaOffline } from "./cola-offline";
import { transportarOperacionOffline } from "./transporte-offline";

const rpc = vi.fn();
const refreshSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc, auth: { refreshSession } }),
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

const VENTA_CONFIRMADA = {
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
};

describe("transporte offline con pos_sincronizar_operacion", () => {
  beforeEach(() => {
    rpc.mockReset();
    refreshSession.mockReset();
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

  it("reintenta una vez tras refrescar la sesión vencida (42501)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "sin permiso", code: "42501" } });
    refreshSession.mockResolvedValueOnce({ data: { session: { access_token: "nuevo" } }, error: null });
    rpc.mockResolvedValueOnce(VENTA_CONFIRMADA);
    const operacion = venta();
    const resultado = await transportarOperacionOffline(operacion, TERMINAL);
    expect(resultado.ok).toBe(true);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p: { client_uuid: operacion.uuid } });
  });

  it("deja la venta pendiente y avisada cuando la sesión vence y el refresco falla", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sin permiso", code: "42501" } });
    refreshSession.mockResolvedValueOnce({ data: { session: null }, error: { message: "refresh token not found" } });
    const resultado = await transportarOperacionOffline(venta(), TERMINAL);
    expect(resultado).toMatchObject({ ok: false, transitorio: true, sesionRequerida: true });
    expect(resultado.ok ? "" : resultado.error).toContain("Vuelve a iniciar sesión");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("tampoco la marca fallida si el 42501 persiste después de refrescar", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sin permiso", code: "42501" } });
    refreshSession.mockResolvedValueOnce({ data: { session: { access_token: "nuevo" } }, error: null });
    const resultado = await transportarOperacionOffline(venta(), TERMINAL);
    expect(resultado).toMatchObject({ ok: false, transitorio: true, sesionRequerida: true });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("la cola conserva la venta pendiente, con aviso y sin perderla, al vencer la sesión", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sin permiso", code: "42501" } });
    refreshSession.mockResolvedValueOnce({ data: { session: null }, error: { message: "refresh token not found" } });
    const operacion = venta();
    const filas = new Map<string, OperacionOffline>([[operacion.uuid, operacion]]);
    const almacen = {
      listar: async () => [...filas.values()].map((fila) => structuredClone(fila)),
      guardar: async (fila: OperacionOffline) => {
        filas.set(fila.uuid, structuredClone(fila));
      },
      eliminar: async (_ambito: string, uuid: string) => {
        filas.delete(uuid);
      },
    };
    await sincronizarColaOffline(almacen, operacion.ambito, (fila) => transportarOperacionOffline(fila, TERMINAL));
    const guardada = filas.get(operacion.uuid);
    expect(guardada).toMatchObject({ estado: "pendiente", intentos: 1 });
    expect(guardada?.error).toContain("Vuelve a iniciar sesión");
  });

  it("40001 y 40P01 son transitorios y no tocan la sesión", async () => {
    for (const code of ["40001", "40P01"]) {
      rpc.mockResolvedValueOnce({ data: null, error: { message: "conflicto", code } });
      const resultado = await transportarOperacionOffline(venta(), TERMINAL);
      expect(resultado).toMatchObject({ ok: false, transitorio: true });
      expect("sesionRequerida" in resultado).toBe(false);
    }
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("PGRST202 y PGRST204 son permanentes: marca fallida sin refrescar ni reintentar", async () => {
    for (const code of ["PGRST202", "PGRST204"]) {
      rpc.mockResolvedValueOnce({ data: null, error: { message: "schema cache", code } });
      const resultado = await transportarOperacionOffline(venta(), TERMINAL);
      expect(resultado).toMatchObject({ ok: false, transitorio: false });
    }
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
