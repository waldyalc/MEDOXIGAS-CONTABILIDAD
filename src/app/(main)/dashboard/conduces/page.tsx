import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getRemisionesLista } from "@/lib/conduces/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

import { DocumentosTabla, TEXTOS_DOCUMENTO } from "../cotizaciones/_components/documentos-tabla";

const RUTA = "/dashboard/conduces";
const TIPO = "remision" as const;

async function TablaDocumentos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas, resumen } = await getRemisionesLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <DocumentosTabla tipo={TIPO} documentos={filas} busqueda={opciones.q} />
      <PaginadorLista base={RUTA} params={params} resumen={resumen} />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const textos = TEXTOS_DOCUMENTO[TIPO];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">{textos.titulo}</h1>
          <p className="text-muted-foreground text-sm">{textos.descripcion}</p>
        </div>
        {perfil.rol !== "lector" ? (
          <Button render={<Link href={textos.rutaNueva} />}>
            <Plus />
            {textos.nueva}
          </Button>
        ) : null}
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número o cliente…"
        ariaLabel="Buscar conduces"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={5} />}>
        <TablaDocumentos opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
