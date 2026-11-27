import type { CSSProperties } from "react";

import { generarVectorQr } from "@/lib/ecf/qr-svg";

export interface BloqueFiscalEcfProps {
  codigoSeguridad: string;
  fechaHoraFirma: string | null;
  urlQr: string;
  encf?: string | null;
  compacto?: boolean;
  tamanoQrMm?: number;
}

function fechaValida(dia: number, mes: number, ano: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const fecha = new Date(Date.UTC(ano, mes - 1, dia));
  return fecha.getUTCFullYear() === ano && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function normalizarFecha(dia: string, mes: string, ano: string): string | null {
  const diaNumero = Number(dia);
  const mesNumero = Number(mes);
  const anoNumero = Number(ano);
  if (!fechaValida(diaNumero, mesNumero, anoNumero)) return null;
  return `${dia}/${mes}/${ano}`;
}

export function formatearFechaFirmaEcf(fechaHoraFirma: string | null | undefined): string | null {
  const texto = fechaHoraFirma?.trim() ?? "";
  if (!texto) return null;

  const dgii = texto.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s|$)/);
  if (dgii?.[1] && dgii[2] && dgii[3]) return normalizarFecha(dgii[1], dgii[2], dgii[3]);

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/);
  if (iso?.[1] && iso[2] && iso[3]) return normalizarFecha(iso[3], iso[2], iso[1]);

  const slash = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (slash?.[1] && slash[2] && slash[3]) return normalizarFecha(slash[1], slash[2], slash[3]);

  return null;
}

function QrDgii({ urlQr, estilo }: { urlQr: string; estilo: CSSProperties }) {
  const { dimension, trazado } = generarVectorQr(urlQr);

  return (
    <svg
      aria-label="Código QR de verificación DGII"
      className="block shrink-0 bg-white"
      height={estilo.height}
      role="img"
      shapeRendering="crispEdges"
      style={estilo}
      viewBox={`0 0 ${dimension} ${dimension}`}
      width={estilo.width}
    >
      <rect fill="#ffffff" height="100%" width="100%" />
      <path d={trazado} fill="#000000" />
    </svg>
  );
}

export function BloqueFiscalEcf({
  codigoSeguridad,
  fechaHoraFirma,
  urlQr,
  encf,
  compacto = false,
  tamanoQrMm,
}: BloqueFiscalEcfProps) {
  const codigo = codigoSeguridad.trim();
  const url = urlQr.trim();
  if (!codigo || !url) return null;

  const fecha = formatearFechaFirmaEcf(fechaHoraFirma);
  const estiloQr: CSSProperties = compacto
    ? { width: `${tamanoQrMm ?? 46}mm`, height: `${tamanoQrMm ?? 46}mm` }
    : { width: "84pt", height: "84pt" };

  if (compacto) {
    return (
      <section className="bloque-ecf mt-[3mm] flex break-inside-avoid flex-col items-center text-black">
        <QrDgii estilo={estiloQr} urlQr={url} />
        <div className="mt-[1.2mm] flex flex-col items-center text-center text-[8pt] leading-[10pt] font-bold">
          <p>Código de seguridad: {codigo}</p>
          {fecha ? <p>Fecha firma digital: {fecha}</p> : null}
        </div>
        {encf ? <span className="sr-only">e-NCF {encf}</span> : null}
      </section>
    );
  }

  return (
    <section className="mt-[8pt] flex break-inside-avoid flex-col items-start text-[#0a2352]">
      <QrDgii estilo={estiloQr} urlQr={url} />
      <div className="mt-[1.5pt] flex flex-col text-[5.8pt] leading-[7.2pt]">
        <p>Código de seguridad {codigo}</p>
        <p>Fecha de firma digital</p>
        {fecha ? <p>{fecha}</p> : null}
        <p className="mt-[2pt] text-[7pt] leading-[8.5pt] font-medium">Original: Cliente</p>
      </div>
      {encf ? <span className="sr-only">e-NCF {encf}</span> : null}
    </section>
  );
}
