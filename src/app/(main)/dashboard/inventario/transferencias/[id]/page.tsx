import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaProducto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { obtenerTransferencia } from "@/lib/inventario/consultas";
import { formatoCantidad } from "@/lib/productos/productos";

import { AccionesTransferencia } from "./_components/acciones-transferencia";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const transferencia = await obtenerTransferencia(id);
  if (!transferencia) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/inventario/transferencias" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Transferencias
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Transferencia #{transferencia.numero}</h1>
            <Badge variant={transferencia.estado === "anulada" ? "destructive" : "secondary"}>
              {transferencia.estado === "anulada" ? "Anulada" : "Activa"}
            </Badge>
          </div>
          {rol !== "lector" && transferencia.estado === "activa" ? (
            <AccionesTransferencia transferenciaId={transferencia.id} numero={transferencia.numero} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(transferencia.fecha)}</dd>
            <dt className="text-muted-foreground">Origen</dt>
            <dd>{transferencia.origen_nombre}</dd>
            <dt className="text-muted-foreground">Destino</dt>
            <dd>{transferencia.destino_nombre}</dd>
            <dt className="text-muted-foreground">Observaciones</dt>
            <dd className="whitespace-pre-line">{transferencia.observaciones?.trim() || "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos transferidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferencia.lineas.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell>
                      <Enlace href={rutaProducto(linea.producto_id)}>{linea.producto_nombre}</Enlace>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
