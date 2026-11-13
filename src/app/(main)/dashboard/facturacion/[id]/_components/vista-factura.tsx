"use client";

import { useEffect, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Ban, CreditCard, Loader2, Printer } from "lucide-react";
import { createPortal } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { anularFactura } from "@/lib/facturacion/acciones";
import { saldoDeFactura } from "@/lib/facturacion/formato";
import type { FacturaVista } from "@/lib/facturacion/tipos";

import { FacturaPapel } from "./factura-papel";

export function VistaFactura({ datos, puedeEscribir }: { datos: FacturaVista; puedeEscribir: boolean }) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  const { factura, lineas, contacto, empresa } = datos;
  const saldo = saldoDeFactura(factura.total, factura.pagado);
  const puedePagar = puedeEscribir && saldo > 0 && factura.estado !== "anulada";
  const puedeAnular = puedeEscribir && factura.estado !== "anulada";

  function anular() {
    setError(null);
    iniciar(async () => {
      const resultado = await anularFactura(factura.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/facturacion" />}>
            <ArrowLeft />
            <span className="sr-only">Volver</span>
          </Button>
          <h1 className="text-2xl tracking-tight">Factura #{factura.numero}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Imprimir
          </Button>
          {puedePagar ? (
            <Button
              render={
                <Link href={`/dashboard/pagos-recibidos/nuevo?factura=${factura.id}&cliente=${factura.contacto_id}`} />
              }
            >
              <CreditCard />
              Registrar pago
            </Button>
          ) : null}
          {puedeAnular ? (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                <Ban />
                Anular
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Anular la factura #{factura.numero}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se creará un asiento de anulación y el NCF quedará sin efecto. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={pendiente} onClick={anular}>
                    {pendiente ? <Loader2 className="animate-spin" /> : null}
                    Anular factura
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="print:hidden">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mx-auto w-full max-w-[8.5in] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <FacturaPapel empresa={empresa} factura={factura} lineas={lineas} contacto={contacto} />
      </div>

      {montado
        ? createPortal(
            <div data-print-root>
              <div data-print-paper>
                <FacturaPapel empresa={empresa} factura={factura} lineas={lineas} contacto={contacto} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
