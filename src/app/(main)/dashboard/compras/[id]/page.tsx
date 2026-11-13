import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { aCentavos, aNumero } from "@/lib/compras/calculo";
import { cargarCuentasCajaBanco, obtenerFacturaProveedor } from "@/lib/compras/consultas";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import { formatoDia } from "@/lib/formato";

import { AccionesFactura } from "../_components/acciones-factura";
import { EstadoBadge } from "../_components/estado-badge";

function EstadoAsiento({ cuadrado }: { cuadrado: boolean }) {
  if (!cuadrado) return <Badge variant="destructive">Descuadrado</Badge>;

  return (
    <Badge variant="outline" className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
      Cuadrado ✓
    </Badge>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const detalle = await obtenerFacturaProveedor(id);
  if (!detalle) notFound();

  const { factura, lineas, asiento, lineasAsiento } = detalle;
  const puedeEscribir = rol === "admin" || rol === "contador";
  const cuentasCajaBanco = puedeEscribir && factura.estado === "abierta" ? await cargarCuentasCajaBanco() : [];

  const total = aNumero(factura.total);
  const pagado = aNumero(factura.pagado);
  const saldo = total - pagado;

  const debitos = lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.debito), 0);
  const creditos = lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.credito), 0);
  const cuadrado = aCentavos(debitos) === aCentavos(creditos);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/compras" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Compras
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Factura de proveedor #{factura.numero}</h1>
            <EstadoBadge estado={factura.estado} />
          </div>
          <AccionesFactura
            facturaId={factura.id}
            numero={factura.numero}
            estado={factura.estado}
            saldo={saldo}
            cuentas={cuentasCajaBanco}
            puedeRegistrarPago={puedeEscribir}
            puedeAnular={puedeEscribir}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd className="font-medium">{factura.contactos?.nombre ?? "—"}</dd>
            <dt className="text-muted-foreground">RNC</dt>
            <dd>{factura.contactos?.rnc_cedula ?? "—"}</dd>
            <dt className="text-muted-foreground">NCF</dt>
            <dd>{factura.ncf ?? "—"}</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(factura.fecha)}</dd>
            <dt className="text-muted-foreground">Vencimiento</dt>
            <dd>{formatoDia(factura.vencimiento)}</dd>
            {factura.notas ? (
              <>
                <dt className="text-muted-foreground">Notas</dt>
                <dd className="whitespace-pre-line">{factura.notas}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatoMoneda(aNumero(factura.subtotal))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ITBIS</span>
              <span className="tabular-nums">{formatoMoneda(aNumero(factura.itbis))}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatoMoneda(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pagado</span>
              <span className="tabular-nums">{formatoMoneda(pagado)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Por pagar</span>
              <span className="tabular-nums">{formatoMoneda(saldo)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">ITBIS %</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    La factura no tiene líneas.
                  </TableCell>
                </TableRow>
              ) : (
                lineas.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell className="pl-(--card-spacing) whitespace-normal">
                      <div className="flex flex-col">
                        <span>{linea.descripcion || "—"}</span>
                        {linea.productos ? (
                          <span className="text-muted-foreground text-xs">{linea.productos.nombre}</span>
                        ) : null}
                        {linea.cuentas ? (
                          <span className="text-muted-foreground text-xs">
                            {linea.cuentas.codigo} · {linea.cuentas.nombre}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.costo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.itbis_tasa)} %</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.subtotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {formatoMoneda(linea.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="pl-(--card-spacing) text-right">
                  Totales
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(aNumero(factura.subtotal))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(aNumero(factura.itbis))}</TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">{formatoMoneda(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>Asiento contable</CardTitle>
            {asiento ? (
              <p className="text-muted-foreground text-sm">
                #{asiento.numero} · {formatoDia(asiento.fecha)} · {asiento.descripcion}
              </p>
            ) : null}
          </div>
          {asiento ? <EstadoAsiento cuadrado={cuadrado} /> : null}
        </CardHeader>
        <CardContent className={asiento ? "px-0" : undefined}>
          {asiento ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Cuenta</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="pr-(--card-spacing) text-right">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineasAsiento.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell className="pl-(--card-spacing) whitespace-normal">
                      {linea.cuentas ? `${linea.cuentas.codigo} · ${linea.cuentas.nombre}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal">{linea.descripcion || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.debito)}</TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {formatoMoneda(linea.credito)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="pl-(--card-spacing) text-right">
                    Totales
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(debitos)}</TableCell>
                  <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                    {formatoMoneda(creditos)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <p className="text-muted-foreground px-(--card-spacing) text-sm">La factura no tiene asiento contable.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
