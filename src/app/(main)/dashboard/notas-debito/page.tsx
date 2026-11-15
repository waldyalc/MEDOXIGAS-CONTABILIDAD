import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";
import { getNotasDebitoLista } from "@/lib/notas-debito/consultas";

import { NotasDebitoTabla } from "./_components/notas-debito-tabla";

const RUTA = "/dashboard/notas-debito";

async function TablaNotas({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: notas, resumen } = await getNotasDebitoLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <NotasDebitoTabla notas={notas} busqueda={opciones.q} />
      <PaginadorLista base={RUTA} params={params} resumen={resumen} />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const [perfil, params] = await Promise.all([getPerfil(), searchParams]);
  if (perfil?.rol == null) redirect("/unauthorized");

  const opciones = leerOpcionesLista(params);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Notas de débito</h1>
          <p className="text-muted-foreground text-sm">Cargos sobre facturas de venta (NCF B03).</p>
        </div>
        {perfil.rol !== "lector" ? (
          <Button render={<Link href="/dashboard/notas-debito/nueva" />}>
            <Plus data-icon="inline-start" />
            Nueva nota de débito
          </Button>
        ) : null}
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número, NCF, factura o cliente…"
        ariaLabel="Buscar notas de débito"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={8} />}>
        <TablaNotas opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
