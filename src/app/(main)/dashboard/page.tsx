import { Suspense } from "react";

import { redirect } from "next/navigation";

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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] pt-6">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Resumen del negocio</h1>
        <SelectorPeriodo periodo={periodo} opciones={opciones} />
      </div>

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:auto-rows-[124px] lg:grid-cols-[1.55fr_1.55fr_1fr_1fr]">
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
