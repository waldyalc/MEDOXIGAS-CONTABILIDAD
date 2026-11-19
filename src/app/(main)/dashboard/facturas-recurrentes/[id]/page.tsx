import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { rutaContacto, rutaFactura, rutaProducto } from "@/lib/enlaces";
import { calcularLinea, valorACentavos } from "@/lib/facturacion/calculo";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import { formatoCantidad, formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { getFacturaRecurrenteVista } from "@/lib/facturas-recurrentes/consultas";
import { formatoDia } from "@/lib/formato";

import { BotonGenerar } from "./_components/boton-generar";

function frecuenciaTexto(meses: number) {
  return meses === 1 ? "Cada mes" : `Cada ${meses} meses`;
}

function etiquetaEstado(estado: string) {
  if (estado === "anulada") return "Anulada";
  if (estado === "pagada") return "Pagada";
  return "Abierta";
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const recurrente = await getFacturaRecurrenteVista(id);
  if (!recurrente) notFound();

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/facturas-recurrentes" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Facturas recurrentes
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Factura recurrente #{recurrente.numero}</h1>
          {perfil.rol !== "lector" ? <BotonGenerar id={recurrente.id} /> : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>
              <Enlace href={rutaContacto(recurrente.contacto_id)}>{recurrente.cliente_nombre}</Enlace>
            </dd>
            <dt className="text-muted-foreground">Comprobante</dt>
            <dd>{etiquetaTipoComprobante(recurrente.tipo_comprobante)}</dd>
            <dt className="text-muted-foreground">Fecha de inicio</dt>
            <dd>{formatoDia(recurrente.fecha_inicio)}</dd>
            <dt className="text-muted-foreground">Vigencia hasta</dt>
            <dd>{recurrente.vigencia_hasta ? formatoDia(recurrente.vigencia_hasta) : "Sin límite"}</dd>
            <dt className="text-muted-foreground">Frecuencia</dt>
            <dd>{frecuenciaTexto(recurrente.frecuencia_meses)}</dd>
            <dt className="text-muted-foreground">Plazo de pago</dt>
            <dd>{recurrente.plazo_dias} días</dd>
            <dt className="text-muted-foreground">Observaciones</dt>
            <dd className="whitespace-pre-line">{recurrente.notas ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas de la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Desc. %</TableHead>
                <TableHead className="text-right">ITBIS %</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurrente.lineas.map((linea) => {
                const calculo = calcularLinea({
                  cantidad: linea.cantidad,
                  precioCentavos: valorACentavos(linea.precio),
                  descuentoPct: linea.descuento_pct,
                  itbisTasa: linea.itbis_tasa,
                });
                return (
                  <FilaNavegable key={linea.id} href={linea.producto_id ? rutaProducto(linea.producto_id) : null}>
                    <TableCell className="font-medium">
                      {linea.producto_id ? (
                        <Enlace href={rutaProducto(linea.producto_id)}>{linea.descripcion}</Enlace>
                      ) : (
                        linea.descripcion
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.descuento_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoCantidad(linea.itbis_tasa)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatoMonedaCentavos(calculo.totalCentavos)}
                    </TableCell>
                  </FilaNavegable>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturas generadas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>NCF</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurrente.generaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Todavía no se ha generado ninguna factura.
                  </TableCell>
                </TableRow>
              ) : (
                recurrente.generaciones.map((generacion) => (
                  <FilaNavegable key={generacion.id} href={rutaFactura(generacion.factura_id)}>
                    <TableCell>{formatoDia(generacion.periodo)}</TableCell>
                    <TableCell className="font-medium">
                      <Enlace href={rutaFactura(generacion.factura_id)}>#{generacion.factura_numero}</Enlace>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{generacion.factura_ncf ?? "—"}</TableCell>
                    <TableCell>{formatoDia(generacion.factura_fecha)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(generacion.factura_total)}</TableCell>
                    <TableCell>
                      <Badge variant={generacion.factura_estado === "anulada" ? "destructive" : "secondary"}>
                        {etiquetaEstado(generacion.factura_estado)}
                      </Badge>
                    </TableCell>
                  </FilaNavegable>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
