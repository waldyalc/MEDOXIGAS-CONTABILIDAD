import { describe, expect, test } from "vitest";

import {
  armarCartaCotizacion,
  armarCartaFactura,
  armarTicketCierre,
  armarTicketCotizacion,
  armarTicketCotizacionVista,
  armarTicketDevolucion,
  armarTicketFactura,
  armarTicketMovimiento,
  armarTicketPrefactura,
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
  test("arma el ticket de 80 mm con cabecera, cliente, líneas, totales y pagos", () => {
    const ticket = armarTicketFactura(ventaEjemplo());

    expect(ticket.tipo).toBe("factura");
    expect(ticket.diseno.ancho_mm).toBe(80);
    expect(ticket.diseno.columnas).toBe("dos");
    expect(ticket.diseno.pie).toBe("Gracias por su compra");
    expect(ticket.encabezado.titulo).toBe("Factura de Consumo");
    expect(ticket.encabezado.empresa).toContain("Medoxigas ALC, SRL");
    expect(ticket.encabezado.empresa).toContain("RNC: 131234567");
    expect(ticket.encabezado.lineas).toContain("NCF B0200000015");
    expect(ticket.encabezado.lineas).toContain("Tipo de pago: Contado");
    expect(ticket.encabezado.lineas).toContain("Método de pago: Efectivo");
    expect(ticket.encabezado.lineas).toContain("Vencimiento: 20/11/2026");
    expect(ticket.encabezado.lineas).not.toContain("Cliente: Consumidor Final");
    expect(ticket.cliente.nombre).toBe("Consumidor Final");
    expect(ticket.cliente.lineas).toContain("RNC: 22222222222");
    expect(ticket.lineas[0]?.total).toBe("236.00");
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
    expect(ticket.pagos).toEqual([
      { etiqueta: "Total recibido", valor: "RD$250.00" },
      { etiqueta: "Cambio", valor: "RD$14.00" },
    ]);
    expect(valor(ticket.resumen, "Total de líneas")).toBe("1");
    expect(valor(ticket.resumen, "Total de productos")).toBe("2");
    expect(ticket.nota).toBeNull();
  });

  test("el encabezado sigue el orden de Alegra y no muestra terminal, turno ni cajero", () => {
    const lineas = armarTicketFactura(ventaEjemplo()).encabezado.lineas;
    const orden = ["NCF B0200000015", "Fecha:", "Tipo de pago: Contado", "Método de pago: Efectivo"].map((texto) =>
      lineas.findIndex((linea) => linea.includes(texto)),
    );

    expect(orden.every((indice) => indice >= 0)).toBe(true);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
    expect(lineas.some((linea) => linea.startsWith("Terminal:"))).toBe(false);
    expect(lineas.some((linea) => linea.startsWith("Turno"))).toBe(false);
    expect(lineas.some((linea) => linea.startsWith("Cajero:"))).toBe(false);
  });

  test("el logo sale del logo_url de la empresa y se apaga con mostrar_logo", () => {
    const conLogo = armarTicketFactura(ventaEjemplo());
    const sinToggle = armarTicketFactura(ventaEjemplo(), plantilla({ mostrar_logo: false }));
    const venta = ventaEjemplo();
    const sinLogoEnEmpresa = armarTicketFactura({
      ...venta,
      empresa: venta.empresa ? { ...venta.empresa, logo_url: null } : null,
    });

    expect(conLogo.diseno.mostrar_logo).toBe(true);
    expect(conLogo.diseno.logo_url).toBe("https://cdn.test/logo.png");
    expect(sinToggle.diseno.mostrar_logo).toBe(false);
    expect(sinToggle.diseno.logo_url).toBeNull();
    expect(sinLogoEnEmpresa.diseno.logo_url).toBeNull();
  });

  test("desglosa la base en Subtotal Exento y Subtotal Gravado", () => {
    const ticket = armarTicketFactura(ventaEjemplo());

    expect(valor(ticket.totales, "Subtotal Exento")).toBe("RD$0.00");
    expect(valor(ticket.totales, "Subtotal Gravado")).toBe("RD$200.00");
    expect(valor(ticket.totales, "ITBIS 18%")).toBe("RD$36.00");
  });

  test("una venta a crédito marca el tipo de pago y muestra recibido sin cambio", () => {
    const venta = ventaEjemplo();
    const credito: VentaPOSResultado = {
      ...venta,
      factura: {
        ...venta.factura,
        estado: "abierta",
        vencimiento: "2026-12-20",
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

    expect(ticket.encabezado.lineas).toContain("Tipo de pago: Crédito");
    expect(ticket.encabezado.lineas).toContain("Vencimiento: 20/12/2026");
    expect(ticket.encabezado.lineas.some((linea) => linea.startsWith("Método de pago:"))).toBe(false);
    expect(valor(ticket.pagos, "Total recibido")).toBe("RD$100.00");
    expect(valor(ticket.pagos, "Cambio")).toBeUndefined();
  });

  test("el subtotal impreso es el bruto: el descuento no se resta dos veces", () => {
    const venta = ventaEjemplo();
    const conDescuento = {
      ...venta,
      totales: { ...venta.totales, subtotal: "200.00", descuento: "5.00", total: "236.00" },
    };
    const ticket = armarTicketFactura(conDescuento);

    expect(valor(ticket.totales, "Subtotal")).toBe("RD$205.00");
    expect(valor(ticket.totales, "Descuento")).toBe("-RD$5.00");
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
  });

  test("57 mm apila las columnas y conserva los montos", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ ancho_mm: 57 }));

    expect(ticket.diseno.ancho_mm).toBe(57);
    expect(ticket.diseno.columnas).toBe("apilada");
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
  });

  test("si la respuesta no trae creado_en usa la hora de recepción", () => {
    const venta = ventaEjemplo();
    const sinHora: VentaPOSResultado = { ...venta, factura: { ...venta.factura, creado_en: null } };
    const ticket = armarTicketFactura(sinHora, null, { recibido_en: "2026-11-20T15:10:00-04:00" });
    const legibles = ticket.encabezado.lineas.map((linea) => linea.replace(/\u00A0/g, " "));

    expect(legibles).toContain("Fecha: 20/11/2026 3:10 pm");
  });

  test("sin precio unitario no imprime la columna ni la nota de ITBIS incluido", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ mostrar_precio_unitario: false }));

    expect(ticket.lineas[0]?.precio_unitario).toBeNull();
    expect(ticket.lineas[0]?.detalle).toBe("2 Unidad");
    expect(valor(ticket.totales, "ITBIS 18%")).toBe("RD$36.00");
    expect(ticket.nota).toBeNull();
  });

  test("sin unidad imprime solo la cantidad", () => {
    const ticket = armarTicketFactura(ventaEjemplo(), plantilla({ mostrar_unidad: false }));

    expect(ticket.lineas[0]?.detalle).toContain("2 x");
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

    expect(conImpuesto.lineas[0]?.precio_unitario).toBe("118.00");
    expect(sinImpuesto.lineas[0]?.precio_unitario).toBe("100.00");
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
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
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

    expect(valor(ticket.totales, "Pagado")).toBe("RD$100.00");
    expect(valor(ticket.totales, "Saldo")).toBe("RD$136.00");
    expect(ticket.pagos).toEqual([{ etiqueta: "Total recibido", valor: "RD$100.00" }]);
  });
});

describe("encabezado de empresa completo (configuración)", () => {
  function empresaCompleta() {
    const venta = ventaEjemplo();
    if (!venta.empresa) throw new Error("La venta de ejemplo no trae empresa.");
    return { ...venta.empresa, sucursal: "Principal", regimen: "Régimen general" };
  }

  test("con datos imprime nombre, sucursal, RNC, dirección, teléfono, correo y régimen en el orden de Alegra", () => {
    const venta = { ...ventaEjemplo(), empresa: empresaCompleta() };
    const lineas = armarTicketFactura(venta).encabezado.empresa;
    const orden = [
      "Medoxigas ALC, SRL",
      "Sucursal: Principal",
      "RNC: 131234567",
      "Av. Duarte 125, Santiago",
      "Teléfono: 809-555-0101",
      "ventas@medoxigas.test",
      "Régimen: Régimen general",
    ].map((texto) => lineas.findIndex((linea) => linea === texto));

    expect(orden.every((indice) => indice >= 0)).toBe(true);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  test("sin sucursal ni régimen esas líneas no se imprimen", () => {
    const venta = { ...ventaEjemplo(), empresa: { ...empresaCompleta(), sucursal: null, regimen: null } };
    const lineas = armarTicketFactura(venta).encabezado.empresa;

    expect(lineas.some((linea) => linea.startsWith("Sucursal:"))).toBe(false);
    expect(lineas.some((linea) => linea.startsWith("Régimen:"))).toBe(false);
    expect(lineas).toContain("RNC: 131234567");
  });

  test("prefactura y cotización usan el mismo encabezado completo", () => {
    const empresa = empresaCompleta();
    const venta = ventaEjemplo();
    const prefactura = armarTicketPrefactura({
      empresa,
      contacto: { nombre: "Juan Pérez", rnc_cedula: "40212345678", direccion: "Calle 2, Santiago" },
      lineas: venta.lineas,
      totales: venta.totales,
      fecha: "2026-11-22",
    });
    const cotizacion = armarTicketCotizacion({
      ...cotizacionEjemplo(),
      empresa,
    });

    for (const ticket of [prefactura, cotizacion]) {
      expect(ticket.encabezado.empresa).toContain("Sucursal: Principal");
      expect(ticket.encabezado.empresa).toContain("Régimen: Régimen general");
      expect(ticket.encabezado.empresa).toContain("Teléfono: 809-555-0101");
    }
    expect(prefactura.cliente.lineas).toContain("Calle 2, Santiago");
    // La prefactura no inventa vencimiento: sin cotización no hay «Vence».
    expect(prefactura.encabezado.lineas.some((linea) => linea.startsWith("Vence"))).toBe(false);
  });

  test("la cotización muestra Vence y Vendedor solo cuando existen", () => {
    const ejemplo = cotizacionEjemplo();
    const ticket = armarTicketCotizacion({
      ...ejemplo,
      empresa: empresaCompleta(),
      vendedor: { id: "v-1", nombre: "Ana" },
    });

    expect(ticket.encabezado.lineas).toContain("Vence: 20/12/2026");
    expect(ticket.encabezado.lineas).toContain("Vendedor: Ana");
  });
});

describe("armarTicketCotizacion", () => {
  test("no imprime NCF ni pagos y avisa que no tiene valor fiscal", () => {
    const ticket = armarTicketCotizacion(cotizacionEjemplo());

    expect(ticket.tipo).toBe("cotizacion");
    expect(ticket.encabezado.titulo).toBe("Cotización No. 12");
    expect(ticket.encabezado.lineas[0]).toBe("Sin valor fiscal");
    expect(ticket.encabezado.lineas.some((linea) => linea.startsWith("NCF"))).toBe(false);
    expect(ticket.encabezado.lineas).toContain("Vence: 20/12/2026");
    expect(ticket.pagos).toEqual([]);
    expect(valor(ticket.totales, "(A) ITBIS 18%")).toBe("RD$36.00");
    expect(valor(ticket.totales, "Total ITBIS")).toBe("RD$36.00");
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
    expect(valor(ticket.resumen, "Total de líneas")).toBe("1");
  });
});

describe("armarTicketPrefactura", () => {
  function entradaPrefactura() {
    const venta = ventaEjemplo();
    return {
      empresa: venta.empresa,
      contacto: { nombre: "Juan Pérez", rnc_cedula: "40212345678" },
      lineas: venta.lineas,
      totales: venta.totales,
      vendedor: { nombre: "Vendedor Uno" },
      fecha: "2026-11-22",
    };
  }

  test("sale del carrito sin NCF ni cobro, con el orden del ticket de Alegra", () => {
    const ticket = armarTicketPrefactura(entradaPrefactura());

    expect(ticket.tipo).toBe("prefactura");
    expect(ticket.diseno.ancho_mm).toBe(80);
    expect(ticket.encabezado.empresa).toContain("Medoxigas ALC, SRL");
    expect(ticket.encabezado.titulo).toBe("Prefactura");
    expect(ticket.encabezado.lineas[0]).toBe("Sin valor fiscal");
    expect(ticket.encabezado.lineas).toContain("Fecha: 22/11/2026");
    expect(ticket.encabezado.lineas).toContain("Vendedor: Vendedor Uno");
    expect(ticket.encabezado.lineas.some((linea) => linea.startsWith("NCF"))).toBe(false);
    expect(ticket.cliente.nombre).toBe("Juan Pérez");
    expect(ticket.cliente.lineas).toContain("Cédula: 40212345678");
    expect(ticket.pagos).toEqual([]);
    expect(valor(ticket.totales, "Subtotal")).toBe("RD$200.00");
    expect(valor(ticket.totales, "Subtotal Gravado")).toBe("RD$200.00");
    expect(valor(ticket.totales, "(A) ITBIS 18%")).toBe("RD$36.00");
    expect(valor(ticket.totales, "Total ITBIS")).toBe("RD$36.00");
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
    expect(valor(ticket.resumen, "Total de líneas")).toBe("1");
    expect(valor(ticket.resumen, "Total de productos")).toBeDefined();
  });

  test("usa pie_ticket de la plantilla y cae al pie propio cuando está vacío", () => {
    const conPie = armarTicketPrefactura(entradaPrefactura(), plantilla({ pie_ticket: "Gracias por su compra" }));
    expect(conPie.pie).toBe("Gracias por su compra");

    const sinPie = armarTicketPrefactura(entradaPrefactura(), plantilla({ pie_ticket: null }));
    expect(sinPie.pie).toBe("Precios sujetos a cambio sin previo aviso.");
  });
});

describe("armarTicketCotizacionVista", () => {
  test("arma el ticket de 80 mm desde la DocumentoVista de Contabilidad", () => {
    const ticket = armarTicketCotizacionVista({
      documento: {
        id: "cot-1",
        numero: 34,
        contacto_id: "con-1",
        fecha: "2026-11-20",
        vencimiento: "2026-12-20",
        total: 236,
        estado: "abierta",
        factura_id: null,
        subtotal: 200,
        descuento: 0,
        itbis: 36,
        otros_impuestos: 0,
        propina: 0,
        notas: null,
        terminos: null,
        vendedor_id: null,
        centro_costo_id: null,
      },
      lineas: [
        {
          id: "lin-1",
          producto_id: "prod-1",
          descripcion: "Oxígeno medicinal",
          cantidad: 2,
          precio: 100,
          descuento_pct: 0,
          itbis_tasa: 18,
          impuesto_id: null,
          subtotal: 200,
          itbis: 36,
          total: 236,
        },
      ],
      impuestos: [],
      contacto: { id: "con-1", nombre: "Clínica Unión", rnc_cedula: "130999888", direccion: null },
      empresa: {
        id: 1,
        nombre: "Medoxigas ALC, SRL",
        rnc: "131234567",
        direccion: null,
        telefono: null,
        correo: null,
        logo_url: null,
      },
      facturaRelacionada: null,
      cotizacionOrigen: null,
      remisionRelacionada: null,
    });

    expect(ticket.tipo).toBe("cotizacion");
    expect(ticket.diseno.ancho_mm).toBe(80);
    expect(ticket.encabezado.titulo).toBe("Cotización No. 34");
    expect(ticket.encabezado.lineas[0]).toBe("Sin valor fiscal");
    expect(ticket.encabezado.lineas).toContain("Fecha: 20/11/2026");
    expect(ticket.encabezado.lineas).toContain("Vence: 20/12/2026");
    expect(ticket.cliente.lineas).toContain("RNC: 130999888");
    expect(valor(ticket.totales, "Total ITBIS")).toBe("RD$36.00");
    expect(valor(ticket.totales, "Total")).toBe("RD$236.00");
    expect(valor(ticket.resumen, "Total de productos")).toBe("2");
  });
});

describe("marca de los documentos", () => {
  test("factura, prefactura y cotización nunca llevan marca de Alegra ni de otra empresa", () => {
    const prohibidos = ["Generado en Alegra POS", "OXYMAT", "Fiel Ferreteria"];

    const prefactura = armarTicketPrefactura(
      {
        ...(() => {
          const venta = ventaEjemplo();
          return { empresa: venta.empresa, contacto: venta.contacto, lineas: venta.lineas, totales: venta.totales };
        })(),
        fecha: "2026-11-22",
      },
      plantilla({ pie_ticket: null }),
    );

    for (const ticket of [armarTicketFactura(ventaEjemplo()), armarTicketCotizacion(cotizacionEjemplo()), prefactura]) {
      const texto = JSON.stringify(ticket);
      for (const prohibido of prohibidos) {
        expect(texto).not.toContain(prohibido);
      }
    }
  });
});

describe("armarTicketDevolucion", () => {
  test("arma la nota B04 con su reembolso", () => {
    const ticket = armarTicketDevolucion(devolucionEjemplo());

    expect(ticket.encabezado.titulo).toBe("Nota de Crédito");
    expect(ticket.encabezado.lineas).toContain("NCF B0400000004");
    expect(ticket.encabezado.lineas).toContain("Factura origen: B0200000015");
    expect(valor(ticket.totales, "Total")).toBe("RD$59.00");
    expect(ticket.bloques[0]?.titulo).toBe("Efectivo");
    expect(ticket.bloques[0]?.filas).toContainEqual({ etiqueta: "Efectivo", valor: "RD$59.00" });
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
    expect(valor(ticket.totales, "Efectivo esperado en caja")).toBe("RD$306.00");
    expect(valor(ticket.totales, "Efectivo real en caja")).toBe("RD$300.00");
    expect(valor(ticket.totales, "Diferencia")).toBe("Faltante RD$6.00");
  });
});

describe("armarTicketMovimiento", () => {
  test("arma el recibo con el efectivo esperado posterior", () => {
    const ticket = armarTicketMovimiento(movimientoEjemplo());

    expect(ticket.encabezado.titulo).toBe("Recibo de ingreso No 10");
    expect(valor(ticket.totales, "Total del recibo")).toBe("RD$100.00");
    expect(valor(ticket.totales, "Efectivo esperado después")).toBe("RD$306.00");
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
