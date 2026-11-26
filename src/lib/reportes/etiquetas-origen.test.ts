import { describe, expect, test } from "vitest";

import { ETIQUETAS_DOCUMENTO } from "@/lib/asientos/origenes";

import { ETIQUETAS_ORIGEN } from "./libro-diario";
import fs from "node:fs";
import path from "node:path";

/**
 * Candado: todo `origen_tipo` aceptado por el CHECK de `asientos` debe tener
 * una etiqueta legible en Libro Diario / Asientos. Si una migración agrega un
 * origen nuevo y se olvida la etiqueta, este test falla.
 */
function origenesDelConstraint(): string[] {
  const directorio = path.join(process.cwd(), "supabase", "migrations");
  const archivos = fs
    .readdirSync(directorio)
    .filter((nombre) => nombre.endsWith(".sql"))
    .sort();

  let valores: string[] = [];
  for (const archivo of archivos) {
    const sql = fs.readFileSync(path.join(directorio, archivo), "utf8");
    const marca = "asientos_origen_tipo_check check";
    const inicio = sql.lastIndexOf(marca);
    if (inicio < 0) continue;
    const bloque = sql.slice(inicio);
    const fin = bloque.indexOf("));");
    const texto = fin >= 0 ? bloque.slice(0, fin) : bloque;
    const encontrados = [...texto.matchAll(/'([a-z_]+)'/g)]
      .map((coincidencia) => coincidencia[1] ?? "")
      .filter((valor) => valor !== "");
    if (encontrados.length > 0) valores = encontrados;
  }

  return [...new Set(valores)].sort();
}

describe("etiquetas de origen de asientos", () => {
  test("el CHECK de asientos declara los origenes conocidos", () => {
    const origenes = origenesDelConstraint();
    expect(origenes.length).toBeGreaterThanOrEqual(20);
    expect(origenes).toContain("pos_movimiento");
    expect(origenes).toContain("pos_diferencia");
    expect(origenes).toContain("nomina");
    expect(origenes).toContain("pago_nomina");
    expect(origenes).toContain("recosteo_inventario");
  });

  test("todo origen del CHECK tiene etiqueta en español", () => {
    const faltantes = origenesDelConstraint().filter((origen) => {
      const etiqueta = ETIQUETAS_ORIGEN[origen];
      return typeof etiqueta !== "string" || etiqueta.trim() === "";
    });

    expect(faltantes).toEqual([]);
  });

  test("el mapa compartido de Asientos cubre los mismos orígenes", () => {
    const faltantes = origenesDelConstraint().filter((origen) => {
      const etiqueta = ETIQUETAS_DOCUMENTO[origen];
      return typeof etiqueta !== "string" || etiqueta.trim() === "";
    });

    expect(faltantes).toEqual([]);
  });

  test("las etiquetas nuevas son legibles", () => {
    expect(ETIQUETAS_ORIGEN.pos_movimiento).toBe("Movimiento de caja POS");
    expect(ETIQUETAS_ORIGEN.pos_diferencia).toBe("Diferencia de cierre POS");
    expect(ETIQUETAS_ORIGEN.nomina).toBe("Nómina");
    expect(ETIQUETAS_ORIGEN.pago_nomina).toBe("Pago de nómina");
  });
});
