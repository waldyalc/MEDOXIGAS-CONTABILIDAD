import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DocumentoVista } from "@/lib/cotizaciones/tipos";
import type { ContactoResumen, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";

import { DocumentoPapel } from "./documento-papel";

const contacto: ContactoResumen = {
  id: "contacto-1",
  nombre: "Cliente de Prueba",
  rnc_cedula: null,
  direccion: null,
  telefono: null,
};

const linea: FacturaLinea = {
  id: "linea-1",
  producto_id: "producto-1",
  descripcion: "Gas refrigerante R410A",
  cantidad: 1,
  precio: 359,
  descuento_pct: 0,
  itbis_tasa: 18,
  impuesto_id: null,
  subtotal: 359,
  itbis: 64.62,
  total: 423.62,
};

const factura: FacturaDetalle = {
  id: "factura-1",
  numero: 6,
  ncf: "B0200000006",
  tipo_comprobante: "01",
  contacto_id: contacto.id,
  fecha: "2026-11-13",
  vencimiento: "2026-12-13",
  total: 423.62,
  pagado: 0,
  credito: 0,
  retenido: 0,
  estado: "abierta",
  subtotal: 359,
  descuento: 0,
  itbis: 64.62,
  otros_impuestos: 0,
  propina: 0,
  notas: null,
  terminos: null,
  pie: null,
  asiento_id: null,
  vendedor_id: null,
  centro_costo_id: null,
};

const vistaCotizacion: DocumentoVista = {
  documento: {
    id: "cotizacion-1",
    numero: 1,
    contacto_id: contacto.id,
    fecha: "2026-11-13",
    vencimiento: "2026-12-13",
    total: 423.62,
    estado: "abierta",
    factura_id: null,
    subtotal: 359,
    descuento: 0,
    itbis: 64.62,
    otros_impuestos: 0,
    propina: 0,
    notas: null,
    terminos: null,
    vendedor_id: null,
    centro_costo_id: null,
  },
  lineas: [linea],
  impuestos: [],
  contacto,
  empresa: null,
  facturaRelacionada: null,
  cotizacionOrigen: null,
  remisionRelacionada: null,
};

function renderFactura(datosContacto: Partial<ContactoResumen> = {}, ncfVence: string | null = null): string {
  return renderToStaticMarkup(
    <DocumentoPapel
      tipo="factura"
      empresa={null}
      factura={factura}
      lineas={[linea]}
      contacto={{ ...contacto, ...datosContacto }}
      ncfVence={ncfVence}
      impuestos={[]}
      mostrarLogo={false}
    />,
  );
}

describe("papel de la factura", () => {
  it("oculta las etiquetas RNC y Teléfono cuando el cliente no las tiene", () => {
    const html = renderFactura();

    expect(html).toContain("Cliente de Prueba");
    expect(html).not.toContain("RNC:");
    expect(html).not.toContain("Teléfono:");
  });

  it("muestra las etiquetas RNC y Teléfono cuando el cliente las tiene", () => {
    const html = renderFactura({ rnc_cedula: "101010101", telefono: "809-555-0101" });

    expect(html).toContain("RNC:");
    expect(html).toContain("101010101");
    expect(html).toContain("Teléfono:");
    expect(html).toContain("809-555-0101");
  });

  it("oculta el vencimiento del NCF cuando la numeración no vence", () => {
    expect(renderFactura()).not.toContain("Vencimiento NCF:");
  });

  it("muestra el vencimiento del NCF cuando la numeración vence", () => {
    const html = renderFactura({}, "2027-12-31");

    expect(html).toContain("Vencimiento NCF:");
    expect(html).toContain("31/12/2027");
  });

  it("escribe con dos puntos la etiqueta del vencimiento de la factura", () => {
    expect(renderFactura()).toContain("Vencimiento de la factura:");
  });
});

describe("papel de la cotización", () => {
  it("oculta la etiqueta RNC cuando el cliente no la tiene", () => {
    const html = renderToStaticMarkup(<DocumentoPapel tipo="cotizacion" vista={vistaCotizacion} mostrarLogo={false} />);

    expect(html).toContain("Cliente de Prueba");
    expect(html).not.toContain("RNC:");
  });

  it("muestra la etiqueta RNC cuando el cliente la tiene", () => {
    const vista: DocumentoVista = { ...vistaCotizacion, contacto: { ...contacto, rnc_cedula: "101010101" } };
    const html = renderToStaticMarkup(<DocumentoPapel tipo="cotizacion" vista={vista} mostrarLogo={false} />);

    expect(html).toContain("RNC:");
    expect(html).toContain("101010101");
  });

  it("lleva el título con número, las columnas de Alegra, el monto en letras y el pie", () => {
    const html = renderToStaticMarkup(<DocumentoPapel tipo="cotizacion" vista={vistaCotizacion} mostrarLogo={false} />);

    expect(html).toContain("Cotización");
    expect(html).toContain("No. 1");
    expect(html).toContain("Fecha de creación:");
    expect(html).toContain("Fecha de vencimiento:");
    for (const columna of ["Concepto", "Precio", "Unidad", "Cantidad", "Descuento", "Impuesto", "Subtotal"]) {
      expect(html).toContain(columna);
    }
    expect(html).toContain("con 62/100");
    expect(html).toContain("RD$423.62");
    expect(html).toContain("Página 1 de 1");
  });
});

describe("papel del conduce", () => {
  it("lleva el título con número, la grilla del cliente y las columnas de Alegra", () => {
    const vista: DocumentoVista = {
      ...vistaCotizacion,
      contacto: { ...contacto, rnc_cedula: "101010101", telefono: "809-555-0101" },
    };
    const html = renderToStaticMarkup(<DocumentoPapel tipo="conduce" vista={vista} mostrarLogo={false} />);

    expect(html).toContain("Conduce");
    expect(html).toContain("No. 1");
    for (const etiqueta of [
      "SEÑOR(ES)",
      "DIRECCIÓN",
      "CIUDAD",
      "TELÉFONO",
      "RNC",
      "FECHA DE EXPEDICIÓN",
      "FECHA DE VENCIMIENTO",
    ]) {
      expect(html).toContain(etiqueta);
    }
    expect(html).toContain("Cliente de Prueba");
    expect(html).toContain("101010101");
    expect(html).toContain("809-555-0101");
    for (const columna of ["Ítem", "Precio", "Cantidad", "Descuento", "Impuesto", "Subtotal"]) {
      expect(html).toContain(columna);
    }
  });

  it("muestra los totales con impuestos y las líneas de firma", () => {
    const html = renderToStaticMarkup(<DocumentoPapel tipo="conduce" vista={vistaCotizacion} mostrarLogo={false} />);

    expect(html).toContain("RD$359.00");
    expect(html).toContain("ITBIS (18.00%)");
    expect(html).toContain("RD$64.62");
    expect(html).toContain("RD$423.62");
    expect(html).toContain("ELABORADO POR");
    expect(html).toContain("ACEPTADA, FIRMA Y/O SELLO Y FECHA");
  });
});
