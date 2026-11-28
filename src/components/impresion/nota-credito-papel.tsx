import { cn } from "cn";

import { BloqueFiscalEcf } from "@/components/documento-venta/bloque-fiscal-ecf";
import { FilaDato, FilaTotal, HojaImpresion, PapelImpresion } from "@/components/impresion/hoja-impresion";
import { TIPOS_ECF } from "@/lib/ecf/tipos";
import { tipoEcfDesdeNcf } from "@/lib/facturacion/emision-ecf";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { filasTotalesNota } from "@/lib/facturacion/totales-nota";
import { formatoDia } from "@/lib/formato";
import type { NotaCreditoVista } from "@/lib/notas-credito/tipos";

/** Papel de impresión de la nota de crédito de venta. */

const CELDA_DATO = "px-[5pt] py-[2.5pt] align-top text-[10pt] leading-[12.1pt] font-semibold";
const CELDA_MONTO = "px-[3pt] py-[2.5pt] align-top text-right whitespace-nowrap tabular-nums";
const ENCABEZADO_TABLA = "border-y border-[#d7dce3] bg-[#f7f8fa] px-[5pt] py-[2.5pt] text-[7.5pt] font-semibold";
const FILA_TABLA = "border-b border-[#e2e5ea]";

export interface EmisionEcfNota {
  codigoSeguridad: string;
  fechaHoraFirma: string | null;
  urlQr: string;
  /** Vencimiento de la secuencia e-NCF en ISO (aaaa-mm-dd), exacto del XML; solo representación impresa. */
  vencimientoSecuencia?: string | null;
  /** Monto gravado total exacto del XML; la RI lo pasa, nunca lo recomputa. */
  montoGravado?: number | null;
  /** Monto exento exacto del XML. */
  montoExento?: number | null;
}

interface PropsNotaCredito {
  nota: NotaCreditoVista;
  empresa: Empresa | null;
  /** Emisión e-CF (RI electrónica): cambia el título al tipo DGII y agrega el bloque fiscal. */
  emisionEcf?: EmisionEcfNota | null;
  /** RNC o identificador del comprador del XML e-CF (hoy no llega en la vista). */
  rncCliente?: string | null;
}

function encabezadoNota(nota: NotaCreditoVista, emisionEcf: EmisionEcfNota | null | undefined) {
  const tipoEcf = tipoEcfDesdeNcf(nota.ncf);
  const electronica = Boolean(emisionEcf) && tipoEcf != null;
  return {
    titulo: electronica && tipoEcf ? TIPOS_ECF[tipoEcf].nombre : "NOTA DE CRÉDITO",
    numero: electronica ? `e-NCF ${nota.ncf}` : `NCF ${nota.ncf}`,
  };
}

function ContenidoNotaCredito({
  nota,
  emisionEcf,
  rncCliente,
}: {
  nota: NotaCreditoVista;
  emisionEcf?: EmisionEcfNota | null;
  rncCliente?: string | null;
}) {
  return (
    <>
      <section className="mt-[18pt] flex justify-between gap-[20pt] bg-[#f7f8fa] px-[5pt] py-[3pt]">
        <div className="flex min-w-0 flex-col">
          <FilaDato etiqueta="Cliente" valor={nota.cliente_nombre} />
          {/* TODO backend: el RNC del cliente no llega en getNotaCreditoVista (solo el nombre). */}
          {rncCliente?.trim() ? <FilaDato etiqueta="RNC" valor={rncCliente} /> : null}
        </div>

        <div className="flex shrink-0 flex-col items-end text-right">
          <FilaDato
            etiqueta="Factura"
            valor={
              emisionEcf
                ? `${nota.factura_numero > 0 ? `#${nota.factura_numero}` : ""}${nota.factura_numero > 0 && nota.factura_ncf ? " · " : ""}${nota.factura_ncf ?? ""}`
                : `#${nota.factura_numero}${nota.factura_ncf ? ` · ${nota.factura_ncf}` : ""}`
            }
          />
          <FilaDato etiqueta="Fecha" valor={formatoDia(nota.fecha)} />
          {emisionEcf?.vencimientoSecuencia ? (
            <FilaDato etiqueta="Vencimiento e-NCF" valor={formatoDia(emisionEcf.vencimientoSecuencia)} />
          ) : null}
        </div>
      </section>

      {nota.notas?.trim() ? (
        <section className="mt-[12pt] text-[9pt] leading-[11pt]">
          <p className="font-semibold">Motivo</p>
          <p className="whitespace-pre-line">{nota.notas}</p>
        </section>
      ) : null}

      {nota.lineas.length === 0 ? (
        <p className="mt-[12pt]">La nota no tiene líneas.</p>
      ) : (
        <table className="mt-[12pt] w-full table-fixed border-collapse text-left">
          <colgroup>
            <col />
            <col className="w-[52pt]" />
            <col className="w-[90pt]" />
            <col className="w-[90pt]" />
          </colgroup>
          <thead>
            <tr>
              <th className={ENCABEZADO_TABLA}>Producto</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Cantidad</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Precio</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {nota.lineas.map((linea) => (
              <tr key={linea.id} className={FILA_TABLA}>
                <td className={CELDA_DATO}>
                  <div className="flex flex-col">
                    <span>{linea.descripcion}</span>
                    {linea.productos ? <span className="text-[8pt] font-normal">{linea.productos.nombre}</span> : null}
                  </div>
                </td>
                <td className={CELDA_MONTO}>{formatoCantidad(linea.cantidad)}</td>
                <td className={CELDA_MONTO}>{formatoMoneda(linea.precio)}</td>
                <td className={CELDA_MONTO}>{formatoMoneda(linea.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex-1" />

      <div className="flex justify-end">
        <div className="w-[210pt] text-[8pt] leading-[13.6pt]">
          {filasTotalesNota(nota).map((fila) => (
            <FilaTotal key={fila.etiqueta} etiqueta={fila.etiqueta.toUpperCase()} valor={formatoMoneda(fila.valor)} />
          ))}
          {emisionEcf?.montoGravado != null ? (
            <FilaTotal etiqueta="MONTO GRAVADO" valor={formatoMoneda(emisionEcf.montoGravado)} />
          ) : null}
          {(emisionEcf?.montoExento ?? 0) > 0 ? (
            <FilaTotal etiqueta="SUBTOTAL EXENTO" valor={formatoMoneda(emisionEcf?.montoExento)} />
          ) : null}
          <div className="mt-[3pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[2pt] text-[10pt] font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(nota.total)}</span>
          </div>
        </div>
      </div>

      {emisionEcf ? (
        <>
          <div style={{ marginLeft: "5mm" }}>
            <BloqueFiscalEcf
              codigoSeguridad={emisionEcf.codigoSeguridad}
              encf={nota.ncf}
              fechaHoraFirma={emisionEcf.fechaHoraFirma}
              urlQr={emisionEcf.urlQr}
            />
          </div>
          {emisionEcf.fechaHoraFirma ? (
            <p className="mt-[2pt] text-[7pt] leading-[9pt]">Fecha de firma digital: {emisionEcf.fechaHoraFirma}</p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function NotaCreditoPapel({
  nota,
  empresa,
  classNameBoton,
  emisionEcf,
  rncCliente,
}: PropsNotaCredito & { classNameBoton?: string }) {
  const encabezado = encabezadoNota(nota, emisionEcf);

  return (
    <HojaImpresion
      titulo={encabezado.titulo}
      empresa={empresa}
      numero={encabezado.numero}
      fecha={nota.fecha}
      leyendaAnulacion={nota.estado === "anulada" ? "ANULADA" : undefined}
      classNameBoton={classNameBoton}
    >
      <ContenidoNotaCredito nota={nota} emisionEcf={emisionEcf} rncCliente={rncCliente} />
    </HojaImpresion>
  );
}

/**
 * Documento Carta completo de la nota de crédito, server-renderable (sin el
 * botón ni el portal): lo usa la tubería de PDF con `renderToStaticMarkup`.
 */
export function NotaCreditoDocumento({ nota, empresa, emisionEcf, rncCliente }: PropsNotaCredito) {
  const encabezado = encabezadoNota(nota, emisionEcf);

  return (
    <PapelImpresion
      titulo={encabezado.titulo}
      empresa={empresa}
      numero={encabezado.numero}
      fecha={nota.fecha}
      leyendaAnulacion={nota.estado === "anulada" ? "ANULADA" : undefined}
    >
      <ContenidoNotaCredito nota={nota} emisionEcf={emisionEcf} rncCliente={rncCliente} />
    </PapelImpresion>
  );
}
