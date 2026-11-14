import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { formatoMoneda } from "@/lib/compras/formato";
import { getNotasCreditoCompraLista } from "@/lib/compras/notas-credito/consultas";
import { rutaCompra, rutaContacto, rutaNotaCreditoCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";

function EstadoBadge({ estado }: { estado: "activa" | "anulada" }) {
  if (estado === "anulada") return <Badge variant="destructive">Anulada</Badge>;
  return <Badge variant="secondary">Activa</Badge>;
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const notas = await getNotasCreditoCompraLista();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Notas de crédito en compras</h1>
          <p className="text-muted-foreground text-sm">
            Devoluciones a proveedores ligadas a una factura de proveedor (NCF del proveedor, B04).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/compras/notas-credito/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva nota de crédito
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
                <TableHead>NCF</TableHead>
                <TableHead>Factura de proveedor</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    No hay notas de crédito en compras registradas.
                  </TableCell>
                </TableRow>
              ) : (
                notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Enlace href={rutaNotaCreditoCompra(nota.id)}>#{nota.numero}</Enlace>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {nota.ncf ? <Enlace href={rutaNotaCreditoCompra(nota.id)}>{nota.ncf}</Enlace> : "—"}
                    </TableCell>
                    <TableCell>
                      <Enlace href={rutaCompra(nota.factura_proveedor_id)}>
                        #{nota.factura_numero}
                        {nota.factura_ncf ? ` — ${nota.factura_ncf}` : ""}
                      </Enlace>
                    </TableCell>
                    <TableCell>
                      <Enlace href={rutaContacto(nota.contacto_id)}>{nota.proveedor_nombre}</Enlace>
                    </TableCell>
                    <TableCell>{formatoDia(nota.fecha)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(nota.total)}</TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <EstadoBadge estado={nota.estado} />
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
