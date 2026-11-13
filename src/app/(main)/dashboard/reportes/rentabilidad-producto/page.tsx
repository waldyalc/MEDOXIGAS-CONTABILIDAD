import Link from "next/link";

import { TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaProducto } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { agruparRentabilidad, paginar, parsearPagina, resumirRentabilidad } from "@/lib/reportes/ventas/v2/calculo";
import { obtenerLineasVenta } from "@/lib/reportes/ventas/v2/consultas";
import { urlRentabilidadProducto } from "@/lib/reportes/ventas/v2/enlaces";
import { tablaRentabilidadProducto } from "@/lib/reportes/ventas/v2/tablas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { SelectorRangoFechas } from "../_components/selector-fechas";
import { PaginacionReporte } from "../ventas-producto/_components/paginacion-reporte";

const TAMANO_PAGINA = 10;

const PORCENTAJE = new Intl.NumberFormat("es-DO", {
  maximumFractionDigits: 2,
});

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const pagina = parsearPagina(params);

  const { lineas, error } = await obtenerLineasVenta(desde, hasta);
  const filas = agruparRentabilidad(lineas);
  const totales = resumirRentabilidad(filas);
  const paginado = paginar(filas, pagina, TAMANO_PAGINA);
  const tabla = tablaRentabilidadProducto(filas, totales, desde, hasta);

  const enlacePagina = (destino: number) => urlRentabilidadProducto({ desde, hasta, pagina: destino });

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Rentabilidad por producto/servicio"
        descripcion="Total vendido, costo y rentabilidad por producto o servicio en el período seleccionado."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <SelectorRangoFechas desde={desde} hasta={hasta} />
        <BotonDescargar tabla={tabla} nombreArchivo={`rentabilidad-por-producto-${desde}-${hasta}`} />
      </div>

      <p className="text-muted-foreground -mt-3 text-sm print:hidden">
        El costo se toma del costo registrado al momento de la venta.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-0">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Total vendido</p>
            <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.totalVendido)}</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Costo total</p>
            <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.costoTotal)}</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Rentabilidad total</p>
            <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.rentabilidad)}</p>
          </CardContent>
        </Card>
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      {filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>Sin rentabilidad por producto</EmptyTitle>
            <EmptyDescription>No hay facturas de venta en el período seleccionado.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto/servicio</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Total vendido</TableHead>
                    <TableHead className="text-right">Costo total</TableHead>
                    <TableHead className="text-right">Rentabilidad total</TableHead>
                    <TableHead className="text-right">Porcentaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginado.filas.map((fila) => (
                    <TableRow key={fila.clave}>
                      <TableCell>
                        {fila.productoId ? (
                          <Link
                            href={rutaProducto(fila.productoId)}
                            prefetch={false}
                            className="font-medium hover:underline"
                          >
                            {fila.nombre}
                          </Link>
                        ) : (
                          fila.nombre
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fila.referencia ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(fila.totalVendido)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(fila.costoTotal)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatearRd(fila.rentabilidad)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{PORCENTAJE.format(fila.porcentaje)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <PaginacionReporte
            pagina={paginado.pagina}
            totalPaginas={paginado.totalPaginas}
            anterior={paginado.pagina > 1 ? enlacePagina(paginado.pagina - 1) : null}
            siguiente={paginado.pagina < paginado.totalPaginas ? enlacePagina(paginado.pagina + 1) : null}
          />
        </div>
      )}
    </div>
  );
}
