"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { DetalleImpuesto } from "@/lib/reportes/fiscales/tipos";

interface Props {
  titulo: string;
  filas: readonly DetalleImpuesto[];
}

export function DetalleRetencion({ titulo, filas }: Props) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Ver detalles</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Documentos que forman esta base y este impuesto.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Impuesto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow key={`${fila.documentoId}-${fila.tasa}`}>
                  <TableCell>
                    {fila.ruta == null ? (
                      fila.ncf || `#${fila.numero}`
                    ) : (
                      <Link href={fila.ruta} prefetch={false} className="text-primary font-medium hover:underline">
                        {fila.ncf || `#${fila.numero}`}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    {fila.contactoId ? (
                      <Link href={rutaContacto(fila.contactoId)} prefetch={false} className="hover:underline">
                        {fila.contactoNombre || "—"}
                      </Link>
                    ) : (
                      fila.contactoNombre || "—"
                    )}
                  </TableCell>
                  <TableCell>{formatoDia(fila.fecha)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.base)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.impuesto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
