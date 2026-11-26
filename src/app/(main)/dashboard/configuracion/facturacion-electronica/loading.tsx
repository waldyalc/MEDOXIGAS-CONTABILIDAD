import { ContenedorLista } from "@/components/listas/tabla-lista";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ContenedorLista className="gap-5">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {["ambiente", "emisor", "modalidad", "progreso"].map((id) => (
          <div key={id} className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-full" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </div>
        ))}
      </div>

      <div className="bg-card ring-foreground/10 grid overflow-hidden rounded-xl ring-1 lg:grid-cols-[330px_1fr]">
        <div className="border-b p-5 lg:border-r lg:border-b-0">
          <Skeleton className="h-5 w-52" />
          <div className="mt-5 flex flex-col gap-4">
            {["paso-1", "paso-2", "paso-3", "paso-4", "paso-5", "paso-6"].map((id) => (
              <div key={id} className="flex items-center gap-3">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-7 w-80 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-xl" />
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      </div>
    </ContenedorLista>
  );
}
