import { cn } from "cn";

import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
import { formatoPct } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { FilaReporte } from "@/lib/reportes/estados/tipos";

interface Props {
  filas: readonly FilaReporte[];
  rotuloCuenta: string;
  rotuloActual: string;
  rotuloAnterior: string;
  rotuloPorcentaje: string;
}

function Montos({ fila }: { fila: FilaReporte }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.actual)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatoPct(fila.porcentajeActual)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.anterior)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatoPct(fila.porcentajeAnterior)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.variacionAbsoluta)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatoPct(fila.variacionRelativa)}</TableCell>
    </>
  );
}

export function TablaComparativa({ filas, rotuloCuenta, rotuloActual, rotuloAnterior, rotuloPorcentaje }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{rotuloCuenta}</TableHead>
          <TableHead className="text-right">{rotuloActual}</TableHead>
          <TableHead className="text-right">{rotuloPorcentaje}</TableHead>
          <TableHead className="text-right">{rotuloAnterior}</TableHead>
          <TableHead className="text-right">{rotuloPorcentaje}</TableHead>
          <TableHead className="text-right">Var. Absoluta</TableHead>
          <TableHead className="text-right">Var. Relativa (%)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => {
          if (fila.clase === "titulo") {
            return (
              <TableRow key={fila.clave} className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={7} className="font-semibold">
                  {fila.nombre}
                </TableCell>
              </TableRow>
            );
          }

          return (
            <FilaNavegable
              key={fila.clave}
              href={fila.cuentaId ? rutaCuenta(fila.cuentaId) : null}
              className={cn(
                fila.clase === "grupo" && "bg-muted/30 hover:bg-muted/30 font-medium",
                fila.clase === "total" && "font-semibold",
              )}
            >
              <TableCell className={cn(fila.clase === "detalle" && "pl-6")}>
                {fila.cuentaId ? (
                  <Enlace href={rutaCuenta(fila.cuentaId)}>
                    {fila.codigo === "" ? null : <span className="text-muted-foreground">{fila.codigo}</span>}{" "}
                    {fila.nombre}
                  </Enlace>
                ) : (
                  <>
                    {fila.codigo === "" ? null : <span className="text-muted-foreground">{fila.codigo}</span>}{" "}
                    {fila.nombre}
                  </>
                )}
              </TableCell>
              <Montos fila={fila} />
            </FilaNavegable>
          );
        })}
      </TableBody>
    </Table>
  );
}
