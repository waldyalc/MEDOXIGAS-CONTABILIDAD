import { Suspense } from "react";

import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { opcionesPeriodo, parsearPeriodo, rangoPeriodo } from "@/lib/inicio/periodo";
import { hoyRd } from "@/lib/reportes/fechas";

import { AgregarGrafica } from "./_components/inicio/agregar-grafica";
import {
  BloqueBancos,
  BloqueCartera,
  BloqueFlujo,
  BloqueGastos,
  BloqueGrafico,
  BloqueMetricas,
  BloqueTopClientes,
  BloqueTopProductos,
} from "./_components/inicio/bloques";
import {
  EsqueletoCartera,
  EsqueletoGraficoInicio,
  EsqueletoMetricas,
  EsqueletoTablaWidget,
  EsqueletoWidgetAncho,
} from "./_components/inicio/esqueletos";
import { SelectorPeriodo } from "./_components/inicio/selector-periodo";
import { ProveedorWidgets } from "./_components/inicio/widgets";

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
    <ProveedorWidgets>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Resumen del negocio</h1>
          <div className="flex items-center gap-2">
            <SelectorPeriodo periodo={periodo} opciones={opciones} />
            <AgregarGrafica />
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[3fr_3fr_4fr]">
          <Suspense fallback={<EsqueletoCartera />}>
            <BloqueCartera desde={rango.desde} hasta={rango.hasta} />
          </Suspense>

          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:col-span-2 xl:col-span-1">
            <Suspense fallback={<EsqueletoMetricas />}>
              <BloqueMetricas desde={rango.desde} hasta={rango.hasta} />
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<EsqueletoGraficoInicio />}>
          <BloqueGrafico desde={rango.desde} hasta={rango.hasta} />
        </Suspense>

        <Suspense fallback={<EsqueletoWidgetAncho />}>
          <BloqueGastos desde={rango.desde} hasta={rango.hasta} />
        </Suspense>

        <Suspense fallback={<EsqueletoWidgetAncho />}>
          <BloqueFlujo desde={rango.desde} hasta={rango.hasta} />
        </Suspense>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Suspense fallback={<EsqueletoTablaWidget />}>
            <BloqueTopProductos desde={rango.desde} hasta={rango.hasta} />
          </Suspense>
          <Suspense fallback={<EsqueletoTablaWidget />}>
            <BloqueTopClientes desde={rango.desde} hasta={rango.hasta} />
          </Suspense>
          <Suspense fallback={<EsqueletoTablaWidget />}>
            <BloqueBancos />
          </Suspense>
        </section>
      </div>
    </ProveedorWidgets>
  );
}
