import { EsqueletoEncabezado, EsqueletoTarjetas } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoEncabezado
        titulo="Nómina"
        descripcion="Empleados, periodos y aportes de ley en un solo lugar."
        acciones={2}
      />
      <EsqueletoTarjetas cantidad={4} />
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-7">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-40" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4 xl:col-span-5">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </ContenedorLista>
  );
}
