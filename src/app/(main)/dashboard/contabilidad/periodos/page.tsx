import Link from "next/link";
import { redirect } from "next/navigation";

import { ChevronLeft, ChevronRight } from "@/components/icons";
import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosPeriodos } from "@/lib/periodos/consultas";

import { PanelPeriodos } from "./_components/panel-periodos";

interface Props {
  searchParams: Promise<{ anio?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const solicitado = Number(params.anio);
  const datos = await getDatosPeriodos(Number.isInteger(solicitado) ? solicitado : datosAnioActual());

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Periodos contables"
        subtitulo="Cierra un mes para bloquear asientos con esa fecha y reábrelo si necesitas corregir."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Periodos contables" },
        ]}
        acciones={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" render={<Link href={`?anio=${datos.anio - 1}`} />}>
              <ChevronLeft />
              <span className="sr-only">Año anterior</span>
            </Button>
            <span className="w-14 text-center text-lg font-semibold tabular-nums">{datos.anio}</span>
            <Button variant="outline" size="icon-sm" render={<Link href={`?anio=${datos.anio + 1}`} />}>
              <ChevronRight />
              <span className="sr-only">Año siguiente</span>
            </Button>
            {datos.anio !== datos.anioActual ? (
              <Button variant="ghost" size="sm" render={<Link href={`?anio=${datos.anioActual}`} />}>
                Año actual
              </Button>
            ) : null}
          </div>
        }
      />

      <PanelPeriodos datos={datos} puedeEscribir={perfil.rol !== "lector"} />
    </ContenedorLista>
  );
}

function datosAnioActual() {
  return Number(hoyRD().slice(0, 4));
}
