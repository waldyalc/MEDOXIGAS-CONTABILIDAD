"use client";

import { cn } from "cn";

import { CheckCircle2, CircleAlert, Clock, Loader2, Printer } from "@/components/icons";
import { PillEstado, type TonoPill } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia, formatoFechaHora } from "@/lib/formato";
import { type ItemHistorialPOS, idDeItemHistorial, type VentaLocalHistorial } from "@/lib/pos/historial-offline";
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

function tonoLocal(estado: VentaLocalHistorial["estado"]): TonoPill {
  if (estado === "error") return "peligro";
  if (estado === "sincronizada") return "exito";
  return "pendiente";
}

function etiquetaLocal(estado: VentaLocalHistorial["estado"]): string {
  if (estado === "error") return "Error";
  if (estado === "sincronizada") return "Cobrada";
  return "Sincronizando";
}

/** Estado de una venta que aún vive en este dispositivo: reloj, ✓ o !. */
function IconoLocal({ estado }: { estado: VentaLocalHistorial["estado"] }) {
  if (estado === "error") {
    return <CircleAlert className="size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />;
  }
  if (estado === "sincronizada") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
  }
  return <Clock className="size-4 shrink-0 text-amber-500" aria-hidden="true" />;
}

/** Número visible: NCF definitivo, «Factura No N» o el folio temporal. */
function numeroLocal(venta: VentaLocalHistorial): string {
  if (venta.ncf) return venta.ncf;
  if (venta.numero !== null) return `Factura No ${venta.numero}`;
  return venta.folio;
}

function FilaServidor({
  fila,
  activo,
  imprimiendo,
  onSeleccionar,
  onImprimir,
}: {
  fila: HistorialPOSFila;
  activo: boolean;
  imprimiendo: string | null;
  onSeleccionar: (id: string) => void;
  onImprimir: (fila: HistorialPOSFila) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 pr-1 hover:bg-slate-200/45 dark:hover:bg-white/[0.06]",
        activo && "bg-slate-200/45 dark:bg-white/[0.08]",
      )}
    >
      <button
        type="button"
        aria-current={activo || undefined}
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
  );
}

function FilaLocal({
  venta,
  activo,
  onSeleccionar,
}: {
  venta: VentaLocalHistorial;
  activo: boolean;
  onSeleccionar: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 pr-1 hover:bg-slate-200/45 dark:hover:bg-white/[0.06]",
        activo && "bg-slate-200/45 dark:bg-white/[0.08]",
      )}
    >
      <button
        type="button"
        aria-current={activo || undefined}
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-2.5 text-left"
        onClick={() => onSeleccionar(venta.uuid)}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconoLocal estado={venta.estado} />
            <span className="truncate text-sm font-medium">{numeroLocal(venta)}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatoMoneda(venta.total)}</span>
        </span>
        <span className="flex w-full items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-xs">
            {`${venta.fecha ? formatoFechaHora(venta.fecha) : "—"} · ${venta.cliente.nombre}`}
          </span>
          <PillEstado tono={tonoLocal(venta.estado)}>{etiquetaLocal(venta.estado)}</PillEstado>
        </span>
      </button>
    </div>
  );
}

/**
 * Lista maestra del historial: filas del servidor y ventas que aún viven en
 * este dispositivo (en cola, con error o recién sincronizadas). Cada ítem
 * resume la venta y abre su detalle a la derecha.
 */
export function ListaVentas({
  items,
  seleccionado,
  imprimiendo,
  onSeleccionar,
  onImprimir,
}: {
  items: ItemHistorialPOS[];
  seleccionado: string | null;
  imprimiendo: string | null;
  onSeleccionar: (id: string) => void;
  onImprimir: (fila: HistorialPOSFila) => void;
}) {
  return (
    <div className="divide-border flex flex-col divide-y">
      {items.map((item) =>
        item.origen === "servidor" ? (
          <FilaServidor
            key={idDeItemHistorial(item)}
            fila={item.fila}
            activo={seleccionado === item.fila.id}
            imprimiendo={imprimiendo}
            onSeleccionar={onSeleccionar}
            onImprimir={onImprimir}
          />
        ) : (
          <FilaLocal
            key={idDeItemHistorial(item)}
            venta={item.venta}
            activo={seleccionado === item.venta.uuid}
            onSeleccionar={onSeleccionar}
          />
        ),
      )}
    </div>
  );
}
