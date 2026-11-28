"use client";

import { type ReactNode, useEffect, useState } from "react";

import { cn } from "cn";
import { createPortal } from "react-dom";

import { Printer } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia, formatoFechaHora } from "@/lib/formato";

/**
 * Papel de impresión compartido por los documentos que no son de venta
 * (recibos de caja, comprobantes de egreso, notas y asientos): encabezado con
 * la empresa a la izquierda y el comprobante a la derecha, el cuerpo del
 * documento como hijos y un pie con la fecha de generación. El botón
 * "Imprimir" abre la ventana de impresión del navegador; el papel viaja en un
 * portal oculto (`data-print-root`) que el CSS de `globals.css` convierte en
 * lo único visible al imprimir, como hace la vista de la factura.
 */

interface PropsHojaImpresion {
  /** Título del comprobante, p. ej. "RECIBO DE CAJA". */
  titulo: string;
  empresa: Empresa | null;
  /** Número o NCF del documento, ya formateado ("No. 12", "NCF B04…"). */
  numero: string;
  /** Fecha del documento en ISO (yyyy-mm-dd). */
  fecha: string;
  /** Leyenda roja para los documentos anulados ("ANULADA"). */
  leyendaAnulacion?: string;
  /** Clases extra del botón, para que combine con los botones de la página. */
  classNameBoton?: string;
  /** Cuerpo del documento. */
  children: ReactNode;
}

/** Props del papel puro, sin el botón de imprimir (server-renderable). */
export type PropsPapelImpresion = Omit<PropsHojaImpresion, "classNameBoton">;

function LogoEmpresa({ empresa, nombre }: { empresa: Empresa | null; nombre: string }) {
  const logo = empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";

  return (
    // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
    <img src={logo} alt={nombre} className="h-[50pt] w-auto max-w-[170pt] object-contain" />
  );
}

/**
 * Papel puro de la hoja de impresión, sin botón ni portal: server-renderable
 * (lo usa la tubería de PDF con `renderToStaticMarkup`). `HojaImpresion` lo
 * monta dentro del portal de impresión con el mismo HTML de siempre.
 */
export function PapelImpresion(props: PropsPapelImpresion) {
  const nombre = props.empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";

  return (
    <article
      className={cn(
        "documento-papel mx-auto flex min-h-[279mm] w-full flex-col bg-white p-[15mm]",
        "[font-family:var(--font-inter)] text-[10pt] leading-[12.1pt] text-[#0a2352]",
      )}
    >
      <header className="flex items-start justify-between gap-[24pt]">
        <div className="flex min-w-0 flex-col">
          <LogoEmpresa empresa={props.empresa} nombre={nombre} />
          <p className="mt-[3pt] text-[13pt] leading-[13.5pt] font-semibold">{nombre}</p>
          {props.empresa?.rnc?.trim() ? (
            <p>
              <span className="font-semibold">RNC:</span> {props.empresa.rnc}
            </p>
          ) : null}
          {props.empresa?.direccion?.trim() ? <p>{props.empresa.direccion}</p> : null}
          {props.empresa?.sucursal?.trim() ? (
            <p>
              <span className="font-semibold">Sucursal:</span> {props.empresa.sucursal}
            </p>
          ) : null}
          {props.empresa?.telefono?.trim() ? (
            <p>
              <span className="font-semibold">Teléfono:</span> {props.empresa.telefono}
            </p>
          ) : null}
          {props.empresa?.correo?.trim() ? <p>{props.empresa.correo}</p> : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold">{props.titulo}</p>
          <p className="my-[2pt] text-[14pt] leading-[16pt] font-semibold">{props.numero}</p>
          <p>{formatoDia(props.fecha)}</p>
          {props.leyendaAnulacion ? <p className="mt-[4pt] font-bold text-red-600">{props.leyendaAnulacion}</p> : null}
        </div>
      </header>

      {props.children}

      <footer className="mt-[18pt] text-center text-[6pt]">
        <p>Generado por Medoxigas Contabilidad</p>
        <p className="mt-[2pt]">{formatoFechaHora(new Date().toISOString())}</p>
      </footer>
    </article>
  );
}

export function HojaImpresion(props: PropsHojaImpresion) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  return (
    <>
      <Button variant="outline" className={cn("print:hidden", props.classNameBoton)} onClick={() => window.print()}>
        <Printer data-icon="inline-start" />
        Imprimir
      </Button>

      {montado
        ? createPortal(
            <div data-print-root>
              <div data-print-paper>
                <PapelImpresion
                  titulo={props.titulo}
                  empresa={props.empresa}
                  numero={props.numero}
                  fecha={props.fecha}
                  leyendaAnulacion={props.leyendaAnulacion}
                >
                  {props.children}
                </PapelImpresion>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Línea "Etiqueta: valor" del cuerpo del papel. */
export function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <p>
      <span className="font-semibold">{etiqueta}:</span> {valor}
    </p>
  );
}

/** Línea de totales: etiqueta a la izquierda y monto tabular a la derecha. */
export function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-[12pt]">
      <span>{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

/** Líneas de firma al pie del papel, como el conduce impreso. */
export function Firmas({ etiquetas }: { etiquetas: readonly string[] }) {
  const unica = etiquetas.length === 1;

  return (
    <div
      className={cn(
        "mt-[40pt] gap-[34pt] text-center text-[7.5pt]",
        unica ? "flex justify-center" : "grid grid-cols-2",
      )}
    >
      {etiquetas.map((etiqueta) => (
        <p key={etiqueta} className={cn("border-t border-[#0a2352] pt-[3pt]", unica && "w-[220pt]")}>
          {etiqueta}
        </p>
      ))}
    </div>
  );
}
