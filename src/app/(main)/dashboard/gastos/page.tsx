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
import { getGastosLista } from "@/lib/gastos/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { GastosTabla } from "./_components/gastos-tabla";

const RUTA = "/dashboard/gastos";

function BotonNuevoGasto() {
  return (
    <Button render={<Link href="/dashboard/gastos/nuevo" />}>
      <Plus />
      Nuevo gasto
    </Button>
  );
}

async function AccionNuevoGasto() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");
  if (perfil.rol === "lector") return null;

  return <BotonNuevoGasto />;
}

async function TablaGastos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const [{ filas, resumen }, perfil] = await Promise.all([getGastosLista(opciones), getPerfil()]);
  const puedeCrear = perfil?.rol != null && perfil.rol !== "lector";

  return (
    <>
      <GastosTabla gastos={filas} busqueda={opciones.q} accion={puedeCrear ? <BotonNuevoGasto /> : undefined} />
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

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Gastos menores"
        subtitulo="Gastos de caja menor con su asiento contable."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Compras", href: "/dashboard/compras" },
          { etiqueta: "Gastos menores" },
        ]}
        acciones={
          <Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <AccionNuevoGasto />
          </Suspense>
        }
      />

      <TarjetaLista data-lista="gastos">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF, proveedor o descripción…"
            ariaLabel="Buscar gastos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={11} className="rounded-none bg-transparent ring-0" />}>
          <TablaGastos opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
