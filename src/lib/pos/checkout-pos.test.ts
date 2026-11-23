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

/**
 * Candado del cobro combinado con métodos repetidos: dos efectivos o dos
 * transferencias son filas separadas y la aritmética sale de una función pura
 * probada con filas repetidas (`calculo.test.ts`).
 */
describe("cobro combinado con el mismo método repetido", () => {
  const checkout = readFileSync(CHECKOUT, "utf8");

  test("agregar fila no descarta los métodos que ya están en la tabla", () => {
    expect(checkout, "El método puede repetirse: no filtres por `fila.metodo === metodo`").not.toMatch(
      /!filas\.some\(\(fila\) => fila\.metodo === metodo\)/,
    );
    expect(checkout, "El Select no debe ocultar un método ya usado en otra fila").not.toMatch(
      /!filas\.some\(\(otra\) => otra\.id !== fila\.id && otra\.metodo === candidato\)/,
    );
    expect(checkout, "El tope de filas es MAXIMO_PAGOS_VENTA, no 4").toContain("filas.length >= MAXIMO_PAGOS_VENTA");
    expect(checkout, "No vuelve el tope viejo de 4 filas").not.toContain("filas.length >= 4");
  });

  test("agrega filas extra y solo bloquea quitar la última", () => {
    expect(checkout, "El botón «Agregar método» debe seguir en el combinado").toContain("Agregar método");
    expect(checkout).toMatch(/<Plus aria-hidden="true" \/>/);
    expect(checkout, "Cada fila se quita por su id").toContain("actuales.filter((actual) => actual.id !== fila.id)");
    expect(checkout, "La última fila no se puede quitar").toContain("disabled={filas.length === 1}");
    expect(checkout).toContain('aria-label="Quitar método"');
  });

  test("aplicado, por cobrar, cambio y crédito usan el cálculo probado", () => {
    expect(checkout, "La matemática del combinado vive en calculo.ts").toContain(
      "calcularTotalesCombinadoPOS(filas, total)",
    );
    expect(checkout, "El payload conserva una fila por pago, aunque repita método").toContain(
      "armarPagosCombinadoPOS(filas, hayCreditoCombinado)",
    );
  });
});
