import Link from "next/link";

import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaProducto } from "@/lib/enlaces";
import type { FilaInventario } from "@/lib/reportes/administrativos/d/tipos";
import { formatearRd } from "@/lib/reportes/dinero";

const CANTIDAD = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function Estado({ activo }: { activo: boolean }) {
  return <Badge variant={activo ? "secondary" : "outline"}>{activo ? "Activo" : "Inactivo"}</Badge>;
}

export function TablaInventario({ filas }: { filas: FilaInventario[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto/servicio</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Costo promedio</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-muted-foreground h-32 text-center whitespace-normal">
              No hay productos inventariables con esos filtros.
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <FilaNavegable key={fila.id} href={rutaProducto(fila.id)}>
              <TableCell>
                <Link
                  href={rutaProducto(fila.id)}
                  prefetch={false}
                  className="text-primary font-medium hover:underline"
                >
                  {fila.nombre}
                </Link>
              </TableCell>
              <TableCell>{fila.referencia ?? ""}</TableCell>
              <TableCell>{fila.descripcion ?? ""}</TableCell>
              <TableCell className="text-right tabular-nums">{CANTIDAD.format(fila.cantidad)}</TableCell>
              <TableCell>{fila.unidad}</TableCell>
              <TableCell>
                <Estado activo={fila.activo} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.costo)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.total)}</TableCell>
            </FilaNavegable>
          ))
        )}
      </TableBody>
    </Table>
  );
}
