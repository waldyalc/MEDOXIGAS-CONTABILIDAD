import { cn } from "cn";

import { FilaDato, FilaTotal, Firmas, HojaImpresion } from "@/components/impresion/hoja-impresion";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { montoEnLetras } from "@/lib/facturacion/numero-a-letras";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import type { DetallePagoRecibido } from "@/lib/pagos/detalle";
import type { MetodoPago } from "@/lib/pagos/tipos";

/** Papel de impresión del pago recibido (recibo de caja). */

const CELDA_DATO = "px-[5pt] py-[2.5pt] align-top text-[10pt] leading-[12.1pt] font-semibold";
const CELDA_MONTO = "px-[3pt] py-[2.5pt] align-top text-right whitespace-nowrap tabular-nums";
const ENCABEZADO_TABLA = "border-y border-[#d7dce3] bg-[#f7f8fa] px-[5pt] py-[2.5pt] text-[7.5pt] font-semibold";
const FILA_TABLA = "border-b border-[#e2e5ea]";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export function ReciboCaja({
  pago,
  empresa,
  classNameBoton,
}: {
  pago: DetallePagoRecibido;
  empresa: Empresa | null;
  classNameBoton?: string;
}) {
  return (
    <HojaImpresion
      titulo="RECIBO DE CAJA"
      empresa={empresa}
      numero={`No. ${pago.numero}`}
      fecha={pago.fecha}
      leyendaAnulacion={pago.estado === "anulado" ? "ANULADO" : undefined}
      classNameBoton={classNameBoton}
    >
      <section className="mt-[18pt] flex justify-between gap-[20pt] bg-[#f7f8fa] px-[5pt] py-[3pt]">
        <div className="flex min-w-0 flex-col">
          <FilaDato etiqueta="Recibido de" valor={pago.contacto?.nombre ?? "—"} />
          {pago.contacto?.rnc_cedula?.trim() ? <FilaDato etiqueta="RNC" valor={pago.contacto.rnc_cedula} /> : null}
        </div>

        <div className="flex shrink-0 flex-col items-end text-right">
          <FilaDato etiqueta="Fecha del pago" valor={formatoDia(pago.fecha)} />
          <FilaDato etiqueta="Método de pago" valor={ETIQUETAS_METODO[pago.metodo]} />
          <FilaDato etiqueta="Cuenta" valor={pago.cuenta ? `${pago.cuenta.codigo} · ${pago.cuenta.nombre}` : "—"} />
        </div>
      </section>

      {/* TODO backend: el saldo antes y después de cada factura no llega en
          obtenerPagoRecibido; haría falta traer el total y lo pagado por factura. */}
      {pago.aplicaciones.length === 0 ? (
        <p className="mt-[12pt]">Este pago no tiene facturas aplicadas.</p>
      ) : (
        <table className="mt-[12pt] w-full table-fixed border-collapse text-left">
          <colgroup>
            <col />
            <col className="w-[90pt]" />
            <col className="w-[90pt]" />
          </colgroup>
          <thead>
            <tr>
              <th className={ENCABEZADO_TABLA}>NCF</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Monto</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Retención</th>
            </tr>
          </thead>
          <tbody>
            {pago.aplicaciones.map((aplicacion) => (
              <tr key={aplicacion.factura_id} className={FILA_TABLA}>
                <td className={CELDA_DATO}>{aplicacion.ncf ?? `#${aplicacion.numero}`}</td>
                <td className={CELDA_MONTO}>{formatoMoneda(aplicacion.monto)}</td>
                <td className={CELDA_MONTO}>{aplicacion.retenido > 0 ? formatoMoneda(aplicacion.retenido) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-[8pt] bg-[#f7f8fa] px-[5pt] py-[3.5pt] font-semibold">
        {montoEnLetras(pago.monto + pago.retenido)}
      </p>

      <div className="flex-1" />

      <div className="flex justify-end">
        <div className="w-[210pt] text-[8pt] leading-[13.6pt]">
          <FilaTotal etiqueta="MONTO RECIBIDO" valor={formatoMoneda(pago.monto)} />
          {pago.retenido > 0 ? <FilaTotal etiqueta="RETENCIÓN" valor={formatoMoneda(pago.retenido)} /> : null}
          <div className="mt-[3pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[2pt] text-[10pt] font-semibold">
            <span>Total recibido</span>
            <span className="tabular-nums">{formatoMoneda(pago.monto + pago.retenido)}</span>
          </div>
        </div>
      </div>

      {pago.notas?.trim() ? (
        <section className="mt-[12pt] text-[9pt] leading-[11pt]">
          <p className="font-semibold">Notas</p>
          <p className="whitespace-pre-line">{pago.notas}</p>
        </section>
      ) : null}

      <Firmas etiquetas={["RECIBIDO POR"]} />
    </HojaImpresion>
  );
}
