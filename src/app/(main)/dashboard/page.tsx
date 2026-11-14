import { Suspense } from "react";

import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { opcionesPeriodo, parsearPeriodo, rangoPeriodo } from "@/lib/inicio/periodo";
import { hoyRd } from "@/lib/reportes/fechas";

import { BloqueCartera, BloqueGrafico, BloqueMetricas } from "./_components/inicio/bloques";
import { EsqueletoCartera, EsqueletoGraficoInicio, EsqueletoMetricas } from "./_components/inicio/esqueletos";
import { SelectorPeriodo } from "./_components/inicio/selector-periodo";
import { AvisoSaldoNegativo } from "./reportes/_components/aviso-saldo-negativo";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl tracking-tight">Resumen del negocio</h1>
        <SelectorPeriodo periodo={periodo} opciones={opciones} />
      </div>

      <Suspense fallback={null}>
        <AvisoSaldoNegativo />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Suspense fallback={<EsqueletoCartera />}>
            <BloqueCartera desde={rango.desde} hasta={rango.hasta} />
          </Suspense>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <Suspense fallback={<EsqueletoMetricas />}>
            <BloqueMetricas desde={rango.desde} hasta={rango.hasta} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<EsqueletoGraficoInicio />}>
        <BloqueGrafico desde={rango.desde} hasta={rango.hasta} />
      </Suspense>
    </div>
  );
}
