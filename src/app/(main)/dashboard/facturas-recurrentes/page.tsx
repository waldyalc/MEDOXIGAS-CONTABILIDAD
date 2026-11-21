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
import { getPerfil } from "@/lib/auth/rol";
import { getFacturasRecurrentesLista } from "@/lib/facturas-recurrentes/consultas";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { FacturasRecurrentesTabla } from "./_components/facturas-recurrentes-tabla";

const RUTA = "/dashboard/facturas-recurrentes";

function BotonNuevaRecurrente() {
  return (
    <Button render={<Link href="/dashboard/facturas-recurrentes/nueva" />}>
      <Plus data-icon="inline-start" />
      Nueva factura recurrente
    </Button>
  );
}

async function AccionNuevaRecurrente() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");
  if (perfil.rol === "lector") return null;

  return <BotonNuevaRecurrente />;
}

async function TablaRecurrentes({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const [{ filas, resumen }, perfil] = await Promise.all([getFacturasRecurrentesLista(opciones), getPerfil()]);
  const puedeCrear = perfil?.rol != null && perfil.rol !== "lector";

  return (
    <>
      <FacturasRecurrentesTabla
        recurrentes={filas}
        busqueda={opciones.q}
        accion={puedeCrear ? <BotonNuevaRecurrente /> : undefined}
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

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Facturas recurrentes"
        subtitulo="Plantillas para clientes con contrato fijo. Genera la factura del periodo cuando toque."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Facturas recurrentes" },
        ]}
        acciones={
          <Suspense fallback={<Skeleton className="h-9 w-52" />}>
            <AccionNuevaRecurrente />
          </Suspense>
        }
      />

      <TarjetaLista data-lista="facturas-recurrentes">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número o cliente…"
            ariaLabel="Buscar facturas recurrentes"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} className="rounded-none bg-transparent ring-0" />}>
          <TablaRecurrentes opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
