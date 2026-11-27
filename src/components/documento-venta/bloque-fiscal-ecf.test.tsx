import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TicketPos } from "@/components/pos/ticket-pos";
import type { ContactoResumen, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";
import { armarTicketFactura } from "@/lib/pos/impresion";
import { ventaEjemplo } from "@/lib/pos/pruebas/ejemplos";
import { PLANTILLA_TICKET_DEFECTO } from "@/lib/pos/tipos";

import { BloqueFiscalEcf, formatearFechaFirmaEcf } from "./bloque-fiscal-ecf";
import { DocumentoPapel } from "./documento-papel";

const URL_QR =
  "https://ecf.dgii.gov.do/ecf/ConsultaTimbre?RncEmisor=130893489&RncComprador=430069574&ENCF=E450000000122&FechaEmision=25-11-2026&MontoTotal=266916.00&FechaFirma=26-11-2026%2008:25:29&CodigoSeguridad=R067%2BU";

const emision = {
  codigoSeguridad: "R067+U",
  fechaHoraFirma: "26-11-2026 08:25:29",
  urlQr: URL_QR,
};

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
  descripcion: "Oxígeno medicinal",
  cantidad: 1,
  precio: 100,
  descuento_pct: 0,
  itbis_tasa: 0,
  impuesto_id: null,
  subtotal: 100,
  itbis: 0,
  total: 100,
};

const facturaBase: FacturaDetalle = {
  id: "factura-1",
  numero: 1,
  ncf: "B0200000001",
  tipo_comprobante: "02",
  contacto_id: contacto.id,
  fecha: "2026-11-25",
  vencimiento: "2026-12-25",
  total: 100,
  pagado: 100,
  credito: 0,
  retenido: 0,
  estado: "pagada",
  subtotal: 100,
  descuento: 0,
  itbis: 0,
  otros_impuestos: 0,
  propina: 0,
  notas: null,
  terminos: null,
  pie: null,
  asiento_id: null,
  vendedor_id: null,
  centro_costo_id: null,
};

function papel(ncf: string, conEmision: boolean): string {
  return renderToStaticMarkup(
    <DocumentoPapel
      tipo="factura"
      empresa={null}
      factura={{ ...facturaBase, ncf, tipo_comprobante: ncf.startsWith("E31") ? "01" : facturaBase.tipo_comprobante }}
      lineas={[linea]}
      contacto={contacto}
      ncfVence="2027-12-31"
      impuestos={[]}
      mostrarLogo={false}
      emisionEcf={conEmision ? emision : null}
    />,
  );
}

describe("formatearFechaFirmaEcf", () => {
  it("convierte formatos DGII e ISO exactamente a DD/MM/YYYY", () => {
    expect(formatearFechaFirmaEcf("26-11-2026 08:25:29")).toBe("26/11/2026");
    expect(formatearFechaFirmaEcf("2026-11-26T08:25:29")).toBe("26/11/2026");
    expect(formatearFechaFirmaEcf("2026-11-26")).toBe("26/11/2026");
    expect(formatearFechaFirmaEcf("2026-11-23T130510")).toBe("23/11/2026");
    expect(formatearFechaFirmaEcf("26/11/2026 08:25:29")).toBe("26/11/2026");
    expect(formatearFechaFirmaEcf(null)).toBeNull();
    expect(formatearFechaFirmaEcf("31-02-2026 08:25:29")).toBeNull();
  });
});

describe("BloqueFiscalEcf", () => {
  it("renderiza el bloque vertical carta con QR SVG y las cuatro líneas exactas", () => {
    const html = renderToStaticMarkup(<BloqueFiscalEcf {...emision} encf="E310000000118" />);

    expect(html).toContain('aria-label="Código QR de verificación DGII"');
    expect(html).toContain("Código de seguridad R067+U");
    expect(html).toContain("Fecha de firma digital");
    expect(html).toContain("26/11/2026");
    expect(html).toContain("Original: Cliente");
    expect(html).toContain("width:84pt");
    expect(html).toContain("height:84pt");
    expect(html).toContain("<path");
    expect(html).not.toContain("Consulta este comprobante");
  });

  it("renderiza el bloque térmico compacto centrado con las dos líneas exactas", () => {
    const html = renderToStaticMarkup(<BloqueFiscalEcf {...emision} compacto tamanoQrMm={46} />);

    expect(html).toContain("Código de seguridad: R067+U");
    expect(html).toContain("Fecha firma digital: 26/11/2026");
    expect(html).not.toContain("Original: Cliente");
    expect(html).toContain("width:46mm");
    expect(html).toContain("height:46mm");
  });
});

describe("integración del bloque e-CF en DocumentoPapel", () => {
  it("no altera la cabecera ni imprime QR en una factura tradicional B02", () => {
    const html = papel("B0200000001", true);

    expect(html).toContain("No. NCF B0200000001");
    expect(html).toContain("Vencimiento NCF:");
    expect(html).not.toContain("e-NCF B0200000001");
    expect(html).not.toContain("Código de seguridad");
    expect((html.match(/Original: Cliente/g) ?? []).length).toBe(1);
  });

  it("imprime e-NCF, vencimiento e-NCF y el bloque QR en una factura electrónica", () => {
    const html = papel("E310000000118", true);

    expect(html).toContain("Factura de Crédito Fiscal Electrónica");
    expect(html).toContain("e-NCF E310000000118");
    expect(html).toContain("Vencimiento e-NCF:");
    expect(html).toContain("31/12/2027");
    expect(html).toContain("Código de seguridad R067+U");
    expect(html).toContain("Fecha de firma digital");
    expect(html).toContain("26/11/2026");
    expect(html).not.toContain("No. NCF E310000000118");
    expect((html.match(/Original: Cliente/g) ?? []).length).toBe(1);
  });

  it("no imprime el bloque QR si la factura electrónica aún no tiene datos de emisión", () => {
    const html = papel("E310000000118", false);

    expect(html).toContain("e-NCF E310000000118");
    expect(html).not.toContain("Código de seguridad");
  });
});

describe("integración del bloque e-CF en TicketPos", () => {
  function ventaElectronica() {
    const venta = ventaEjemplo();
    return {
      ...venta,
      factura: { ...venta.factura, ncf: "E320000000015" },
      ecf: emision,
    };
  }

  it("no agrega ecf ni cambia el ticket tradicional", () => {
    const ticket = armarTicketFactura(ventaEjemplo());
    const html = renderToStaticMarkup(<TicketPos payload={ticket} />);

    expect(ticket.ecf).toBeUndefined();
    expect(html).not.toContain("Código de seguridad:");
    expect(html).not.toContain("Fecha firma digital:");
  });

  it("imprime QR de 46 mm y datos DGII formateados en ticket de 80 mm", () => {
    const ticket = armarTicketFactura(ventaElectronica());
    const html = renderToStaticMarkup(<TicketPos payload={ticket} />);

    expect(ticket.ecf?.codigoSeguridad).toBe("R067+U");
    expect(html).toContain("Código de seguridad: R067+U");
    expect(html).toContain("Fecha firma digital: 26/11/2026");
    expect(html).toContain("width:46mm");
    expect(html).not.toContain("26-11-2026 08:25:29");
  });

  it("usa QR de 36 mm en ticket de 57 mm", () => {
    const venta = ventaElectronica();
    const plantilla = { ...PLANTILLA_TICKET_DEFECTO, ancho_mm: 57 as const };
    const ticket = armarTicketFactura(venta, plantilla);
    const html = renderToStaticMarkup(<TicketPos payload={ticket} />);

    expect(ticket.diseno.ancho_mm).toBe(57);
    expect(html).toContain("width:36mm");
    expect(html).toContain("Código de seguridad: R067+U");
  });
});
