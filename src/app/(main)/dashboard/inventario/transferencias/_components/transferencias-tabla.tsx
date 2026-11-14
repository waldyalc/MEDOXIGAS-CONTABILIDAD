import Link from "next/link";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaTransferenciaInventario } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import type { TransferenciaLista } from "@/lib/inventario/tipos";

export function TransferenciasTabla({
  transferencias,
  puedeEscribir,
}: {
  transferencias: TransferenciaLista[];
  puedeEscribir: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Transferencias entre almacenes</h1>
          <p className="text-muted-foreground text-sm">
            Mueven la existencia de un almacén a otro sin asiento contable.
          </p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/inventario/transferencias/nueva" />}>
            <Plus />
            Nueva transferencia
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transferencias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                  No hay transferencias entre almacenes todavía.
                </TableCell>
              </TableRow>
            ) : (
              transferencias.map((transferencia) => (
                <TableRow key={transferencia.id}>
                  <TableCell className="font-medium">
                    <Enlace href={rutaTransferenciaInventario(transferencia.id)}>{transferencia.numero}</Enlace>
                  </TableCell>
                  <TableCell>{formatoDia(transferencia.fecha)}</TableCell>
                  <TableCell>{transferencia.origen_nombre}</TableCell>
                  <TableCell>{transferencia.destino_nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{transferencia.lineas}</TableCell>
                  <TableCell>
                    <Badge variant={transferencia.estado === "anulada" ? "destructive" : "secondary"}>
                      {transferencia.estado === "anulada" ? "Anulada" : "Activa"}
                    </Badge>
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
