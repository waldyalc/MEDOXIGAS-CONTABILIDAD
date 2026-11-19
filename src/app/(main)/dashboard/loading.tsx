import { Skeleton } from "@/components/ui/skeleton";

import { EsqueletoCartera, EsqueletoGraficoInicio, EsqueletoMetricas } from "./_components/inicio/esqueletos";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[970px] flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Resumen del negocio</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-10 w-40 rounded-[10px]" />
          <Skeleton className="h-10 w-36 rounded-[10px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EsqueletoCartera />
        <EsqueletoMetricas />
      </div>

      <EsqueletoGraficoInicio />
    </div>
  );
}
