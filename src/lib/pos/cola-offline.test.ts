import { describe, expect, it, vi } from "vitest";

import {
  type AlmacenColaOffline,
  demoraReintentoOffline,
  ErrorImpedimentoCierreOffline,
  MENSAJE_SIN_CONEXION_CIERRE,
  MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR,
  nuevaOperacionOffline,
  type OperacionOffline,
  programarReintentoOffline,
  revisionCierreOffline,
  sincronizarColaOffline,
} from "./cola-offline";

function preparar() {
  const filas = new Map<string, OperacionOffline>();
  const almacen: AlmacenColaOffline = {
    listar: async (ambito) => [...filas.values()].filter((fila) => fila.ambito === ambito),
    guardar: async (fila) => {
      filas.set(fila.uuid, structuredClone(fila));
    },
    eliminar: async (ambito, uuid) => {
      const fila = filas.get(uuid);
      if (fila?.ambito === ambito) filas.delete(uuid);
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

  it("ante un fallo de red respeta el backoff y no adelanta las ventas siguientes", async () => {
    const { almacen, crear, filas } = preparar();
    const primera = crear(1);
    const segunda = crear(2);
    await almacen.guardar(segunda);
    await almacen.guardar(primera);
    const enviar = vi.fn(async () => ({ ok: false as const, transitorio: true, error: "Sin red" }));
    await sincronizarColaOffline(almacen, primera.ambito, enviar, () => 0);
    await sincronizarColaOffline(almacen, primera.ambito, enviar, () => 4_999);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(filas.get(primera.uuid)?.estado).toBe("pendiente");
    expect(filas.get(segunda.uuid)?.intentos).toBe(0);
  });

  it("una venta fallida no tranca la cola: suben las nueve válidas y la fallida queda marcada", async () => {
    const { almacen, crear, filas } = preparar();
    const operaciones = Array.from({ length: 10 }, (_, indice) => crear(indice + 1));
    for (const operacion of operaciones) await almacen.guardar(operacion);
    const rechazada = operaciones[0];
    if (!rechazada) throw new Error("Falta la operación rechazada.");
    const enviar = vi.fn(async (operacion: OperacionOffline) =>
      operacion.uuid === rechazada.uuid
        ? { ok: false as const, transitorio: false, error: "Sin existencia" }
        : { ok: true as const, resultado: { factura: { numero: operacion.secuencia } } },
    );

    await sincronizarColaOffline(almacen, rechazada.ambito, enviar, () => 0);

    expect(enviar).toHaveBeenCalledTimes(10);
    expect(filas.get(rechazada.uuid)).toMatchObject({
      estado: "fallida",
      error: "Sin existencia",
      proximoIntento: 0,
    });
    for (const valida of operaciones.slice(1)) {
      expect(filas.get(valida.uuid)?.estado).toBe("sincronizada");
    }

    enviar.mockClear();
    await sincronizarColaOffline(almacen, rechazada.ambito, enviar, () => 10_000);
    expect(enviar).not.toHaveBeenCalled();
    expect(filas.get(rechazada.uuid)?.estado).toBe("fallida");
  });

  it("reintentar una venta fallida la vuelve a encolar y la sube con su mismo UUID", async () => {
    const { almacen, crear, filas } = preparar();
    const venta = crear(1);
    await almacen.guardar(venta);
    const rechazar = vi.fn(async () => ({ ok: false as const, transitorio: false, error: "Sin existencia" }));
    await sincronizarColaOffline(almacen, venta.ambito, rechazar, () => 0);
    const fallida = filas.get(venta.uuid);
    if (!fallida) throw new Error("La venta fallida debe conservarse en la cola.");

    await almacen.guardar(programarReintentoOffline(fallida));
    expect(filas.get(venta.uuid)).toMatchObject({ estado: "pendiente", error: null, proximoIntento: 0 });

    const enviar = vi.fn(async (_operacion: OperacionOffline) => ({
      ok: true as const,
      resultado: { factura: { numero: 7 } },
    }));
    await sincronizarColaOffline(almacen, venta.ambito, enviar, () => 10_000);
    expect(enviar.mock.calls[0]?.[0].uuid).toBe(venta.uuid);
    expect(filas.get(venta.uuid)?.estado).toBe("sincronizada");
  });

  it("cierre estricto: bloquea con pendientes, con fallidas y sin conexión; solo permite la cola limpia", () => {
    const fallida = { estado: "fallida" as const };
    const pendiente = { estado: "pendiente" as const };
    const sincronizada = { estado: "sincronizada" as const };

    expect(revisionCierreOffline([pendiente], true)).toEqual({
      impedimento: MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR,
      aviso: null,
      porSubir: 1,
      fallidas: 0,
    });
    expect(revisionCierreOffline([fallida, sincronizada], true).impedimento).toBe(
      "Debes sincronizar tu información antes de poder cerrar turno",
    );
    expect(revisionCierreOffline([fallida, fallida, sincronizada], true)).toMatchObject({
      impedimento: MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR,
      porSubir: 0,
      fallidas: 2,
    });
    expect(revisionCierreOffline([pendiente, fallida], false).impedimento).toBe(MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR);

    expect(revisionCierreOffline([sincronizada], false)).toEqual({
      impedimento: MENSAJE_SIN_CONEXION_CIERRE,
      aviso: null,
      porSubir: 0,
      fallidas: 0,
    });
    expect(revisionCierreOffline([], true)).toEqual({
      impedimento: null,
      aviso: null,
      porSubir: 0,
      fallidas: 0,
    });
  });

  it("ErrorImpedimentoCierreOffline conserva el nombre y el mensaje local", () => {
    const error = new ErrorImpedimentoCierreOffline(MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ErrorImpedimentoCierreOffline");
    expect(error.message).toBe("Debes sincronizar tu información antes de poder cerrar turno");
    expect(new ErrorImpedimentoCierreOffline(MENSAJE_SIN_CONEXION_CIERRE).message).toBe(
      "Sin conexión a internet. No puedes cerrar el turno sin conexión.",
    );
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
