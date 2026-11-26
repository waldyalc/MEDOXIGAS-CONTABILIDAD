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
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { getPagosLista } from "@/lib/pagos/consultas";

import { PagosTabla } from "./_components/pagos-tabla";

const RUTA = "/dashboard/pagos-recibidos";

function BotonNuevoPago() {
  return (
    <Button render={<Link href="/dashboard/pagos-recibidos/nuevo" />}>
      <Plus />
      Nuevo pago
    </Button>
  );
}

async function AccionNuevoPago() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");
  if (perfil.rol === "lector") return null;

  return <BotonNuevoPago />;
}

async function TablaPagos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const [lista, perfil] = await Promise.all([getPagosLista(opciones), getPerfil()]);
  const puedeCrear = perfil?.rol != null && perfil.rol !== "lector";

  return (
    <>
      <PagosTabla pagos={lista.filas} busqueda={opciones.q} accion={puedeCrear ? <BotonNuevoPago /> : undefined} />
      <PaginadorLista
        base={RUTA}
        params={params}
        resumen={lista.resumen}
        etiqueta="Ítems por página"
        tamano={opciones.tamano}
        opciones={TAMANOS_PAGINA}
        mostrarEnVacio
        botonesExtremos={false}
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
      <EncabezadoPagina
        titulo="Pagos recibidos"
        subtitulo="Cobros aplicados a facturas de venta."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Ingresos" }, { etiqueta: "Pagos recibidos" }]}
        acciones={
          <Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <AccionNuevoPago />
          </Suspense>
        }
      />

      <TarjetaLista data-lista="pagos-recibidos">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, cliente o factura…"
            ariaLabel="Buscar pagos recibidos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} className="rounded-none bg-transparent ring-0" />}>
          <TablaPagos opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
