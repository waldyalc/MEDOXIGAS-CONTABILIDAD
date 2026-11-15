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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { listarFacturasProveedor } from "@/lib/compras/consultas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

import { EstadoBadge } from "./_components/estado-badge";

const RUTA = "/dashboard/compras";

async function AccionesCompra() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" render={<Link href="/dashboard/compras/pagos" />}>
        Pagos a proveedores
      </Button>
      <Button variant="outline" render={<Link href="/dashboard/compras/notas-credito" />}>
        Notas de crédito
      </Button>
      {rol !== "lector" ? (
        <Button render={<Link href="/dashboard/compras/nueva" />}>
          <Plus data-icon="inline-start" />
          Nueva factura de proveedor
        </Button>
      ) : null}
    </div>
  );
}

async function TablaCompras({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: facturas, resumen } = await listarFacturasProveedor(opciones);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>No. / NCF</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Por pagar</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
                    {opciones.q
                      ? "No se encontraron compras con esa búsqueda."
                      : "No hay facturas de proveedor registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((factura) => {
                  const total = aNumero(factura.total);
                  const pagado = aNumero(factura.pagado);
                  const credito = aNumero(factura.credito);
                  const retenido = aNumero(factura.retenido);

                  return (
                    <TableRow key={factura.id}>
                      <TableCell className="pl-(--card-spacing) font-medium">
                        <Enlace href={rutaCompra(factura.id)}>#{factura.numero}</Enlace>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {factura.ncf ? <Enlace href={rutaCompra(factura.id)}>{factura.ncf}</Enlace> : "—"}
                      </TableCell>
                      <TableCell>
                        {factura.contactos ? (
                          <Enlace href={rutaContacto(factura.contacto_id)}>{factura.contactos.nombre}</Enlace>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatoDia(factura.fecha)}</TableCell>
                      <TableCell>{formatoDia(factura.vencimiento)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(pagado)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoMoneda(total - pagado - credito - retenido)}
                      </TableCell>
                      <TableCell className="pr-(--card-spacing)">
                        <EstadoBadge estado={factura.estado} />
                      </TableCell>
                    </TableRow>
                  );
                })
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-muted-foreground text-sm">Facturas de proveedores, cuentas por pagar y sus pagos.</p>
        </div>
        <Suspense
          fallback={
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-52" />
            </div>
          }
        >
          <AccionesCompra />
        </Suspense>
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número, NCF o proveedor…"
        ariaLabel="Buscar compras"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={9} />}>
        <TablaCompras opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
