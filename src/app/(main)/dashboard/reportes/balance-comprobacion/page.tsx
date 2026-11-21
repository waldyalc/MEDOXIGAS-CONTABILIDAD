import { Enlace } from "@/components/enlace";
import { CircleCheck, Scale, TriangleAlert } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { calcularBalanza } from "@/lib/reportes/libros/balance";
import { obtenerCuentas, obtenerSaldosCuentas } from "@/lib/reportes/libros/consultas";
import { leerBooleano, leerTexto } from "@/lib/reportes/libros/parametros";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroBalance } from "../_components/libros/filtro-balance";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const buscar = leerTexto(params.buscar) ?? "";
  const cierreAnual = leerBooleano(params.cierre);
  const incluirCero = leerBooleano(params.ceros);

  const [cuentas, saldos] = await Promise.all([obtenerCuentas(), obtenerSaldosCuentas(desde, hasta, cierreAnual)]);
  const error = cuentas.error ?? saldos.error;
  const balance = calcularBalanza(saldos.filas, cuentas.filas, { buscar, incluirCero });

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Balanza de comprobación"
        descripcion="Saldo inicial, movimientos y saldo final por cuenta, con subtotales por grupo."
        desde={desde}
        hasta={hasta}
      />

      <FiltroBalance desde={desde} hasta={hasta} buscar={buscar} cierreAnual={cierreAnual} incluirCero={incluirCero} />

      {error ? <AlertaError mensaje={error} /> : null}

      {balance.filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>Sin datos</EmptyTitle>
            <EmptyDescription>No hay cuentas con movimientos en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Cuenta contable</TableHead>
                  <TableHead colSpan={2} className="text-center">
                    Saldo inicial
                  </TableHead>
                  <TableHead colSpan={2} className="text-center">
                    Movimientos
                  </TableHead>
                  <TableHead colSpan={2} className="text-center">
                    Saldo final
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.filas.map((fila) => (
                  <FilaNavegable
                    key={fila.clave}
                    href={rutaCuenta(fila.cuentaId)}
                    className={
                      fila.esGrupo
                        ? "bg-muted/50 hover:bg-muted/50 font-semibold"
                        : fila.esPadre
                          ? "font-medium"
                          : undefined
                    }
                  >
                    <TableCell style={{ paddingLeft: `${8 + fila.nivel * 16}px` }}>
                      <Enlace href={rutaCuenta(fila.cuentaId)}>
                        <span className="text-muted-foreground tabular-nums">{fila.codigo}</span> {fila.nombre}
                      </Enlace>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.saldoInicialDebito === 0 ? "" : formatearRd(fila.saldoInicialDebito)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.saldoInicialCredito === 0 ? "" : formatearRd(fila.saldoInicialCredito)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.debitos === 0 ? "" : formatearRd(fila.debitos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.creditos === 0 ? "" : formatearRd(fila.creditos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.saldoFinalDebito === 0 ? "" : formatearRd(fila.saldoFinalDebito)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.saldoFinalCredito === 0 ? "" : formatearRd(fila.saldoFinalCredito)}
                    </TableCell>
                  </FilaNavegable>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      Total
                      {buscar.trim() === "" ? (
                        balance.totales.cuadra ? (
                          <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TriangleAlert className="text-destructive size-4" />
                        )
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balance.totales.saldoInicialDebito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balance.totales.saldoInicialCredito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(balance.totales.debitos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(balance.totales.creditos)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balance.totales.saldoFinalDebito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balance.totales.saldoFinalCredito)}
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
