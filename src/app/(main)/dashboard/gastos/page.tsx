import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getGastosLista } from "@/lib/gastos/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

import { GastosTabla } from "./_components/gastos-tabla";

const RUTA = "/dashboard/gastos";

async function TablaGastos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas, resumen } = await getGastosLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <GastosTabla gastos={filas} busqueda={opciones.q} />
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
          <h1 className="text-3xl tracking-tight">Gastos menores</h1>
          <p className="text-muted-foreground text-sm">Gastos de caja menor con su asiento contable.</p>
        </div>
        {perfil.rol !== "lector" ? (
          <Button render={<Link href="/dashboard/gastos/nuevo" />}>
            <Plus />
            Nuevo gasto
          </Button>
        ) : null}
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número, NCF, proveedor o descripción…"
        ariaLabel="Buscar gastos"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={11} />}>
        <TablaGastos opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
