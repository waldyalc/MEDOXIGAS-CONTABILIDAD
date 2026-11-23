"use client";

import { useState } from "react";

import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TicketPOSPayload } from "@/lib/pos/impresion";

export function ConfirmacionOffline({ ticket, onCerrar }: { ticket: TicketPOSPayload; onCerrar: () => void }) {
  const [imprimiendo, setImprimiendo] = useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Venta guardada en este dispositivo</DialogTitle>
        <DialogDescription>Pendiente de subir. Conserva este dispositivo y no borres sus datos.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setImprimiendo(true)}>
          Imprimir ticket
        </Button>
        <Button variant="outline" onClick={onCerrar}>
          Nueva venta
        </Button>
      </div>
      <div className="overflow-x-auto border p-3">
        <TicketPos payload={ticket} />
      </div>
      {imprimiendo ? (
        <ImpresionPos titulo="venta-offline" ancho={ticket.diseno.ancho_mm} onCerrar={() => setImprimiendo(false)}>
          <TicketPos payload={ticket} />
        </ImpresionPos>
      ) : null}
    </>
  );
}
