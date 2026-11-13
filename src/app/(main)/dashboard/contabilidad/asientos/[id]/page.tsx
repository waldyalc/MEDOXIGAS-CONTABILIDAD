import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import { obtenerAsientoDetalle } from "./_consultas";

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

  const asiento = await obtenerAsientoDetalle(id);
  if (!asiento) notFound();

  const debitos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const creditos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Asiento contable #{asiento.numero}</h1>
          <EstadoAsiento cuadrado={debitos === creditos} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Número</dt>
            <dd className="tabular-nums">#{asiento.numero}</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(asiento.fecha)}</dd>
            <dt className="text-muted-foreground">Descripción</dt>
            <dd className="whitespace-pre-line">{asiento.descripcion || "—"}</dd>
            <dt className="text-muted-foreground">Documento de origen</dt>
            <dd>
              {asiento.origen.href ? (
                <Enlace href={asiento.origen.href}>{asiento.origen.etiqueta}</Enlace>
              ) : (
                asiento.origen.etiqueta
              )}
            </dd>
          </dl>
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
                <TableHead className="pl-(--card-spacing)">Cuenta</TableHead>
                <TableHead>Tercero</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asiento.lineas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                    El asiento no tiene líneas.
                  </TableCell>
                </TableRow>
              ) : (
                asiento.lineas.map((linea) => (
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
                    <TableCell className="whitespace-normal">
                      {linea.contacto ? (
                        <Enlace href={rutaContacto(linea.contacto.id)}>{linea.contacto.nombre}</Enlace>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">{linea.descripcion || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {linea.debito === 0 ? "—" : formatoMoneda(linea.debito)}
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                      {linea.credito === 0 ? "—" : formatoMoneda(linea.credito)}
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
                <TableCell className="text-right tabular-nums">{formatoMoneda(debitos / 100)}</TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {formatoMoneda(creditos / 100)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
