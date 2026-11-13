import Link from "next/link";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import { ALMACEN_PRINCIPAL } from "@/lib/reportes/ventas/v1/calculos";
import { urlVentas } from "@/lib/reportes/ventas/v1/filtros";
import type { FiltrosVentasUrl, PaginaVentas, VentaCalculada } from "@/lib/reportes/ventas/v1/tipos";

const POR_PAGINA = 10;

interface Props {
  ruta: string;
  desde: string;
  hasta: string;
  filtros: FiltrosVentasUrl;
  pagina: PaginaVentas;
  porAlmacen?: boolean;
}

function EstadoVenta({ venta }: { venta: VentaCalculada }) {
  if (venta.estado === "anulada") return <Badge variant="destructive">{venta.estadoEtiqueta}</Badge>;
  if (venta.estado === "pagada")
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {venta.estadoEtiqueta}
      </Badge>
    );
  return <Badge>{venta.estadoEtiqueta}</Badge>;
}

function FilaVenta({ venta, porAlmacen }: { venta: VentaCalculada; porAlmacen: boolean }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="font-medium hover:underline" href={rutaFactura(venta.id)}>
          {venta.ncf}
        </Link>
      </TableCell>
      <TableCell>
        <Link className="hover:underline" href={rutaContacto(venta.contactoId)}>
          {venta.clienteNombre}
        </Link>
      </TableCell>
      <TableCell>
        <EstadoVenta venta={venta} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatoDia(venta.fecha)}</TableCell>
      {porAlmacen ? (
        <>
          <TableCell>{ALMACEN_PRINCIPAL}</TableCell>
          <TableCell className="text-muted-foreground">—</TableCell>
        </>
      ) : null}
      <TableCell className="text-right tabular-nums">{formatearRd(venta.subtotal)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(venta.descuento)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(venta.antesImpuestos)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(venta.impuestos)}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatearRd(venta.despuesImpuestos)}</TableCell>
    </TableRow>
  );
}

export function TablaVentas({ ruta, desde, hasta, filtros, pagina, porAlmacen = false }: Props) {
  const encabezados = [
    { titulo: "Documento" },
    { titulo: "Cliente" },
    { titulo: "Estado" },
    { titulo: "Creación" },
    ...(porAlmacen ? [{ titulo: "Almacén" }, { titulo: "Centro de costos" }] : []),
    { titulo: "Subtotal", numerica: true },
    { titulo: "Descuento", numerica: true },
    { titulo: "Antes de impuestos", numerica: true },
    { titulo: "Impuestos", numerica: true },
    { titulo: "Después de impuestos", numerica: true },
  ];

  if (pagina.totalFilas === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCart />
          </EmptyMedia>
          <EmptyTitle>Sin ventas</EmptyTitle>
          <EmptyDescription>No hay facturas que coincidan con los filtros del período.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hrefAnterior = urlVentas(ruta, { desde, hasta, ...filtros, pagina: pagina.pagina - 1 });
  const hrefSiguiente = urlVentas(ruta, { desde, hasta, ...filtros, pagina: pagina.pagina + 1 });
  const inicio = (pagina.pagina - 1) * POR_PAGINA + 1;
  const fin = inicio + pagina.filas.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <Card className="py-0">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {encabezados.map((encabezado) => (
                  <TableHead
                    key={encabezado.titulo}
                    className={cn("whitespace-nowrap", encabezado.numerica && "text-right")}
                  >
                    {encabezado.titulo}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagina.filas.map((venta) => (
                <FilaVenta key={venta.id} venta={venta} porAlmacen={porAlmacen} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Mostrando {inicio}–{fin} de {pagina.totalFilas}
        </p>
        <div className="flex items-center gap-2">
          {pagina.pagina > 1 ? (
            <Button variant="outline" size="sm" render={<Link href={hrefAnterior} />}>
              <ChevronLeft />
              Anterior
            </Button>
          ) : null}
          <span className="text-muted-foreground text-sm">
            Página {pagina.pagina} de {pagina.totalPaginas}
          </span>
          {pagina.pagina < pagina.totalPaginas ? (
            <Button variant="outline" size="sm" render={<Link href={hrefSiguiente} />}>
              Siguiente
              <ChevronRight />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
