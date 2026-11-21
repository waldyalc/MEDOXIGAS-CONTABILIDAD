import { EsqueletoEncabezado, EsqueletoTabla } from "@/components/carga/esqueletos";
import { ContenedorLista } from "@/components/listas/tabla-lista";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ContenedorLista>
      <EsqueletoEncabezado titulo="Empleados" descripcion="Personas que reciben nómina en la empresa." acciones={1} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="border-border flex h-14 items-center gap-2 border-b px-4">
          <Skeleton className="h-8 w-[267px]" />
          <Skeleton className="h-8 w-[180px]" />
          <Skeleton className="h-8 w-[180px]" />
        </div>
        <EsqueletoTabla filas={8} columnas={7} className="rounded-none ring-0" />
      </div>
    </ContenedorLista>
  );
}
