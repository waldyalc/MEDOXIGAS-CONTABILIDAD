import { Suspense } from "react";

import { redirect } from "next/navigation";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { opcionesPeriodo, parsearPeriodo, rangoPeriodo } from "@/lib/inicio/periodo";
import { hoyRd } from "@/lib/reportes/fechas";

import { BloqueCartera, BloqueGrafico, BloqueMetricas } from "./_components/inicio/bloques";
import { EsqueletoCartera, EsqueletoGraficoInicio, EsqueletoMetricas } from "./_components/inicio/esqueletos";
import { SelectorPeriodo } from "./_components/inicio/selector-periodo";

interface Props {
  searchParams: Promise<{ periodo?: string | string[] }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const hoy = hoyRd();
  const periodo = parsearPeriodo(params.periodo);
  const rango = rangoPeriodo(periodo, hoy);
  const opciones = opcionesPeriodo(hoy);

  return (
    <div className="mx-auto flex w-full max-w-[970px] flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Resumen del negocio</h1>
        <div className="flex flex-wrap items-center gap-4">
          <SelectorPeriodo periodo={periodo} opciones={opciones} />
          {/* TODO backend: habilitar cuando se puedan agregar más gráficas al resumen. */}
          <Button variant="default" className="h-10 gap-2 rounded-[10px] px-4" disabled title="Próximamente">
            Agregar gráfica
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Suspense fallback={<EsqueletoCartera />}>
          <BloqueCartera desde={rango.desde} hasta={rango.hasta} />
        </Suspense>

        <Suspense fallback={<EsqueletoMetricas />}>
          <BloqueMetricas desde={rango.desde} hasta={rango.hasta} />
        </Suspense>
      </div>

      <Suspense fallback={<EsqueletoGraficoInicio />}>
        <BloqueGrafico desde={rango.desde} hasta={rango.hasta} />
      </Suspense>
    </div>
  );
}
