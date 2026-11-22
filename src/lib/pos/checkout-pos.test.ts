import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKOUT = join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "vender", "checkout-pos.tsx");

/**
 * Candado del Punto 8 del PLAN POS 2: la X y «Cancelar» del modal Pagar
 * factura cierran el cobro de inmediato, conservan el carrito y no preguntan
 * «¿Cerrar el cobro?». Si alguien vuelve a meter el diálogo, este test falla.
 */
describe("cerrar el cobro desde Pagar factura", () => {
  const checkout = readFileSync(CHECKOUT, "utf8");

  test("no vuelve a mostrar «¿Cerrar el cobro?» ni el aviso de venta sin cobrar", () => {
    expect(checkout, "Quita el diálogo «La venta no se ha cobrado. ¿Cerrar el cobro?»").not.toContain(
      "¿Cerrar el cobro?",
    );
    expect(checkout).not.toContain("La venta no se ha cobrado");
    expect(checkout, "No debe quedar el estado del segundo diálogo").not.toContain("confirmarCierre");
  });

  test("la X cierra directo y respeta el bloqueo mientras se envía", () => {
    expect(checkout).toContain("if (enviando) return;");
    expect(checkout).toContain("onCerrar();");
  });
});
