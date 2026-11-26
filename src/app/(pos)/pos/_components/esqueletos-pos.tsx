import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueletos de las cinco pantallas del POS (regla de Waldy, 24-11-2026): al
 * entrar a un módulo se ve de inmediato la forma de la pantalla en vez de un
 * lienzo vacío o un click que «se frisa». Cada uno espeja la maqueta real de
 * su pantalla para que no brinque cuando llegan los datos.
 */

function Tarjeta({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("bg-card border-border overflow-hidden rounded-2xl border", className)}>{children}</div>;
}

function Encabezado({ titulo, descripcion, acciones = 1 }: { titulo: string; descripcion: string; acciones?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm">{descripcion}</p>
      </div>
      {acciones > 0 ? <Skeleton className="h-10 w-40" /> : null}
    </div>
  );
}

/** Filas del listado maestro (ventas, devoluciones, pagos). */
function FilasMaestras({ cantidad = 7 }: { cantidad?: number }) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, fila) => (
        <div key={fila} className="border-border flex items-center justify-between gap-3 border-b px-3 py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Panel de detalle a la derecha del maestro-detalle. */
function DetalleEsqueleto() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Skeleton className="h-4 w-56" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }, (_, fila) => (
          <div key={fila} className="flex items-center justify-between gap-4 py-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="border-border mt-2 flex flex-col gap-2 border-t pt-4">
        {Array.from({ length: 4 }, (_, fila) => (
          <div key={fila} className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** /pos — la caja: catálogo a la izquierda, factura a la derecha. */
export function EsqueletoVenderPOS() {
  return (
    <div className="flex min-h-0 flex-1 bg-slate-100 dark:bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Buscador */}
        <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
          <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
          <Skeleton className="hidden h-10 w-36 rounded-lg sm:block" />
        </div>
        {/* Categorías */}
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          {Array.from({ length: 4 }, (_, chip) => (
            <Skeleton key={chip} className={cn("h-7 rounded-full", chip === 0 ? "w-32" : "w-20")} />
          ))}
        </div>
        {/* Rejilla de productos */}
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden px-3 pb-3 sm:grid-cols-3 sm:px-4 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, tarjeta) => (
            <div key={tarjeta} className="bg-card border-border flex flex-col rounded-xl border p-3">
              <Skeleton className="mb-3 aspect-square w-full rounded-lg" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="mt-1.5 h-3.5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
      {/* Panel de factura */}
      <div className="border-border bg-card hidden w-[380px] shrink-0 flex-col border-l sm:flex lg:w-[420px]">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 py-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="px-4 pb-3">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <div className="border-border flex flex-col gap-2 border-t p-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** /pos/historial y /pos/devoluciones — maestro-detalle con filtros. */
export function EsqueletoListaDetallePOS({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[1289px] flex-col gap-4 p-4 md:p-6">
      <Encabezado titulo={titulo} descripcion={descripcion} />
      <Tarjeta className="flex flex-col">
        {/* Filtros */}
        <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Skeleton className="h-9 w-full sm:max-w-sm" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="hidden lg:flex">
          <div className="border-border w-[340px] shrink-0 border-r">
            <FilasMaestras />
            <div className="flex items-center justify-between px-3 py-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          </div>
          <DetalleEsqueleto />
        </div>
        <div className="lg:hidden">
          <FilasMaestras />
        </div>
      </Tarjeta>
    </div>
  );
}

/** /pos/turnos — lista de cierres a la izquierda, resumen del turno a la derecha. */
export function EsqueletoTurnosPOS() {
  return (
    <div className="mx-auto flex w-full max-w-[1289px] flex-col gap-4 p-4 md:p-6">
      <Encabezado titulo="Turnos" descripcion="Abre, opera y cierra la caja de esta terminal." acciones={0} />
      <Tarjeta className="lg:flex">
        <div className="border-border w-full shrink-0 lg:w-[330px] lg:border-r">
          <div className="border-border border-b px-3 py-2">
            <Skeleton className="h-9 w-full" />
          </div>
          {Array.from({ length: 6 }, (_, fila) => (
            <div key={fila} className="border-border flex items-center justify-between border-b px-3 py-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 9 }, (_, fila) => (
              <div key={fila} className="flex items-center justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 3 }, (_, fila) => (
              <div key={fila} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

/** /pos/pagos — pestañas Ingresos/Egresos, buscador y maestro-detalle. */
export function EsqueletoPagosPOS() {
  return (
    <div className="mx-auto flex w-full max-w-[1289px] flex-col gap-4 p-4 md:p-6">
      <Encabezado titulo="Pagos" descripcion="Entradas y salidas de efectivo de los turnos de esta terminal." />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Tarjeta>
        <div className="border-border border-b px-3 py-2">
          <Skeleton className="h-9 w-full sm:max-w-sm" />
        </div>
        <div className="grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:divide-x lg:divide-border">
          <div>
            {Array.from({ length: 5 }, (_, fila) => (
              <div key={fila} className="border-border flex items-center justify-between border-b px-3 py-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
          <div className="hidden flex-col items-center justify-center gap-3 py-16 lg:flex">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-32" />
        </div>
      </Tarjeta>
    </div>
  );
}
