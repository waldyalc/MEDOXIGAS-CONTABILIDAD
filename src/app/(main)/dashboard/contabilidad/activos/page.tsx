import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus, Truck } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActivosLista } from "@/lib/activos-fijos/consultas";
import { ETIQUETAS_TIPO_ACTIVO, type TipoActivo } from "@/lib/activos-fijos/tipos";
import { getPerfil } from "@/lib/auth/rol";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const RUTA = "/dashboard/contabilidad/activos";

async function TablaActivos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: activos, resumen } = await getActivosLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead>Adquisición</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
              <TableHead className="text-right">Depreciado</TableHead>
              <TableHead className="text-right">Valor actual</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Truck />
                      </EmptyMedia>
                      <EmptyTitle>{opciones.q ? "Sin resultados" : "Sin activos fijos"}</EmptyTitle>
                      <EmptyDescription>
                        {opciones.q
                          ? "No se encontraron activos con esa búsqueda."
                          : "Registra un vehículo, equipo o inmueble para empezar a depreciarlo."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              activos.map((activo) => {
                const montoCentavos = centavos(activo.monto_total);
                const residualCentavos = centavos(activo.valor_residual);
                const depreciadoCentavos = centavos(activo.depreciado);
                const valorActualCentavos = montoCentavos - depreciadoCentavos;
                const totalizado = depreciadoCentavos >= montoCentavos - residualCentavos;
                const tipo = ETIQUETAS_TIPO_ACTIVO[activo.tipo_activo as TipoActivo] ?? activo.tipo_activo;

                return (
                  <TableRow key={activo.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/dashboard/contabilidad/activos/${activo.id}`}>
                        {activo.nombre}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {tipo}
                        {activo.referencia ? ` · ${activo.referencia}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>{formatoDia(activo.fecha_adquisicion)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(montoCentavos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(depreciadoCentavos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(valorActualCentavos)}</TableCell>
                    <TableCell>
                      {totalizado ? (
                        <Badge variant="secondary">Totalmente depreciado</Badge>
                      ) : (
                        <Badge variant="outline">En curso</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PaginadorLista base={RUTA} params={params} resumen={resumen} />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Activos fijos</h1>
          <p className="text-muted-foreground text-sm">
            Bienes de la empresa, su valor actual y la depreciación mes a mes.
          </p>
        </div>
        {perfil.rol !== "lector" ? (
          <Button render={<Link href="/dashboard/contabilidad/activos/nuevo" />}>
            <Plus />
            Nuevo activo
          </Button>
        ) : null}
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por nombre o referencia…"
        ariaLabel="Buscar activos fijos"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={6} />}>
        <TablaActivos opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
