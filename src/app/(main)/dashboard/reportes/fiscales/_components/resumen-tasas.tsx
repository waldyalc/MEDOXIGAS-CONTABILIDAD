import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearRd } from "@/lib/reportes/dinero";
import type { ResumenTasas } from "@/lib/reportes/fiscales/impuestos";

interface Props {
  titulo: string;
  resumen: ResumenTasas;
}

export function TablaResumenTasas({ titulo, resumen }: Props) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Impuesto</TableHead>
              <TableHead className="text-right">Total base imponible</TableHead>
              <TableHead className="text-right">Total impuesto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumen.filas.map((fila) => (
              <TableRow key={fila.clave}>
                <TableCell>{fila.etiqueta}</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(fila.base)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(fila.impuesto)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(resumen.totalBase)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(resumen.totalImpuesto)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
