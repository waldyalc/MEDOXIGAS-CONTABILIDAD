import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, ArrowRightLeft, BookOpen } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaCuenta } from "@/lib/enlaces";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

import { getDetalleTransferencia } from "./_consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const transferencia = await getDetalleTransferencia(id);
  if (!transferencia) notFound();

  const salida = transferencia.lineas.find((linea) => linea.credito > 0);
  const entrada = transferencia.lineas.find((linea) => linea.debito > 0);
  const montoCentavos = valorACentavos(entrada?.debito ?? salida?.credito ?? 0);
  const esTransferencia = transferencia.origenTipo === "transferencia";
  const cuentaOrigen = esTransferencia ? salida : entrada;
  const cuentaDestino = esTransferencia ? entrada : salida;
  const debitos = transferencia.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const creditos = transferencia.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/bancos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Bancos
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl tracking-tight">
              {esTransferencia ? "Transferencia" : "Depósito"} #{transferencia.numero}
            </h1>
            <Badge variant="secondary">{esTransferencia ? "Entre cuentas" : "Depósito"}</Badge>
          </div>
          <Button variant="outline" render={<Link href={rutaAsiento(transferencia.id)} prefetch={false} />}>
            <BookOpen />
            Ver asiento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(transferencia.fecha)}</dd>
            <dt className="text-muted-foreground">Descripción</dt>
            <dd className="whitespace-pre-line">{transferencia.descripcion || "—"}</dd>
            {transferencia.numeracionIngreso ? (
              <>
                <dt className="text-muted-foreground">Numeración ingreso</dt>
                <dd>{transferencia.numeracionIngreso}</dd>
              </>
            ) : null}
            {transferencia.numeracionEgreso ? (
              <>
                <dt className="text-muted-foreground">Numeración egreso</dt>
                <dd>{transferencia.numeracionEgreso}</dd>
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <Card>
          <CardHeader>
            <CardTitle>{esTransferencia ? "Desde" : "Cuenta destino"}</CardTitle>
          </CardHeader>
          <CardContent>
            {cuentaOrigen?.cuenta ? (
              <Enlace href={rutaCuenta(cuentaOrigen.cuenta.id)} className="font-medium">
                {cuentaOrigen.cuenta.codigo} · {cuentaOrigen.cuenta.nombre}
              </Enlace>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-1">
          <ArrowRightLeft className="text-muted-foreground size-5" />
          <span className="text-lg font-semibold tabular-nums">{formatearRd(montoCentavos)}</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{esTransferencia ? "Hacia" : "Contrapartida"}</CardTitle>
          </CardHeader>
          <CardContent>
            {cuentaDestino?.cuenta ? (
              <Enlace href={rutaCuenta(cuentaDestino.cuenta.id)} className="font-medium">
                {cuentaDestino.cuenta.codigo} · {cuentaDestino.cuenta.nombre}
              </Enlace>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asiento</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
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
              {transferencia.lineas.map((linea) => (
                <TableRow key={linea.id}>
                  <TableCell className="pl-(--card-spacing) whitespace-normal">
                    {linea.cuenta ? (
                      <Enlace href={rutaCuenta(linea.cuenta.id)}>
                        <span className="text-muted-foreground">{linea.cuenta.codigo}</span> {linea.cuenta.nombre}
                      </Enlace>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">{linea.descripcion || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {linea.debito === 0 ? "—" : formatearRd(valorACentavos(linea.debito))}
                  </TableCell>
                  <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                    {linea.credito === 0 ? "—" : formatearRd(valorACentavos(linea.credito))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="pl-(--card-spacing) text-right">
                  Totales
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(debitos)}</TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">{formatearRd(creditos)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
