import { ListTree } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { obtenerDatosIngresosCompras } from "@/lib/reportes/administrativos/e/consultas";
import { calcularReporteIngresosCompras } from "@/lib/reportes/administrativos/e/ingresos-compras";
import { tablaIngresosCompras } from "@/lib/reportes/administrativos/e/tablas";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { ArbolCuentas } from "./_components/arbol-cuentas";
import { FiltrosIngresosCompras } from "./_components/filtros-ingresos-compras";

function textoParametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? "");
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const parametros = await searchParams;
  const { desde, hasta } = parsearRango(parametros);
  const buscar = textoParametro(parametros.q).trim();
  const incluirCeros = textoParametro(parametros.ceros) !== "0";

  const { cuentas, filas, error } = await obtenerDatosIngresosCompras(desde, hasta);
  const reporte = calcularReporteIngresosCompras(cuentas, filas, { buscar, incluirCeros });
  const tabla = tablaIngresosCompras(reporte, desde, hasta);

  const sinDatos = reporte.ingresos.length === 0 && reporte.costos.length === 0 && reporte.gastos.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Ingresos y compras"
        descripcion="Ingresos, costos y gastos del período con el detalle de sus cuentas contables."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltrosIngresosCompras desde={desde} hasta={hasta} buscar={buscar} incluirCeros={incluirCeros} />
        <BotonDescargar tabla={tabla} nombreArchivo={`ingresos-y-compras-${desde}-${hasta}`} />
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      {sinDatos ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTree />
            </EmptyMedia>
            <EmptyTitle>Sin datos</EmptyTitle>
            <EmptyDescription>No hay cuentas para el período y filtros seleccionados.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta contable</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <ArbolCuentas
                ingresos={reporte.ingresos}
                costos={reporte.costos}
                gastos={reporte.gastos}
                desde={desde}
                hasta={hasta}
              />
              <TableFooter>
                <TableRow>
                  <TableCell>Total de ingresos</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(reporte.totalIngresos)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total de egresos</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(reporte.totalEgresos)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/30 hover:bg-muted/30 font-semibold">
                  <TableCell>Saldo (utilidad)</TableCell>
                  <TableCell className={`text-right tabular-nums ${reporte.saldo < 0 ? "text-destructive" : ""}`}>
                    {formatearRd(reporte.saldo)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
