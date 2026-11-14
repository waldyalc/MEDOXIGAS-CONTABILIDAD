import { Skeleton } from "@/components/ui/skeleton";

import { EsqueletoCartera, EsqueletoGraficoInicio, EsqueletoMetricas } from "./_components/inicio/esqueletos";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl tracking-tight">Resumen del negocio</h1>
        <Skeleton className="h-11 w-56" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <EsqueletoCartera />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <EsqueletoMetricas />
        </div>
      </div>

      <EsqueletoGraficoInicio />
    </div>
  );
}
