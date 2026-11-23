import { describe, expect, it, vi } from "vitest";

import {
  type AlmacenColaOffline,
  demoraReintentoOffline,
  nuevaOperacionOffline,
  type OperacionOffline,
  sincronizarColaOffline,
} from "./cola-offline";

function preparar() {
  const filas = new Map<string, OperacionOffline>();
  const almacen: AlmacenColaOffline = {
    listar: async (ambito) => [...filas.values()].filter((fila) => fila.ambito === ambito),
    guardar: async (fila) => {
      filas.set(fila.uuid, structuredClone(fila));
    },
  };
  const crear = (secuencia: number) =>
    nuevaOperacionOffline({
      ambito: "usuario/terminal",
      tipo: "venta",
      turnoId: "turno",
      payload: { precio: "120.00" },
      snapshot: { cliente: "Cliente", precio: "120.00" },
      secuencia,
    });
  return { filas, almacen, crear };
}

describe("cola offline POS", () => {
  it("conserva UUID y snapshot al reintentar tras perder una respuesta ya confirmada en servidor", async () => {
    const { almacen, crear, filas } = preparar();
    const venta = crear(1);
    await almacen.guardar(venta);
    const servidor = new Map<string, string>();
    let perderRespuesta = true;
    const enviar = vi.fn(async (operacion: OperacionOffline) => {
      servidor.set(operacion.uuid, servidor.get(operacion.uuid) ?? "factura-1");
      if (perderRespuesta) {
        perderRespuesta = false;
        throw new Error("timeout");
      }
      return { ok: true as const, resultado: servidor.get(operacion.uuid) };
    });
    await sincronizarColaOffline(almacen, venta.ambito, enviar, () => 0);
    expect(filas.get(venta.uuid)?.estado).toBe("pendiente");
    await sincronizarColaOffline(almacen, venta.ambito, enviar, () => 5_000);
    await sincronizarColaOffline(almacen, venta.ambito, enviar, () => 10_000);
    expect(servidor.size).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls.map(([operacion]) => operacion.uuid)).toEqual([venta.uuid, venta.uuid]);
    expect(filas.get(venta.uuid)?.snapshot).toEqual({ cliente: "Cliente", precio: "120.00" });
    expect(filas.get(venta.uuid)?.estado).toBe("sincronizada");
  });

  it("no adelanta operaciones dependientes durante backoff ni ante un error de negocio", async () => {
    const { almacen, crear, filas } = preparar();
    const primera = crear(1);
    const segunda = crear(2);
    await almacen.guardar(segunda);
    await almacen.guardar(primera);
    const enviar = vi.fn(async () => ({ ok: false as const, transitorio: true, error: "Sin red" }));
    await sincronizarColaOffline(almacen, primera.ambito, enviar, () => 0);
    await sincronizarColaOffline(almacen, primera.ambito, enviar, () => 4_999);
    expect(enviar).toHaveBeenCalledTimes(1);
    const rechazar = vi.fn(async () => ({ ok: false as const, transitorio: false, error: "Sin existencia" }));
    await sincronizarColaOffline(almacen, primera.ambito, rechazar, () => 5_000);
    await sincronizarColaOffline(almacen, primera.ambito, rechazar, () => 10_000);
    expect(rechazar).toHaveBeenCalledTimes(1);
    expect(filas.get(primera.uuid)?.estado).toBe("fallida");
    expect(filas.get(segunda.uuid)?.intentos).toBe(0);
  });

  it("procesa tres ventas en orden y no incluye la cola de otro usuario", async () => {
    const { almacen, crear } = preparar();
    for (const numero of [3, 1, 2]) await almacen.guardar(crear(numero));
    await almacen.guardar({ ...crear(0), ambito: "otro/terminal" });
    const enviar = vi.fn(async () => ({ ok: true as const, resultado: "confirmado" }));
    await sincronizarColaOffline(almacen, "usuario/terminal", enviar);
    expect(enviar.mock.calls).toHaveLength(3);
    expect((await almacen.listar("otro/terminal"))[0]?.estado).toBe("pendiente");
  });

  it("limita el backoff a diez minutos y el snapshot no cambia con el carrito", () => {
    const { crear } = preparar();
    expect(demoraReintentoOffline(1)).toBe(5_000);
    expect(demoraReintentoOffline(1_000)).toBe(600_000);
    const entrada = crear(1);
    const copia = nuevaOperacionOffline(entrada);
    entrada.payload = { precio: "999.00" };
    expect(copia.payload).toEqual({ precio: "120.00" });
    expect(copia.folio).toBe(`POS-LOCAL-${copia.uuid}`);
  });
});
