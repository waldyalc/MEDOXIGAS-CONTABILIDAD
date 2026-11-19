import { cn } from "cn";

import { FilaDato, FilaTotal, HojaImpresion } from "@/components/impresion/hoja-impresion";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import type { NotaCreditoVista } from "@/lib/notas-credito/tipos";

/** Papel de impresión de la nota de crédito de venta. */

const CELDA_DATO = "px-[5pt] py-[2.5pt] align-top text-[10pt] leading-[12.1pt] font-semibold";
const CELDA_MONTO = "px-[3pt] py-[2.5pt] align-top text-right whitespace-nowrap tabular-nums";
const ENCABEZADO_TABLA = "border-y border-[#d7dce3] bg-[#f7f8fa] px-[5pt] py-[2.5pt] text-[7.5pt] font-semibold";
const FILA_TABLA = "border-b border-[#e2e5ea]";

export function NotaCreditoPapel({
  nota,
  empresa,
  classNameBoton,
}: {
  nota: NotaCreditoVista;
  empresa: Empresa | null;
  classNameBoton?: string;
}) {
  return (
    <HojaImpresion
      titulo="NOTA DE CRÉDITO"
      empresa={empresa}
      numero={`NCF ${nota.ncf}`}
      fecha={nota.fecha}
      leyendaAnulacion={nota.estado === "anulada" ? "ANULADA" : undefined}
      classNameBoton={classNameBoton}
    >
      <section className="mt-[18pt] flex justify-between gap-[20pt] bg-[#f7f8fa] px-[5pt] py-[3pt]">
        <div className="flex min-w-0 flex-col">
          <FilaDato etiqueta="Cliente" valor={nota.cliente_nombre} />
          {/* TODO backend: el RNC del cliente no llega en getNotaCreditoVista (solo el nombre). */}
        </div>

        <div className="flex shrink-0 flex-col items-end text-right">
          <FilaDato
            etiqueta="Factura"
            valor={`#${nota.factura_numero}${nota.factura_ncf ? ` · ${nota.factura_ncf}` : ""}`}
          />
          <FilaDato etiqueta="Fecha" valor={formatoDia(nota.fecha)} />
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
          <FilaTotal etiqueta="SUBTOTAL" valor={formatoMoneda(nota.subtotal)} />
          <FilaTotal etiqueta="ITBIS" valor={formatoMoneda(nota.itbis)} />
          <div className="mt-[3pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[2pt] text-[10pt] font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(nota.total)}</span>
          </div>
        </div>
      </div>
    </HojaImpresion>
  );
}
