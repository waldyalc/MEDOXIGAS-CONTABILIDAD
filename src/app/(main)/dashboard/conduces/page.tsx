import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPerfil } from "@/lib/auth/rol";
import { getRemisionesLista } from "@/lib/conduces/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { DocumentosTabla, TEXTOS_DOCUMENTO } from "../cotizaciones/_components/documentos-tabla";

const RUTA = "/dashboard/conduces";
const TIPO = "remision" as const;

function BotonNuevoConduce() {
  const textos = TEXTOS_DOCUMENTO[TIPO];
  return (
    <Button render={<Link href={textos.rutaNueva} />}>
      <Plus />
      {textos.nueva}
    </Button>
  );
}

async function AccionNuevoConduce() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");
  if (perfil.rol === "lector") return null;

  return <BotonNuevoConduce />;
}

async function TablaDocumentos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const [{ filas, resumen }, perfil] = await Promise.all([getRemisionesLista(opciones), getPerfil()]);
  const puedeCrear = perfil?.rol != null && perfil.rol !== "lector";

  return (
    <>
      <DocumentosTabla
        tipo={TIPO}
        documentos={filas}
        busqueda={opciones.q}
        accion={puedeCrear ? <BotonNuevoConduce /> : undefined}
      />
      <PaginadorLista
        base={RUTA}
        params={params}
        resumen={resumen}
        etiqueta="Ítems por página"
        tamano={opciones.tamano}
        opciones={TAMANOS_PAGINA}
        mostrarEnVacio
        botonesExtremos={false}
        className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
      />
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const textos = TEXTOS_DOCUMENTO[TIPO];

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">{textos.titulo}</h1>
          <p className="text-muted-foreground text-sm">{textos.descripcion}</p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-36" />}>
          <AccionNuevoConduce />
        </Suspense>
      </div>

      <TarjetaLista data-lista="conduces">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número o cliente…"
            ariaLabel="Buscar conduces"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={5} className="rounded-none bg-transparent ring-0" />}>
          <TablaDocumentos opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
