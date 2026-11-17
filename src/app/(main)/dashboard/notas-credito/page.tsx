import { Suspense } from "react";

import { redirect } from "next/navigation";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { getPerfil } from "@/lib/auth/rol";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { getNotasCreditoLista } from "@/lib/notas-credito/consultas";

import { NotasCreditoTabla } from "./_components/notas-credito-tabla";

const RUTA = "/dashboard/notas-credito";

async function TablaNotas({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: notas, resumen } = await getNotasCreditoLista(opciones);

  return (
    <>
      <NotasCreditoTabla notas={notas} busqueda={opciones.q} />
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
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Notas de crédito</h1>
        <p className="text-muted-foreground text-sm">Devoluciones y créditos sobre facturas de venta (NCF B04).</p>
      </div>

      <TarjetaLista data-lista="notas-credito">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF, factura o cliente…"
            ariaLabel="Buscar notas de crédito"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} className="rounded-none bg-transparent ring-0" />}>
          <TablaNotas opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
