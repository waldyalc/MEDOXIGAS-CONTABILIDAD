import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, ReceiptText, ShoppingBag } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { obtenerOrdenCompra } from "@/lib/ordenes-compra/consultas";

import { EstadoOrdenBadge } from "../_components/estado-orden-badge";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const orden = await obtenerOrdenCompra(id);
  if (!orden) notFound();

  const puedeEscribir = perfil.rol === "admin" || perfil.rol === "contador";

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/ordenes-compra" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Órdenes de compra
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Orden de compra #{orden.numero}</h1>
            <EstadoOrdenBadge estado={orden.estado} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {orden.factura_proveedor_id ? (
              <Button
                variant="outline"
                render={<Link href={rutaCompra(orden.factura_proveedor_id)} prefetch={false} />}
              >
                <ReceiptText data-icon="inline-start" />
                Ver factura de proveedor
              </Button>
            ) : null}
            {puedeEscribir && orden.estado === "abierta" ? (
              <Button render={<Link href={`/dashboard/compras/nueva?orden=${orden.id}`} prefetch={false} />}>
                <ShoppingBag data-icon="inline-start" />
                Convertir en factura de proveedor
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd className="font-medium">
              <Enlace href={rutaContacto(orden.contacto_id)}>{orden.contacto_nombre}</Enlace>
            </dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(orden.fecha)}</dd>
            <dt className="text-muted-foreground">Entrega</dt>
            <dd>{formatoDia(orden.fecha_entrega)}</dd>
            <dt className="text-muted-foreground">Notas</dt>
            <dd className="whitespace-pre-line">{orden.notas ?? "—"}</dd>
            <dt className="text-muted-foreground">Términos</dt>
            <dd className="whitespace-pre-line">{orden.terminos ?? "—"}</dd>
          </dl>
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <p className="text-sm">
              Esta orden es un documento de control: no mueve inventario ni genera asiento contable.
            </p>
            <div className="mt-auto flex items-center justify-between border-t pt-2 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatoMoneda(aNumero(orden.total))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">ITBIS %</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orden.lineas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    La orden no tiene líneas.
                  </TableCell>
                </TableRow>
              ) : (
                orden.lineas.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell className="pl-(--card-spacing) whitespace-normal">
                      <div className="flex flex-col">
                        <span>{linea.descripcion || "—"}</span>
                        {linea.productos ? (
                          <span className="text-muted-foreground text-xs">{linea.productos.nombre}</span>
                        ) : null}
                        {linea.cuentas ? (
                          <span className="text-muted-foreground text-xs">
                            {linea.cuentas.codigo} — {linea.cuentas.nombre}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.costo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.itbis_tasa)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.subtotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {formatoMoneda(linea.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="pl-(--card-spacing) text-right">
                  Totales
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(aNumero(orden.subtotal))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(aNumero(orden.itbis))}</TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {formatoMoneda(aNumero(orden.total))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
