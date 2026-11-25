import { describe, expect, it } from "vitest";

import {
  calcularReservaNcfLocal,
  formatearNcfLocal,
  parsearSecuenciaNcf,
  sincronizarContadoresNcfLocal,
} from "./ncf-local";

const NUMERACION_B02 = {
  id: "num-b02",
  prefijo: "B02",
  siguiente: 120,
  hasta: 500,
  vence: "2027-12-31",
  activa: true,
};

describe("numeración NCF consecutiva local", () => {
  it("formatea el NCF con el mismo padding de 8 dígitos que Postgres", () => {
    expect(formatearNcfLocal("B02", 1)).toBe("B0200000001");
    expect(formatearNcfLocal("B02", 120)).toBe("B0200000120");
    expect(formatearNcfLocal("B01", 98765432)).toBe("B0198765432");
  });

  it("avanza consecutivo en el dispositivo sin repetir NCF aunque el servidor siga en un valor viejo", () => {
    const primera = calcularReservaNcfLocal(NUMERACION_B02, undefined, "2026-11-24");
    expect(primera).toEqual({ ncf: "B0200000120", secuenciaUsada: 120, siguienteNuevo: 121 });

    const segunda = calcularReservaNcfLocal(NUMERACION_B02, primera.siguienteNuevo, "2026-11-24");
    expect(segunda).toEqual({ ncf: "B0200000121", secuenciaUsada: 121, siguienteNuevo: 122 });

    // Si el servidor avanzó más rápido (otra caja facturó), salta al siguiente libre del servidor.
    const trasOtraCaja = calcularReservaNcfLocal(
      { ...NUMERACION_B02, siguiente: 130 },
      segunda.siguienteNuevo,
      "2026-11-24",
    );
    expect(trasOtraCaja).toEqual({ ncf: "B0200000130", secuenciaUsada: 130, siguienteNuevo: 131 });
  });

  it("rechaza series inactivas, agotadas o vencidas con mensajes claros", () => {
    expect(() => calcularReservaNcfLocal({ ...NUMERACION_B02, activa: false }, undefined, "2026-11-24")).toThrow(
      /inactiva/,
    );
    expect(() => calcularReservaNcfLocal({ ...NUMERACION_B02, siguiente: 501 }, undefined, "2026-11-24")).toThrow(
      /agotada/,
    );
    expect(() => calcularReservaNcfLocal({ ...NUMERACION_B02, vence: "2026-11-23" }, undefined, "2026-11-24")).toThrow(
      /vencida/,
    );
  });

  it("extrae la secuencia de un NCF confirmado por el servidor y reconcilia pisos sin retroceder", () => {
    expect(parsearSecuenciaNcf("B0200000125", "B02")).toBe(125);
    expect(parsearSecuenciaNcf("B0100000125", "B02")).toBeNull();
    expect(parsearSecuenciaNcf("POS-LOCAL-abc", "B02")).toBeNull();

    const reconciliados = sincronizarContadoresNcfLocal({ "num-b02": 124, "num-b01": 10 }, [
      { id: "num-b02", siguiente: 120 },
      { id: "num-b01", siguiente: 18 },
    ]);
    expect(reconciliados).toEqual({ "num-b02": 124, "num-b01": 18 });
  });
});
