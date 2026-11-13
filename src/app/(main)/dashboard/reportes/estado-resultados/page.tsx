import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { obtenerEstadoResultados } from "@/lib/reportes/consultas";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import type { FilaResultadoCalculada } from "@/lib/reportes/resultados";
import { calcularEstadoResultados } from "@/lib/reportes/resultados";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroFechas } from "../_components/filtro-fechas";

function FilasMonto({ filas }: { filas: readonly FilaResultadoCalculada[] }) {
  return filas.map((fila) => (
    <TableRow key={fila.codigo}>
      <TableCell>
        <span className="text-muted-foreground">{fila.codigo}</span> {fila.nombre}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.monto)}</TableCell>
    </TableRow>
  ));
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const { desde, hasta } = parsearRango(await searchParams);
  const { filas, error } = await obtenerEstadoResultados(desde, hasta);
  const estado = calcularEstadoResultados(filas);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Estado de resultados"
        descripcion="Ingresos, costos y gastos del período, calculados desde los asientos contables."
        desde={desde}
        hasta={hasta}
      />

      <FiltroFechas desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={2} className="font-semibold">
                  Ingresos
                </TableCell>
              </TableRow>
              <FilasMonto filas={estado.ingresos} />
              <TableRow className="font-medium">
                <TableCell className="text-right">Total ingresos</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(estado.totalIngresos)}</TableCell>
              </TableRow>

              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={2} className="font-semibold">
                  Costos
                </TableCell>
              </TableRow>
              <FilasMonto filas={estado.costos} />
              <TableRow className="font-medium">
                <TableCell className="text-right">Total costos</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(estado.totalCostos)}</TableCell>
              </TableRow>

              <TableRow className="bg-muted/30 hover:bg-muted/30 font-semibold">
                <TableCell>Utilidad bruta</TableCell>
                <TableCell className={`text-right tabular-nums ${estado.utilidadBruta < 0 ? "text-destructive" : ""}`}>
                  {formatearRd(estado.utilidadBruta)}
                </TableCell>
              </TableRow>

              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={2} className="font-semibold">
                  Gastos
                </TableCell>
              </TableRow>
              <FilasMonto filas={estado.gastos} />
              <TableRow className="font-medium">
                <TableCell className="text-right">Total gastos</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(estado.totalGastos)}</TableCell>
              </TableRow>

              <TableRow className="bg-muted/30 hover:bg-muted/30 font-semibold">
                <TableCell>Utilidad neta</TableCell>
                <TableCell className={`text-right tabular-nums ${estado.utilidadNeta < 0 ? "text-destructive" : ""}`}>
                  {formatearRd(estado.utilidadNeta)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
