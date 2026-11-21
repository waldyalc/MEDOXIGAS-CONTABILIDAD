import { cn } from "cn";

import { Loader2 } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EsqueletoEncabezadoProps {
  titulo: string;
  descripcion?: string;
  acciones?: number;
  /** Ya no cambia el tamaño: el h1 de página es 20 px (EncabezadoPagina). Se conserva por compatibilidad. */
  grande?: boolean;
  className?: string;
}

export function EsqueletoEncabezado({ titulo, descripcion, acciones = 0, className }: EsqueletoEncabezadoProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion ? <p className="text-muted-foreground text-sm">{descripcion}</p> : null}
      </div>
      {acciones > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: acciones }, (_, indice) => (
            <Skeleton key={indice} className="h-9 w-36" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EsqueletoFiltros({ campos = 4 }: { campos?: number }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {Array.from({ length: campos }, (_, indice) => (
        <div key={indice} className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

interface EsqueletoTarjetasProps {
  cantidad?: number;
  className?: string;
}

export function EsqueletoTarjetas({ cantidad = 4, className }: EsqueletoTarjetasProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: cantidad }, (_, indice) => (
        <Card key={indice}>
          <CardContent className="flex flex-col gap-2 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface EsqueletoTablaProps {
  filas?: number;
  columnas?: number;
  className?: string;
}

export function EsqueletoTabla({ filas = 8, columnas = 6, className }: EsqueletoTablaProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border h-12 border-b bg-slate-200/20 hover:bg-slate-200/20 dark:bg-slate-800/40 dark:hover:bg-slate-800/40">
            {Array.from({ length: columnas }, (_, indice) => (
              <TableHead key={indice} className="h-12">
                <Skeleton className="h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: filas }, (_, fila) => (
            <TableRow key={fila} className="h-14">
              {Array.from({ length: columnas }, (_, columna) => (
                <TableCell key={columna}>
                  <Skeleton className={cn("h-4", columna === 0 ? "w-24" : "w-full max-w-32")} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function EsqueletoGrafico({ className, alto = 260 }: { className?: string; alto?: number }) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="w-full rounded-lg" style={{ height: alto }} />
      </CardContent>
    </Card>
  );
}

interface EsqueletoListaProps {
  titulo: string;
  descripcion?: string;
  grande?: boolean;
  acciones?: number;
  filtros?: number;
  tarjetas?: number;
  columnas?: number;
  filas?: number;
}

export function EsqueletoLista({
  titulo,
  descripcion,
  grande = false,
  acciones = 1,
  filtros = 0,
  tarjetas = 0,
  columnas = 6,
  filas = 8,
}: EsqueletoListaProps) {
  return (
    <div className="flex flex-col gap-6">
      <EsqueletoEncabezado titulo={titulo} descripcion={descripcion} acciones={acciones} grande={grande} />
      {filtros > 0 ? <EsqueletoFiltros campos={filtros} /> : null}
      {tarjetas > 0 ? <EsqueletoTarjetas cantidad={tarjetas} /> : null}
      <EsqueletoTabla filas={filas} columnas={columnas} />
    </div>
  );
}

interface EsqueletoReporteProps {
  titulo: string;
  descripcion?: string;
  filtros?: number;
  tarjetas?: number;
  grafico?: boolean;
  filas?: number;
}

export function EsqueletoReporte({
  titulo,
  descripcion,
  filtros = 4,
  tarjetas = 4,
  grafico = false,
  filas = 10,
}: EsqueletoReporteProps) {
  return (
    <div className="flex flex-col gap-6">
      <EsqueletoEncabezado titulo={titulo} descripcion={descripcion} acciones={2} />
      {filtros > 0 ? <EsqueletoFiltros campos={filtros} /> : null}
      {tarjetas > 0 ? <EsqueletoTarjetas cantidad={tarjetas} /> : null}
      {grafico ? <EsqueletoGrafico /> : null}
      <EsqueletoTabla filas={filas} columnas={6} />
    </div>
  );
}

export function EsqueletoDetalle({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-28" />
        <EsqueletoEncabezado titulo={titulo} acciones={3} />
      </div>
      <EsqueletoTarjetas cantidad={4} />
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          {Array.from({ length: 7 }, (_, indice) => (
            <Skeleton key={indice} className={cn("h-5", indice === 0 ? "w-48" : "w-full")} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface EsqueletoFormularioProps {
  titulo: string;
  campos?: number;
}

export function EsqueletoFormulario({ titulo, campos = 8 }: EsqueletoFormularioProps) {
  return (
    <div className="flex flex-col gap-6">
      <EsqueletoEncabezado titulo={titulo} acciones={2} />
      <Card className="max-w-[1040px]">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          {Array.from({ length: campos }, (_, indice) => (
            <div key={indice} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Skeleton className="h-40 w-full max-w-[1040px] rounded-xl" />
    </div>
  );
}

export function CargandoReportes() {
  return (
    <div className="flex flex-col gap-6">
      <EsqueletoEncabezado
        titulo="Reportes"
        descripcion="La contabilidad se genera sola a partir de las facturas, pagos y gastos. Elige un reporte para verlo o descargarlo."
        grande
      />
      <EsqueletoFiltros campos={2} />
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl bg-muted/40">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
        <p className="text-muted-foreground text-sm" role="status">
          Ya vienen tus reportes…
        </p>
      </div>
      <EsqueletoTarjetas cantidad={3} className="xl:grid-cols-3" />
      <EsqueletoTabla filas={6} columnas={5} />
    </div>
  );
}
