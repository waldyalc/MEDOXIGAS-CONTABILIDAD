"use client";

import { cn } from "cn";
import { ReceiptText } from "lucide-react";

import { PillEstado } from "@/components/listas/tabla-lista";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import type { PagoPOSFila } from "@/lib/pos/consultas";
import type { TipoMovimientoPOS } from "@/lib/pos/tipos";

import { MOTIVOS_MOVIMIENTO } from "./etiquetas-pagos";

/**
 * Lista maestra de recibos del Registro de pagos: número y referencia a la
 * izquierda, monto firmado y fecha a la derecha, como en Alegra. El seleccionado
 * lleva el acento primario; el detalle vive al lado (escritorio) o en un Sheet
 * (móvil).
 */
export function ListaPagos({
  filas,
  seleccionadoId,
  onSeleccionar,
  tipo,
  filtrada,
}: {
  filas: PagoPOSFila[];
  seleccionadoId: string | null;
  onSeleccionar: (fila: PagoPOSFila) => void;
  tipo: TipoMovimientoPOS;
  /** true = hay búsqueda activa: el vacío es de filtro, no de datos. */
  filtrada: boolean;
}) {
  if (filas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
        <ReceiptText className="size-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <p className="font-semibold">
          {filtrada ? "Sin resultados." : `No hay ${tipo === "ingreso" ? "ingresos" : "egresos"} registrados.`}
        </p>
        <p className="text-muted-foreground text-sm">
          {filtrada
            ? "Ningún recibo coincide con la búsqueda."
            : "Los movimientos de caja de esta terminal aparecerán aquí."}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {filas.map((fila) => {
        const activo = fila.id === seleccionadoId;
        return (
          <li key={fila.id}>
            <button
              type="button"
              aria-current={activo || undefined}
              onClick={() => onSeleccionar(fila)}
              className={cn(
                "hover:bg-muted/60 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                activo && "bg-primary/5 hover:bg-primary/5 shadow-[inset_3px_0_0_0_var(--color-primary)]",
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  <span className="font-mono">{fila.numero}</span>
                  {" · "}
                  {fila.contacto_nombre ?? MOTIVOS_MOVIMIENTO[fila.motivo]}
                </span>
                <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                  {fila.contacto_nombre ? MOTIVOS_MOVIMIENTO[fila.motivo] : null}
                  {fila.contacto_nombre && fila.turno_numero ? " · " : null}
                  {fila.turno_numero ? `Turno No ${fila.turno_numero}` : null}
                  {!fila.vigente ? <PillEstado tono="neutro">No vigente</PillEstado> : null}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    fila.tipo === "retiro" && "text-destructive",
                    !fila.vigente && "line-through opacity-60",
                  )}
                >
                  {`${fila.tipo === "retiro" ? "−" : "+"}${formatoMoneda(fila.monto)}`}
                </span>
                <span className="text-muted-foreground text-xs">{formatoFechaHora(fila.creado_en)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
