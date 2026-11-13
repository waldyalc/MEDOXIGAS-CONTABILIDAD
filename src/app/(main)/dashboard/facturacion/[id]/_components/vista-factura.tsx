"use client";

import { useEffect, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Ban, BookOpen, CreditCard, Loader2, Printer } from "lucide-react";
import { createPortal } from "react-dom";

import { Enlace } from "@/components/enlace";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaAsiento, rutaPagoRecibido } from "@/lib/enlaces";
import { anularFactura } from "@/lib/facturacion/acciones";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { FacturaVista, PagoFacturaVista } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

import { FacturaPapel } from "./factura-papel";

const METODOS: Record<PagoFacturaVista["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export function VistaFactura({ datos, puedeEscribir }: { datos: FacturaVista; puedeEscribir: boolean }) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  const { factura, lineas, contacto, empresa, ncfVence, asiento, pagos } = datos;
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
          {asiento.asiento ? (
            <Button variant="outline" render={<Link href={rutaAsiento(asiento.asiento.id)} />}>
              <BookOpen />
              Ver asiento
            </Button>
          ) : null}
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

      <div className="ring-foreground/10 mx-auto w-full max-w-[8.5in] overflow-hidden rounded-xl bg-white shadow-sm ring-1">
        <FacturaPapel
          empresa={empresa}
          factura={factura}
          lineas={lineas}
          contacto={contacto}
          ncfVence={ncfVence}
          enlaces
        />
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10 print:hidden">
        <div className="border-b p-4">
          <h2 className="font-heading text-lg font-medium">Pagos asociados</h2>
        </div>
        {pagos.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Sin pagos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Fecha</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.map((pago) => (
                <TableRow key={pago.id}>
                  <TableCell className="pl-(--card-spacing)">{formatoDia(pago.fecha)}</TableCell>
                  <TableCell className="font-medium">
                    <Enlace href={rutaPagoRecibido(pago.id)}>#{pago.numero}</Enlace>
                  </TableCell>
                  <TableCell>{METODOS[pago.metodo]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(pago.monto)}</TableCell>
                  <TableCell className="pr-(--card-spacing)">
                    {pago.estado === "anulado" ? (
                      <Badge variant="destructive">Anulado</Badge>
                    ) : (
                      <Badge variant="secondary">Activo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {montado
        ? createPortal(
            <div data-print-root>
              <div data-print-paper>
                <FacturaPapel
                  empresa={empresa}
                  factura={factura}
                  lineas={lineas}
                  contacto={contacto}
                  ncfVence={ncfVence}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
