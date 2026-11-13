import Link from "next/link";

import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { GastoLista } from "@/lib/gastos/tipos";

export function GastosTabla({ gastos, puedeEscribir }: { gastos: GastoLista[]; puedeEscribir: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Gastos menores</h1>
          <p className="text-muted-foreground text-sm">Gastos de caja menor con su asiento contable.</p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/gastos/nuevo" />}>
            <Plus />
            Nuevo gasto
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">ITBIS</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gastos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
                  No hay gastos registrados todavía.
                </TableCell>
              </TableRow>
            ) : (
              gastos.map((gasto) => (
                <TableRow key={gasto.id}>
                  <TableCell className="font-medium">{gasto.numero}</TableCell>
                  <TableCell>{formatoDia(gasto.fecha)}</TableCell>
                  <TableCell>{gasto.descripcion}</TableCell>
                  <TableCell>{gasto.proveedor_nombre}</TableCell>
                  <TableCell>{gasto.cuenta_nombre}</TableCell>
                  <TableCell className="text-right">{formatoMoneda(gasto.subtotal)}</TableCell>
                  <TableCell className="text-right">{formatoMoneda(gasto.itbis)}</TableCell>
                  <TableCell className="text-right font-medium">{formatoMoneda(gasto.total)}</TableCell>
                  <TableCell>
                    {gasto.estado === "anulado" ? (
                      <Badge variant="destructive">Anulado</Badge>
                    ) : (
                      <Badge variant="secondary">Activo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
