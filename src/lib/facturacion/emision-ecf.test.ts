import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/facturacion/emision-ecf-acciones", () => ({
  emitirFacturaEcfAction: vi.fn(),
  consultarEstadoFacturaEcfAction: vi.fn(),
}));

import { TarjetaEmisionEcf } from "@/components/documento-venta/tarjeta-emision-ecf";
import type { ContactoResumen, FacturaDetalle } from "@/lib/facturacion/tipos";

import {
  construirUrlQrEcf,
  derivarEstadoEmisionFactura,
  type EnvioEcfFactura,
  esNcfElectronico,
  fechaEmisionIso,
  nombreArchivoXmlEcf,
  normalizarFiltroEmision,
} from "./emision-ecf";

function envioBase(cambios: Partial<EnvioEcfFactura> = {}): EnvioEcfFactura {
  return {
    id: "envio-1",
    rnc_emisor: "131123456",
    documento_tipo: "factura",
    documento_id: "factura-1",
    tipo_ecf: "45",
    encf: "E450000000122",
    es_rfce: false,
    ambiente: "testecf",
    estado: "aceptado",
    track_id: "track-1",
    codigo_seguridad: "R067+U",
    url_qr: "https://fc.dgii.gov.do/testecf/consultatimbre?x=1",
    fecha_hora_firma: "15-01-2026 10:30:00",
    mensajes: null,
    intentos: 1,
    ultimo_intento_at: "2026-01-15T10:31:00.000Z",
    updated_at: "2026-01-15T10:31:00.000Z",
    tiene_xml: true,
    ...cambios,
  };
}

const factura: FacturaDetalle = {
  id: "factura-1",
  numero: 122,
  ncf: "E450000000122",
  tipo_comprobante: "15",
  contacto_id: "contacto-1",
  fecha: "2026-01-15",
  vencimiento: "2026-01-15",
  total: 1180,
  pagado: 0,
  credito: 0,
  retenido: 0,
  estado: "abierta",
  subtotal: 1000,
  descuento: 0,
  itbis: 180,
  otros_impuestos: 0,
  propina: 0,
  notas: null,
  terminos: null,
  pie: null,
  asiento_id: null,
  vendedor_id: null,
  centro_costo_id: null,
};

const contacto: ContactoResumen = {
  id: "contacto-1",
  nombre: "Cliente de prueba",
  rnc_cedula: "131654321",
  direccion: "Santo Domingo",
  telefono: null,
};

describe("derivarEstadoEmisionFactura", () => {
  it("clasifica comprobantes tradicionales como no electrónicos", () => {
    expect(derivarEstadoEmisionFactura("B0200000001", null)).toBe("no_electronica");
    expect(derivarEstadoEmisionFactura(null, null)).toBe("no_electronica");
  });

  it("clasifica e-NCF sin envío o con error de red como sin emisión", () => {
    expect(derivarEstadoEmisionFactura("E450000000122", null)).toBe("sin_emision");
    expect(derivarEstadoEmisionFactura("E450000000122", envioBase({ estado: "error_red" }))).toBe("sin_emision");
  });

  it("clasifica pendiente y en proceso como en proceso", () => {
    expect(derivarEstadoEmisionFactura("E450000000122", envioBase({ estado: "pendiente" }))).toBe("en_proceso");
    expect(derivarEstadoEmisionFactura("E450000000122", envioBase({ estado: "en_proceso" }))).toBe("en_proceso");
  });

  it("clasifica aceptado y aceptado condicional como emitida", () => {
    expect(derivarEstadoEmisionFactura("E450000000122", envioBase({ estado: "aceptado" }))).toBe("emitida");
    expect(derivarEstadoEmisionFactura("E450000000122", envioBase({ estado: "aceptado_condicional" }))).toBe("emitida");
  });

  it("clasifica rechazado como rechazada", () => {
    expect(derivarEstadoEmisionFactura("E450000000122", envioBase({ estado: "rechazado" }))).toBe("rechazada");
  });
});

describe("helpers de emisión e-CF", () => {
  it("genera el nombre exacto del archivo XML", () => {
    expect(nombreArchivoXmlEcf("E450000000122")).toBe("Factura de venta NCF E450000000122.xml");
  });

  it("reconoce e-NCF y normaliza el filtro", () => {
    expect(esNcfElectronico("E310000000001")).toBe(true);
    expect(esNcfElectronico("B0200000001")).toBe(false);
    expect(normalizarFiltroEmision("sin_emision")).toBe("sin_emision");
    expect(normalizarFiltroEmision("otro")).toBeUndefined();
  });

  it("convierte la fecha DGII a ISO y construye URL QR", () => {
    expect(fechaEmisionIso("15-01-2026 10:30:00", "2026-01-01")).toBe("2026-01-15");
    const url = construirUrlQrEcf({
      envio: envioBase({ url_qr: null }),
      rncComprador: "131654321",
      fechaEmision: "2026-01-15",
      montoTotal: 1180,
    });
    expect(url).toContain("RncEmisor=131123456");
    expect(url).toContain("ENCF=E450000000122");
    expect(url).toContain("CodigoSeguridad=R067%2BU");
  });
});

describe("TarjetaEmisionEcf", () => {
  function renderizar(envio: EnvioEcfFactura | null) {
    return renderToStaticMarkup(createElement(TarjetaEmisionEcf, { factura, envio, contacto, puedeEscribir: true }));
  }

  it("renderiza aceptado con filas, toggle y acciones principales", () => {
    const html = renderizar(envioBase());
    expect(html).toContain("Información de emisión");
    expect(html).toContain("Comprobante aceptado");
    expect(html).toContain("Fecha de emisión");
    expect(html).toContain("2026-01-15");
    expect(html).toContain("Código de seguridad");
    expect(html).toContain("R067+U");
    expect(html).toContain("Ocultar detalles");
    expect(html).toContain("Ver comprobante en la DGII");
    expect(html).toContain("Factura de venta NCF E450000000122.xml");
  });

  it("renderiza el estado animado de subida cuando está en proceso", () => {
    const html = renderizar(envioBase({ estado: "en_proceso", url_qr: null }));
    expect(html).toContain("Subiendo comprobante a la DGII...");
    expect(html).toContain("Firmando XML e-CF");
    expect(html).toContain("Enviando comprobante a la DGII");
    expect(html).toContain("Verificando acuse de aceptación");
    expect(html).toContain("Consultar estado en la DGII");
  });

  it("renderiza rechazado y mantiene ambos textos del toggle en el componente", () => {
    const html = renderizar(envioBase({ estado: "rechazado", mensajes: ["RNC inválido"] }));
    expect(html).toContain("Comprobante rechazado");
    expect(html).toContain("RNC inválido");
    expect(html).toContain("Reintentar emisión");
    expect(TarjetaEmisionEcf.toString()).toContain("Mostrar detalles");
  });
});
