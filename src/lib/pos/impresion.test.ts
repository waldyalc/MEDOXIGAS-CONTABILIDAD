import { describe, expect, test } from "vitest";

import {
  armarCartaCotizacion,
  armarCartaFactura,
  armarTicketCierre,
  armarTicketCotizacion,
  armarTicketDevolucion,
  armarTicketFactura,
  armarTicketMovimiento,
  type FilaTicketPOS,
  type TicketPOSPayload,
} from "./impresion";
import {
  cierreEjemplo,
  cotizacionEjemplo,
  devolucionEjemplo,
  movimientoEjemplo,
  ventaEjemplo,
} from "./pruebas/ejemplos";
import { type LineaVenta, PLANTILLA_TICKET_DEFECTO, type PlantillaTicket, type VentaPOSResultado } from "./tipos";

function plantilla(cambios: Partial<PlantillaTicket>): PlantillaTicket {
  return { ...PLANTILLA_TICKET_DEFECTO, ...cambios };
}

function valor(filas: readonly FilaTicketPOS[], etiqueta: string): string | undefined {
  return filas.find((fila) => fila.etiqueta === etiqueta)?.valor;
}

function primeraLinea(venta: VentaPOSResultado): LineaVenta {
  const linea = venta.lineas[0];
  if (!linea) throw new Error("La venta de ejemplo no tiene líneas.");
  return linea;
}

function ticketConLinea(cambios: Partial<LineaVenta>): TicketPOSPayload {
  const venta = ventaEjemplo();
  const modificada: VentaPOSResultado = {
    ...venta,
    lineas: [{ ...primeraLinea(venta), ...cambios }],
  };

  return armarTicketFactura(modificada);
}

describe("armarTicketFactura", () => {
  test("arma el ticket de 80 mm con cabecera, líneas, totales y pagos", () => {
    const ticket = armarTicketFactura(ventaEjemplo());

    expect(ticket.tipo).toBe("factura");
    expect(ticket.diseno.ancho_mm).toBe(80);
    expect(ticket.diseno.columnas).toBe("dos");
    expect(ticket.diseno.pie).toBe("Gracias por su compra");
    expect(ticket.encabezado.titulo).toBe("Factura de Consumo");
    expect(ticket.encabezado.empresa).toContain("Medoxigas ALC, SRL");
    expect(ticket.encabezado.empresa).toContain("RNC: 131234567");
    expect(ticket.encabezado.lineas).toContain("NCF B0200000015");
    expect(ticket.encabezado.lineas).toContain("Terminal: Caja 1");
    expect(ticket.encabezado.lineas).toContain("Turno No 4");
    expect(ticket.encabezado.lineas).toContain("Cliente: Consumidor Final");
    expect(ticket.lineas[0]?.total).toBe("RD$ 236.00");
    expect(valor(ticket.totales, "Total")).toBe("RD$ 236.00");
    expect(ticket.pagos).toContainEqual({ etiqueta: "Efectivo", valor: "RD$ 236.00" });
    expect(valor(ticket.pagos, "Cambio")).toBe("RD$ 14.00");
    expect(ticket.nota).toBe("ITBIS incluido");
  });

  test("57 mm apila las columnas y conserva los montos", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ ancho_mm: 57 }));

    expect(ticket.diseno.ancho_mm).toBe(57);
    expect(ticket.diseno.columnas).toBe("apilada");
    expect(valor(ticket.totales, "Total")).toBe("RD$ 236.00");
  });

  test("sin precio unitario no imprime la columna ni la nota de ITBIS incluido", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ mostrar_precio_unitario: false }));

    expect(ticket.lineas[0]?.precio_unitario).toBeNull();
    expect(ticket.lineas[0]?.detalle).toBe("2 Unidad");
    expect(valor(ticket.totales, "ITBIS 18%")).toBe("RD$ 36.00");
    expect(ticket.nota).toBeNull();
  });

  test("sin unidad imprime solo la cantidad", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ mostrar_unidad: false }));

    expect(ticket.lineas[0]?.detalle).toContain("2 ×");
    expect(ticket.lineas[0]?.detalle).not.toContain("Unidad");
  });

  test("sin descripción usa el nombre del producto", () => {
    const ticket = ticketConLinea({ descripcion: "Descripción larga", producto_nombre: "Nombre corto" });
    const conDescripcion = armarTicketFactura(
      { ...ventaEjemplo(), lineas: [primeraLinea(ventaEjemplo())] },
      plantilla({ mostrar_descripcion: false }),
    );

    expect(ticket.lineas[0]?.descripcion).toBe("Descripción larga");
    expect(conDescripcion.lineas[0]?.descripcion).toBe("Destornillador Phillips");
  });

  test("la referencia solo sale con el toggle encendido", () => {
    expect(ticketConLinea({}).lineas[0]?.referencia).toBeNull();
    expect(armarTicketFactura(ventaEjemplo(), plantilla({ mostrar_referencia: true })).lineas[0]?.referencia).toBe(
      "DEST-01",
    );
  });

  test("precios con impuestos muestra el precio unitario con ITBIS", () => {
    const conImpuesto = armarTicketFactura(ventaEjemplo(), plantilla({ precios_con_impuestos: true }));
    const sinImpuesto = armarTicketFactura(ventaEjemplo(), plantilla({ precios_con_impuestos: false }));

    expect(conImpuesto.lineas[0]?.precio_unitario).toBe("RD$ 118.00");
    expect(sinImpuesto.lineas[0]?.precio_unitario).toBe("RD$ 100.00");
  });

  test("el pie se omite cuando la plantilla no lo define", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ pie_ticket: null }));

    expect(ticket.pie).toBeNull();
    expect(ticket.diseno.pie).toBeNull();
  });

  test("una factura anulada se marca sin cambiar los montos", () => {
    const venta = ventaEjemplo();
    const ticket = armarTicketFactura({
      ...venta,
      factura: { ...venta.factura, estado: "anulada" },
    });

    expect(ticket.anulada).toBe(true);
    expect(ticket.encabezado.anulada).toBe(true);
    expect(valor(ticket.totales, "Total")).toBe("RD$ 236.00");
  });

  test("una venta a crédito muestra pagado, crédito y saldo", () => {
    const venta = ventaEjemplo();
    const credito: VentaPOSResultado = {
      ...venta,
      factura: {
        ...venta.factura,
        estado: "abierta",
        pagado: "100.00",
        credito: "0.00",
        saldo: "136.00",
        monto_recibido: "100.00",
        cambio: "0.00",
      },
      pagos: [],
      totales: { ...venta.totales, pagado: "100.00", credito: "0.00", saldo: "136.00", monto_recibido: "100.00" },
    };
    const ticket = armarTicketFactura(credito);

    expect(valor(ticket.totales, "Pagado")).toBe("RD$ 100.00");
    expect(valor(ticket.totales, "Saldo")).toBe("RD$ 136.00");
    expect(ticket.pagos).toEqual([]);
  });
});

describe("armarTicketCotizacion", () => {
  test("no imprime NCF ni pagos y avisa que no es una factura", () => {
    const ticket = armarTicketCotizacion(cotizacionEjemplo());

    expect(ticket.encabezado.titulo).toBe("Cotización No 12");
    expect(ticket.encabezado.lineas.some((linea) => linea.startsWith("NCF"))).toBe(false);
    expect(ticket.encabezado.lineas).toContain("Vence: 20/12/2026");
    expect(ticket.pagos).toEqual([]);
    expect(ticket.nota).toBe("No es una factura.");
    expect(valor(ticket.totales, "Total")).toBe("RD$ 236.00");
  });
});

describe("armarTicketDevolucion", () => {
  test("arma la nota B04 con su reembolso", () => {
    const ticket = armarTicketDevolucion(devolucionEjemplo());

    expect(ticket.encabezado.titulo).toBe("Nota de Crédito");
    expect(ticket.encabezado.lineas).toContain("NCF B0400000004");
    expect(ticket.encabezado.lineas).toContain("Factura origen: B0200000015");
    expect(valor(ticket.totales, "Total")).toBe("RD$ 59.00");
    expect(ticket.bloques[0]?.titulo).toBe("Efectivo");
    expect(ticket.bloques[0]?.filas).toContainEqual({ etiqueta: "Efectivo", valor: "RD$ 59.00" });
    expect(ticket.bloques[0]?.filas).toContainEqual({ etiqueta: "Cuenta de efectivo", valor: "Caja general" });
  });
});

describe("armarTicketCierre", () => {
  test("incluye desgloses, movimientos y la diferencia de faltante", () => {
    const ticket = armarTicketCierre(cierreEjemplo());
    const titulos = ticket.bloques.map((bloque) => bloque.titulo);

    expect(ticket.encabezado.titulo).toBe("Cierre No 4");
    expect(titulos).toContain("Ventas por método");
    expect(titulos).toContain("Ingresos");
    expect(titulos).toContain("Retiros");
    expect(titulos).toContain("Devoluciones");
    expect(titulos).toContain("Movimientos");
    expect(titulos).toContain("Observaciones");
    expect(valor(ticket.totales, "Efectivo esperado en caja")).toBe("RD$ 306.00");
    expect(valor(ticket.totales, "Efectivo real en caja")).toBe("RD$ 300.00");
    expect(valor(ticket.totales, "Diferencia")).toBe("Faltante RD$ 6.00");
  });
});

describe("armarTicketMovimiento", () => {
  test("arma el recibo con el efectivo esperado posterior", () => {
    const ticket = armarTicketMovimiento(movimientoEjemplo());

    expect(ticket.encabezado.titulo).toBe("Recibo de ingreso No 10");
    expect(valor(ticket.totales, "Total del recibo")).toBe("RD$ 100.00");
    expect(valor(ticket.totales, "Efectivo esperado después")).toBe("RD$ 306.00");
  });

  test("al reimprimir omite el esperado posterior", () => {
    const ticket = armarTicketMovimiento(movimientoEjemplo(), null, { incluirEfectivoEsperado: false });

    expect(valor(ticket.totales, "Efectivo esperado después")).toBeUndefined();
  });
});

describe("armarCartaFactura", () => {
  test("produce props numéricas para DocumentoPapel y completa la plantilla Carta", () => {
    const carta = armarCartaFactura(ventaEjemplo(), {
      mostrarLogo: true,
      notas: "Gracias por preferirnos",
      terminos: "Pago a 30 días",
    });

    expect(carta.tipo).toBe("factura");
    expect(carta.empresa?.nombre).toBe("Medoxigas ALC, SRL");
    expect(carta.factura.total).toBe(236);
    expect(carta.factura.notas).toBe("Gracias por preferirnos");
    expect(carta.factura.terminos).toBe("Pago a 30 días");
    expect(carta.lineas[0]).toMatchObject({ cantidad: 2, precio: 100, total: 236 });
    expect(carta.contacto.rnc_cedula).toBe("22222222222");
    expect(carta.mostrarLogo).toBe(true);
  });
});

describe("armarCartaCotizacion", () => {
  test("produce la DocumentoVista de cotización con montos numéricos", () => {
    const carta = armarCartaCotizacion(cotizacionEjemplo(), { mostrarLogo: false });

    expect(carta.tipo).toBe("cotizacion");
    expect(carta.mostrarLogo).toBe(false);
    expect(carta.vista.documento.estado).toBe("abierta");
    expect(carta.vista.documento.factura_id).toBeNull();
    expect(carta.vista.documento.total).toBe(236);
    expect(carta.vista.lineas[0]).toMatchObject({ cantidad: 2, precio: 100, total: 236 });
    expect(carta.vista.facturaRelacionada).toBeNull();
    expect(carta.vista.empresa?.rnc).toBe("131234567");
  });
});
