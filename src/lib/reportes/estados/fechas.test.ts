import { describe, expect, test } from "vitest";

import {
  compararPeriodoAnioAnterior,
  etiquetaDia,
  etiquetaMes,
  finAnioAnterior,
  inicioAnio,
  parsearBusqueda,
  parsearHasta,
  parsearVista,
  periodoAnterior,
  restarAnio,
  sumarDias,
} from "./fechas";

describe("fechas de los estados financieros", () => {
  test("calcula el período anterior de igual largo", () => {
    expect(periodoAnterior("2026-11-01", "2026-11-30")).toEqual({ desde: "2026-10-02", hasta: "2026-10-31" });
    expect(periodoAnterior("2026-11-01", "2026-11-13")).toEqual({ desde: "2026-10-19", hasta: "2026-10-31" });
    expect(periodoAnterior("2026-01-01", "2026-01-31")).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
  });

  test("compara con el mismo período del año anterior y maneja el 29 de febrero", () => {
    expect(compararPeriodoAnioAnterior("2026-11-01", "2026-11-30")).toEqual({
      desde: "2025-11-01",
      hasta: "2025-11-30",
    });
    expect(restarAnio("2024-02-29")).toBe("2023-02-28");
  });

  test("calcula límites de año y sumas de días", () => {
    expect(inicioAnio("2026-11-13")).toBe("2026-01-01");
    expect(finAnioAnterior("2026-11-13")).toBe("2025-12-31");
    expect(finAnioAnterior("2025-03-01")).toBe("2024-12-31");
    expect(sumarDias("2026-11-01", -1)).toBe("2026-10-31");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("lee filtros de la URL y etiqueta las columnas", () => {
    expect(parsearVista({})).toBe("detallado");
    expect(parsearVista({ vista: "resumido" })).toBe("resumido");
    expect(parsearBusqueda({ q: "  caja " })).toBe("caja");
    expect(parsearHasta({}, "2026-11-13")).toBe("2026-11-13");
    expect(parsearHasta({ hasta: "2026-02-30" }, "2026-11-13")).toBe("2026-11-13");
    expect(parsearHasta({ hasta: "2025-12-31" }, "2026-11-13")).toBe("2025-12-31");
    expect(etiquetaMes("2026-11-13")).toBe("Nov, 2026");
    expect(etiquetaDia("2026-11-13")).toBe("13 Nov, 2026");
  });
});
