/**
 * Mapeo del modelo fiscal `DatosRi` (parseado del XML e-CF firmado) a las
 * plantillas de papel reales del sistema — las mismas que imprime Alegra en
 * ventas (`DocumentoPapel` tipo factura) y en notas (`NotaDebitoDocumento` /
 * `NotaCreditoDocumento`). Fabrica los objetos `Empresa`, `ContactoResumen`,
 * `FacturaDetalle`, `FacturaLinea` y las vistas de nota EXACTAMENTE con los
 * datos del XML:
 *
 * - `MontoItem` es la base pre-ITBIS de la línea (verificado contra los 25
 *   XML del Paso 4: Σ items = MontoGravadoTotal + MontoExento y el Total
 *   cuadra al centavo con TotalITBIS).
 * - El ITBIS de línea se calcula con la tasa del IndicadorFacturacion
 *   (1 = 18 %, 2 = 16 %, 3 = 0 %, 4 = exenta).
 * - E47 sin RNCComprador usa IdentificadorExtranjero como RNC del contacto;
 *   E43 sin Comprador imprime «—» en el cliente.
 * - La fecha/hora de firma completa viaja en el pie de la factura (en las
 *   notas va dentro del bloque de emisión) porque `BloqueFiscalEcf` resume
 *   la fecha a dd/mm/aaaa y la RI debe reproducir el literal exacto del XML.
 */

import type { ReactElement } from "react";

import { DocumentoPapel } from "@/components/documento-venta/documento-papel";
import { NotaCreditoDocumento } from "@/components/impresion/nota-credito-papel";
import { NotaDebitoDocumento } from "@/components/impresion/nota-debito-papel";
import type { ContactoResumen, Empresa, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";
import type { NotaCreditoVista } from "@/lib/notas-credito/tipos";
import type { NotaDebitoVista } from "@/lib/notas-debito/tipos";

import type { DatosRi, ItemRi } from "./representacion-impresa";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const RUTA_LOGO_MEDOXIGAS = "public/marca/logo-medoxigas.png";

/** dd-mm-aaaa (formato DGII del XML) → aaaa-mm-dd (ISO que usan las plantillas). */
export function fechaDgiiAIso(fechaDgii: string | null | undefined): string | null {
  const coincidencia = fechaDgii?.trim().match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!coincidencia) return null;
  return `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`;
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function secuencialDesdeEncf(encf: string): number {
  const secuencial = Number(encf.slice(3));
  return Number.isInteger(secuencial) && secuencial > 0 ? secuencial : 1;
}

function logoDataUri(): string | null {
  const ruta = path.resolve(RUTA_LOGO_MEDOXIGAS);
  if (!existsSync(ruta)) return null;
  return `data:image/png;base64,${readFileSync(ruta).toString("base64")}`;
}

/** Empresa de las plantillas fabricada con el Emisor del XML e-CF. */
export function empresaDesdeRi(datos: DatosRi): Empresa {
  return {
    id: 1,
    nombre: datos.emisor.razonSocial,
    rnc: datos.emisor.rnc,
    direccion: datos.emisor.direccion,
    telefono: null,
    correo: datos.emisor.correo,
    logo_url: logoDataUri(),
    sucursal: datos.emisor.sucursal,
  };
}

/**
 * Contacto de las plantillas fabricado con el Comprador del XML. E47 usa el
 * IdentificadorExtranjero en el campo RNC; sin Comprador (E43) queda «—».
 */
export function contactoDesdeRi(datos: DatosRi): ContactoResumen {
  const comprador = datos.comprador;
  return {
    id: "comprador-ri",
    nombre: comprador?.razonSocial ?? "—",
    rnc_cedula: comprador?.rnc ?? comprador?.identificadorExtranjero ?? null,
    direccion: null,
    telefono: null,
  };
}

function tasaDeItem(item: ItemRi): number {
  return item.tasaItbis ?? 0;
}

function itbisDeItem(item: ItemRi): number {
  return redondear2((item.montoItem * tasaDeItem(item)) / 100);
}

/** Líneas de factura de las plantillas: MontoItem es la base pre-ITBIS. */
export function lineasDesdeRi(datos: DatosRi): FacturaLinea[] {
  return datos.items.map((item) => {
    const itbis = itbisDeItem(item);
    const bruto = item.cantidadItem * item.precioUnitarioItem;
    const descuentoPct = item.descuentoMonto && bruto > 0 ? redondear2((item.descuentoMonto / bruto) * 100) : 0;
    return {
      id: `linea-${item.numeroLinea}`,
      producto_id: null,
      descripcion: item.nombreItem,
      cantidad: item.cantidadItem,
      precio: item.precioUnitarioItem,
      descuento_pct: descuentoPct,
      itbis_tasa: tasaDeItem(item),
      impuesto_id: null,
      subtotal: item.montoItem,
      itbis,
      total: redondear2(item.montoItem + itbis),
    };
  });
}

function subtotalDesdeRi(datos: DatosRi): number {
  return redondear2(datos.items.reduce((total, item) => total + item.montoItem, 0));
}

function descuentoDesdeRi(datos: DatosRi): number {
  return redondear2(datos.items.reduce((total, item) => total + (item.descuentoMonto ?? 0), 0));
}

function fechaDocumentoIso(datos: DatosRi): string {
  const iso = fechaDgiiAIso(datos.emisor.fechaEmision);
  if (!iso) throw new Error(`${datos.encf}: FechaEmision inválida para la representación impresa`);
  return iso;
}

function motivoModificacion(datos: DatosRi): string | null {
  const referencia = datos.informacionReferencia;
  if (!referencia) return null;
  const partes: string[] = [];
  if (referencia.codigoModificacion) {
    partes.push(
      referencia.codigoModificacionEtiqueta
        ? `${referencia.codigoModificacion} — ${referencia.codigoModificacionEtiqueta}`
        : referencia.codigoModificacion,
    );
  }
  if (referencia.razonModificacion) partes.push(referencia.razonModificacion);
  return partes.length > 0 ? partes.join(": ") : null;
}

function emisionDesdeRi(datos: DatosRi): { codigoSeguridad: string; fechaHoraFirma: string; urlQr: string } {
  if (!datos.urlQr) throw new Error(`${datos.encf}: la representación impresa requiere urlQr`);
  return { codigoSeguridad: datos.codigoSeguridad, fechaHoraFirma: datos.fechaHoraFirma, urlQr: datos.urlQr };
}

/** Factura de las plantillas fabricada con los totales e ítems del XML. */
export function facturaDesdeRi(datos: DatosRi): FacturaDetalle {
  const fechaIso = fechaDocumentoIso(datos);
  const vencimientoIso = fechaDgiiAIso(datos.fechaLimitePago) ?? fechaIso;
  const paisDestino = datos.transporte?.paisDestino?.trim();

  return {
    id: `ri-${datos.encf}`,
    numero: secuencialDesdeEncf(datos.encf),
    ncf: datos.encf,
    // "02" para que la plantilla no calcule un saldo pendiente inexistente en la RI.
    tipo_comprobante: "02",
    contacto_id: "comprador-ri",
    fecha: fechaIso,
    vencimiento: vencimientoIso,
    total: datos.totales.montoTotal,
    pagado: 0,
    credito: 0,
    retenido: 0,
    estado: "abierta",
    subtotal: subtotalDesdeRi(datos),
    descuento: descuentoDesdeRi(datos),
    itbis: datos.totales.totalItbis ?? 0,
    otros_impuestos: 0,
    propina: 0,
    notas: paisDestino ? `País destino: ${paisDestino}` : null,
    terminos: null,
    pie: `Fecha de firma digital: ${datos.fechaHoraFirma}`,
    asiento_id: null,
    vendedor_id: null,
    centro_costo_id: null,
  };
}

function lineasNotaDesdeRi(datos: DatosRi) {
  return lineasDesdeRi(datos).map((linea) => ({
    id: linea.id,
    producto_id: null,
    productos: null,
    descripcion: linea.descripcion,
    cantidad: linea.cantidad,
    precio: linea.precio,
    descuento_pct: linea.descuento_pct,
    itbis_tasa: linea.itbis_tasa,
    subtotal: linea.subtotal,
    itbis: linea.itbis,
    total: linea.total,
  }));
}

function baseNotaDesdeRi(datos: DatosRi) {
  return {
    id: `ri-${datos.encf}`,
    numero: secuencialDesdeEncf(datos.encf),
    ncf: datos.encf,
    fecha: fechaDocumentoIso(datos),
    subtotal: subtotalDesdeRi(datos),
    itbis: datos.totales.totalItbis ?? 0,
    otros_impuestos: 0,
    propina: 0,
    total: datos.totales.montoTotal,
    estado: "activa" as const,
    notas: motivoModificacion(datos),
    asiento_id: null,
    factura_id: "factura-modificada",
    contacto_id: "comprador-ri",
    cliente_nombre: datos.comprador?.razonSocial ?? "—",
    factura_numero: 0,
    factura_ncf: datos.informacionReferencia?.ncfModificado ?? null,
    lineas: lineasNotaDesdeRi(datos),
  };
}

/** Vista de nota de crédito fabricada con el XML E34. */
export function notaCreditoDesdeRi(datos: DatosRi): NotaCreditoVista {
  return { ...baseNotaDesdeRi(datos), devuelve_inventario: false };
}

/** Vista de nota de débito fabricada con el XML E33. */
export function notaDebitoDesdeRi(datos: DatosRi): NotaDebitoVista {
  return {
    ...baseNotaDesdeRi(datos),
    tipo: datos.informacionReferencia?.codigoModificacion === "3" ? "montos" : "texto",
    descuento: descuentoDesdeRi(datos),
  };
}

function elementoFacturaRi(datos: DatosRi): ReactElement {
  const empresa = empresaDesdeRi(datos);
  return (
    <DocumentoPapel
      tipo="factura"
      empresa={empresa}
      factura={facturaDesdeRi(datos)}
      lineas={lineasDesdeRi(datos)}
      contacto={contactoDesdeRi(datos)}
      ncfVence={fechaDgiiAIso(datos.fechaVencimientoSecuencia)}
      impuestos={[]}
      mostrarLogo={empresa.logo_url != null}
      emisionEcf={emisionDesdeRi(datos)}
      retencionesFiscales={{
        itbisRetenido: datos.totales.totalItbisRetenido,
        isrRetenido: datos.totales.totalIsrRetencion,
      }}
      margenFiscalMm={15}
    />
  );
}

/**
 * Elemento React server-renderable de la representación impresa, construido
 * con la plantilla real del sistema según el tipo de comprobante: nota de
 * débito (33), nota de crédito (34) o factura Carta Alegra (resto).
 */
export function elementoRepresentacionImpresa(datos: DatosRi): ReactElement {
  const empresa = empresaDesdeRi(datos);
  const emision = emisionDesdeRi(datos);
  const rncCliente = datos.comprador?.rnc ?? datos.comprador?.identificadorExtranjero ?? null;

  if (datos.tipoEcf === "33") {
    return (
      <NotaDebitoDocumento
        nota={notaDebitoDesdeRi(datos)}
        empresa={empresa}
        emisionEcf={emision}
        rncCliente={rncCliente}
      />
    );
  }
  if (datos.tipoEcf === "34") {
    return (
      <NotaCreditoDocumento
        nota={notaCreditoDesdeRi(datos)}
        empresa={empresa}
        emisionEcf={emision}
        rncCliente={rncCliente}
      />
    );
  }
  return elementoFacturaRi(datos);
}
