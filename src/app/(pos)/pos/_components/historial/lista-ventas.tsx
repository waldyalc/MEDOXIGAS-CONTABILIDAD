"use client";

import { cn } from "cn";
import { Loader2, Printer } from "lucide-react";

import { PillEstado, type TonoPill } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { HistorialPOSFila } from "@/lib/pos/tipos";

function tonoEstado(estado: HistorialPOSFila["estado"]): TonoPill {
  if (estado === "pagada") return "exito";
  if (estado === "anulada") return "peligro";
  return "pendiente";
}

function etiquetaEstado(estado: HistorialPOSFila["estado"]): string {
  if (estado === "pagada") return "Cobrada";
  if (estado === "anulada") return "Anulada";
  return "Por cobrar";
}

/** Lista maestra compacta del historial: cada ítem resume la venta y abre su detalle a la derecha. */
export function ListaVentas({
  filas,
  seleccionado,
  imprimiendo,
  onSeleccionar,
  onImprimir,
}: {
  filas: HistorialPOSFila[];
  seleccionado: string | null;
  imprimiendo: string | null;
  onSeleccionar: (id: string) => void;
  onImprimir: (fila: HistorialPOSFila) => void;
}) {
  return (
    <div className="divide-border flex flex-col divide-y">
      {filas.map((fila) => (
        <div
          key={fila.id}
          className={cn(
            "flex items-center gap-1 pr-1 hover:bg-slate-200/45 dark:hover:bg-white/[0.06]",
            seleccionado === fila.id && "bg-slate-200/45 dark:bg-white/[0.08]",
          )}
        >
          <button
            type="button"
            aria-current={seleccionado === fila.id || undefined}
            className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-2.5 text-left"
            onClick={() => onSeleccionar(fila.id)}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{fila.ncf ?? `Factura No ${fila.numero}`}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatoMoneda(fila.total)}</span>
            </span>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs">
                {`${formatoDia(fila.fecha)} · ${fila.cliente_nombre}`}
              </span>
              <PillEstado tono={tonoEstado(fila.estado)}>{etiquetaEstado(fila.estado)}</PillEstado>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Reimprimir ticket"
            onClick={() => onImprimir(fila)}
          >
            {imprimiendo === fila.id ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Printer aria-hidden="true" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
