import { notFound, redirect } from "next/navigation";

import { EditarCuenta } from "@/components/contabilidad/cuenta-formulario";
import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { listarOpcionesCuenta } from "@/lib/contabilidad/consultas";
import { rutaAsiento, rutaContacto } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import { FiltroFechasCuenta } from "./_components/filtro-fechas-cuenta";
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
  const titulo = `${cuenta.codigo} · ${cuenta.nombre}`;

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {titulo}
            <Badge variant="outline" className="capitalize">
              {cuenta.tipo}
            </Badge>
          </span>
        }
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: titulo },
        ]}
        acciones={
          <>
            {puedeEditar ? (
              <EditarCuenta cuenta={cuenta} cuentas={opciones} bloquearCodigoTipoNaturaleza={tieneMovimientos} />
            ) : null}
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs">Saldo</span>
              <span className={`text-xl font-semibold tabular-nums ${saldoCentavos < 0 ? "text-destructive" : ""}`}>
                {formatoMoneda(saldoCentavos / 100)}
              </span>
            </div>
          </>
        }
      />

      <FiltroFechasCuenta desde={desde} hasta={hasta} />

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
    </ContenedorLista>
  );
}
