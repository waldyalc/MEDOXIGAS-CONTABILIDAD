import { ListOrdered } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { centavos, formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { obtenerCuentas, obtenerMovimientos, obtenerSaldosCuentas } from "@/lib/reportes/libros/consultas";
import { calcularMovimientosCuenta } from "@/lib/reportes/libros/movimientos";
import { leerCodigoCuenta, leerTexto } from "@/lib/reportes/libros/parametros";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { EstadoAsiento } from "../_components/libros/estado-asiento";
import { FiltroMovimientosCuenta } from "../_components/libros/filtro-movimientos-cuenta";
import { ResumenCifra } from "../_components/libros/resumen-cifra";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const cuenta = leerCodigoCuenta(params.cuenta);
  const asiento = leerTexto(params.asiento) ?? "";

  const cuentas = await obtenerCuentas();
  let movimientos = calcularMovimientosCuenta([], { saldoInicial: 0, buscarAsiento: asiento });
  let error = cuentas.error;

  if (cuenta) {
    const [lineas, saldos] = await Promise.all([
      obtenerMovimientos({ desde, hasta, cuentas: [cuenta] }),
      obtenerSaldosCuentas(desde, hasta, false, [cuenta]),
    ]);
    const saldoInicial = saldos.filas.reduce((total, fila) => total + centavos(fila.saldo_inicial), 0);
    movimientos = calcularMovimientosCuenta(lineas.filas, { saldoInicial, buscarAsiento: asiento });
    if (lineas.error) error = lineas.error;
    else if (saldos.error) error = saldos.error;
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Movimientos por cuenta contable"
        descripcion="Movimientos de una cuenta con saldo corrido y totales del período."
        desde={desde}
        hasta={hasta}
      />

      <FiltroMovimientosCuenta desde={desde} hasta={hasta} cuentas={cuentas.filas} cuenta={cuenta} asiento={asiento} />

      {error ? <AlertaError mensaje={error} /> : null}

      {!cuenta ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListOrdered />
            </EmptyMedia>
            <EmptyTitle>Elige una cuenta contable</EmptyTitle>
            <EmptyDescription>Selecciona la cuenta para ver sus movimientos y saldo corrido.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : movimientos.filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListOrdered />
            </EmptyMedia>
            <EmptyTitle>Sin movimientos</EmptyTitle>
            <EmptyDescription>La cuenta no tiene movimientos en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ResumenCifra etiqueta="Saldo inicial" valor={formatearRd(movimientos.totales.saldoInicial)} />
            <ResumenCifra etiqueta="Débito" valor={formatearRd(movimientos.totales.debitos)} />
            <ResumenCifra etiqueta="Crédito" valor={formatearRd(movimientos.totales.creditos)} />
            <ResumenCifra etiqueta="Movimiento neto" valor={formatearRd(movimientos.totales.neto)} />
            <ResumenCifra etiqueta="Saldo final" valor={formatearRd(movimientos.totales.saldoFinal)} />
          </div>

          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de documento</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Asiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tercero</TableHead>
                    <TableHead>Código contable</TableHead>
                    <TableHead>Cuenta contable</TableHead>
                    <TableHead className="text-right">Saldo inicial</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Movimiento neto</TableHead>
                    <TableHead className="text-right">Saldo final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.filas.map((fila) => (
                    <TableRow key={fila.clave}>
                      <TableCell>{fila.tipoDocumento}</TableCell>
                      <TableCell>{formatoDia(fila.fecha)}</TableCell>
                      <TableCell className="tabular-nums">
                        <Enlace href={rutaAsiento(fila.asientoId)}>#{fila.asientoNumero}</Enlace>
                      </TableCell>
                      <TableCell>
                        <EstadoAsiento estado={fila.estado} />
                      </TableCell>
                      <TableCell>
                        {fila.contactoId ? (
                          <Enlace href={rutaContacto(fila.contactoId)}>{fila.tercero}</Enlace>
                        ) : (
                          fila.tercero
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        <Enlace href={rutaCuenta(fila.cuentaId)}>{fila.cuentaCodigo}</Enlace>
                      </TableCell>
                      <TableCell>
                        <Enlace href={rutaCuenta(fila.cuentaId)}>{fila.cuentaNombre}</Enlace>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(fila.saldoInicial)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fila.debito === 0 ? "" : formatearRd(fila.debito)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fila.credito === 0 ? "" : formatearRd(fila.credito)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(fila.neto)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatearRd(fila.saldoFinal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearRd(movimientos.totales.saldoInicial)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearRd(movimientos.totales.debitos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearRd(movimientos.totales.creditos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(movimientos.totales.neto)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearRd(movimientos.totales.saldoFinal)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
