"use client";

import type { ReactNode } from "react";

import { cn } from "cn";
import { ArrowUpRight, Loader2, Printer, ReceiptText, RotateCcw, Wallet } from "lucide-react";

import { PillEstado } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import type { PagoPOSFila } from "@/lib/pos/consultas";

import { MOTIVOS_CON_INVERSO, MOTIVOS_MOVIMIENTO } from "./etiquetas-pagos";

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

/**
 * Detalle del recibo seleccionado (maestro-detalle del Registro de pagos):
 * número, fecha, monto grande, datos generales y las acciones reales —
 * imprimir, ver la factura o el gasto ligado y registrar el inverso. Sin
 * editar ni eliminar: `pos_turno_movimientos` es inmutable.
 */
export function DetallePago({
  pago,
  cajaNombre,
  puedeInversa,
  imprimiendo,
  onImprimir,
  onInverso,
  className,
}: {
  pago: PagoPOSFila | null;
  /** Nombre de la cuenta de efectivo de la terminal (la "cuenta bancaria"). */
  cajaNombre: string | null;
  /** Hay turno abierto y el rol escribe: permite registrar el inverso. */
  puedeInversa: boolean;
  imprimiendo: boolean;
  onImprimir: (fila: PagoPOSFila) => void;
  onInverso: (fila: PagoPOSFila) => void;
  className?: string;
}) {
  if (!pago) {
    return (
      <div className={cn("flex flex-col items-center gap-1.5 px-6 py-16 text-center", className)}>
        <ReceiptText className="size-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">Selecciona un recibo para ver su detalle.</p>
      </div>
    );
  }

  const retiro = pago.tipo === "retiro";

  return (
    <div className={cn("flex flex-col gap-5 p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold">{`Recibo No ${pago.numero}`}</h2>
          <p className="text-muted-foreground text-sm">{`Creado el ${formatoFechaHora(pago.creado_en)}`}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Imprimir recibo"
            title="Imprimir recibo"
            disabled={imprimiendo}
            onClick={() => onImprimir(pago)}
          >
            {imprimiendo ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Printer aria-hidden="true" />}
          </Button>
          {pago.factura_id ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ver factura en Contabilidad"
              title="Ver factura en Contabilidad"
              render={<a href={`/dashboard/facturacion/${pago.factura_id}`} target="_blank" rel="noreferrer" />}
            >
              <ArrowUpRight aria-hidden="true" />
            </Button>
          ) : null}
          {pago.gasto_menor_id ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ver gasto en Contabilidad"
              title="Ver gasto en Contabilidad"
              render={<a href={`/dashboard/gastos/${pago.gasto_menor_id}`} target="_blank" rel="noreferrer" />}
            >
              <ArrowUpRight aria-hidden="true" />
            </Button>
          ) : null}
          {puedeInversa && pago.vigente && MOTIVOS_CON_INVERSO.has(pago.motivo) ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Registrar movimiento inverso"
              title="Registrar movimiento inverso"
              onClick={() => onInverso(pago)}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {!pago.vigente ? (
        <div>
          <PillEstado tono="neutro">No vigente: su documento quedó anulado y no suma en caja.</PillEstado>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
          <Wallet className="text-muted-foreground size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Monto</span>
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              retiro && "text-destructive",
              !pago.vigente && "line-through opacity-60",
            )}
          >
            {`${retiro ? "−" : "+"}${formatoMoneda(pago.monto)}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Datos generales</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <Campo etiqueta="Cliente">{pago.contacto_nombre ?? "—"}</Campo>
          <Campo etiqueta="Caja">{cajaNombre ?? "—"}</Campo>
          <Campo etiqueta="Método de pago">Efectivo</Campo>
          <Campo etiqueta="Motivo">{MOTIVOS_MOVIMIENTO[pago.motivo]}</Campo>
          <Campo etiqueta="Cuenta contable">{pago.cuenta_nombre ?? "—"}</Campo>
          <Campo etiqueta="Turno">{pago.turno_numero ? `No ${pago.turno_numero}` : "—"}</Campo>
          {pago.factura_numero ? (
            <Campo etiqueta="Factura">{`No ${pago.factura_numero}${pago.factura_ncf ? ` · ${pago.factura_ncf}` : ""}`}</Campo>
          ) : null}
        </dl>
        {pago.notas ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Notas: </span>
            {pago.notas}
          </p>
        ) : null}
      </div>
    </div>
  );
}
