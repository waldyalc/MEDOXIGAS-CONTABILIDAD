import { construirUrlQrDgii } from "@/lib/ecf/endpoints";
import type { AmbienteEcf, EstadoDgii, TipoEcf } from "@/lib/ecf/tipos";

export type EstadoEnvioEcf = EstadoDgii;
export type EstadoEmisionFactura = "no_electronica" | "sin_emision" | "en_proceso" | "emitida" | "rechazada";
export type FiltroEmisionFactura = "sin_emision" | "en_proceso";

export interface EnvioEcfFactura {
  id: string;
  rnc_emisor: string;
  documento_tipo: string;
  documento_id: string | null;
  tipo_ecf: TipoEcf;
  encf: string;
  es_rfce: boolean;
  ambiente: AmbienteEcf;
  estado: EstadoEnvioEcf;
  track_id: string | null;
  codigo_seguridad: string | null;
  url_qr: string | null;
  fecha_hora_firma: string | null;
  mensajes: string[] | null;
  intentos: number;
  ultimo_intento_at: string | null;
  updated_at: string;
  tiene_xml?: boolean;
}

export function esNcfElectronico(ncf: string | null | undefined): boolean {
  return /^E\d{2}/i.test(ncf?.trim() ?? "");
}

export function tipoEcfDesdeNcf(ncf: string | null | undefined): TipoEcf | null {
  const tipo = ncf?.trim().slice(1, 3);
  return tipo === "31" ||
    tipo === "32" ||
    tipo === "33" ||
    tipo === "34" ||
    tipo === "41" ||
    tipo === "43" ||
    tipo === "44" ||
    tipo === "45" ||
    tipo === "46" ||
    tipo === "47"
    ? tipo
    : null;
}

export function derivarEstadoEmisionFactura(
  ncf: string | null | undefined,
  envio: Pick<EnvioEcfFactura, "estado"> | null | undefined,
): EstadoEmisionFactura {
  if (!esNcfElectronico(ncf)) return "no_electronica";
  if (envio?.estado === "aceptado" || envio?.estado === "aceptado_condicional") return "emitida";
  if (envio?.estado === "en_proceso" || envio?.estado === "pendiente") return "en_proceso";
  if (envio?.estado === "rechazado") return "rechazada";
  return "sin_emision";
}

export function normalizarFiltroEmision(valor: string | null | undefined): FiltroEmisionFactura | undefined {
  return valor === "sin_emision" || valor === "en_proceso" ? valor : undefined;
}

export function nombreArchivoXmlEcf(ncf: string): string {
  return `Factura de venta NCF ${ncf}.xml`;
}

export function fechaEmisionIso(fechaHoraFirma: string | null | undefined, fechaFactura: string): string {
  const texto = fechaHoraFirma?.trim() ?? "";
  const dgii = texto.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s|$)/);
  if (dgii?.[1] && dgii[2] && dgii[3]) return `${dgii[3]}-${dgii[2]}-${dgii[1]}`;
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso?.[1]) return iso[1];
  return fechaFactura;
}

export function fechaDgiiDesdeIso(fecha: string): string {
  const iso = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso?.[1] && iso[2] && iso[3]) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  return fecha;
}

export function construirUrlQrEcf({
  envio,
  rncComprador,
  fechaEmision,
  montoTotal,
}: {
  envio: EnvioEcfFactura;
  rncComprador: string | null | undefined;
  fechaEmision: string;
  montoTotal: number;
}): string | null {
  if (!envio.codigo_seguridad || !envio.fecha_hora_firma) return null;
  return construirUrlQrDgii({
    ambiente: envio.ambiente,
    rncEmisor: envio.rnc_emisor,
    rncComprador: rncComprador?.replace(/\D/g, "") ?? "",
    encf: envio.encf,
    fechaEmision: fechaDgiiDesdeIso(fechaEmision),
    montoTotal: montoTotal.toFixed(2),
    fechaFirma: envio.fecha_hora_firma,
    codigoSeguridad: envio.codigo_seguridad,
    esRfce: envio.es_rfce,
  });
}
