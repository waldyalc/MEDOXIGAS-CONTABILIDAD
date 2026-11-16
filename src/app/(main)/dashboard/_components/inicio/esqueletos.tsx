import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function EsqueletoDetalleCartera() {
  return (
    <div className="border-muted flex flex-col gap-1 border-l-[3px] pl-3">
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
        <Card
          key={indice}
          className="justify-between gap-0 rounded-[10px] py-5 ring-[#e2e8f0] sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:self-start dark:ring-border"
        >
          <CardHeader className="gap-1.5 px-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-36" />
          </CardHeader>
          <CardContent className="mt-5 flex flex-col gap-3.5 px-5">
            <Skeleton className="h-2 w-full rounded-full" />
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
        <Card key={indice} className="h-full gap-0 justify-start rounded-[10px] py-5 ring-[#e2e8f0] dark:ring-border">
          <CardHeader className="gap-1 px-5">
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
    <Card className="gap-4 rounded-[10px] py-5 ring-[#e2e8f0] dark:ring-border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 px-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3.5 w-10" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-0">
        <Skeleton className="h-[260px] w-full rounded-lg" />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}
