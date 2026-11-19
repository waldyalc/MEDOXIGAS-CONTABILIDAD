import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaProducto } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { obtenerAjuste } from "@/lib/inventario/consultas";
import { formatoCantidad } from "@/lib/productos/productos";

import { AccionesAjuste } from "./_components/acciones-ajuste";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const ajuste = await obtenerAjuste(id);
  if (!ajuste) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/inventario/ajustes" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Ajustes de inventario
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Ajuste de inventario #{ajuste.numero}</h1>
            <Badge variant={ajuste.estado === "anulada" ? "destructive" : "secondary"}>
              {ajuste.estado === "anulada" ? "Anulado" : "Activo"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {ajuste.asiento_id ? (
              <Button variant="outline" render={<Link href={rutaAsiento(ajuste.asiento_id)} prefetch={false} />}>
                <BookOpen data-icon="inline-start" />
                Ver asiento
              </Button>
            ) : null}
            {rol !== "lector" && ajuste.estado === "activo" ? (
              <AccionesAjuste ajusteId={ajuste.id} numero={ajuste.numero} />
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
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(ajuste.fecha)}</dd>
            <dt className="text-muted-foreground">Almacén</dt>
            <dd>{ajuste.almacen_nombre}</dd>
            <dt className="text-muted-foreground">Observaciones</dt>
            <dd className="whitespace-pre-line">{ajuste.observaciones?.trim() || "—"}</dd>
          </dl>
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Líneas</span>
              <span className="tabular-nums">{ajuste.lineas.length}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Total ajustado</span>
              <span className="tabular-nums">{formatoMoneda(ajuste.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos ajustados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo unitario</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ajuste.lineas.map((linea) => (
                  <FilaNavegable key={linea.id} href={rutaProducto(linea.producto_id)}>
                    <TableCell>
                      <Enlace href={rutaProducto(linea.producto_id)}>{linea.producto_nombre}</Enlace>
                    </TableCell>
                    <TableCell>
                      <Badge variant={linea.tipo === "entrada" ? "default" : "secondary"}>
                        {linea.tipo === "entrada" ? "Entrada" : "Salida"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.costo_unitario)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(linea.total)}</TableCell>
                  </FilaNavegable>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
