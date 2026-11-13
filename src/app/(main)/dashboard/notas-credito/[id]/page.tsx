import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen, ReceiptText } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaFactura } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { getNotaCreditoVista } from "@/lib/notas-credito/consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const nota = await getNotaCreditoVista(id);
  if (!nota) notFound();

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/notas-credito" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Notas de crédito
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Nota de crédito #{nota.numero}</h1>
            <Badge variant={nota.estado === "anulada" ? "destructive" : "secondary"}>
              {nota.estado === "anulada" ? "Anulada" : "Activa"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nota.asiento_id ? (
              <Button variant="outline" render={<Link href={rutaAsiento(nota.asiento_id)} prefetch={false} />}>
                <BookOpen data-icon="inline-start" />
                Ver asiento
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href={rutaFactura(nota.factura_id)} prefetch={false} />}>
              <ReceiptText data-icon="inline-start" />
              Ver factura
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">NCF</dt>
            <dd className="font-mono font-medium">{nota.ncf}</dd>
            <dt className="text-muted-foreground">Comprobante</dt>
            <dd>Nota de crédito (B04)</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(nota.fecha)}</dd>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>
              <Enlace href={rutaContacto(nota.contacto_id)}>{nota.cliente_nombre}</Enlace>
            </dd>
            <dt className="text-muted-foreground">Factura</dt>
            <dd>
              <Enlace href={rutaFactura(nota.factura_id)}>
                #{nota.factura_numero}
                {nota.factura_ncf ? ` · ${nota.factura_ncf}` : ""}
              </Enlace>
            </dd>
            <dt className="text-muted-foreground">Devuelve inventario</dt>
            <dd>{nota.devuelve_inventario ? "Sí" : "No"}</dd>
            <dt className="text-muted-foreground">Notas</dt>
            <dd className="whitespace-pre-line">{nota.notas ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Desc. %</TableHead>
                <TableHead className="text-right">ITBIS %</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nota.lineas.map((linea) => (
                <TableRow key={linea.id}>
                  <TableCell className="font-medium">{linea.descripcion}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(linea.descuento_pct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(linea.itbis_tasa)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(linea.subtotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(linea.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="bg-muted/50 flex w-full flex-col gap-2 rounded-xl p-4 text-sm md:w-80">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatoMoneda(nota.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ITBIS</span>
            <span>{formatoMoneda(nota.itbis)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatoMoneda(nota.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
