"use client";

import { useState } from "react";

import { CheckCircle2, CircleAlert, Clock, Pencil, Printer, RefreshCw, Trash2 } from "@/components/icons";
import { PillEstado, type TonoPill } from "@/components/listas/tabla-lista";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoFechaHora } from "@/lib/formato";
import type { EstadoConexion } from "@/lib/pos/conexion-offline";
import { lineasVentaDeLocal, type VentaLocalHistorial } from "@/lib/pos/historial-offline";
import { armarTicketOffline } from "@/lib/pos/impresion";
import type { PlantillaTicket } from "@/lib/pos/tipos";

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

/** NCF definitivo cuando subió; si no, el número temporal del dispositivo. */
function numeroVenta(venta: VentaLocalHistorial): string {
  if (venta.ncf) return venta.ncf;
  if (venta.numero !== null) return `Factura No ${venta.numero}`;
  return "Venta en este dispositivo";
}

function BannerEstadoOffline({
  venta,
  reintentoBloqueado,
  onReintentar,
  onEditar,
  onImprimir,
  onDescartar,
}: {
  venta: VentaLocalHistorial;
  reintentoBloqueado: boolean;
  onReintentar: () => void;
  onEditar: () => void;
  onImprimir: () => void;
  onDescartar: () => void;
}) {
  if (venta.estado === "error") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/40 dark:bg-rose-500/10">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-pos-texto text-sm font-semibold">No se pudo sincronizar la venta</p>
            <p className="text-pos-texto-suave text-sm">
              {venta.motivo ?? "Ocurrió un error al sincronizar esta venta."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-pos-primario hover:bg-pos-primario-hover h-10 gap-1.5 text-white"
            disabled={reintentoBloqueado}
            onClick={onReintentar}
          >
            <RefreshCw aria-hidden="true" />
            Reintentar sincronización
          </Button>
          <Button variant="outline" className="h-10 gap-1.5" onClick={onEditar}>
            <Pencil aria-hidden="true" />
            Editar venta
          </Button>
          <Button variant="outline" className="h-10 gap-1.5" onClick={onImprimir}>
            <Printer aria-hidden="true" />
            Imprimir ticket
          </Button>
          <Button variant="ghost" className="text-destructive h-10 gap-1.5" onClick={onDescartar}>
            <Trash2 aria-hidden="true" />
            Descartar
          </Button>
        </div>
      </div>
    );
  }
  if (venta.estado === "sincronizando") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-pos-texto text-sm font-semibold">Sincronizando</p>
            <p className="text-pos-texto-suave text-sm">
              {`La venta está guardada en este dispositivo con el número temporal ${venta.folio}. Se subirá automáticamente al tener conexión.`}
            </p>
          </div>
        </div>
        <div>
          <Button variant="outline" className="h-10 gap-1.5" onClick={onImprimir}>
            <Printer aria-hidden="true" />
            Imprimir ticket
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
      <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <p className="text-pos-texto text-sm font-semibold">
        {venta.ncf ? `Venta sincronizada con NCF ${venta.ncf}` : "Venta sincronizada en el servidor"}
      </p>
    </div>
  );
}

/**
 * Detalle de una venta que todavía vive en este dispositivo (cola offline).
 * Permite reintentar la subida, editarla en el carrito, imprimir el ticket de
 * soporte o descartarla con confirmación.
 */
export function DetalleVentaOffline({
  venta,
  empresa,
  plantillaTicket,
  estado,
  onReintentar,
  onEditar,
  onDescartar,
}: {
  venta: VentaLocalHistorial;
  empresa: Empresa | null;
  plantillaTicket: PlantillaTicket;
  estado: EstadoConexion;
  onReintentar: () => void;
  onEditar: () => void;
  onDescartar: () => void;
}) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const reintentoBloqueado = estado === "offline" || estado === "sincronizando";

  const ticket = armarTicketOffline({
    folio: venta.folio,
    empresa,
    cliente: venta.cliente,
    lineas: lineasVentaDeLocal(venta.lineas),
    plantilla: plantillaTicket,
    fecha: venta.fecha,
    subtotal: venta.totales.subtotal,
    descuento: venta.totales.descuento,
    itbis: venta.totales.itbis,
    total: venta.totales.total,
    recibido: venta.totales.recibido,
    cambio: venta.totales.cambio,
  });

  return (
    <>
      <div className="flex min-h-full flex-col">
        <div className="flex flex-col gap-5 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-pos-texto text-lg font-semibold">{numeroVenta(venta)}</h2>
                <PillEstado tono={tonoLocal(venta.estado)}>{etiquetaLocal(venta.estado)}</PillEstado>
              </div>
              <p className="text-pos-texto-suave text-xs">
                {`Folio ${venta.folio} · ${formatoFechaHora(venta.fecha)}`}
              </p>
            </div>
          </div>

          <BannerEstadoOffline
            venta={venta}
            reintentoBloqueado={reintentoBloqueado}
            onReintentar={onReintentar}
            onEditar={onEditar}
            onImprimir={() => setImprimiendo(true)}
            onDescartar={() => setDescartando(true)}
          />

          <section className="flex flex-col gap-1 text-sm">
            <p className="text-pos-texto font-medium">{venta.cliente.nombre}</p>
            {venta.cliente.rnc_cedula ? (
              <p className="text-pos-texto-suave">RNC/Cédula: {venta.cliente.rnc_cedula}</p>
            ) : null}
          </section>

          <section>
            <h3 className="text-pos-texto mb-2 text-sm font-semibold">Productos y servicios</h3>
            <div className="border-pos-linea overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Desc.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venta.lineas.map((linea) => (
                    <TableRow key={linea.id}>
                      <TableCell className="text-sm">{linea.descripcion}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoCantidad(linea.cantidad)}
                        {linea.unidad_nombre ? ` ${linea.unidad_nombre}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(linea.descuento_pct) > 0 ? `${formatoCantidad(linea.descuento_pct)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(linea.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="bg-pos-panel border-pos-linea flex w-full max-w-[320px] flex-col gap-1 rounded-xl border px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-pos-texto-suave">Subtotal</span>
              <span className="tabular-nums">{formatoMoneda(venta.totales.subtotal)}</span>
            </div>
            {Number(venta.totales.descuento) > 0 ? (
              <div className="flex justify-between">
                <span className="text-pos-texto-suave">Descuento</span>
                <span className="tabular-nums">−{formatoMoneda(venta.totales.descuento)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-pos-texto-suave">ITBIS</span>
              <span className="tabular-nums">{formatoMoneda(venta.totales.itbis)}</span>
            </div>
            <div className="border-pos-linea mt-1 flex items-baseline justify-between border-t pt-1">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-semibold tabular-nums">{formatoMoneda(venta.totales.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pos-texto-suave">Recibido</span>
              <span className="tabular-nums">{formatoMoneda(venta.totales.recibido)}</span>
            </div>
            {Number(venta.totales.cambio) > 0 ? (
              <div className="flex justify-between">
                <span className="text-pos-texto-suave">Cambio</span>
                <span className="tabular-nums">{formatoMoneda(venta.totales.cambio)}</span>
              </div>
            ) : null}
          </section>

          <p className="text-pos-texto-suave text-xs">
            Este ticket de soporte se genera con los datos guardados en este dispositivo y no tiene valor fiscal.
          </p>
        </div>
      </div>

      {imprimiendo ? (
        <ImpresionPos
          titulo={`venta-offline-${venta.folio}`}
          ancho={ticket.diseno.ancho_mm}
          onCerrar={() => setImprimiendo(false)}
        >
          <TicketPos payload={ticket} />
        </ImpresionPos>
      ) : null}

      <AlertDialog open={descartando} onOpenChange={setDescartando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              {`La venta ${venta.folio} se borrará de este dispositivo y no se enviará al servidor. No se podrá recuperar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              onClick={() => {
                setDescartando(false);
                onDescartar();
              }}
            >
              Sí, descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
