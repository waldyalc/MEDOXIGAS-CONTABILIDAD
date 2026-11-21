import { Enlace } from "@/components/enlace";
import { UsersRound } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { calcularBalanzaTercero } from "@/lib/reportes/libros/balanza-tercero";
import { obtenerContactos, obtenerCuentas, obtenerSaldosTercero } from "@/lib/reportes/libros/consultas";
import { leerBooleano, leerCodigoCuenta, leerUuid } from "@/lib/reportes/libros/parametros";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroBalanzaTercero } from "../_components/libros/filtro-balanza-tercero";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const cuenta = leerCodigoCuenta(params.cuenta);
  const tercero = leerUuid(params.tercero);
  const incluirCero = leerBooleano(params.ceros);

  const [cuentas, contactos, saldos] = await Promise.all([
    obtenerCuentas(),
    obtenerContactos(),
    obtenerSaldosTercero(desde, hasta, {
      cuentas: cuenta ? [cuenta] : undefined,
      contacto: tercero,
      incluirCero,
    }),
  ]);

  const error = cuentas.error ?? contactos.error ?? saldos.error;
  const balanza = calcularBalanzaTercero(saldos.filas, incluirCero);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Balanza de comprobación por tercero"
        descripcion="Saldos iniciales, movimientos y saldos finales por cuenta y tercero."
        desde={desde}
        hasta={hasta}
      />

      <FiltroBalanzaTercero
        desde={desde}
        hasta={hasta}
        cuentas={cuentas.filas}
        contactos={contactos.filas}
        cuenta={cuenta}
        tercero={tercero}
        incluirCero={incluirCero}
      />

      {error ? <AlertaError mensaje={error} /> : null}

      {balanza.filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>Sin datos</EmptyTitle>
            <EmptyDescription>No hay saldos por tercero para los filtros seleccionados.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Cuenta contable</TableHead>
                  <TableHead rowSpan={2}>Tercero</TableHead>
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
                {balanza.filas.map((fila) => (
                  <FilaNavegable key={fila.clave} href={rutaCuenta(fila.cuentaId)}>
                    <TableCell>
                      <Enlace href={rutaCuenta(fila.cuentaId)}>
                        <span className="text-muted-foreground tabular-nums">{fila.cuentaCodigo}</span>{" "}
                        {fila.cuentaNombre}
                      </Enlace>
                    </TableCell>
                    <TableCell>
                      {fila.contactoId ? (
                        <Enlace href={rutaContacto(fila.contactoId)}>{fila.tercero}</Enlace>
                      ) : (
                        fila.tercero
                      )}
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
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balanza.totales.saldoInicialDebito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balanza.totales.saldoInicialCredito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(balanza.totales.debitos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(balanza.totales.creditos)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balanza.totales.saldoFinalDebito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearRd(balanza.totales.saldoFinalCredito)}
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
