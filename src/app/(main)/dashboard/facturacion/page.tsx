import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRol } from "@/lib/auth/rol";
import { getFacturasLista } from "@/lib/facturacion/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";

import { FacturasTabla } from "./_components/facturas-tabla";

const RUTA = "/dashboard/facturacion";

async function AccionNuevaFactura() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");
  if (rol === "lector") return null;

  return (
    <Button render={<Link href="/dashboard/facturacion/nueva" />}>
      <Plus />
      Nueva factura
    </Button>
  );
}

async function TablaFacturas({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: facturas, resumen } = await getFacturasLista(opciones);

  return (
    <>
      <FacturasTabla facturas={facturas} busqueda={opciones.q} />
      <PaginadorLista base={RUTA} params={params} resumen={resumen} className="border-t px-4 py-2" />
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Facturas de venta</h1>
          <p className="text-muted-foreground text-sm">Con comprobante fiscal (NCF).</p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-36" />}>
          <AccionNuevaFactura />
        </Suspense>
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="flex h-12 items-center gap-2 border-b px-3">
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF o cliente…"
            ariaLabel="Buscar facturas"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </div>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={9} className="rounded-none ring-0" />}>
          <TablaFacturas opciones={opciones} params={params} />
        </Suspense>
      </div>
    </div>
  );
}
