"use client";

import { useState } from "react";

import { CircleCheck, Printer } from "@/components/icons";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { armarTicketDevolucion } from "@/lib/pos/impresion";
import type { DevolucionPOSResultado, PlantillaTicket } from "@/lib/pos/tipos";

export function ConfirmacionDevolucion({
  resultado,
  plantilla,
  onNueva,
  onCerrar,
}: {
  resultado: DevolucionPOSResultado;
  plantilla: PlantillaTicket;
  onNueva: () => void;
  onCerrar: () => void;
}) {
  const [imprimir, setImprimir] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="bg-pos-primario/10 text-pos-primario flex size-14 items-center justify-center rounded-full">
        <CircleCheck className="size-7" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Devolución creada</h2>
        <p className="text-sm font-medium">{resultado.nota.ncf}</p>
        <p className="text-muted-foreground text-sm">
          {`Factura origen ${resultado.factura.ncf ?? `No ${resultado.factura.numero}`}`}
        </p>
        {resultado.contacto ? <p className="text-muted-foreground text-sm">{resultado.contacto.nombre}</p> : null}
      </div>

      <div className="border-border w-full max-w-sm rounded-lg border px-4 py-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatoMoneda(resultado.totales.total)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Efectivo</span>
          <span className="tabular-nums">{formatoMoneda(resultado.reembolso.efectivo)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Crédito</span>
          <span className="tabular-nums">{formatoMoneda(resultado.reembolso.credito)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button className="h-12" onClick={onNueva}>
          Nueva devolución
        </Button>
        <Button variant="outline" className="h-12 gap-1.5" onClick={() => setImprimir(true)}>
          <Printer aria-hidden="true" />
          Imprimir ticket
        </Button>
        <Button
          variant="ghost"
          className="h-12"
          nativeButton={false}
          render={<a href={`/dashboard/notas-credito/${resultado.nota.id}`} target="_blank" rel="noreferrer" />}
        >
          Ver en Contabilidad
        </Button>
        <Button variant="link" className="h-12 px-2" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>

      {imprimir ? (
        <ImpresionPos
          titulo={`devolucion-${resultado.nota.ncf}`}
          ancho={plantilla.ancho_mm}
          onCerrar={() => setImprimir(false)}
        >
          <TicketPos payload={armarTicketDevolucion(resultado, plantilla)} />
        </ImpresionPos>
      ) : null}
    </div>
  );
}
