import { describe, expect, test } from "vitest";
import type { z } from "zod";

import {
  esquemaAbrirTurno,
  esquemaCatalogoPOS,
  esquemaCerrarTurno,
  esquemaCotizacionPOS,
  esquemaDevolucion,
  esquemaFiltrosHistorial,
  esquemaMovimientoTurno,
  esquemaPlantillaTicket,
  esquemaTerminal,
  esquemaTerminalEdicion,
  esquemaVenta,
  mensajeValidacion,
} from "./esquemas";

const TERMINAL = "11111111-1111-4111-8111-111111111111";
const PRODUCTO = "22222222-2222-4222-8222-222222222222";
const CONTACTO = "33333333-3333-4333-8333-333333333333";
const OTRO_CONTACTO = "44444444-4444-4444-8444-444444444444";
const FACTURA = "55555555-5555-4555-8555-555555555555";
const CUENTA = "66666666-6666-4666-8666-666666666666";
const LINEA = "77777777-7777-4777-8777-777777777777";
const TURNO = "88888888-8888-4888-8888-888888888888";

function errorDe(resultado: z.ZodSafeParseResult<unknown>): string | null {
  return resultado.success ? null : mensajeValidacion(resultado.error);
}

const linea = { producto_id: PRODUCTO, cantidad: "1", precio: "100", itbis_tasa: "18" };

const ventaValida = {
  terminal_id: TERMINAL,
  lineas: [linea],
  pagos: [{ metodo: "efectivo", monto: "118", monto_recibido: "120" }],
};

describe("esquemaVenta", () => {
  test("acepta una venta válida y aplica los defaults de la línea", () => {
    const resultado = esquemaVenta.safeParse({
      terminal_id: TERMINAL,
      lineas: [{ producto_id: PRODUCTO, cantidad: "2", precio: "100", itbis_tasa: "18" }],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.pagos).toEqual([]);
    expect(resultado.data.lineas?.[0]?.descuento_pct).toBe("0");
  });

  test("rechaza dos fuentes de venta a la vez", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          ...ventaValida,
          venta_simple: { descripcion: "Servicio", monto: "100" },
        }),
      ),
    ).toBe("Indica líneas, venta simple o una cotización, no varias a la vez.");
  });

  test("rechaza una venta sin fuente", () => {
    expect(errorDe(esquemaVenta.safeParse({ terminal_id: TERMINAL, pagos: [] }))).toBe(
      "Indica líneas, venta simple o una cotización, no varias a la vez.",
    );
  });

  test("la línea libre exige descripción y precio", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [{ producto_id: null, cantidad: "1", itbis_tasa: "0" }],
        }),
      ),
    ).toBe("La línea libre requiere una descripción.");

    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [{ producto_id: null, descripcion: "Flete", cantidad: "1", itbis_tasa: "0" }],
        }),
      ),
    ).toBe("La línea libre requiere un precio.");
  });

  test("la línea libre no admite unidad de medida", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [
            {
              producto_id: null,
              descripcion: "Flete",
              cantidad: "1",
              precio: "500",
              unidad_id: PRODUCTO,
            },
          ],
        }),
      ),
    ).toBe("La línea libre no admite unidad de medida.");
  });

  test("rechaza un pago combinado que excede el total", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [linea],
          pagos: [
            { metodo: "efectivo", monto: "100" },
            { metodo: "tarjeta_credito", monto: "30" },
          ],
        }),
      ),
    ).toBe("La suma de los pagos no puede exceder el total de la venta.");
  });

  test("el cambio solo se permite sobre efectivo", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [linea],
          pagos: [{ metodo: "tarjeta_debito", monto: "118", monto_recibido: "120" }],
        }),
      ),
    ).toBe("Solo el efectivo admite monto recibido y cambio.");
  });

  test("acepta monto recibido igual al monto en un método no efectivo", () => {
    const resultado = esquemaVenta.safeParse({
      terminal_id: TERMINAL,
      lineas: [linea],
      pagos: [{ metodo: "transferencia", monto: "118", monto_recibido: "118" }],
    });

    expect(resultado.success).toBe(true);
  });

  test("el efectivo recibido no puede ser menor al monto aplicado", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [linea],
          pagos: [{ metodo: "efectivo", monto: "118", monto_recibido: "100" }],
        }),
      ),
    ).toBe("El monto recibido en efectivo no puede ser menor al monto del pago.");
  });

  test("no permite cambio en una venta que queda a crédito", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          lineas: [{ producto_id: PRODUCTO, cantidad: "2", precio: "100", itbis_tasa: "18" }],
          pagos: [{ metodo: "efectivo", monto: "100", monto_recibido: "120" }],
        }),
      ),
    ).toBe("No se puede dar cambio en una venta que queda a crédito.");
  });

  test("bloquea el crédito total al Consumidor Final", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          contacto_defecto_id: CONTACTO,
          lineas: [linea],
          pagos: [],
        }),
      ),
    ).toBe("No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.");
  });

  test("bloquea el crédito parcial al Consumidor Final", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          terminal_id: TERMINAL,
          contacto_defecto_id: CONTACTO,
          lineas: [{ producto_id: PRODUCTO, cantidad: "2", precio: "100", itbis_tasa: "18" }],
          pagos: [{ metodo: "efectivo", monto: "100" }],
        }),
      ),
    ).toBe("No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.");
  });

  test("permite el crédito parcial a otro cliente", () => {
    const resultado = esquemaVenta.safeParse({
      terminal_id: TERMINAL,
      contacto_id: OTRO_CONTACTO,
      contacto_defecto_id: CONTACTO,
      lineas: [{ producto_id: PRODUCTO, cantidad: "2", precio: "100", itbis_tasa: "18" }],
      pagos: [{ metodo: "efectivo", monto: "100" }],
    });

    expect(resultado.success).toBe(true);
  });

  test("el vencimiento no puede ser anterior a la fecha", () => {
    expect(
      errorDe(
        esquemaVenta.safeParse({
          ...ventaValida,
          fecha: "2026-11-20",
          vencimiento: "2026-11-19",
        }),
      ),
    ).toBe("El vencimiento no puede ser anterior a la fecha.");
  });

  test("acepta la conversión de una cotización sin líneas", () => {
    const resultado = esquemaVenta.safeParse({
      terminal_id: TERMINAL,
      cotizacion_id: FACTURA,
      pagos: [],
    });

    expect(resultado.success).toBe(true);
  });
});

describe("esquemaCotizacionPOS", () => {
  test("acepta líneas y rechaza cotización de cotización", () => {
    expect(esquemaCotizacionPOS.safeParse({ terminal_id: TERMINAL, lineas: [linea] }).success).toBe(true);
    expect(esquemaCotizacionPOS.safeParse({ terminal_id: TERMINAL, lineas: [linea], venta_simple: {} }).success).toBe(
      false,
    );
  });
});

describe("esquemaAbrirTurno", () => {
  test("la base inicial por defecto es cero", () => {
    const resultado = esquemaAbrirTurno.safeParse({ terminal_id: TERMINAL });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.base_inicial).toBe("0");
  });

  test("rechaza una base negativa", () => {
    expect(errorDe(esquemaAbrirTurno.safeParse({ terminal_id: TERMINAL, base_inicial: "-1" }))).toBe(
      "La base inicial no puede ser negativa.",
    );
  });
});

const movimientoBase = {
  turno_id: TURNO,
  tipo: "ingreso",
  motivo: "fondo_caja",
  monto: "100",
  cuenta_contrapartida_id: CUENTA,
};

describe("esquemaMovimientoTurno", () => {
  test("acepta un fondo de caja con su contrapartida", () => {
    expect(esquemaMovimientoTurno.safeParse(movimientoBase).success).toBe(true);
  });

  test("el motivo debe corresponder al tipo", () => {
    expect(errorDe(esquemaMovimientoTurno.safeParse({ ...movimientoBase, tipo: "retiro" }))).toBe(
      "El motivo del movimiento no corresponde al tipo.",
    );
  });

  test("el cobro de factura exige la factura y no la contrapartida", () => {
    expect(
      errorDe(
        esquemaMovimientoTurno.safeParse({
          turno_id: TURNO,
          tipo: "ingreso",
          motivo: "cobro_factura",
          monto: "100",
        }),
      ),
    ).toBe("El cobro de factura requiere la factura.");

    expect(
      esquemaMovimientoTurno.safeParse({
        turno_id: TURNO,
        tipo: "ingreso",
        motivo: "cobro_factura",
        monto: "100",
        factura_id: FACTURA,
      }).success,
    ).toBe(true);
  });

  test("un motivo que no es cobro no puede llevar factura", () => {
    expect(errorDe(esquemaMovimientoTurno.safeParse({ ...movimientoBase, factura_id: FACTURA }))).toBe(
      "Solo el cobro de factura puede llevar una factura.",
    );
  });

  test("el gasto menor exige cuenta y descripción", () => {
    expect(
      errorDe(
        esquemaMovimientoTurno.safeParse({
          turno_id: TURNO,
          tipo: "retiro",
          motivo: "gasto_menor",
          monto: "100",
        }),
      ),
    ).toBe("La cuenta de gasto es obligatoria.");
  });

  test("valida que el ITBIS del gasto cuadre con el monto", () => {
    expect(
      errorDe(
        esquemaMovimientoTurno.safeParse({
          turno_id: TURNO,
          tipo: "retiro",
          motivo: "gasto_menor",
          monto: "100",
          cuenta_gasto_id: CUENTA,
          descripcion: "Papel",
          subtotal: "100",
          itbis_tasa: "18",
        }),
      ),
    ).toBe("El ITBIS del gasto no cuadra con el monto.");
  });

  test("acepta un gasto menor con ITBIS cuadrado", () => {
    expect(
      esquemaMovimientoTurno.safeParse({
        turno_id: TURNO,
        tipo: "retiro",
        motivo: "gasto_menor",
        monto: "118",
        cuenta_gasto_id: CUENTA,
        descripcion: "Papel",
        subtotal: "100",
        itbis_tasa: "18",
      }).success,
    ).toBe(true);
  });

  test("los movimientos directos exigen la cuenta de contrapartida", () => {
    expect(
      errorDe(
        esquemaMovimientoTurno.safeParse({
          turno_id: TURNO,
          tipo: "retiro",
          motivo: "retiro_caja",
          monto: "100",
        }),
      ),
    ).toBe("La cuenta de contrapartida es obligatoria.");
  });
});

describe("esquemaCerrarTurno", () => {
  test("el efectivo real es obligatorio y no puede ser negativo", () => {
    expect(errorDe(esquemaCerrarTurno.safeParse({ turno_id: TURNO, efectivo_real: "" }))).toBe(
      "El efectivo real es obligatorio.",
    );
    expect(errorDe(esquemaCerrarTurno.safeParse({ turno_id: TURNO, efectivo_real: "-5" }))).toBe(
      "El efectivo real no puede ser negativo.",
    );
  });

  test("acepta un cierre válido y registra la diferencia por defecto", () => {
    const resultado = esquemaCerrarTurno.safeParse({ turno_id: TURNO, efectivo_real: "300" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.registrar_diferencia).toBe(true);
  });
});

const devolucionValida = {
  terminal_id: TERMINAL,
  factura_id: FACTURA,
  tipo_reembolso: "efectivo",
  lineas: [{ factura_linea_id: LINEA, cantidad: "1" }],
};

describe("esquemaDevolucion", () => {
  test("acepta una devolución en efectivo", () => {
    expect(esquemaDevolucion.safeParse(devolucionValida).success).toBe(true);
  });

  test("rechaza una devolución sin líneas", () => {
    expect(errorDe(esquemaDevolucion.safeParse({ ...devolucionValida, lineas: [] }))).toBe(
      "La devolución requiere al menos una línea.",
    );
  });

  test("rechaza una línea repetida", () => {
    expect(
      errorDe(
        esquemaDevolucion.safeParse({
          ...devolucionValida,
          lineas: [
            { factura_linea_id: LINEA, cantidad: "1" },
            { factura_linea_id: LINEA, cantidad: "0.5" },
          ],
        }),
      ),
    ).toBe("Repetiste una línea en la devolución.");
  });

  test("el crédito a factura no lleva efectivo", () => {
    expect(
      errorDe(
        esquemaDevolucion.safeParse({
          ...devolucionValida,
          tipo_reembolso: "credito_factura",
          monto_reembolso_efectivo: "10",
        }),
      ),
    ).toBe("El reembolso con crédito a factura no puede incluir efectivo.");
  });

  test("el combinado exige efectivo mayor a cero", () => {
    expect(
      errorDe(
        esquemaDevolucion.safeParse({
          ...devolucionValida,
          tipo_reembolso: "combinado",
        }),
      ),
    ).toBe("El reembolso combinado requiere efectivo y crédito mayores a cero.");
  });

  test("acepta un combinado con efectivo mayor a cero", () => {
    expect(
      esquemaDevolucion.safeParse({
        ...devolucionValida,
        tipo_reembolso: "combinado",
        monto_reembolso_efectivo: "20",
      }).success,
    ).toBe(true);
  });
});

describe("esquemaPlantillaTicket", () => {
  test("acepta una plantilla parcial y normaliza el pie vacío a null", () => {
    const resultado = esquemaPlantillaTicket.safeParse({ ancho_mm: 57, pie_ticket: "   " });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.ancho_mm).toBe(57);
      expect(resultado.data.pie_ticket).toBeNull();
    }
  });

  test("rechaza un campo desconocido", () => {
    expect(errorDe(esquemaPlantillaTicket.safeParse({ ancho_mm: 80, typo: true }))).toBe(
      "La plantilla del ticket tiene un campo desconocido: typo.",
    );
  });

  test("rechaza un ancho o un estilo inválido", () => {
    expect(errorDe(esquemaPlantillaTicket.safeParse({ ancho_mm: 100 }))).toBe(
      "El ancho del ticket debe ser 80 o 57 mm.",
    );
    expect(errorDe(esquemaPlantillaTicket.safeParse({ estilo: "fino" }))).toBe("El estilo del ticket no es válido.");
  });
});

describe("esquemaTerminal", () => {
  const terminal = {
    nombre: "Caja 1",
    almacen_id: PRODUCTO,
    cuenta_efectivo_id: CUENTA,
    numeracion_defecto_id: LINEA,
    contacto_defecto_id: CONTACTO,
  };

  test("acepta una terminal válida con cuentas opcionales nulas", () => {
    const resultado = esquemaTerminal.safeParse({ ...terminal, cuenta_tarjeta_debito_id: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cuenta_tarjeta_debito_id).toBeNull();
  });

  test("el nombre es obligatorio", () => {
    expect(errorDe(esquemaTerminal.safeParse({ ...terminal, nombre: "  " }))).toBe(
      "El nombre de la terminal es obligatorio.",
    );
  });

  test("la edición exige al menos un cambio", () => {
    expect(errorDe(esquemaTerminalEdicion.safeParse({}))).toBe("No hay cambios para guardar.");
  });
});

describe("esquemaFiltrosHistorial", () => {
  test("aplica página y tamaño por defecto", () => {
    const resultado = esquemaFiltrosHistorial.safeParse({});
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.pagina).toBe(1);
      expect(resultado.data.tamano).toBe(25);
    }
  });

  test("rechaza un tamaño no permitido y un rango invertido", () => {
    expect(errorDe(esquemaFiltrosHistorial.safeParse({ tamano: 30 }))).toBe(
      "El tamaño de página debe ser 25, 50 o 100.",
    );
    expect(errorDe(esquemaFiltrosHistorial.safeParse({ desde: "2026-11-20", hasta: "2026-11-01" }))).toBe(
      "La fecha desde no puede ser mayor que la fecha hasta.",
    );
  });

  test("acepta los filtros del historial", () => {
    expect(
      esquemaFiltrosHistorial.safeParse({
        q: "B0200000015",
        estado: "pagada",
        terminal_id: TERMINAL,
        pagina: 2,
        tamano: 50,
      }).success,
    ).toBe(true);
  });
});

describe("esquemaCatalogoPOS", () => {
  test("acepta la terminal y aplica los topes del catálogo", () => {
    const resultado = esquemaCatalogoPOS.safeParse({ terminal_id: TERMINAL });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.limit).toBe(50);
      expect(resultado.data.offset).toBe(0);
    }
  });
});
