import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { listarOpcionesCuenta } from "@/lib/contabilidad/consultas";
import { rutaAsiento, rutaContacto } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import { EditarCuenta } from "../../_components/cuenta-formulario";
import { normalizarFecha, obtenerCuentaDetalle } from "./_consultas";

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
  const [detalle, opciones] = await Promise.all([obtenerCuentaDetalle(id, desde, hasta), listarOpcionesCuenta()]);
  if (!detalle) notFound();

  const { cuenta, movimientos, tieneMovimientos, saldoCentavos, totalDebitoCentavos, totalCreditoCentavos } = detalle;
  const puedeEditar = rol === "admin" || rol === "contador";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/contabilidad" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Contabilidad
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {cuenta.codigo} · {cuenta.nombre}
            </h1>
            <Badge variant="outline" className="capitalize">
              {cuenta.tipo}
            </Badge>
            {puedeEditar ? (
              <EditarCuenta cuenta={cuenta} cuentas={opciones} bloquearCodigoTipoNaturaleza={tieneMovimientos} />
            ) : null}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Saldo</span>
            <span className={`text-xl font-semibold tabular-nums ${saldoCentavos < 0 ? "text-destructive" : ""}`}>
              {formatoMoneda(saldoCentavos / 100)}
            </span>
          </div>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-40" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Fecha</TableHead>
                <TableHead>Asiento</TableHead>
                <TableHead>Tercero</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Saldo acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    La cuenta no tiene movimientos en el período seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                movimientos.map((movimiento) => (
                  <FilaNavegable key={movimiento.id} href={rutaAsiento(movimiento.asiento_id)}>
                    <TableCell className="pl-(--card-spacing) tabular-nums">{formatoDia(movimiento.fecha)}</TableCell>
                    <TableCell>
                      <Enlace href={rutaAsiento(movimiento.asiento_id)} className="tabular-nums">
                        #{movimiento.numero}
                      </Enlace>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {movimiento.contacto ? (
                        <Enlace href={rutaContacto(movimiento.contacto.id)}>{movimiento.contacto.nombre}</Enlace>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">{movimiento.descripcion || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movimiento.debitoCentavos === 0 ? "—" : formatoMoneda(movimiento.debitoCentavos / 100)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movimiento.creditoCentavos === 0 ? "—" : formatoMoneda(movimiento.creditoCentavos / 100)}
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {formatoMoneda(movimiento.saldoCentavos / 100)}
                    </TableCell>
                  </FilaNavegable>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="pl-(--card-spacing) text-right">
                  Totales
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(totalDebitoCentavos / 100)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(totalCreditoCentavos / 100)}</TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {formatoMoneda(saldoCentavos / 100)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
