import Link from "next/link";
import { redirect } from "next/navigation";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { ContenedorLista } from "@/components/listas/tabla-lista";
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Periodos contables</h1>
          <p className="text-muted-foreground text-sm">
            Cierra un mes para bloquear asientos con esa fecha y reábrelo si necesitas corregir.
          </p>
        </div>
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
      </div>

      <PanelPeriodos datos={datos} puedeEscribir={perfil.rol !== "lector"} />
    </ContenedorLista>
  );
}

function datosAnioActual() {
  return Number(hoyRD().slice(0, 4));
}
