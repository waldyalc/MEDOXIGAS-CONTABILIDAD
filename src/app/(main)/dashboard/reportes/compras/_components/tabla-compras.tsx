import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCompra, rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import type { FilaCompra } from "@/lib/reportes/administrativos/d/tipos";
import { formatearRd } from "@/lib/reportes/dinero";

function Factura({ fila }: { fila: FilaCompra }) {
  return (
    <Link href={rutaCompra(fila.id)} prefetch={false} className="text-primary font-medium hover:underline">
      {fila.ncf ?? `#${fila.numero}`}
    </Link>
  );
}

function Proveedor({ fila }: { fila: FilaCompra }) {
  return (
    <Link href={rutaContacto(fila.contactoId)} prefetch={false} className="hover:underline">
      {fila.contactoNombre}
    </Link>
  );
}

export function TablaCompras({ filas }: { filas: FilaCompra[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número de factura</TableHead>
          <TableHead>Proveedor</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Antes de impuestos</TableHead>
          <TableHead className="text-right">Después de impuestos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground h-32 text-center whitespace-normal">
              No hay compras en el período seleccionado.
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <TableRow key={fila.id}>
              <TableCell>
                <Factura fila={fila} />
              </TableCell>
              <TableCell>
                <Proveedor fila={fila} />
              </TableCell>
              <TableCell>{formatoDia(fila.fecha)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.subtotal)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.total)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
