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
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { getNotasDebitoLista } from "@/lib/notas-debito/consultas";

import { NotasDebitoTabla } from "./_components/notas-debito-tabla";

const RUTA = "/dashboard/notas-debito";

function BotonNuevaNota() {
  return (
    <Button render={<Link href="/dashboard/notas-debito/nueva" />}>
      <Plus />
      Nueva nota de débito
    </Button>
  );
}

async function AccionNuevaNota() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");
  if (perfil.rol === "lector") return null;

  return <BotonNuevaNota />;
}

async function TablaNotas({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: notas, resumen } = await getNotasDebitoLista(opciones);

  return (
    <>
      <NotasDebitoTabla notas={notas} busqueda={opciones.q} />
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
  const [perfil, params] = await Promise.all([getPerfil(), searchParams]);
  if (perfil?.rol == null) redirect("/unauthorized");

  const opciones = leerOpcionesLista(params);

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Notas de débito</h1>
          <p className="text-muted-foreground text-sm">Cargos sobre facturas de venta (NCF B03).</p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-44" />}>
          <AccionNuevaNota />
        </Suspense>
      </div>

      <TarjetaLista data-lista="notas-debito">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF, factura o cliente…"
            ariaLabel="Buscar notas de débito"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={8} className="rounded-none bg-transparent ring-0" />}>
          <TablaNotas opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
