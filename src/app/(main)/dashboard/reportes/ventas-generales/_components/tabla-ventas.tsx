import Link from "next/link";

import { cn } from "cn";

import { ShoppingCart } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { resumirPagina, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { formatearRd } from "@/lib/reportes/dinero";
import type { ParametrosFecha } from "@/lib/reportes/fechas";
import { ALMACEN_PRINCIPAL } from "@/lib/reportes/ventas/v1/calculos";
import type { PaginaVentas, VentaCalculada } from "@/lib/reportes/ventas/v1/tipos";

interface Props {
  ruta: string;
  params: ParametrosFecha;
  pagina: PaginaVentas;
  tamano: number;
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
    <FilaNavegable href={rutaFactura(venta.id)}>
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
    </FilaNavegable>
  );
}

export function TablaVentas({ ruta, params, pagina, tamano, porAlmacen = false }: Props) {
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

  const resumenPagina = resumirPagina(pagina.pagina, tamano, pagina.totalFilas);

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
        </div>
        <PaginadorLista
          base={ruta}
          params={params}
          resumen={resumenPagina}
          tamano={tamano}
          opciones={TAMANOS_PAGINA}
          className="print:hidden"
        />
      </CardContent>
    </Card>
  );
}
