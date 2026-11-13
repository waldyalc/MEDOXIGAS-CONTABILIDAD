import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto, rutaOrdenCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { listarOrdenesCompra } from "@/lib/ordenes-compra/consultas";

import { EstadoOrdenBadge } from "./_components/estado-orden-badge";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const ordenes = await listarOrdenesCompra();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Órdenes de compra</h1>
          <p className="text-muted-foreground text-sm">
            Documentos de control para el proveedor. No mueven inventario ni generan asiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/ordenes-compra/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva orden
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Factura de proveedor</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    No hay órdenes de compra registradas.
                  </TableCell>
                </TableRow>
              ) : (
                ordenes.map((orden) => (
                  <TableRow key={orden.id}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Enlace href={rutaOrdenCompra(orden.id)}>#{orden.numero}</Enlace>
                    </TableCell>
                    <TableCell>
                      <Enlace href={rutaContacto(orden.contacto_id)}>{orden.contacto_nombre}</Enlace>
                    </TableCell>
                    <TableCell>{formatoDia(orden.fecha)}</TableCell>
                    <TableCell>{formatoDia(orden.fecha_entrega)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(orden.total)}</TableCell>
                    <TableCell>
                      {orden.factura_proveedor_id ? (
                        <Enlace href={rutaCompra(orden.factura_proveedor_id)}>Ver factura</Enlace>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <EstadoOrdenBadge estado={orden.estado} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
