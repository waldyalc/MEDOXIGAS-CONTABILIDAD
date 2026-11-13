import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen, ReceiptText } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { aCentavos, aNumero } from "@/lib/compras/calculo";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import { getNotaCreditoCompraVista } from "@/lib/compras/notas-credito/consultas";
import { rutaAsiento, rutaCompra, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";

import { AccionesNotaCompra } from "../_components/acciones-nota-compra";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const nota = await getNotaCreditoCompraVista(id);
  if (!nota) notFound();

  const puedeEscribir = perfil.rol === "admin" || perfil.rol === "contador";
  const debitos = nota.lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.debito), 0);
  const creditos = nota.lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.credito), 0);
  const cuadrado = aCentavos(debitos) === aCentavos(creditos);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/compras/notas-credito" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Notas de crédito en compras
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Nota de crédito #{nota.numero}</h1>
            <Badge variant={nota.estado === "anulada" ? "destructive" : "secondary"}>
              {nota.estado === "anulada" ? "Anulada" : "Activa"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nota.asiento_id ? (
              <Button variant="outline" render={<Link href={rutaAsiento(nota.asiento_id)} prefetch={false} />}>
                <BookOpen data-icon="inline-start" />
                Ver asiento
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href={rutaCompra(nota.factura_proveedor_id)} prefetch={false} />}>
              <ReceiptText data-icon="inline-start" />
              Ver factura de proveedor
            </Button>
            {puedeEscribir && nota.estado === "activa" ? (
              <AccionesNotaCompra notaId={nota.id} numero={nota.numero} />
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">NCF</dt>
            <dd className="font-mono font-medium">{nota.ncf}</dd>
            <dt className="text-muted-foreground">Comprobante</dt>
            <dd>Nota de crédito en compras (B03)</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(nota.fecha)}</dd>
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd>
              <Enlace href={rutaContacto(nota.contacto_id)}>{nota.proveedor_nombre}</Enlace>
            </dd>
            <dt className="text-muted-foreground">Factura de proveedor</dt>
            <dd>
              <Enlace href={rutaCompra(nota.factura_proveedor_id)}>
                #{nota.factura_numero}
                {nota.factura_ncf ? ` — ${nota.factura_ncf}` : ""}
              </Enlace>
            </dd>
            <dt className="text-muted-foreground">Devuelve inventario</dt>
            <dd>{nota.devuelve_inventario ? "Sí" : "No"}</dd>
            <dt className="text-muted-foreground">Notas</dt>
            <dd className="whitespace-pre-line">{nota.notas ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">ITBIS %</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nota.lineas.map((linea) => (
                <TableRow key={linea.id}>
                  <TableCell className="font-medium">{linea.descripcion}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(linea.costo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(linea.itbis_tasa)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(linea.subtotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(linea.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="bg-muted/50 flex w-full flex-col gap-2 rounded-xl p-4 text-sm md:w-80">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatoMoneda(nota.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ITBIS</span>
            <span>{formatoMoneda(nota.itbis)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatoMoneda(nota.total)}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asiento contable</CardTitle>
          {nota.asiento ? (
            <p className="text-muted-foreground text-sm">
              #{nota.asiento.numero} — {formatoDia(nota.asiento.fecha)} — {nota.asiento.descripcion}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">
          {nota.asiento ? (
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
                {nota.lineasAsiento.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell className="pl-(--card-spacing) whitespace-normal">
                      {linea.cuentas ? (
                        <Enlace href={rutaCuenta(linea.cuenta_id)}>
                          {linea.cuentas.codigo} — {linea.cuentas.nombre}
                        </Enlace>
                      ) : (
                        "—"
                      )}
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
                    Totales {cuadrado ? "(cuadrado)" : "(descuadrado)"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(debitos)}</TableCell>
                  <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                    {formatoMoneda(creditos)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <p className="text-muted-foreground px-(--card-spacing) text-sm">La nota no tiene asiento contable.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
