import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { DetalleImpuesto } from "@/lib/reportes/fiscales/tipos";

interface Props {
  filas: readonly DetalleImpuesto[];
  vacio: string;
}

function etiquetaTasa(tasa: number | null): string {
  return tasa == null ? "Exento (0%)" : `ITBIS (${tasa}%)`;
}

export function TablaDetalleImpuestos({ filas, vacio }: Props) {
  if (filas.length === 0) {
    return <p className="text-muted-foreground p-6 text-center text-sm">{vacio}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>NCF/Número</TableHead>
            <TableHead>Tipo de documento</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Creación</TableHead>
            <TableHead>Impuesto</TableHead>
            <TableHead className="text-right">Base imponible</TableHead>
            <TableHead className="text-right">Valor impuesto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={`${fila.documentoId}-${fila.tasa}`}>
              <TableCell>
                {fila.ruta == null ? (
                  <span className="font-medium">{fila.ncf || `#${fila.numero}`}</span>
                ) : (
                  <Link href={fila.ruta} prefetch={false} className="text-primary font-medium hover:underline">
                    {fila.ncf || `#${fila.numero}`}
                  </Link>
                )}
              </TableCell>
              <TableCell>{fila.tipoDocumento}</TableCell>
              <TableCell>{fila.contactoNombre || "—"}</TableCell>
              <TableCell>{formatoDia(fila.fecha)}</TableCell>
              <TableCell>{etiquetaTasa(fila.tasa)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.base)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(fila.impuesto)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
