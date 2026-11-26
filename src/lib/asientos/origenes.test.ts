import { describe, expect, test } from "vitest";

import { ETIQUETAS_DOCUMENTO, etiquetaOrigen } from "./origenes";
import fs from "node:fs";
import path from "node:path";

const PAGINA = path.join(process.cwd(), "src/app/(main)/dashboard/contabilidad/asientos/page.tsx");
const DETALLE = path.join(process.cwd(), "src/app/(main)/dashboard/contabilidad/asientos/[id]/_consultas.ts");
const ENLACES = path.join(process.cwd(), "src/lib/enlaces.ts");

describe("etiquetaOrigen", () => {
  test("traduce los orígenes que antes salían en snake_case", () => {
    expect(etiquetaOrigen("ajuste_inventario")).toBe("Ajuste de inventario");
    expect(etiquetaOrigen("inventario_inicial")).toBe("Inventario inicial");
    expect(etiquetaOrigen("pos_movimiento")).toBe("Movimiento de caja POS");
    expect(etiquetaOrigen("pos_diferencia")).toBe("Diferencia de cierre POS");
    expect(etiquetaOrigen("nomina")).toBe("Nómina");
    expect(etiquetaOrigen("pago_nomina")).toBe("Pago de nómina");
    expect(etiquetaOrigen("nota_credito_venta")).toBe("Nota de crédito");
    expect(etiquetaOrigen("recosteo_inventario")).toBe("Recosteo de inventario");
  });

  test("conserva la clave cruda si la base trae un origen desconocido", () => {
    expect(etiquetaOrigen("origen_nuevo")).toBe("origen_nuevo");
  });
});

describe("mapa de etiquetas compartido", () => {
  test("el listado usa etiquetaOrigen y no un mapa local", () => {
    const fuente = fs.readFileSync(PAGINA, "utf8");

    expect(fuente).toContain('from "@/lib/asientos/origenes"');
    expect(fuente).toContain("etiquetaOrigen(asiento.origen_tipo)");
    expect(fuente).not.toContain("const ORIGENES");
  });

  test("el detalle usa el mapa compartido y enlaza el ajuste de inventario", () => {
    const fuente = fs.readFileSync(DETALLE, "utf8");

    expect(fuente).toContain('from "@/lib/asientos/origenes"');
    expect(fuente).not.toContain("const ETIQUETAS_DOCUMENTO");
    expect(fuente).toContain("rutaAjusteInventario");
    expect(fuente).toContain("ETIQUETAS_DOCUMENTO[asiento.origen_tipo] ?? ");
  });

  test("el listado enlaza el asiento de ajuste de inventario a su documento", () => {
    const fuente = fs.readFileSync(ENLACES, "utf8");

    expect(fuente).toContain("ajuste_inventario: rutaAjusteInventario");
  });

  test("el mapa declara los 21 orígenes del CHECK de la base", () => {
    expect(Object.keys(ETIQUETAS_DOCUMENTO)).toHaveLength(21);
  });
});
