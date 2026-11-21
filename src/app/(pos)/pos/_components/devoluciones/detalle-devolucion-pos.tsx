"use client";

import { Printer, Undo2 } from "@/components/icons";
import { PillEstado } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import type { DevolucionPOSDetalle, DevolucionPOSFila } from "../tipos";

function filaDesdeDetalle(detalle: DevolucionPOSDetalle): DevolucionPOSFila {
  return {
    id: detalle.nota.id,
    numero: detalle.nota.numero,
    ncf: detalle.nota.ncf,
    fecha: detalle.nota.fecha,
    total: detalle.nota.total,
    estado: detalle.nota.estado,
    factura_id: detalle.nota.factura_id,
    factura_numero: detalle.factura.numero,
    factura_ncf: detalle.factura.ncf,
    contacto_id: detalle.nota.contacto_id,
    cliente_nombre: detalle.contacto?.nombre ?? "—",
    tipo_reembolso: detalle.nota.tipo_reembolso,
    monto_reembolso_efectivo: detalle.nota.monto_reembolso_efectivo,
    turno_numero: detalle.nota.turno_numero,
  };
}

/** Panel inline del detalle de una devolución (lado derecho del maestro-detalle). */
export function DetalleDevolucionPos({
  detalle,
  onImprimir,
}: {
  detalle: DevolucionPOSDetalle;
  onImprimir: (fila: DevolucionPOSFila) => void;
}) {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{detalle.nota.ncf}</h2>
            <PillEstado tono={detalle.nota.estado === "anulada" ? "peligro" : "exito"}>
              {detalle.nota.estado === "anulada" ? "Anulada" : "Activa"}
            </PillEstado>
          </div>
          <p className="text-muted-foreground text-xs">
            {`Factura origen ${detalle.factura.ncf ?? `No ${detalle.factura.numero}`} · ${formatoDia(detalle.nota.fecha)}`}
            {detalle.nota.turno_numero != null ? ` · Turno No ${detalle.nota.turno_numero}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 gap-1.5" onClick={() => onImprimir(filaDesdeDetalle(detalle))}>
            <Printer aria-hidden="true" />
            Imprimir ticket
          </Button>
          <Button
            variant="ghost"
            className="h-10"
            render={<a href={`/dashboard/notas-credito/${detalle.nota.id}`} target="_blank" rel="noreferrer" />}
          >
            Ver en Contabilidad
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{detalle.contacto?.nombre ?? "—"}</p>
            {detalle.contacto?.rnc_cedula ? (
              <p className="text-muted-foreground">RNC: {detalle.contacto.rnc_cedula}</p>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Líneas devueltas</h3>
            <div className="border-border overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">ITBIS</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.lineas.map((linea) => (
                    <TableRow key={linea.id}>
                      <TableCell className="text-sm">{linea.descripcion}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoCantidad(linea.cantidad)}
                        {linea.unidad_nombre ? ` ${linea.unidad_nombre}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(linea.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        <aside className="h-fit">
          <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatoMoneda(detalle.nota.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ITBIS</span>
              <span className="tabular-nums">{formatoMoneda(detalle.nota.itbis)}</span>
            </div>
            <div className="border-border mt-1 flex items-baseline justify-between border-t pt-1">
              <span className="font-semibold">Total devuelto</span>
              <span className="text-destructive text-xl font-semibold tabular-nums">
                {formatoMoneda(detalle.nota.total)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">
                <Undo2 className="mr-1 inline size-3.5" aria-hidden="true" />
                Reembolso
              </span>
              <span>
                {detalle.nota.tipo_reembolso === "credito_factura"
                  ? "Crédito a factura"
                  : detalle.nota.tipo_reembolso === "efectivo"
                    ? "Efectivo"
                    : "Combinado"}
              </span>
            </div>
            {detalle.nota.tipo_reembolso !== "credito_factura" ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efectivo</span>
                <span className="tabular-nums">{formatoMoneda(detalle.nota.monto_reembolso_efectivo)}</span>
              </div>
            ) : null}
            {detalle.nota.notas ? (
              <p className="text-muted-foreground border-border mt-1 border-t pt-1 text-xs">{detalle.nota.notas}</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
