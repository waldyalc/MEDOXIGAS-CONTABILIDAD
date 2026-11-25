import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regla de Waldy (24-11-2026): las pantallas del POS muestran su esqueleto al
 * entrar, como los módulos de Contabilidad — nada de lienzo vacío ni clicks
 * que «se frisan» mientras llegan los datos.
 */

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");
const existe = (ruta: string) => existsSync(join(process.cwd(), ruta));

const RUTAS_POS: { ruta: string; pantalla: string }[] = [
  { ruta: "src/app/(pos)/pos/loading.tsx", pantalla: "EsqueletoVenderPOS" },
  { ruta: "src/app/(pos)/pos/historial/loading.tsx", pantalla: "EsqueletoListaDetallePOS" },
  { ruta: "src/app/(pos)/pos/pagos/loading.tsx", pantalla: "EsqueletoPagosPOS" },
  { ruta: "src/app/(pos)/pos/turnos/loading.tsx", pantalla: "EsqueletoTurnosPOS" },
  { ruta: "src/app/(pos)/pos/devoluciones/loading.tsx", pantalla: "EsqueletoListaDetallePOS" },
];

describe("esqueletos de carga del POS", () => {
  it("las cinco pantallas del POS tienen su loading.tsx con el esqueleto espejo", () => {
    for (const { ruta, pantalla } of RUTAS_POS) {
      expect(existe(ruta), `Falta ${ruta}: al entrar al módulo se vería un lienzo vacío (regla de Waldy).`).toBe(true);
      const loading = leer(ruta);
      expect(loading, `${ruta} debe renderizar ${pantalla} mientras llegan los datos`).toContain(pantalla);
    }
  });

  it("los esqueletos viven en un solo archivo compartido del POS", () => {
    const ruta = "src/app/(pos)/pos/_components/esqueletos-pos.tsx";
    expect(existe(ruta), `Falta ${ruta}`).toBe(true);
    const esqueletos = leer(ruta);
    for (const nombre of [
      "EsqueletoVenderPOS",
      "EsqueletoListaDetallePOS",
      "EsqueletoTurnosPOS",
      "EsqueletoPagosPOS",
    ]) {
      expect(esqueletos, `Falta ${nombre} en esqueletos-pos.tsx`).toContain(`export function ${nombre}`);
    }
    expect(esqueletos, "Los esqueletos usan el Skeleton animado del sistema").toContain("@/components/ui/skeleton");
  });
});
