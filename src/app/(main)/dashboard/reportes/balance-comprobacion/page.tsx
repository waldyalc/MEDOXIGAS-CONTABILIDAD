import { CircleCheck, Scale, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcularBalance } from "@/lib/reportes/balance";
import { obtenerBalanceComprobacion } from "@/lib/reportes/consultas";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroFechas } from "../_components/filtro-fechas";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const { desde, hasta } = parsearRango(await searchParams);
  const { filas, error } = await obtenerBalanceComprobacion(desde, hasta);
  const balance = calcularBalance(filas);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Balance de comprobación"
        descripcion="Movimientos y saldo por cuenta. Los débitos deben igualar a los créditos."
        desde={desde}
        hasta={hasta}
      />

      <FiltroFechas desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      {balance.filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>Sin datos</EmptyTitle>
            <EmptyDescription>No hay movimientos contables en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Débitos</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.filas.map((fila) => (
                  <TableRow key={fila.codigo}>
                    <TableCell className="text-muted-foreground tabular-nums">{fila.codigo}</TableCell>
                    <TableCell>{fila.nombre}</TableCell>
                    <TableCell className="capitalize">{fila.tipo}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.debitos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.creditos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Totales</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(balance.totales.debitos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(balance.totales.creditos)}</TableCell>
                  <TableCell className="text-right">
                    {balance.totales.cuadra ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CircleCheck className="size-4" />
                        Cuadra
                      </span>
                    ) : (
                      <span className="text-destructive inline-flex items-center gap-1">
                        <TriangleAlert className="size-4" />
                        {formatearRd(balance.totales.diferencia)}
                      </span>
                    )}
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
