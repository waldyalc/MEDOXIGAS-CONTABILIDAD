import { Fragment } from "react";

import { BookOpen } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoDia } from "@/lib/formato";
import { obtenerLibroDiario } from "@/lib/reportes/consultas";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { agruparLibroDiario, etiquetaOrigen, totalesLibroDiario } from "@/lib/reportes/libro-diario";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroFechas } from "../_components/filtro-fechas";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const { desde, hasta } = parsearRango(await searchParams);
  const { filas, error } = await obtenerLibroDiario(desde, hasta);
  const asientos = agruparLibroDiario(filas);
  const totales = totalesLibroDiario(asientos);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Libro diario"
        descripcion="Asientos contables generados por el motor, agrupados por asiento."
        desde={desde}
        hasta={hasta}
      />

      <FiltroFechas desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      {asientos.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>Sin movimientos</EmptyTitle>
            <EmptyDescription>No hay asientos contables en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asientos.map((asiento) => (
                  <Fragment key={asiento.numero}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={3} className="font-medium">
                        Asiento #{asiento.numero} · {formatoDia(asiento.fecha)} · {asiento.descripcion}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          ({etiquetaOrigen(asiento.origenTipo)})
                        </span>
                      </TableCell>
                    </TableRow>
                    {asiento.lineas.map((linea) => (
                      <TableRow key={linea.clave}>
                        <TableCell>
                          <span className="text-muted-foreground">{linea.cuentaCodigo}</span> {linea.cuentaNombre}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {linea.debito === 0 ? "" : formatearRd(linea.debito)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {linea.credito === 0 ? "" : formatearRd(linea.credito)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-medium">
                      <TableCell className="text-right">Total asiento #{asiento.numero}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(asiento.totalDebito)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(asiento.totalCredito)}</TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Totales del período</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(totales.debitos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(totales.creditos)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
