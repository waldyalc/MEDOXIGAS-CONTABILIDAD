import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { formatoMoneda } from "@/lib/compras/formato";
import { getNotasCreditoCompraLista } from "@/lib/compras/notas-credito/consultas";
import { rutaCompra, rutaContacto, rutaNotaCreditoCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

const RUTA = "/dashboard/compras/notas-credito";

function EstadoBadge({ estado }: { estado: "activa" | "anulada" }) {
  if (estado === "anulada") return <Badge variant="destructive">Anulada</Badge>;
  return <Badge variant="secondary">Activa</Badge>;
}

async function TablaNotas({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: notas, resumen } = await getNotasCreditoCompraLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>NCF</TableHead>
                <TableHead>Factura de proveedor</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                    {opciones.q
                      ? "No se encontraron notas de crédito con esa búsqueda."
                      : "No hay notas de crédito en compras registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Enlace href={rutaNotaCreditoCompra(nota.id)}>#{nota.numero}</Enlace>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {nota.ncf ? <Enlace href={rutaNotaCreditoCompra(nota.id)}>{nota.ncf}</Enlace> : "—"}
                    </TableCell>
                    <TableCell>
                      <Enlace href={rutaCompra(nota.factura_proveedor_id)}>
                        #{nota.factura_numero}
                        {nota.factura_ncf ? ` — ${nota.factura_ncf}` : ""}
                      </Enlace>
                    </TableCell>
                    <TableCell>
                      <Enlace href={rutaContacto(nota.contacto_id)}>{nota.proveedor_nombre}</Enlace>
                    </TableCell>
                    <TableCell>{formatoDia(nota.fecha)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(nota.total)}</TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <EstadoBadge estado={nota.estado} />
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
          <h1 className="text-2xl font-semibold tracking-tight">Notas de crédito en compras</h1>
          <p className="text-muted-foreground text-sm">
            Devoluciones a proveedores ligadas a una factura de proveedor (NCF del proveedor, B04).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/compras/notas-credito/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva nota de crédito
            </Button>
          ) : null}
        </div>
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número, NCF o proveedor…"
        ariaLabel="Buscar notas de crédito de compras"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} />}>
        <TablaNotas opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
