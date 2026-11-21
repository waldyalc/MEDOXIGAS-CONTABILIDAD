import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function EsqueletoDetalleCartera() {
  return (
    <div className="border-border/60 flex flex-col gap-1 border-l-4 pl-3">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function EsqueletoCartera() {
  return (
    <>
      {[0, 1].map((indice) => (
        <Card key={indice} className="ring-border h-full gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
          <CardHeader className="gap-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-36" />
          </CardHeader>
          <CardContent className="mt-5 flex flex-col gap-4">
            <Skeleton className="h-2 w-full rounded-[2px]" />
            <div className="grid grid-cols-2 gap-4">
              <EsqueletoDetalleCartera />
              <EsqueletoDetalleCartera />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export function EsqueletoMetricas() {
  return (
    <>
      {[0, 1, 2, 3].map((indice) => (
        <Card key={indice} className="ring-border h-full gap-0 rounded-2xl">
          <CardHeader className="gap-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-6 w-24" />
          </CardHeader>
        </Card>
      ))}
    </>
  );
}

export function EsqueletoGraficoInicio() {
  return (
    <Card className="ring-border gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-10" />
        </div>
      </CardHeader>
      <CardContent className="pb-0">
        <Skeleton className="h-[260px] w-full rounded-lg" />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Esqueleto de los widgets anchos de la segunda sección (gastos y flujo). */
export function EsqueletoWidgetAncho() {
  return (
    <Card className="ring-border gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/** Esqueleto de las tablas del Inicio (top productos/clientes, bancos). */
export function EsqueletoTablaWidget() {
  return (
    <Card className="ring-border h-full gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((indice) => (
          <div key={indice} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
