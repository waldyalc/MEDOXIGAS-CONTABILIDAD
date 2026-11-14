import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function EsqueletoFilaCartera() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function EsqueletoCartera() {
  return (
    <>
      {[0, 1].map((indice) => (
        <Card key={indice}>
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <EsqueletoFilaCartera />
            <EsqueletoFilaCartera />
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
        <Card key={indice} size="sm" className="h-full justify-center">
          <CardHeader className="gap-1">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-24" />
          </CardHeader>
        </Card>
      ))}
    </>
  );
}

export function EsqueletoGraficoInicio() {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <Skeleton className="h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
