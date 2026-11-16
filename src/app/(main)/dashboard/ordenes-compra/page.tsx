import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto, rutaOrdenCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";
import { listarOrdenesCompra } from "@/lib/ordenes-compra/consultas";

import { EstadoOrdenBadge } from "./_components/estado-orden-badge";

const RUTA = "/dashboard/ordenes-compra";

async function TablaOrdenes({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: ordenes, resumen } = await listarOrdenesCompra(opciones);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Factura de proveedor</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    {opciones.q
                      ? "No se encontraron órdenes de compra con esa búsqueda."
                      : "No hay órdenes de compra registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                ordenes.map((orden) => (
                  <TableRow key={orden.id}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Enlace href={rutaOrdenCompra(orden.id)}>#{orden.numero}</Enlace>
                    </TableCell>
                    <TableCell>
                      <Enlace href={rutaContacto(orden.contacto_id)}>{orden.contacto_nombre}</Enlace>
                    </TableCell>
                    <TableCell>{formatoDia(orden.fecha)}</TableCell>
                    <TableCell>{formatoDia(orden.fecha_entrega)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(orden.total)}</TableCell>
                    <TableCell>
                      {orden.factura_proveedor_id ? (
                        <Enlace href={rutaCompra(orden.factura_proveedor_id)}>Ver factura</Enlace>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <EstadoOrdenBadge estado={orden.estado} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginadorLista base={RUTA} params={params} resumen={resumen} />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Órdenes de compra</h1>
          <p className="text-muted-foreground text-sm">
            Documentos de control para el proveedor. No mueven inventario ni generan asiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/ordenes-compra/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva orden
            </Button>
          ) : null}
        </div>
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número o proveedor…"
        ariaLabel="Buscar órdenes de compra"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} />}>
        <TablaOrdenes opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
