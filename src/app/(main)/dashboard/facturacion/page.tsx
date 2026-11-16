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
import { getRol } from "@/lib/auth/rol";
import { getFacturasLista } from "@/lib/facturacion/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { FacturasTabla } from "./_components/facturas-tabla";

const RUTA = "/dashboard/facturacion";

function BotonNuevaFactura() {
  return (
    <Button render={<Link href="/dashboard/facturacion/nueva" />}>
      <Plus />
      Nueva factura
    </Button>
  );
}

async function AccionNuevaFactura() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");
  if (rol === "lector") return null;

  return <BotonNuevaFactura />;
}

async function TablaFacturas({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const [lista, rol] = await Promise.all([getFacturasLista(opciones), getRol()]);
  const puedeCrear = rol !== null && rol !== "lector";

  return (
    <>
      <FacturasTabla
        facturas={lista.filas}
        busqueda={opciones.q}
        accion={puedeCrear ? <BotonNuevaFactura /> : undefined}
      />
      <PaginadorLista
        base={RUTA}
        params={params}
        resumen={lista.resumen}
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

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Facturas de venta</h1>
          <p className="text-muted-foreground text-sm">Con comprobante fiscal (NCF).</p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-36" />}>
          <AccionNuevaFactura />
        </Suspense>
      </div>

      <TarjetaLista data-lista="facturas">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF o cliente…"
            ariaLabel="Buscar facturas"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={9} className="rounded-none bg-transparent ring-0" />}>
          <TablaFacturas opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
