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
import { getPagosLista } from "@/lib/pagos/consultas";

import { PagosTabla } from "./_components/pagos-tabla";

const RUTA = "/dashboard/pagos-recibidos";

async function TablaPagos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: pagos, resumen } = await getPagosLista(opciones);

  return (
    <div className="flex flex-col gap-3">
      <PagosTabla pagos={pagos} busqueda={opciones.q} />
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Pagos recibidos</h1>
          <p className="text-muted-foreground text-sm">Cobros aplicados a facturas de venta.</p>
        </div>
        {perfil.rol !== "lector" ? (
          <Button render={<Link href="/dashboard/pagos-recibidos/nuevo" />}>
            <Plus />
            Nuevo pago
          </Button>
        ) : null}
      </div>

      <BuscadorLista
        base={RUTA}
        parametros={params}
        valorInicial={opciones.q}
        placeholder="Buscar por número, cliente o factura…"
        ariaLabel="Buscar pagos recibidos"
      />

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} />}>
        <TablaPagos opciones={opciones} params={params} />
      </Suspense>
    </div>
  );
}
