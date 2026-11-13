import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearRd } from "@/lib/reportes/dinero";
import type { ColumnaDgii } from "@/lib/reportes/fiscales/formatos/tipos";
import type { FilaDgii } from "@/lib/reportes/fiscales/tipos";

interface Props {
  columnas: readonly ColumnaDgii[];
  filas: readonly FilaDgii[];
  vacio?: string;
}

export function TablaFormato({ columnas, filas, vacio = "No hay registros en el período." }: Props) {
  if (filas.length === 0) {
    return (
      <Alert>
        <AlertTitle>Sin registros</AlertTitle>
        <AlertDescription>{vacio}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columnas.map((columna) => (
              <TableHead key={columna.clave} className={columna.tipo === "dinero" ? "text-right" : undefined}>
                {columna.nombre}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={`${fila.ncf ?? ""}-${fila.fechaComprobante ?? ""}-${fila.fechaComprobanteDia ?? ""}`}>
              {columnas.map((columna) => {
                const valor = fila[columna.clave];
                return (
                  <TableCell
                    key={columna.clave}
                    className={columna.tipo === "dinero" ? "text-right tabular-nums" : "whitespace-nowrap"}
                  >
                    {columna.tipo === "dinero"
                      ? formatearRd(typeof valor === "number" ? valor : Number(valor ?? 0))
                      : String(valor ?? "")}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
