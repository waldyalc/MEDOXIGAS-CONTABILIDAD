import Link from "next/link";

import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto } from "@/lib/enlaces";
import { formatoEntero } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { FilaReporte, TablaReporte } from "@/lib/reportes/exportar/tipos";
import type { ParametrosFecha } from "@/lib/reportes/fechas";
import { parsearRango } from "@/lib/reportes/fechas";
import { obtenerVentasCliente } from "@/lib/reportes/ventas/v3/consultas";
import { urlVentasCliente } from "@/lib/reportes/ventas/v3/enlaces";
import { parsearBusqueda, parsearPagina } from "@/lib/reportes/ventas/v3/parametros";
import {
  calcularVentasPorCliente,
  filtrarClientes,
  paginar,
  resumirClientes,
  totalPaginas,
} from "@/lib/reportes/ventas/v3/ventas-cliente";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { SelectorRangoFechas } from "../_components/selector-fechas";
import { GraficosClientes } from "./_components/graficos-clientes";

const POR_PAGINA = 10;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const busqueda = parsearBusqueda(params);
  const { filas, error } = await obtenerVentasCliente(desde, hasta);
  const resumen = calcularVentasPorCliente(filas);
  const clientes = filtrarClientes(resumen.clientes, busqueda);
  const totales = resumirClientes(clientes);
  const paginas = totalPaginas(clientes.length, POR_PAGINA);
  const pagina = parsearPagina(params, clientes.length, POR_PAGINA);
  const visibles = paginar(clientes, pagina, POR_PAGINA);

  const filasTabla: FilaReporte[] = clientes.map((cliente) => ({
    celdas: {
      cliente: cliente.contactoNombre,
      ventas: cliente.numeroVentas,
      subtotal: cliente.subtotal,
      descuentos: cliente.descuentos,
      devoluciones: cliente.devoluciones,
      antesImpuestos: cliente.antesImpuestos,
      impuestos: cliente.impuestos,
      despuesImpuestos: cliente.despuesImpuestos,
    },
  }));

  const filaTotal: FilaReporte = {
    celdas: {
      cliente: "Total",
      ventas: totales.numeroVentas,
      subtotal: totales.subtotal,
      descuentos: totales.descuentos,
      devoluciones: totales.devoluciones,
      antesImpuestos: totales.antesImpuestos,
      impuestos: totales.impuestos,
      despuesImpuestos: totales.despuesImpuestos,
    },
    estilo: "total",
  };

  const tabla: TablaReporte = {
    titulo: "Ventas por cliente",
    subtitulo: `Del ${desde} al ${hasta}${busqueda !== "" ? ` · Cliente: ${busqueda}` : ""}`,
    columnas: [
      { clave: "cliente", titulo: "Cliente", tipo: "texto" },
      { clave: "ventas", titulo: "Número de ventas", tipo: "texto" },
      { clave: "subtotal", titulo: "Subtotal", tipo: "dinero" },
      { clave: "descuentos", titulo: "Descuentos", tipo: "dinero" },
      { clave: "devoluciones", titulo: "Devoluciones", tipo: "dinero" },
      { clave: "antesImpuestos", titulo: "Antes de impuestos", tipo: "dinero" },
      { clave: "impuestos", titulo: "Impuestos", tipo: "dinero" },
      { clave: "despuesImpuestos", titulo: "Después de impuestos", tipo: "dinero" },
    ],
    filas: [...filasTabla, filaTotal],
  };

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Ventas por cliente"
        descripcion="Ventas del período agrupadas por cliente, con subtotal, descuentos e impuestos."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
          <SelectorRangoFechas desde={desde} hasta={hasta} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">Buscar cliente</Label>
            <Input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Cliente" className="w-56" />
          </div>
          <Button type="submit" variant="secondary">
            Aplicar
          </Button>
        </form>
        <BotonDescargar tabla={tabla} nombreArchivo={`ventas-por-cliente-${desde}-${hasta}`} />
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      <GraficosClientes clientes={clientes} />

      {clientes.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No encontramos ventas que coincidan con tu búsqueda</EmptyTitle>
            <EmptyDescription>Prueba con otro período o revisa el nombre del cliente.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Número de ventas</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Descuentos</TableHead>
                    <TableHead className="text-right">Devoluciones</TableHead>
                    <TableHead className="text-right">Antes de impuestos</TableHead>
                    <TableHead className="text-right">Impuestos</TableHead>
                    <TableHead className="text-right">Después de impuestos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((cliente) => (
                    <TableRow key={cliente.contactoId}>
                      <TableCell>
                        <Link className="font-medium hover:underline" href={rutaContacto(cliente.contactoId)}>
                          {cliente.contactoNombre}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoEntero(cliente.numeroVentas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.descuentos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.devoluciones)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.antesImpuestos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.impuestos)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatearRd(cliente.despuesImpuestos)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoEntero(totales.numeroVentas)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.subtotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.descuentos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.devoluciones)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.antesImpuestos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.impuestos)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearRd(totales.despuesImpuestos)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {paginas > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <p className="text-muted-foreground text-sm">
                Página {pagina} de {paginas} · {formatoEntero(clientes.length)} clientes
              </p>
              <div className="flex gap-2">
                {pagina > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={urlVentasCliente({ desde, hasta, q: busqueda, pagina: pagina - 1 })} />}
                  >
                    Anterior
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Anterior
                  </Button>
                )}
                {pagina < paginas ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={urlVentasCliente({ desde, hasta, q: busqueda, pagina: pagina + 1 })} />}
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Siguiente
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
