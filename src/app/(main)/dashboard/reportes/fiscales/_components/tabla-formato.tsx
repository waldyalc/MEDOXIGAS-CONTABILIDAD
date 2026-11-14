import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import type { ColumnaDgii } from "@/lib/reportes/fiscales/formatos/tipos";
import type { FilaDgii } from "@/lib/reportes/fiscales/tipos";

interface Props {
  columnas: readonly ColumnaDgii[];
  filas: readonly FilaDgii[];
  vacio?: string;
}

function valorCelda(fila: FilaDgii, columna: ColumnaDgii, valor: string | number | undefined) {
  if (columna.tipo === "dinero") {
    return formatearRd(typeof valor === "number" ? valor : Number(valor ?? 0));
  }

  const texto = String(valor ?? "");

  if (columna.clave === "ncf" && typeof fila.__ruta === "string" && fila.__ruta !== "") {
    return (
      <Link href={fila.__ruta} prefetch={false} className="font-medium hover:underline">
        {texto}
      </Link>
    );
  }

  if (columna.clave === "rnc" && typeof fila.__contactoId === "string" && fila.__contactoId !== "") {
    return (
      <Link href={rutaContacto(fila.__contactoId)} prefetch={false} className="hover:underline">
        {texto}
      </Link>
    );
  }

  return texto;
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
                    {valorCelda(fila, columna, valor)}
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
