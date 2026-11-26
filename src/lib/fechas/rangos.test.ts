import { describe, expect, it } from "vitest";

import {
  ATAJOS_FECHA,
  ATAJOS_RANGO,
  etiquetaFecha,
  etiquetaRango,
  fechaAyer,
  fechaFinAnioAnterior,
  fechaFinMesAnterior,
  fechaFinSemanaAnterior,
  fechaFinTrimestreAnterior,
  rangoAnioAnterior,
  rangoAyer,
  rangoEstaSemana,
  rangoEsteAnio,
  rangoEsteMes,
  rangoEsteTrimestre,
  rangoHoy,
  rangoMesAnterior,
  rangoSemanaAnterior,
  rangoTrimestreAnterior,
  rangoUltimos30Dias,
} from "./rangos";

describe("atajos de rango", () => {
  it("hoy y ayer", () => {
    expect(rangoHoy("2026-11-13")).toEqual({ desde: "2026-11-13", hasta: "2026-11-13" });
    expect(rangoAyer("2026-11-13")).toEqual({ desde: "2026-11-12", hasta: "2026-11-12" });
    expect(rangoAyer("2026-01-01")).toEqual({ desde: "2025-12-31", hasta: "2025-12-31" });
  });

  it("la semana empieza el lunes", () => {
    expect(rangoEstaSemana("2026-11-13")).toEqual({ desde: "2026-11-09", hasta: "2026-11-15" });
    expect(rangoEstaSemana("2026-11-09")).toEqual({ desde: "2026-11-09", hasta: "2026-11-15" });
  });

  it("la semana cruza el cambio de año", () => {
    expect(rangoEstaSemana("2026-01-04")).toEqual({ desde: "2025-12-29", hasta: "2026-01-04" });
    expect(rangoEstaSemana("2026-01-01")).toEqual({ desde: "2025-12-29", hasta: "2026-01-04" });
  });

  it("la semana anterior va de lunes a domingo", () => {
    expect(rangoSemanaAnterior("2026-11-13")).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(rangoSemanaAnterior("2026-01-04")).toEqual({ desde: "2025-12-22", hasta: "2025-12-28" });
  });

  it("el trimestre anterior es el trimestre calendario completo", () => {
    expect(rangoTrimestreAnterior("2026-11-13")).toEqual({ desde: "2026-07-01", hasta: "2026-09-30" });
    expect(rangoTrimestreAnterior("2026-01-15")).toEqual({ desde: "2025-10-01", hasta: "2025-12-31" });
  });

  it("este mes y mes anterior", () => {
    expect(rangoEsteMes("2026-11-13")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(rangoMesAnterior("2026-01-15")).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
  });

  it("mes anterior ajusta el último día de febrero", () => {
    expect(rangoMesAnterior("2026-03-31")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoMesAnterior("2024-03-10")).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
  });

  it("últimos 30 días incluye hoy como el día 30", () => {
    expect(rangoUltimos30Dias("2026-11-30")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(rangoUltimos30Dias("2026-01-15")).toEqual({ desde: "2025-12-17", hasta: "2026-01-15" });
  });

  it("cada trimestre del año", () => {
    expect(rangoEsteTrimestre("2026-01-15")).toEqual({ desde: "2026-01-01", hasta: "2026-03-31" });
    expect(rangoEsteTrimestre("2026-04-01")).toEqual({ desde: "2026-04-01", hasta: "2026-06-30" });
    expect(rangoEsteTrimestre("2026-07-31")).toEqual({ desde: "2026-07-01", hasta: "2026-09-30" });
    expect(rangoEsteTrimestre("2026-11-13")).toEqual({ desde: "2026-10-01", hasta: "2026-12-31" });
  });

  it("este año y año anterior", () => {
    expect(rangoEsteAnio("2026-06-15")).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" });
    expect(rangoAnioAnterior("2026-01-01")).toEqual({ desde: "2025-01-01", hasta: "2025-12-31" });
  });
});

describe("atajos de una fecha", () => {
  it("hoy y ayer", () => {
    expect(ATAJOS_FECHA[0]?.obtener("2026-11-13")).toBe("2026-11-13");
    expect(fechaAyer("2026-11-13")).toBe("2026-11-12");
    expect(fechaAyer("2026-01-01")).toBe("2025-12-31");
  });

  it("fin de semana anterior usa el domingo de la semana completa previa", () => {
    expect(fechaFinSemanaAnterior("2026-11-13")).toBe("2026-11-08");
    expect(fechaFinSemanaAnterior("2026-01-04")).toBe("2025-12-28");
  });

  it("fin de mes anterior", () => {
    expect(fechaFinMesAnterior("2026-01-05")).toBe("2025-12-31");
    expect(fechaFinMesAnterior("2026-03-01")).toBe("2026-02-28");
    expect(fechaFinMesAnterior("2024-03-01")).toBe("2024-02-29");
  });

  it("fin de trimestre anterior", () => {
    expect(fechaFinTrimestreAnterior("2026-11-13")).toBe("2026-09-30");
    expect(fechaFinTrimestreAnterior("2026-01-15")).toBe("2025-12-31");
  });

  it("fin de año anterior", () => {
    expect(fechaFinAnioAnterior("2026-11-13")).toBe("2025-12-31");
  });

  it("incluye todos los cortes útiles para reportes contables", () => {
    expect(ATAJOS_FECHA.map((atajo) => atajo.etiqueta)).toEqual([
      "Hoy",
      "Ayer",
      "Fin de semana anterior",
      "Fin de mes anterior",
      "Fin de trimestre anterior",
      "Fin de año anterior",
    ]);
  });
});

describe("etiquetas", () => {
  it("fecha y rango en español", () => {
    expect(etiquetaFecha("2026-11-01")).toBe("1 nov 2026");
    expect(etiquetaRango({ desde: "2026-11-01", hasta: "2026-11-30" })).toBe("1 nov 2026 – 30 nov 2026");
  });

  it("los atajos mantienen el orden de Alegra", () => {
    expect(
      ATAJOS_RANGO.map((atajo) => atajo.etiqueta),
      'el panel debe tener todos los atajos "anterior" de Alegra: Semana anterior y Trimestre anterior, en este orden',
    ).toEqual([
      "Hoy",
      "Ayer",
      "Esta semana",
      "Semana anterior",
      "Este mes",
      "Mes anterior",
      "Últimos 30 días",
      "Este trimestre",
      "Trimestre anterior",
      "Este año",
      "Año anterior",
      "Personalizado",
    ]);
  });
});
