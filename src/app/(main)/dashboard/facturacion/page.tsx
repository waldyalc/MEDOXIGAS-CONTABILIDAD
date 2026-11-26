import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Plus } from "@/components/icons";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRol } from "@/lib/auth/rol";
import type { OpcionesFacturasLista } from "@/lib/facturacion/consultas";
import { getFacturasLista, getResumenEmisionFacturas } from "@/lib/facturacion/consultas";
import { normalizarFiltroEmision } from "@/lib/facturacion/emision-ecf";
import { leerOpcionesLista, leerTexto, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { FacturasTabla } from "./_components/facturas-tabla";
import { TarjetasEmision } from "./_components/tarjetas-emision";

const RUTA = "/dashboard/facturacion";

async function TarjetasEmisionContadas({
  params,
  activa,
}: {
  params: ParametrosLista;
  activa?: "sin_emision" | "en_proceso";
}) {
  const resumen = await getResumenEmisionFacturas();
  return (
    <TarjetasEmision params={params} activa={activa} sinEmision={resumen.sinEmision} enProceso={resumen.enProceso} />
  );
}

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
  readonly opciones: OpcionesFacturasLista;
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
  const opciones = { ...leerOpcionesLista(params), emision: normalizarFiltroEmision(leerTexto(params, "emision")) };

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Facturas de venta"
        subtitulo="Con comprobante fiscal (NCF)."
        migas={[{ etiqueta: "Facturación" }, { etiqueta: "Facturas" }]}
        acciones={
          <Suspense fallback={<Skeleton className="h-9 w-36" />}>
            <AccionNuevaFactura />
          </Suspense>
        }
      />

      <Suspense
        fallback={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-[68px] w-full rounded-2xl sm:w-[250px]" />
            <Skeleton className="h-[68px] w-full rounded-2xl sm:w-[250px]" />
          </div>
        }
      >
        <TarjetasEmisionContadas params={params} activa={opciones.emision} />
      </Suspense>

      <TarjetaLista data-lista="facturas">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por NCF o cliente…"
            ariaLabel="Buscar facturas"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={8} className="rounded-none bg-transparent ring-0" />}>
          <TablaFacturas opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
