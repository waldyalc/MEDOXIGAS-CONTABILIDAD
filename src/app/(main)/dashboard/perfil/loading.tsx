import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ContenedorDetalle className="gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-44" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card className="xl:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="grid gap-4 border-t pt-5 sm:grid-cols-3">
              {["metodo", "creada", "acceso"].map((dato) => (
                <div key={dato} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>

        {["seguridad", "apariencia"].map((tarjeta) => (
          <Card key={tarjeta}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(tarjeta === "seguridad" ? ["actual", "nueva", "confirmar", "boton"] : ["tema", "sesion", "todas"]).map(
                (campo) => (
                  <Skeleton key={campo} className="h-9 w-full" />
                ),
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ContenedorDetalle>
  );
}
