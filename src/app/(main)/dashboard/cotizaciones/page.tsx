import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPerfil } from "@/lib/auth/rol";
import { getDocumentosLista } from "@/lib/cotizaciones/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { DocumentosTabla, TEXTOS_DOCUMENTO } from "./_components/documentos-tabla";

const RUTA = "/dashboard/cotizaciones";
const TIPO = "cotizacion" as const;

function BotonNuevaCotizacion() {
  const textos = TEXTOS_DOCUMENTO[TIPO];
  return (
    <Button render={<Link href={textos.rutaNueva} />}>
      <Plus />
      {textos.nueva}
    </Button>
  );
}

async function AccionNuevaCotizacion() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");
  if (perfil.rol === "lector") return null;

  return <BotonNuevaCotizacion />;
}

async function TablaDocumentos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const [{ filas, resumen }, perfil] = await Promise.all([getDocumentosLista(TIPO, opciones), getPerfil()]);
  const puedeCrear = perfil?.rol != null && perfil.rol !== "lector";

  return (
    <>
      <DocumentosTabla
        tipo={TIPO}
        documentos={filas}
        busqueda={opciones.q}
        accion={puedeCrear ? <BotonNuevaCotizacion /> : undefined}
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
      <EncabezadoPagina
        titulo={textos.titulo}
        subtitulo={textos.descripcion}
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Ingresos" }, { etiqueta: textos.titulo }]}
        acciones={
          <Suspense fallback={<Skeleton className="h-9 w-40" />}>
            <AccionNuevaCotizacion />
          </Suspense>
        }
      />

      <TarjetaLista data-lista="cotizaciones">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número o cliente…"
            ariaLabel="Buscar cotizaciones"
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
