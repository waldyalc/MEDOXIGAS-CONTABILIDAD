import { UserRound } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { calcularAuxiliar } from "@/lib/reportes/libros/auxiliar";
import { obtenerContactos, obtenerCuentas, obtenerSaldosTercero } from "@/lib/reportes/libros/consultas";
import { leerCodigoCuenta, leerUuid } from "@/lib/reportes/libros/parametros";
import type { FilaSaldoTercero } from "@/lib/reportes/libros/tipos";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroAuxiliar } from "../_components/libros/filtro-auxiliar";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const tercero = leerUuid(params.tercero);
  const cuenta = leerCodigoCuenta(params.cuenta);

  const [contactos, cuentas] = await Promise.all([obtenerContactos(), obtenerCuentas()]);
  let filas: FilaSaldoTercero[] = [];
  let error = contactos.error ?? cuentas.error;

  if (tercero) {
    const saldos = await obtenerSaldosTercero(desde, hasta, {
      cuentas: cuenta ? [cuenta] : undefined,
      contacto: tercero,
    });
    filas = saldos.filas;
    if (saldos.error) error = saldos.error;
  }

  const auxiliar = calcularAuxiliar(filas);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Auxiliar por tercero"
        descripcion="Saldo anterior, movimientos y saldo final por cuenta para un tercero."
        desde={desde}
        hasta={hasta}
      />

      <FiltroAuxiliar
        desde={desde}
        hasta={hasta}
        contactos={contactos.filas}
        cuentas={cuentas.filas}
        tercero={tercero}
        cuenta={cuenta}
      />

      {error ? <AlertaError mensaje={error} /> : null}

      {!tercero ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>Elige un tercero</EmptyTitle>
            <EmptyDescription>Selecciona el tercero para ver sus saldos por cuenta contable.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : auxiliar.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>Sin movimientos</EmptyTitle>
            <EmptyDescription>El tercero no tiene movimientos en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta contable</TableHead>
                  <TableHead>Tercero</TableHead>
                  <TableHead className="text-right">Saldo anterior</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Saldo final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auxiliar.map((fila) => (
                  <TableRow key={fila.clave}>
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
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.saldoAnterior)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.debito)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.credito)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.neto)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearRd(fila.saldoFinal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
