import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaCuenta, rutaFactura } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { puedeAnularDocumento } from "@/lib/pagos/anulacion";
import { obtenerPagoRecibido } from "@/lib/pagos/detalle";
import type { MetodoPago } from "@/lib/pagos/tipos";

import { AccionesPago } from "./_components/acciones-pago";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const pago = await obtenerPagoRecibido(id);
  if (!pago) notFound();

  const puedeAnular = puedeAnularDocumento(rol, pago.estado);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/pagos-recibidos" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Pagos recibidos
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Pago recibido #{pago.numero}</h1>
            <Badge variant={pago.estado === "anulado" ? "destructive" : "default"}>
              {pago.estado === "anulado" ? "Anulado" : "Activo"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pago.asiento_id ? (
              <Button variant="outline" render={<Link href={rutaAsiento(pago.asiento_id)} prefetch={false} />}>
                <BookOpen data-icon="inline-start" />
                Ver asiento
              </Button>
            ) : null}
            {puedeAnular ? <AccionesPago pagoId={pago.id} numero={pago.numero} /> : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(pago.fecha)}</dd>
            <dt className="text-muted-foreground">Monto</dt>
            <dd className="font-medium tabular-nums">{formatoMoneda(pago.monto)}</dd>
            <dt className="text-muted-foreground">Retención</dt>
            <dd className="tabular-nums">{formatoMoneda(pago.retenido)}</dd>
            <dt className="text-muted-foreground">Método</dt>
            <dd>{ETIQUETAS_METODO[pago.metodo]}</dd>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>
              <Enlace href={rutaContacto(pago.contacto_id)}>{pago.contacto?.nombre ?? "—"}</Enlace>
            </dd>
            <dt className="text-muted-foreground">Cuenta</dt>
            <dd>
              <Enlace href={rutaCuenta(pago.cuenta_id)}>
                {pago.cuenta ? `${pago.cuenta.codigo} · ${pago.cuenta.nombre}` : "—"}
              </Enlace>
            </dd>
            <dt className="text-muted-foreground">Notas</dt>
            <dd className="whitespace-pre-line">{pago.notas ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturas aplicadas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>NCF</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Retención</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pago.aplicaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    Este pago no tiene facturas aplicadas.
                  </TableCell>
                </TableRow>
              ) : (
                pago.aplicaciones.map((aplicacion) => (
                  <FilaNavegable key={aplicacion.factura_id} href={rutaFactura(aplicacion.factura_id)}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Enlace href={rutaFactura(aplicacion.factura_id)}>#{aplicacion.numero}</Enlace>
                    </TableCell>
                    <TableCell>{aplicacion.ncf ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(aplicacion.monto)}</TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {formatoMoneda(aplicacion.retenido)}
                    </TableCell>
                  </FilaNavegable>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
