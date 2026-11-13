import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, Scale } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { getDetalleCuentaBanco, normalizarFecha } from "@/lib/bancos/consultas";
import { tipoCuenta } from "@/lib/bancos/formato";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

import { FiltroFechas } from "./_components/filtro-fechas";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const desde = normalizarFecha(busqueda.desde);
  const hasta = normalizarFecha(busqueda.hasta);
  const detalle = await getDetalleCuentaBanco(id, desde, hasta);
  if (!detalle) notFound();

  const { cuenta } = detalle;
  const puedeEscribir = rol !== "lector";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/bancos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Bancos
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl tracking-tight">{cuenta.nombre}</h1>
              <Badge variant="secondary">{tipoCuenta(cuenta.nombre, cuenta.tipoBanco)}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              <Enlace href={rutaCuenta(cuenta.id)}>Cuenta contable {cuenta.codigo}</Enlace>
              {cuenta.numeroCuenta ? ` · N.º ${cuenta.numeroCuenta}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Saldo actual</span>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                detalle.saldoActualCentavos < 0 ? "text-destructive" : ""
              }`}
            >
              {formatearRd(detalle.saldoActualCentavos)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroFechas desde={desde ?? ""} hasta={hasta ?? ""} />
        {puedeEscribir ? (
          <Button
            variant="outline"
            render={<Link href={`/dashboard/bancos/conciliaciones/nueva?cuenta=${cuenta.id}`} prefetch={false} />}
          >
            <Scale />
            Conciliar
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Fecha</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Tercero</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Salida</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalle.movimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    La cuenta no tiene movimientos en el período seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                detalle.movimientos.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell className="pl-(--card-spacing) tabular-nums">{formatoDia(movimiento.fecha)}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-0.5">
                        {movimiento.documento.href ? (
                          <Enlace href={movimiento.documento.href}>{movimiento.documento.etiqueta}</Enlace>
                        ) : (
                          <span>{movimiento.documento.etiqueta}</span>
                        )}
                        <Enlace href={rutaAsiento(movimiento.asientoId)} className="text-muted-foreground text-xs">
                          Asiento #{movimiento.asientoNumero}
                        </Enlace>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {movimiento.tercero ? (
                        <Enlace href={rutaContacto(movimiento.tercero.id)}>{movimiento.tercero.nombre}</Enlace>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movimiento.entradaCentavos === 0 ? "—" : formatearRd(movimiento.entradaCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movimiento.salidaCentavos === 0 ? "—" : formatearRd(movimiento.salidaCentavos)}
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {formatearRd(movimiento.saldoCentavos)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="pl-(--card-spacing) text-right">
                  Totales
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(detalle.totalEntradasCentavos)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(detalle.totalSalidasCentavos)}</TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {formatearRd(detalle.saldoCentavos)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {cuenta.descripcion ? <p className="text-muted-foreground text-sm">{cuenta.descripcion}</p> : null}
    </div>
  );
}
