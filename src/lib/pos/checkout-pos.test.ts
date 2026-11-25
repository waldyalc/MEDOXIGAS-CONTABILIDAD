import { describe, expect, test } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKOUT = join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "vender", "checkout-pos.tsx");
const CONFIRMACION_OFFLINE = join(
  process.cwd(),
  "src",
  "app",
  "(pos)",
  "pos",
  "_components",
  "vender",
  "confirmacion-offline.tsx",
);

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

/**
 * Candado (auditoría POS, 24-11-2026): un monto excedido en tarjeta o en el
 * combinado no puede dejar «Cobrar» deshabilitado en efectivo o crédito —
 * sus flags solo pesan en el modo donde vive el input que los produce.
 */
describe("exceso de un método no bloquea «Cobrar» en los demás", () => {
  const checkout = readFileSync(CHECKOUT, "utf8");

  test("excedeOtro solo deshabilita en tarjeta/transferencia", () => {
    expect(
      checkout,
      "excedeOtro viene del input de tarjeta/transferencia: solo puede bloquear en esos modos",
    ).toContain('(modo === "tarjeta" || modo === "transferencia") && excedeOtro');
    expect(checkout, "excedeOtro suelto en ctaDeshabilitado era el bug: bloqueaba todos los métodos").not.toContain(
      "excedeOtro ||",
    );
  });

  test("excedeCombinado solo deshabilita en el combinado", () => {
    expect(checkout, "excedeCombinado es del modo combinado solamente").toContain(
      '(modo === "combinado" && excedeCombinado)',
    );
    expect(checkout, "excedeCombinado suelto bloqueaba los demás métodos").not.toContain("excedeCombinado ||");
  });
});

/**
 * Decisión de Waldy (24-11-2026): el modal Pagar factura muestra una sola
 * opción «Tarjeta» (la terminal decide crédito o débito) y la transferencia
 * pregunta a qué banco fue, enviando su `cuenta_id` al backend.
 */
describe("una sola Tarjeta y banco destino al transferir", () => {
  const checkout = readFileSync(CHECKOUT, "utf8");

  test("ya no hay dos tarjetas separadas y la opción unificada se llama «Tarjeta»", () => {
    expect(checkout, "Une «Tarjeta crédito» y «Tarjeta débito» en la opción única «Tarjeta»").not.toContain(
      "Tarjeta crédito",
    );
    expect(checkout, "Une «Tarjeta crédito» y «Tarjeta débito» en la opción única «Tarjeta»").not.toContain(
      "Tarjeta débito",
    );
    expect(checkout, "La opción unificada se llama «Tarjeta»").toContain('titulo="Tarjeta"');
  });

  test("la transferencia elige el banco destino y manda su cuenta_id", () => {
    expect(checkout, "El modal debe pedir el banco destino de la transferencia").toContain("Banco destino");
    expect(checkout, "El pago por transferencia envía el cuenta_id del banco elegido").toContain(
      "cuenta_id: bancoTransferenciaId",
    );
  });
});

/**
 * Decisión de Waldy (24-11-2026): en «Pagar factura» los tres métodos
 * principales se leen de izquierda a derecha Tarjeta, Transferencia y Efectivo.
 * La fila de «Otros métodos» (Combinado y Crédito) no cambia.
 */
describe("orden de los métodos principales en Pagar factura", () => {
  const checkout = readFileSync(CHECKOUT, "utf8");
  const inicio = checkout.indexOf('<div className="grid grid-cols-3 gap-2">');
  const fin = checkout.indexOf("Otros métodos");

  test("Tarjeta, Transferencia y Efectivo en ese orden de izquierda a derecha", () => {
    expect(inicio, "No se encontró la fila principal de métodos en «Pagar factura»").toBeGreaterThanOrEqual(0);
    expect(fin, "No se encontró la separación «Otros métodos» en «Pagar factura»").toBeGreaterThan(inicio);

    const fila = checkout.slice(inicio, fin);
    const tarjeta = fila.indexOf('titulo="Tarjeta"');
    const transferencia = fila.indexOf('titulo="Transferencia"');
    const efectivo = fila.indexOf('titulo="Efectivo"');

    expect(tarjeta, "La fila principal empieza con «Tarjeta» (decisión de Waldy, 24-11-2026)").toBeGreaterThanOrEqual(
      0,
    );
    expect(
      transferencia,
      "«Transferencia» va en el centro, después de «Tarjeta» (decisión de Waldy, 24-11-2026)",
    ).toBeGreaterThan(tarjeta);
    expect(
      efectivo,
      "«Efectivo» va a la derecha, después de «Transferencia» (decisión de Waldy, 24-11-2026)",
    ).toBeGreaterThan(transferencia);
  });
});

/**
 * Decisión de Waldy (24-11-2026): ventas de contado normales van local-first
 * puro (Opción A) con NCF consecutivo local y abren el mismo modal
 * «¡Venta completada!» (sin el preview «Venta guardada en este dispositivo»).
 * Crédito y cotizaciones siguen pidiendo conexión.
 */
describe("POS local-first y modal único ¡Venta completada!", () => {
  const checkout = readFileSync(CHECKOUT, "utf8");

  test("no existe ni se revive el preview viejo ConfirmacionOffline", () => {
    expect(
      existsSync(CONFIRMACION_OFFLINE),
      "ConfirmacionOffline fue eliminado: las ventas locales muestran el mismo modal ConfirmacionVenta",
    ).toBe(false);
    expect(checkout).not.toContain("ConfirmacionOffline");
    expect(checkout).not.toContain("armarTicketOffline");
  });

  test("las ventas de contado van primero al dispositivo con NCF local y crédito/cotización piden conexión", () => {
    expect(checkout).toContain("const requiereConexion = cotizacion !== null || porCobrarVisible");
    expect(checkout).toContain("armarVentaLocalResultado");
    expect(checkout).toContain("{ numeracion, fecha: hoy }");
  });
});
