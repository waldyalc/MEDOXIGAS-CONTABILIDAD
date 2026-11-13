import Link from "next/link";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { AjusteLista } from "@/lib/inventario/tipos";

export function AjustesTabla({ ajustes, puedeEscribir }: { ajustes: AjusteLista[]; puedeEscribir: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Ajustes de inventario</h1>
          <p className="text-muted-foreground text-sm">
            Entradas y salidas de productos con su asiento contable automático.
          </p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/inventario/ajustes/nuevo" />}>
            <Plus />
            Nuevo ajuste
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="text-right">Total ajustado</TableHead>
              <TableHead>Observaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ajustes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  No hay ajustes de inventario todavía.
                </TableCell>
              </TableRow>
            ) : (
              ajustes.map((ajuste) => (
                <TableRow key={ajuste.id}>
                  <TableCell className="font-medium">
                    <Enlace href={`/dashboard/inventario/ajustes/${ajuste.id}`}>{ajuste.numero}</Enlace>
                  </TableCell>
                  <TableCell>{formatoDia(ajuste.fecha)}</TableCell>
                  <TableCell>{ajuste.almacen_nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(ajuste.total)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[360px] truncate">
                    {ajuste.observaciones?.trim() || "—"}
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
