import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getFacturasRecurrentesLista } from "@/lib/facturas-recurrentes/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

import { FacturasRecurrentesTabla } from "./_components/facturas-recurrentes-tabla";

const RUTA = "/dashboard/facturas-recurrentes";

async function TablaRecurrentes({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas, resumen } = await getFacturasRecurrentesLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <FacturasRecurrentesTabla recurrentes={filas} busqueda={opciones.q} />
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Facturas recurrentes</h1>
          <p className="text-muted-foreground text-sm">
            Plantillas para clientes con contrato fijo. Genera la factura del periodo cuando toque.
          </p>
        </div>
        {perfil.rol !== "lector" ? (
          <Button render={<Link href="/dashboard/facturas-recurrentes/nueva" />}>
            <Plus data-icon="inline-start" />
            Nueva factura recurrente
          </Button>
        ) : null}
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número o cliente…"
        ariaLabel="Buscar facturas recurrentes"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} />}>
        <TablaRecurrentes opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
