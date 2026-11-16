import type { ReactNode } from "react";

import { cn } from "cn";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type TonoPill = "exito" | "pendiente" | "peligro" | "neutro" | "info";
export type Alineacion = "izquierda" | "derecha" | "centro";

export interface ColumnaLista<T> {
  clave: string;
  encabezado: ReactNode;
  celda: (fila: T) => ReactNode;
  /** Default "izquierda". Los montos van a la derecha. */
  alineacion?: Alineacion;
  /** Ancho y responsive: "w-24", "hidden lg:table-cell". */
  className?: string;
}

export interface VacioLista {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  /** Botón "Crear…" solo si el rol puede escribir. */
  accion?: ReactNode;
  /** true = búsqueda/filtro sin resultados: nunca muestra la acción. */
  filtrada?: boolean;
}

const ALINEACION: Record<Alineacion, string> = {
  izquierda: "text-left",
  derecha: "text-right tabular-nums",
  centro: "text-center",
};

const TONOS_PILL: Record<TonoPill, string> = {
  exito: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  peligro: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  neutro: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
};

export function TarjetaLista({
  children,
  className,
  "data-lista": dataLista,
}: {
  children: ReactNode;
  className?: string;
  /** Identificador para los e2e, p. ej. "facturas". */
  "data-lista"?: string;
}) {
  return (
    <div data-lista={dataLista} className={cn("bg-card border-border overflow-hidden rounded-2xl border", className)}>
      {children}
    </div>
  );
}

export function BarraLista({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-border flex h-12 items-center gap-2 border-b px-3", className)}>{children}</div>;
}

function ContenidoVacio({ titulo, descripcion, icono, accion, filtrada }: VacioLista) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {icono ? <div className="text-slate-300 dark:text-slate-600">{icono}</div> : null}
      <p className="text-lg font-semibold">{titulo}</p>
      {descripcion ? <p className="text-muted-foreground text-sm">{descripcion}</p> : null}
      {!filtrada && accion ? <div className="pt-3">{accion}</div> : null}
    </div>
  );
}

export function EstadoVacioLista(props: VacioLista) {
  return (
    <div className="bg-card border-border rounded-2xl border px-6 py-12">
      <ContenidoVacio {...props} />
    </div>
  );
}

function FilaLista<T>({
  fila,
  columnas,
  seleccion,
  acciones,
  compacta,
}: {
  fila: T;
  columnas: readonly ColumnaLista<T>[];
  seleccion?: { cabecera: ReactNode; celda: (fila: T) => ReactNode };
  acciones?: (fila: T) => ReactNode;
  compacta: boolean;
}) {
  return (
    <TableRow
      className={cn(
        compacta ? "h-10" : "h-12",
        "border-border border-b hover:bg-slate-200/45 dark:hover:bg-slate-800/40",
      )}
    >
      {seleccion ? <TableCell className={compacta ? "px-3" : "px-4"}>{seleccion.celda(fila)}</TableCell> : null}
      {columnas.map((columna) => (
        <TableCell
          key={columna.clave}
          className={cn(
            compacta ? "px-3 text-[13px]" : "px-4 text-sm",
            "whitespace-nowrap text-slate-700 dark:text-slate-300",
            ALINEACION[columna.alineacion ?? "izquierda"],
            columna.className,
          )}
        >
          {columna.celda(fila)}
        </TableCell>
      ))}
      {acciones ? (
        <TableCell className={cn(compacta ? "px-3" : "px-4", "text-center")}>{acciones(fila)}</TableCell>
      ) : null}
    </TableRow>
  );
}

export function TablaLista<T>({
  columnas,
  filas,
  claveFila,
  vacio,
  seleccion,
  acciones,
  pie,
  densidad = "normal",
  className,
}: {
  columnas: readonly ColumnaLista<T>[];
  filas: readonly T[];
  claveFila: (fila: T) => string;
  vacio: VacioLista;
  /** Checkbox ya renderizado (cabecera y celda). */
  seleccion?: { cabecera: ReactNode; celda: (fila: T) => ReactNode };
  /** Columna final de 88 px con las acciones de la fila. */
  acciones?: (fila: T) => ReactNode;
  /** Filas del TableFooter de totales; el componente no las inventa. */
  pie?: ReactNode;
  densidad?: "normal" | "compacta";
  className?: string;
}) {
  const compacta = densidad === "compacta";
  const colSpan = columnas.length + (seleccion ? 1 : 0) + (acciones ? 1 : 0);

  return (
    <Table className={cn("text-sm text-slate-700 dark:text-slate-300", className)}>
      <TableHeader>
        <TableRow className="border-border h-10 border-b bg-slate-200/20 hover:bg-slate-200/20 dark:bg-slate-800/40 dark:hover:bg-slate-800/40">
          {seleccion ? <TableHead className="w-12 px-4">{seleccion.cabecera}</TableHead> : null}
          {columnas.map((columna) => (
            <TableHead
              key={columna.clave}
              scope="col"
              className={cn(
                "px-4 text-xs font-medium text-slate-700 dark:text-slate-300",
                ALINEACION[columna.alineacion ?? "izquierda"],
                columna.className,
              )}
            >
              {columna.encabezado}
            </TableHead>
          ))}
          {acciones ? (
            <TableHead className="w-[88px] px-4 text-center">
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colSpan} className="py-12">
              <ContenidoVacio {...vacio} />
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <FilaLista
              key={claveFila(fila)}
              fila={fila}
              columnas={columnas}
              seleccion={seleccion}
              acciones={acciones}
              compacta={compacta}
            />
          ))
        )}
      </TableBody>
      {pie ? <TableFooter>{pie}</TableFooter> : null}
    </Table>
  );
}

export function PillEstado({ tono, children }: { tono: TonoPill; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-[9px] pt-1.5 pb-1 text-[11px] leading-[1.3]",
        TONOS_PILL[tono],
      )}
    >
      {children}
    </span>
  );
}
