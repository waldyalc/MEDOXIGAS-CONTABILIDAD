import Link from "next/link";

import { Package } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaProducto } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import {
  agruparVentasPorProducto,
  filtrarVentas,
  paginar,
  parsearBusqueda,
  parsearPagina,
  resumirVentas,
} from "@/lib/reportes/ventas/v2/calculo";
import { obtenerLineasVenta } from "@/lib/reportes/ventas/v2/consultas";
import { urlVentasProducto } from "@/lib/reportes/ventas/v2/enlaces";
import { tablaVentasProducto } from "@/lib/reportes/ventas/v2/tablas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroVentas } from "./_components/filtro-ventas";
import { PaginacionReporte } from "./_components/paginacion-reporte";

const TAMANO_PAGINA = 20;

const CANTIDAD = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const busqueda = parsearBusqueda(params);
  const pagina = parsearPagina(params);

  const { lineas, error } = await obtenerLineasVenta(desde, hasta);
  const filas = filtrarVentas(agruparVentasPorProducto(lineas), busqueda);
  const totales = resumirVentas(filas);
  const paginado = paginar(filas, pagina, TAMANO_PAGINA);
  const tabla = tablaVentasProducto(filas, totales, desde, hasta);

  const enlacePagina = (destino: number) => urlVentasProducto({ desde, hasta, busqueda, pagina: destino });

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Ventas por producto/servicio"
        descripcion="Ventas agrupadas por producto o servicio en el período seleccionado."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroVentas desde={desde} hasta={hasta} busqueda={busqueda} />
        <BotonDescargar tabla={tabla} nombreArchivo={`ventas-por-producto-${desde}-${hasta}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="py-0">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Antes de impuestos</p>
            <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.antes)}</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Después de impuestos</p>
            <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.despues)}</p>
          </CardContent>
        </Card>
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      {filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>Sin ventas por producto</EmptyTitle>
            <EmptyDescription>
              {busqueda
                ? "Ningún producto o servicio coincide con la búsqueda."
                : "No hay facturas de venta en el período seleccionado."}
            </EmptyDescription>
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
                    <TableHead className="text-right">Número de productos/servicios</TableHead>
                    <TableHead className="text-right">Antes de impuestos</TableHead>
                    <TableHead className="text-right">Después de impuestos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginado.filas.map((fila) => (
                    <FilaNavegable key={fila.clave} href={fila.productoId ? rutaProducto(fila.productoId) : null}>
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
                      <TableCell className="text-muted-foreground">{fila.referencia ?? ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{CANTIDAD.format(fila.cantidad)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(fila.antes)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.despues)}</TableCell>
                    </FilaNavegable>
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
